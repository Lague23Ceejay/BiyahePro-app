// File path in project: RideHailing.API/Controllers/DriversController.cs
// ============================================================
// Controllers/DriversController.cs — Fleet Tracking API
// Allows drivers to view profiles and admins to track statuses
// ============================================================
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using RideHailing.API.Models;
using RideHailing.API.Services;

namespace RideHailing.API.Controllers;

[ApiController]
[Route("api/drivers")]
[Authorize]
public class DriversController(IDriverService driverService, ITripService tripService) : ControllerBase
{
    // GET: api/drivers/me (Allows an authenticated driver to view their metrics)
    [HttpGet("me")]
    [Authorize(Roles = "driver")]
    public async Task<IActionResult> GetMyProfile()
    {
        var claimId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (claimId == null) return Unauthorized();

        var userId = Guid.Parse(claimId);
        var driver = await driverService.GetProfileAsync(userId);
        if (driver == null) return NotFound(new { message = "Driver profile card not found." });
        
        return Ok(driver);
    }

    [HttpPut("me/profile")]
    [Authorize(Roles = "driver")]
    public async Task<IActionResult> CompleteProfile([FromBody] CompleteDriverProfileRequest request)
    {
        var claimId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (claimId == null || !Guid.TryParse(claimId, out var userId)) return Unauthorized();

        try
        {
            var driver = await driverService.CompleteProfileAsync(userId, request);
            return driver == null ? BadRequest(new { message = "Invalid driver profile details." }) : Ok(driver);
        }
        catch (Npgsql.PostgresException ex) when (ex.SqlState == Npgsql.PostgresErrorCodes.UniqueViolation)
        {
            return Conflict(new { message = "License number or plate number is already registered." });
        }
    }

    // PATCH: api/drivers/me/status (Online/offline toggle — the switch on the driver home screen)
    [HttpPatch("me/status")]
    [Authorize(Roles = "driver")]
    public async Task<IActionResult> SetMyStatus([FromBody] SetAvailabilityRequest req)
    {
        var claimId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (claimId == null) return Unauthorized();

        var success = await driverService.SetAvailabilityAsync(Guid.Parse(claimId), req.Available);
        if (!success) return BadRequest(new { message = "Unable to change availability — driver not found, suspended, or banned." });
        return NoContent();
    }

    // PATCH: api/drivers/me/location (Periodic ping from the driver app so nearby-request/nearby-driver lookups stay current)
    [HttpPatch("me/location")]
    [Authorize(Roles = "driver")]
    public async Task<IActionResult> UpdateMyLocation([FromBody] UpdateLocationRequest req)
    {
        var claimId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (claimId == null) return Unauthorized();

        var success = await driverService.UpdateLocationAsync(Guid.Parse(claimId), req.Latitude, req.Longitude);
        if (!success) return NotFound(new { message = "Driver profile not found." });
        return NoContent();
    }

    // GET: api/drivers/me/requests (Incoming ride requests — pending trips near the driver, matching their vehicle type)
    [HttpGet("me/requests")]
    [Authorize(Roles = "driver")]
    public async Task<IActionResult> GetMyRequests()
    {
        var claimId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (claimId == null) return Unauthorized();

        var requests = await tripService.GetPendingRequestsForDriverAsync(Guid.Parse(claimId));
        return Ok(requests);
    }

    // GET: api/drivers/me/earnings (Earnings screen — totals, this week's breakdown, recent daily summaries)
    [HttpGet("me/earnings")]
    [Authorize(Roles = "driver")]
    public async Task<IActionResult> GetMyEarnings()
    {
        var claimId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (claimId == null) return Unauthorized();

        var earnings = await driverService.GetEarningsAsync(Guid.Parse(claimId));
        if (earnings == null) return NotFound(new { message = "Driver profile not found." });
        return Ok(earnings);
    }

    // GET: api/drivers (Admin-only panel to review the entire fleet status)
    [HttpGet]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var result = await driverService.GetAllAsync(status, page, pageSize);
        return Ok(result);
    }

    // ── Driver Performance Index / Three-Strike Policy (BP §VI, §IX) ──

    // POST: api/drivers/{id}/strikes — issue a strike against a driver.
    // Strike 1 = formal warning, 2 = 7-day suspension, 3 = permanent ban.
    // The consequence is applied automatically based on the driver's
    // resulting strike count (see DriverRepository.AddStrikeAsync).
    [HttpPost("{id}/strikes")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> IssueStrike(Guid id, [FromBody] IssueStrikeRequest req)
    {
        var claimId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (claimId == null || !Guid.TryParse(claimId, out var adminId)) return Unauthorized();

        var strike = await driverService.IssueStrikeAsync(id, adminId, req.Reason);
        if (strike == null)
            return NotFound(new { message = "Driver not found, or driver is already permanently banned." });

        return Ok(strike);
    }

    // GET: api/drivers/{id}/strikes — full strike history for a driver
    [HttpGet("{id}/strikes")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> GetStrikes(Guid id)
    {
        var strikes = await driverService.GetStrikesAsync(id);
        return Ok(strikes);
    }

    // POST: api/drivers/{id}/suspend — manual suspension outside the strike flow
    [HttpPost("{id}/suspend")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Suspend(Guid id)
    {
        var claimId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (claimId == null || !Guid.TryParse(claimId, out var adminId)) return Unauthorized();

        var success = await driverService.SuspendAsync(id, adminId);
        return success ? NoContent() : NotFound(new { message = "Driver not found." });
    }

    // POST: api/drivers/{id}/reinstate — manually lift a suspension early
    [HttpPost("{id}/reinstate")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Reinstate(Guid id)
    {
        var claimId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (claimId == null || !Guid.TryParse(claimId, out var adminId)) return Unauthorized();

        var success = await driverService.ReinstateAsync(id, adminId);
        return success ? NoContent() : NotFound(new { message = "Driver not found, or driver is not currently suspended." });
    }
}