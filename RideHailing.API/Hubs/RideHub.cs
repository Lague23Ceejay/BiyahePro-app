// ============================================================
// Hubs/RideHub.cs — SignalR real-time network layer
// Handles live connections, trip updates, and location vectors.
// ============================================================
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using RideHailing.API.Repositories;

namespace RideHailing.API.Hubs;

[Authorize]
public class RideHub(IDriverRepository driverRepo) : Hub
{
    // Automatically runs when a phone or application connects to the network
    public override async Task OnConnectedAsync()
    {
        var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var role   = Context.User?.FindFirst(ClaimTypes.Role)?.Value;

        if (userId != null)
        {
            // Give every user an isolated private room for personal booking status pings
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{userId}");

            // Only online drivers receive new ride broadcasts.
            if (role == "driver" && Guid.TryParse(userId, out var parsedUserId))
            {
                var driver = await driverRepo.GetByUserIdAsync(parsedUserId);
                if (driver?.Status == "available")
                    await Groups.AddToGroupAsync(Context.ConnectionId, "available_drivers");
            }
        }

        await base.OnConnectedAsync();
    }

    // Driver app invokes this every few seconds to broadcast their moving map coordinates
    public async Task UpdateDriverLocation(Guid tripId, double latitude, double longitude)
    {
        var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userId == null) return;

        var driver = await driverRepo.GetByUserIdAsync(Guid.Parse(userId));
        if (driver == null) return;

        // Persist the precise coordinate location into the PostGIS column
        await driverRepo.UpdateLocationAsync(driver.Id, latitude, longitude);

        // Stream the position live to the passenger device tracking this specific trip room
        await Clients.Group($"trip_{tripId}").SendAsync("DriverLocationUpdated", new
        {
            Latitude  = latitude,
            Longitude = longitude,
            DriverId  = driver.Id
        });
    }

    // Connects a customer phone screen to an active live tracking room session
    public async Task JoinTripRoom(Guid tripId)
        => await Groups.AddToGroupAsync(Context.ConnectionId, $"trip_{tripId}");

    // Disconnects a tracking map screen once the ride terminates
    public async Task LeaveTripRoom(Guid tripId)
        => await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"trip_{tripId}");

    // Controls driver global network status changes
    public async Task SetAvailability(bool available)
    {
        var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userId == null) return;

        var driver = await driverRepo.GetByUserIdAsync(Guid.Parse(userId));
        if (driver == null) return;

        var newStatus = available ? "available" : "offline";
        await driverRepo.UpdateStatusAsync(driver.Id, newStatus);

        if (available)
            await Groups.AddToGroupAsync(Context.ConnectionId, "available_drivers");
        else
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, "available_drivers");
    }
}
