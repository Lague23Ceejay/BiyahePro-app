// File path in project: RideHailing.API/Models/Trip.cs
// File path in project: RideHailing.API/Models/Trip.cs
// ============================================================
// Models/Trip.cs
// Trip domain model + booking/fare request & response DTOs
// ============================================================
namespace RideHailing.API.Models;

// ── Domain Model ──────────────────────────────────────────────
public class Trip
{
    public Guid     Id               { get; set; }
    public Guid     CustomerId       { get; set; }
    public Guid?    DriverId         { get; set; }   // null until a driver accepts

    // Unpacked from PostGIS GEOGRAPHY columns in repository
    public double   PickupLatitude   { get; set; }
    public double   PickupLongitude  { get; set; }
    public double   DropoffLatitude  { get; set; }
    public double   DropoffLongitude { get; set; }

    public string   PickupAddress    { get; set; } = string.Empty;
    public string   DropoffAddress   { get; set; } = string.Empty;

    // ── Trip state machine ────────────────────────────────────
    // requested → accepted → en_route → arrived → in_progress → completed | cancelled
    public string   Status           { get; set; } = "requested";

    // ── Fare snapshot (locked at booking time) ────────────────
    public decimal  BaseFare         { get; set; }
    public decimal  DistanceFare     { get; set; }
    public decimal  TimeFare         { get; set; }
    public decimal  SurgeMultiplier  { get; set; } = 1.00m;
    public decimal  BookingFee       { get; set; }   // flat ancillary fee (fare.booking_fee setting)
    public decimal  FareAmount       { get; set; }   // final total, includes BookingFee

    // ── Trip metrics (filled on completion) ──────────────────
    public decimal? DistanceKm       { get; set; }
    public int?     DurationMinutes  { get; set; }

    // ── Payment ───────────────────────────────────────────────
    // cash | gcash | card
    public string   PaymentMethod    { get; set; } = "cash";
    // pending | paid | refunded
    public string   PaymentStatus    { get; set; } = "pending";

    // ── Cancellation ──────────────────────────────────────────
    public string?  CancelledBy      { get; set; }  // customer | driver | system
    public string?  CancelReason     { get; set; }

    // ── Scheduled rides (BP §III "Future Product/Service Expansion") ──
    // Set only when this trip was booked in advance. A background sweep
    // (ScheduledTripActivationService) flips Status "scheduled" ->
    // "requested" once ScheduledFor arrives, entering normal dispatch.
    public DateTime? ScheduledFor    { get; set; }

    // motorcycle | motorcab (BP §III "Vehicle Options") — requested ride
    // type. AcceptAsync rejects a driver whose registered vehicle doesn't match.
    public string    VehicleType     { get; set; } = "motorcycle";

    // ── State timestamps ──────────────────────────────────────
    public DateTime  RequestedAt     { get; set; }
    public DateTime? AcceptedAt      { get; set; }
    public DateTime? EnRouteAt       { get; set; }
    public DateTime? ArrivedAt       { get; set; }
    public DateTime? StartedAt       { get; set; }
    public DateTime? CompletedAt     { get; set; }
    public DateTime? CancelledAt     { get; set; }

    // ── Joined fields (from queries) ──────────────────────────
    public string?  CustomerName     { get; set; }
    public string?  CustomerPhone    { get; set; }
    public string?  DriverName       { get; set; }
    public string?  DriverPhone      { get; set; }
    public string?  PlateNumber      { get; set; }
}

// ── Request DTOs ──────────────────────────────────────────────
public record BookTripRequest(
    double PickupLatitude,
    double PickupLongitude,
    double DropoffLatitude,
    double DropoffLongitude,
    string PickupAddress,
    string DropoffAddress,
    string PaymentMethod = "cash",
    DateTime? ScheduledFor = null,
    string VehicleType = "motorcycle"
);

public record FareEstimateRequest(
    double PickupLatitude,
    double PickupLongitude,
    double DropoffLatitude,
    double DropoffLongitude
);

public record TripStatusUpdate(
    Guid   TripId,
    string Status
);

// ── Ratings (BP §III step 7 "Rating & Feedback System") ────────
public record RateTripRequest(
    int     Score,
    string? Comment = null
);

// ── Response DTOs ─────────────────────────────────────────────
public record FareEstimateResponse(
    decimal BaseFare,
    decimal EstimatedDistanceFare,
    decimal BookingFee,
    decimal EstimatedTotal,
    decimal SurgeMultiplier,
    double  EstimatedDistanceKm,
    int     EstimatedMinutes
);

public record TripSummaryResponse(
    Guid    Id,
    string  PickupAddress,
    string  DropoffAddress,
    string  Status,
    decimal FareAmount,
    string  PaymentMethod,
    string? DriverName,
    string? PlateNumber,
    DateTime RequestedAt,
    DateTime? CompletedAt
);

public record RatingResult(bool Success, string? Error);

// One row of "incoming ride requests" for a driver's home screen — a
// pending (status = 'requested') trip within their accept radius that
// matches their registered vehicle type. Extra columns TripColumns
// selects (payment_method, cancelled_by, etc.) that aren't declared here
// are simply ignored by Dapper — no need for a narrower SELECT list.
public record PendingTripResponse
{
    public Guid Id { get; init; }
    public string PickupAddress { get; init; } = "";
    public string DropoffAddress { get; init; } = "";
    public decimal FareAmount { get; init; }
    public decimal DistanceKm { get; init; }
    public string CustomerName { get; init; } = "";
    public DateTime RequestedAt { get; init; }
    public int MinutesAway { get; set; }
}