// File path in project: RideHailing.API/Models/Driver.cs
// File path in project: RideHailing.API/Models/Driver.cs
// ============================================================
// Models/Driver.cs
// Driver + Vehicle domain models and related DTOs
// ============================================================
using System.ComponentModel.DataAnnotations;

namespace RideHailing.API.Models;

// ── Domain Models ─────────────────────────────────────────────
public class Driver
{
    public Guid     Id                    { get; set; }
    public Guid     UserId                { get; set; }
    public string   LicenseNumber         { get; set; } = string.Empty;
    public DateOnly LicenseExpiry         { get; set; }

    // offline | available | on_trip | suspended | banned
    public string   Status                { get; set; } = "offline";

    // Unpacked from PostGIS GEOGRAPHY column in repository
    public double?  Latitude              { get; set; }
    public double?  Longitude             { get; set; }

    public decimal  Rating                { get; set; } = 5.00m;

    // ── Driver Performance Index / Three-Strike Policy (BP §VI, §IX) ──
    public bool      DpiReviewFlag        { get; set; }   // true when Rating < 4.2 — needs admin review
    public short     StrikeCount          { get; set; }   // 1 = warning, 2 = suspended, 3 = banned
    public DateTime? SuspendedUntil       { get; set; }   // set on strike 2 (7-day suspension); NULL for bans/no suspension

    public int      TotalTrips            { get; set; }
    public bool     IsDocumentsVerified   { get; set; }
    public DateTime CreatedAt             { get; set; }
    public DateTime UpdatedAt             { get; set; }

    // ── Joined from users table ───────────────────────────────
    public string?  FullName              { get; set; }
    public string?  Phone                 { get; set; }
    public string?  Email                 { get; set; }

    // ── Joined from vehicles table ────────────────────────────
    public Vehicle? Vehicle               { get; set; }
}

public class Vehicle
{
    public Guid    Id           { get; set; }
    public Guid    DriverId     { get; set; }
    public string  PlateNumber  { get; set; } = string.Empty;
    public string  Make         { get; set; } = string.Empty; // e.g. Toyota
    public string  Model        { get; set; } = string.Empty; // e.g. Vios
    public string  Color        { get; set; } = string.Empty;
    public short   Year         { get; set; }

    // motorcycle | motorcab (BiyahePro's only vehicle types — see BP §III)
    public string  VehicleType  { get; set; } = "motorcycle";
    public bool    IsActive     { get; set; } = true;
    public DateTime CreatedAt   { get; set; }
}

// ── Driver Performance Index / Three-Strike Policy (BP §VI, §IX) ───
public class DriverStrike
{
    public Guid     Id            { get; set; }
    public Guid     DriverId      { get; set; }
    public short    StrikeNumber  { get; set; }   // 1, 2, or 3
    public string   Reason        { get; set; } = string.Empty;
    public string   Consequence   { get; set; } = string.Empty;  // human-readable outcome, snapshotted at issue time
    public Guid     IssuedBy      { get; set; }   // admin user id
    public DateTime IssuedAt      { get; set; }
    public DateTime? ExpiresAt    { get; set; }   // set for strike 2 (7-day suspension)
}

// ── Request DTOs ──────────────────────────────────────────────
public record DriverLocationUpdate(
    Guid   DriverId,
    double Latitude,
    double Longitude
);

public record RegisterDriverRequest(
    // Inherits user fields
    string   FullName,
    string   Email,
    string   Phone,
    string   Password,
    // Driver-specific
    string   LicenseNumber,
    DateOnly LicenseExpiry,
    // Vehicle
    string   PlateNumber,
    string   Make,
    string   Model,
    string   Color,
    short    Year,
    string   VehicleType = "motorcycle"
);

public record CompleteDriverProfileRequest(
    string LicenseNumber,
    DateOnly LicenseExpiry,
    string PlateNumber,
    string Make,
    string Model,
    string Color,
    short Year,
    string VehicleType = "motorcycle"
);

public record IssueStrikeRequest(
    // See the note on RegisterRequest.Password in User.cs — attributes on
    // a record's primary constructor parameter must NOT use a
    // [property: ...] target, or ASP.NET Core throws at request time.
    [Required(AllowEmptyStrings = false)]
    string Reason
);

// ── Response DTOs ─────────────────────────────────────────────
public record NearbyDriverResponse(
    Guid    DriverId,
    string  FullName,
    decimal Rating,
    double  Latitude,
    double  Longitude,
    double  DistanceKm,
    string  PlateNumber,
    string  VehicleModel,
    string  VehicleColor
);

public record DriverStatusResponse(
    Guid    DriverId,
    string  Status,
    double? Latitude,
    double? Longitude,
    decimal Rating,
    int     TotalTrips,
    bool    DpiReviewFlag,
    short   StrikeCount,
    DateTime? SuspendedUntil
);

// Driver home-screen "Online" switch.
public record SetAvailabilityRequest(bool Available);

// Periodic location ping from the driver app.
public record UpdateLocationRequest(double Latitude, double Longitude);

// Driver "Earnings" screen. Earnings here are the full trip fare, not
// net of any platform commission — there's no commission/payout ledger
// in the schema yet (see BP §V "15% commission" for the eventual real
// number), so this is a computed summary over completed trips, not an
// actual settled-payout record.
public record DailyEarningsPoint(string DayLabel, DateOnly Date, decimal Earnings, int Trips);

public record DriverEarningsResponse(
    decimal TotalEarnings,
    int     TotalTrips,
    decimal WeekEarnings,
    int     WeekTrips,
    decimal? WeekEarningsChangePercent,
    decimal AvgFare,
    int     AvgTimeMinutes,
    int     CompletionRatePercent,
    List<DailyEarningsPoint> DailyEarnings,
    List<DailyEarningsPoint> RecentPayouts
);