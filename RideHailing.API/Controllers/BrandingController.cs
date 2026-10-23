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
        => await ReadAppIconAsync("app_icon");

    [HttpGet("app-icon/{appType}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetAppIcon(string appType)
    {
        var assetKey = GetAssetKey(appType);
        if (assetKey == null) return BadRequest(new { message = "App type must be customer or driver." });
        return await ReadAppIconAsync(assetKey);
    }

    [HttpPut("app-icon")]
    [Authorize(Roles = "admin")]
    [RequestSizeLimit(MaxRequestSizeBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxRequestSizeBytes)]
    public async Task<IActionResult> UploadLegacyAppIcon([FromForm] IFormFile? file)
        => await UploadIconAsync("app_icon", file);

    [HttpPut("app-icon/{appType}")]
    [Authorize(Roles = "admin")]
    [RequestSizeLimit(MaxRequestSizeBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxRequestSizeBytes)]
    public async Task<IActionResult> UploadAppIcon(string appType, [FromForm] IFormFile? file)
    {
        var assetKey = GetAssetKey(appType);
        if (assetKey == null) return BadRequest(new { message = "App type must be customer or driver." });
        return await UploadIconAsync(assetKey, file);
    }

    private async Task<IActionResult> ReadAppIconAsync(string assetKey)
    {
        var asset = await brandingRepository.GetAppIconAsync(assetKey);
        if (asset == null) return NotFound(new { message = "No custom app icon has been uploaded." });

        Response.Headers.CacheControl = "no-cache";
        return File(asset.Content, asset.ContentType);
    }

    private async Task<IActionResult> UploadIconAsync(string assetKey, IFormFile? file)
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

        await brandingRepository.SaveAppIconAsync(assetKey, content, "image/png", adminId);
        return NoContent();
    }

    private static string? GetAssetKey(string appType) => appType.ToLowerInvariant() switch
    {
        "customer" => "customer_app_icon",
        "driver" => "driver_app_icon",
        _ => null
    };
}
