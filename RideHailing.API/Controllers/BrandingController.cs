using System.Buffers.Binary;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RideHailing.API.Repositories;

namespace RideHailing.API.Controllers;

[ApiController]
[Route("api/branding")]
public class BrandingController(IBrandingRepository brandingRepository) : ControllerBase
{
    private const int MaxIconSizeBytes = 2 * 1024 * 1024;
    private const int MaxRequestSizeBytes = MaxIconSizeBytes + 128 * 1024;
    private static readonly byte[] PngSignature = [137, 80, 78, 71, 13, 10, 26, 10];

    [HttpGet("app-icon")]
    [AllowAnonymous]
    public async Task<IActionResult> GetAppIcon()
    {
        var asset = await brandingRepository.GetAppIconAsync();
        if (asset == null) return NotFound(new { message = "No custom app icon has been uploaded." });

        Response.Headers.CacheControl = "no-cache";
        return File(asset.Content, asset.ContentType);
    }

    [HttpPut("app-icon")]
    [Authorize(Roles = "admin")]
    [RequestSizeLimit(MaxRequestSizeBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxRequestSizeBytes)]
    public async Task<IActionResult> UploadAppIcon([FromForm] IFormFile? file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "Choose a PNG image to upload." });
        if (file.Length > MaxIconSizeBytes)
            return BadRequest(new { message = "The app icon must be 2 MB or smaller." });

        await using var stream = new MemoryStream();
        await file.CopyToAsync(stream);
        var content = stream.ToArray();
        if (content.Length < 24 || !content.AsSpan(0, PngSignature.Length).SequenceEqual(PngSignature) ||
            !content.AsSpan(12, 4).SequenceEqual("IHDR"u8))
            return BadRequest(new { message = "The uploaded file is not a valid PNG image." });

        var width = BinaryPrimitives.ReadInt32BigEndian(content.AsSpan(16, 4));
        var height = BinaryPrimitives.ReadInt32BigEndian(content.AsSpan(20, 4));
        if (width != height || width < 512 || width > 2048)
            return BadRequest(new { message = "Use a square PNG between 512 × 512 and 2048 × 2048 pixels." });

        var claimId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(claimId, out var adminId)) return Unauthorized();

        await brandingRepository.SaveAppIconAsync(content, "image/png", adminId);
        return NoContent();
    }
}
