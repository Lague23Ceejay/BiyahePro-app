// ============================================================
// Controllers/SettingsController.cs — System Settings API
// Connected directly to Phase 1 app_settings table using Dapper
// ============================================================
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RideHailing.API.Models;
using RideHailing.API.Repositories;
using RideHailing.API.Services;

namespace RideHailing.API.Controllers;

[ApiController]
[Route("api/settings")]
[Authorize(Roles = "admin")]
public class SettingsController(ISettingsRepository settingsRepo, ISettingsService settingsService) : ControllerBase
{
    // Public settings (Fares, Surge switches) — React frontend reads this.
    // The only endpoint on this controller that non-admins (or the unauthenticated
    // mobile app) are allowed to hit.
    [HttpGet("public")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPublic()
    {
        var all = await settingsRepo.GetByCategoryAsync(null);
        // Returns the values where is_public is true
        return Ok(all.Where(s => s.IsPublic));
    }

    // Fetch all settings — Restricted to system administrators
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? category)
    {
        var all = await settingsRepo.GetByCategoryAsync(category);
        return Ok(all);
    }

    [HttpGet("audit")]
    public async Task<IActionResult> GetAudit([FromQuery] int limit = 100)
        => Ok(await settingsRepo.GetAuditLogsAsync(limit));

    // Update an individual configuration value and write to admin audit log
    [HttpPatch("{key}")]
    public async Task<IActionResult> Update(string key, [FromBody] UpdateSettingRequest req)
    {
        // Real admin id, taken from the authenticated JWT — no more mock id.
        var claimId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (claimId == null || !Guid.TryParse(claimId, out var adminId))
            return Unauthorized();

        await settingsRepo.UpdateAsync(key, req.Value, adminId);
        await settingsService.InvalidateCacheAsync();
        return NoContent();
    }
}