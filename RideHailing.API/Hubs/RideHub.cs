// ============================================================
// Hubs/RideHub.cs — SignalR real-time network layer
// Handles live connections, trip updates, and location vectors.
// ============================================================
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using RideHailing.API.Models;
using RideHailing.API.Repositories;

namespace RideHailing.API.Hubs;

[Authorize]
public class RideHub(IDriverRepository driverRepo, ITripRepository tripRepo) : Hub
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

    // Trip states during which a driver's live position is meaningful to the
    // customer: from acceptance until the ride ends.
    private static readonly HashSet<string> TrackableStatuses =
        ["accepted", "en_route", "arrived", "in_progress"];

    // Driver app invokes this every few seconds while a trip is active to
    // broadcast their moving map coordinates.
    public async Task UpdateDriverLocation(Guid tripId, double latitude, double longitude)
    {
        var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userId == null || !Guid.TryParse(userId, out var parsedUserId)) return;

        // Reject out-of-range coordinates rather than broadcasting garbage.
        if (latitude is < -90 or > 90 || longitude is < -180 or > 180) return;

        var driver = await driverRepo.GetByUserIdAsync(parsedUserId);
        if (driver == null) return;

        // Only the driver actually assigned to this trip may broadcast into its
        // room. Without this check any logged-in driver could push positions
        // into any other trip's room just by knowing its id.
        var trip = await tripRepo.GetByIdAsync(tripId);
        if (trip == null || trip.DriverId != driver.Id || !TrackableStatuses.Contains(trip.Status)) return;

        // Persist the precise coordinate location into the PostGIS column
        await driverRepo.UpdateLocationAsync(driver.Id, latitude, longitude);

        // Stream the position live to the passenger device tracking this specific trip room
        await Clients.Group($"trip_{tripId}").SendAsync("DriverLocationUpdated", new
        {
            TripId    = tripId,
            Latitude  = latitude,
            Longitude = longitude,
            DriverId  = driver.Id
        });
    }

    // Connects a customer phone screen to an active live tracking room session.
    // Only the trip's customer or its assigned driver may join. On join, the
    // caller immediately receives the driver's last known position so the map
    // isn't empty until the next GPS ping arrives.
    public async Task JoinTripRoom(Guid tripId)
    {
        var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userId == null || !Guid.TryParse(userId, out var parsedUserId)) return;

        var trip = await tripRepo.GetByIdAsync(tripId);
        if (trip == null) return;

        Driver? assignedDriver = null;
        if (trip.DriverId != null)
        {
            var callerDriver = await driverRepo.GetByUserIdAsync(parsedUserId);
            if (callerDriver != null && callerDriver.Id == trip.DriverId) assignedDriver = callerDriver;
        }

        var isCustomer = trip.CustomerId == parsedUserId;
        if (!isCustomer && assignedDriver == null) return;

        await Groups.AddToGroupAsync(Context.ConnectionId, $"trip_{tripId}");

        if (isCustomer && trip.DriverId != null && TrackableStatuses.Contains(trip.Status))
        {
            var driver = await driverRepo.GetByIdAsync(trip.DriverId.Value);
            if (driver?.Latitude != null && driver.Longitude != null)
            {
                await Clients.Caller.SendAsync("DriverLocationUpdated", new
                {
                    TripId    = tripId,
                    Latitude  = driver.Latitude.Value,
                    Longitude = driver.Longitude.Value,
                    DriverId  = driver.Id
                });
            }
        }
    }

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
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, "available_drivers");
        }
        else
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, "available_drivers");
        }
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        await base.OnDisconnectedAsync(exception);
    }
}