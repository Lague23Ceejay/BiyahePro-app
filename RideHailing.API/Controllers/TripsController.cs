// ============================================================
// Controllers/TripsController.cs — Booking Transaction API
// Handles price calculations, reservations, and state updates
// ============================================================
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RideHailing.API.Models;
using RideHailing.API.Services;

namespace RideHailing.API.Controllers;

[ApiController]
[Route("api/trips")]
[Authorize]
public class TripsController(ITripService tripService, IFareService fareService) : ControllerBase
{
    private Guid CurrentUserId => Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
    private string CurrentRole  => User.FindFirst(ClaimTypes.Role)!.Value;

    // POST: api/trips/estimate (Public route to calculate a price snapshot)
    [HttpPost("estimate")]
    [AllowAnonymous]
    public async Task<IActionResult> Estimate([FromBody] FareEstimateRequest req)
        => Ok(await fareService.EstimateAsync(req));

    // POST: api/trips (Passengers use this to book an open trip)
    [HttpPost]
    [Authorize(Roles = "customer")]
    public async Task<IActionResult> Book([FromBody] BookTripRequest req)
    {
        var trip = await tripService.BookAsync(CurrentUserId, req);
        if (trip == null) return BadRequest(new { message = "Unable to process booking request." });
        return Ok(trip);
    }

    // POST: api/trips/{id}/accept (Drivers use this to claim a booking)
    [HttpPost("{id:guid}/accept")]
    [Authorize(Roles = "driver")]
    public async Task<IActionResult> Accept(Guid id)
    {
        var trip = await tripService.AcceptAsync(id, CurrentUserId);
        if (trip == null) return BadRequest(new { message = "Trip is no longer available to accept." });
        return Ok(trip);
    }

    // PATCH: api/trips/{id}/status (Drivers step through states: en_route, arrived, in_progress, completed)
    [HttpPatch("{id:guid}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] TripStatusUpdate req)
    {
        var trip = await tripService.UpdateStatusAsync(id, CurrentUserId, req.Status);
        if (trip == null) return BadRequest(new { message = "Invalid transaction transition state request." });
        return Ok(trip);
    }

    // POST: api/trips/{id}/cancel (Terminates booking and handles windows cancellation fees)
    [HttpPost("{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid id, [FromBody] CancelTripRequest req)
    {
        var trip = await tripService.CancelAsync(id, CurrentUserId, CurrentRole, req.Reason);
        if (trip == null) return BadRequest(new { message = "Cannot cancel this transaction in its current state." });
        return Ok(trip);
    }

    

    // POST: api/trips/{id}/rate (Either side rates the other once a trip is completed)
    [HttpPost("{id:guid}/rate")]
    public async Task<IActionResult> Rate(Guid id, [FromBody] RateTripRequest req)
    {
        var result = await tripService.RateTripAsync(id, CurrentUserId, CurrentRole, req.Score, req.Comment);
        if (!result.Success) return BadRequest(new { message = result.Error });
        return Ok(new { message = "Rating submitted." });
    }

    // GET: api/trips/history (Fetches paginated historic logs for customers/drivers)
    [HttpGet("history")]
    public async Task<IActionResult> History(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var result = await tripService.GetTripHistoryAsync(CurrentUserId, CurrentRole, page, pageSize);
        return Ok(result);
    }
}
