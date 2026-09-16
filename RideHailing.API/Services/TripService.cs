// File path in project: RideHailing.API/Services/TripService.cs
// File path in project: RideHailing.API/Services/TripService.cs
using Microsoft.AspNetCore.SignalR;
using RideHailing.API.Hubs;
using RideHailing.API.Models;
using RideHailing.API.Repositories;

namespace RideHailing.API.Services;

public interface ITripService
{
    Task<Trip?> BookAsync(Guid customerId, BookTripRequest request);
    Task<Trip?> AcceptAsync(Guid tripId, Guid driverId);
    Task<Trip?> UpdateStatusAsync(Guid tripId, Guid actorId, string newStatus);
    Task<Trip?> CancelAsync(Guid tripId, Guid actorId, string role, string reason);
    Task<PagedResult<Trip>> GetTripHistoryAsync(Guid userId, string role, int page, int pageSize);
    Task<RatingResult> RateTripAsync(Guid tripId, Guid actorId, string role, int score, string? comment);
    Task<List<NearbyDriverResponse>> GetNearbyDriversAsync(double lat, double lng);
    Task<List<PendingTripResponse>> GetPendingRequestsForDriverAsync(Guid driverUserId);
    
    Task ActivateDueScheduledTripsAsync();
}

public class TripService(
    ITripRepository tripRepo,
    IDriverRepository driverRepo,
    IFareService fareService,
    ISettingsService settings,
    IHubContext<RideHub> hub) : ITripService
{
    private static readonly Dictionary<string, string[]> AllowedTransitions = new()
    {
        ["requested"]   = ["accepted", "cancelled"],
        ["accepted"]    = ["en_route", "cancelled"],
        ["en_route"]    = ["arrived"],
        ["arrived"]     = ["in_progress"],
        ["in_progress"] = ["completed"],
        ["completed"]   = [],
        ["cancelled"]   = []
    };

    public async Task<Trip?> BookAsync(Guid customerId, BookTripRequest req)
    {
        if (req.VehicleType != "motorcycle" && req.VehicleType != "motorcab") return null;

        if (req.ScheduledFor.HasValue)
        {
            var featureEnabled = await settings.GetBoolAsync(SettingKeys.FeatureScheduled, false);
            if (!featureEnabled) return null;

            var minLeadMinutes = await settings.GetIntAsync(SettingKeys.OpsScheduledMinLeadMins, 30);
            if (req.ScheduledFor.Value < DateTime.UtcNow.AddMinutes(minLeadMinutes)) return null;
        }

        var estimate = await fareService.EstimateAsync(new FareEstimateRequest(
            req.PickupLatitude, req.PickupLongitude,
            req.DropoffLatitude, req.DropoffLongitude));

        var trip = new Trip
        {
            CustomerId       = customerId,
            PickupLatitude   = req.PickupLatitude,
            PickupLongitude  = req.PickupLongitude,
            DropoffLatitude  = req.DropoffLatitude,
            DropoffLongitude = req.DropoffLongitude,
            PickupAddress    = req.PickupAddress,
            DropoffAddress   = req.DropoffAddress,
            PaymentMethod    = req.PaymentMethod,
            BaseFare         = estimate.BaseFare,
            DistanceFare     = estimate.EstimatedDistanceFare,
            SurgeMultiplier  = estimate.SurgeMultiplier,
            BookingFee       = estimate.BookingFee,
            FareAmount       = estimate.EstimatedTotal,
            // A scheduled trip sits in 'scheduled' (no dispatch) until its
            // time arrives; an immediate booking goes straight to
            // 'requested' as before. See ActivateDueScheduledTripsAsync.
            Status           = req.ScheduledFor.HasValue ? "scheduled" : "requested",
            ScheduledFor     = req.ScheduledFor,
            VehicleType      = req.VehicleType,
            RequestedAt      = DateTime.UtcNow
        };

        var created = await tripRepo.CreateAsync(trip);

        // Only dispatch to drivers immediately for non-scheduled bookings —
        // a scheduled trip gets notified later once it's activated.
        if (!req.ScheduledFor.HasValue)
            await NotifyDriversOfNewTripAsync(created);

        return created;
    }

    // Extracted from BookAsync so both an immediate booking and a scheduled
    // trip becoming due (see ActivateDueScheduledTripsAsync) notify drivers
    // through the exact same path.
    private async Task NotifyDriversOfNewTripAsync(Trip trip)
    {
        await hub.Clients.Group("available_drivers").SendAsync("NewTripRequest", new
        {
            TripId           = trip.Id,
            PickupAddress    = trip.PickupAddress,
            DropoffAddress   = trip.DropoffAddress,
            PickupLatitude   = trip.PickupLatitude,
            PickupLongitude  = trip.PickupLongitude,
            FareAmount       = trip.FareAmount,
            PaymentMethod    = trip.PaymentMethod,
            VehicleType      = trip.VehicleType
        });
    }

    // ── Scheduled rides (BP §III) ──────────────────────────────
    // Called every 30s by ScheduledTripActivationService. Flips any due
    // 'scheduled' trips to 'requested' and dispatches them to drivers
    // exactly like a fresh immediate booking.
    public async Task ActivateDueScheduledTripsAsync()
    {
        var dueTrips = await tripRepo.GetDueScheduledTripsAsync();
        foreach (var trip in dueTrips)
        {
            await tripRepo.ActivateScheduledTripAsync(trip.Id);
            trip.Status = "requested";
            await NotifyDriversOfNewTripAsync(trip);
        }
    }

    public async Task<Trip?> AcceptAsync(Guid tripId, Guid driverUserId)
    {
        var trip = await tripRepo.GetByIdAsync(tripId);
        if (trip == null || trip.Status != "requested") return null;

        // BUG FIX: driverUserId here is the authenticated user's id (from
        // the JWT via TripsController.CurrentUserId) — NOT drivers.id,
        // which is its own PK on a separate table. This method previously
        // stored the raw user id directly as trip.DriverId and passed it
        // straight to driverRepo.UpdateStatusAsync, so:
        //   - trip.DriverId never actually matched any drivers row
        //     (GetHistoryAsync's `LEFT JOIN drivers d ON d.id = t.driver_id`
        //     would never find the driver, silently dropping DriverName)
        //   - driverRepo.UpdateStatusAsync(driverId, "on_trip") matched
        //     zero rows, so a driver's status never actually flipped to
        //     on_trip — and, since trip.DriverId carried the same wrong
        //     value forward, UpdateStatusAsync/CancelAsync's "available"
        //     resets on completion/cancellation silently did nothing too.
        // Resolving the real driver row here fixes all three call sites.
        var driver = await driverRepo.GetByUserIdAsync(driverUserId);
        if (driver == null) return null;

        // Vehicle-type match (BP §III "Vehicle Options") — a driver can
        // only accept a trip requesting the vehicle type they're actually
        // registered with (motorcycle vs. motorcab/baobao).
        var vehicle = await driverRepo.GetVehicleAsync(driver.Id);
        if (vehicle == null || vehicle.VehicleType != trip.VehicleType) return null;

        trip.DriverId   = driver.Id;
        trip.Status     = "accepted";
        trip.AcceptedAt = DateTime.UtcNow;

        await tripRepo.UpdateAsync(trip);
        await driverRepo.UpdateStatusAsync(driver.Id, "on_trip");

        await hub.Clients.Group($"user_{trip.CustomerId}").SendAsync("TripAccepted", new
        {
            TripId   = trip.Id,
            DriverId = driver.Id
        });

        return trip;
    }

    public async Task<Trip?> UpdateStatusAsync(Guid tripId, Guid actorId, string newStatus)
    {
        var trip = await tripRepo.GetByIdAsync(tripId);
        if (trip == null) return null;

        if (!AllowedTransitions.TryGetValue(trip.Status, out var allowed) || !allowed.Contains(newStatus))
            return null;

        trip.Status = newStatus;

        switch (newStatus)
        {
            case "en_route":    trip.EnRouteAt   = DateTime.UtcNow; break;
            case "arrived":     trip.ArrivedAt   = DateTime.UtcNow; break;
            case "in_progress": trip.StartedAt   = DateTime.UtcNow; break;
            case "completed":
                trip.CompletedAt = DateTime.UtcNow;
                if (trip.DriverId.HasValue)
                    await driverRepo.UpdateStatusAsync(trip.DriverId.Value, "available");
                break;
        }

        await tripRepo.UpdateAsync(trip);

        await hub.Clients.Group($"user_{trip.CustomerId}").SendAsync("TripStatusChanged", new
        {
            TripId = trip.Id,
            Status = newStatus
        });

        return trip;
    }

    public async Task<Trip?> CancelAsync(Guid tripId, Guid actorId, string role, string reason)
    {
        var trip = await tripRepo.GetByIdAsync(tripId);
        if (trip == null) return null;
        if (!AllowedTransitions[trip.Status].Contains("cancelled")) return null;

        if (role == "customer" && trip.Status == "accepted")
        {
            var windowMinutes = await settings.GetIntAsync(SettingKeys.OpsCancelWindow, 3);
            if (trip.AcceptedAt.HasValue && DateTime.UtcNow > trip.AcceptedAt.Value.AddMinutes(windowMinutes))
            {
                trip.FareAmount = await settings.GetDecimalAsync(SettingKeys.FareCancellationFee, 25m);
            }
        }

        trip.Status      = "cancelled";
        trip.CancelledBy = role == "admin" ? "system" : role;
        trip.CancelReason = reason;
        trip.CancelledAt = DateTime.UtcNow;

        await tripRepo.UpdateAsync(trip);

        if (trip.DriverId.HasValue)
            await driverRepo.UpdateStatusAsync(trip.DriverId.Value, "available");

        await hub.Clients.Group($"user_{trip.CustomerId}").SendAsync("TripCancelled", new { TripId = tripId });
        if (trip.DriverId.HasValue)
            await hub.Clients.Group($"user_{trip.DriverId}").SendAsync("TripCancelled", new { TripId = tripId });

        return trip;
    }

    public async Task<PagedResult<Trip>> GetTripHistoryAsync(Guid userId, string role, int page, int pageSize)
        => await tripRepo.GetHistoryAsync(userId, role, page, pageSize);

    public async Task<RatingResult> RateTripAsync(Guid tripId, Guid actorId, string role, int score, string? comment)
    {
        if (score < 1 || score > 5)
            return new RatingResult(false, "Rating must be between 1 and 5.");

        var trip = await tripRepo.GetByIdAsync(tripId);
        if (trip == null)
            return new RatingResult(false, "Trip not found.");

        if (trip.Status != "completed")
            return new RatingResult(false, "Only completed trips can be rated.");

        var isCustomer = trip.CustomerId == actorId;
        var isDriver = trip.DriverId.HasValue && trip.DriverId.Value == actorId;

        if (role == "customer" && !isCustomer)
            return new RatingResult(false, "Customers can only rate the driver.");

        if (role == "driver" && !isDriver)
            return new RatingResult(false, "Drivers can only rate the customer.");

        if (role != "customer" && role != "driver")
            return new RatingResult(false, "Invalid role.");

        if (await tripRepo.HasRatingAsync(tripId, actorId))
            return new RatingResult(false, "You have already rated this trip.");

        var ratedUser = role == "customer" ? trip.DriverId : trip.CustomerId;
        if (!ratedUser.HasValue)
            return new RatingResult(false, "This trip has no eligible user to rate.");

        await tripRepo.AddRatingAsync(tripId, actorId, ratedUser.Value, score, comment);
        return new RatingResult(true, null);
    }

    public async Task<List<NearbyDriverResponse>> GetNearbyDriversAsync(double lat, double lng)
    {
        var radiusKm = await settings.GetIntAsync(SettingKeys.OpsDriverRadius, 5);
        return await driverRepo.GetNearbyAsync(lat, lng, radiusKm);
    }

    // ── Driver home screen: "Incoming Requests" ─────────────────────
// Reuses the same driver-accept radius setting GetNearbyDriversAsync
// uses for the mirror-image lookup (customer finding nearby drivers),
// so the two stay consistent by construction rather than by two
// independently-tuned numbers.
public async Task<List<PendingTripResponse>> GetPendingRequestsForDriverAsync(Guid driverUserId)
{
    var driver = await driverRepo.GetByUserIdAsync(driverUserId);
    if (driver == null || driver.Latitude == null || driver.Longitude == null)
        return [];

    var vehicle = await driverRepo.GetVehicleAsync(driver.Id);
    if (vehicle == null) return [];

    var radiusKm = await settings.GetIntAsync(SettingKeys.OpsDriverRadius, 5);
    var requests = await tripRepo.GetPendingNearbyAsync(vehicle.VehicleType, driver.Latitude.Value, driver.Longitude.Value, radiusKm);

    // Same 25 km/h assumption as FareService's ETA calculation —
    // "minutes away" here means minutes for the driver to reach
    // pickup, not the trip's own estimated duration.
    foreach (var r in requests)
        r.MinutesAway = (int)Math.Ceiling((double)r.DistanceKm / 25.0 * 60);

    return requests;
}
}