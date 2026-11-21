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
    private const int MaxWebsiteImageSizeBytes = 5 * 1024 * 1024;
    private const int MaxWebsiteImageRequestSizeBytes = MaxWebsiteImageSizeBytes + 128 * 1024;
    private static readonly byte[] PngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
    private static readonly HashSet<string> WebsiteImageAssetKeys = ["website-hero", "website-about", "website-download-qr", "service-card-motorcycle", "service-card-motorcab"];

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

    [HttpHead("website-image/{assetKey}")]
    [AllowAnonymous]
    public async Task<IActionResult> HasWebsiteImage(string assetKey)
    {
        if (!IsWebsiteImageAssetKey(assetKey)) return NotFound();
        return await brandingRepository.WebsiteImageExistsAsync(assetKey) ? NoContent() : NotFound();
    }

    [HttpGet("website-image/{assetKey}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetWebsiteImage(string assetKey)
    {
        if (!IsWebsiteImageAssetKey(assetKey)) return NotFound();
        var asset = await brandingRepository.GetWebsiteImageAsync(assetKey);
        if (asset == null) return NotFound();

        Response.Headers.CacheControl = "no-cache";
        Response.Headers.XContentTypeOptions = "nosniff";
        return File(asset.Content, asset.ContentType);
    }

    [HttpPut("website-image/{assetKey}")]
    [Authorize(Roles = "admin")]
    [RequestSizeLimit(MaxWebsiteImageRequestSizeBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxWebsiteImageRequestSizeBytes)]
    public async Task<IActionResult> UploadWebsiteImage(string assetKey, [FromForm] IFormFile? file)
    {
        if (!IsWebsiteImageAssetKey(assetKey)) return NotFound();
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "Choose an image to upload." });
        if (file.Length > MaxWebsiteImageSizeBytes)
            return BadRequest(new { message = "Website images must be 5 MB or smaller." });

        await using var stream = new MemoryStream();
        await file.CopyToAsync(stream);
        var content = stream.ToArray();
        var contentType = GetWebsiteImageContentType(content);
        if (contentType == null)
            return BadRequest(new { message = "Use a PNG, JPEG, or WebP image. SVG files are not supported." });

        var claimId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(claimId, out var adminId)) return Unauthorized();

        await brandingRepository.SaveWebsiteImageAsync(assetKey, content, contentType, adminId);
        return NoContent();
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

    private static bool IsWebsiteImageAssetKey(string assetKey)
    {
        if (WebsiteImageAssetKeys.Contains(assetKey)) return true;
        const string serviceCardPrefix = "service-card-";
        if (!assetKey.StartsWith(serviceCardPrefix, StringComparison.Ordinal)) return false;
        var serviceCardKey = assetKey[serviceCardPrefix.Length..];
        return Guid.TryParseExact(serviceCardKey, "D", out _) ||
            (serviceCardKey.StartsWith("legacy-", StringComparison.Ordinal) &&
             int.TryParse(serviceCardKey["legacy-".Length..], out var index) && index >= 0);
    }

    private static string? GetWebsiteImageContentType(ReadOnlySpan<byte> content)
    {
        if (content.Length >= 24 &&
            content[..PngSignature.Length].SequenceEqual(PngSignature) &&
            content.Slice(12, 4).SequenceEqual("IHDR"u8))
            return "image/png";
        if (content.Length >= 3 && content[0] == 0xFF && content[1] == 0xD8 && content[2] == 0xFF)
            return "image/jpeg";
        if (content.Length >= 12 &&
            content[..4].SequenceEqual("RIFF"u8) &&
            content.Slice(8, 4).SequenceEqual("WEBP"u8))
            return "image/webp";
        return null;
    }
}
