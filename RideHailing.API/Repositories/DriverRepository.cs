// File path in project: RideHailing.API/Repositories/DriverRepository.cs
using Dapper;
using Npgsql;
using RideHailing.API.Models;

namespace RideHailing.API.Repositories;

public interface IDriverRepository
{
    Task<Driver?> GetByUserIdAsync(Guid userId);
    Task<Driver?> GetByIdAsync(Guid id);
    Task<Vehicle?> GetVehicleAsync(Guid driverId);
    Task UpdateStatusAsync(Guid driverId, string status);
    Task UpdateLocationAsync(Guid driverId, double lat, double lng);
    Task<List<NearbyDriverResponse>> GetNearbyAsync(double lat, double lng, int radiusKm);
    Task<PagedResult<Driver>> GetAllAsync(string? status, int page, int pageSize);
    Task<DriverStrike?> AddStrikeAsync(Guid driverId, string reason, Guid issuedBy);
    Task<List<DriverStrike>> GetStrikesAsync(Guid driverId);
    Task LiftSuspensionAsync(Guid driverId);
    Task<DriverEarningsResponse> GetEarningsSummaryAsync(Guid driverId);
}

public class DriverRepository(IConfiguration config) : IDriverRepository
{
    private NpgsqlConnection Connection() => new(config.GetConnectionString("DefaultConnection"));

    public async Task<Driver?> GetByUserIdAsync(Guid userId)
    {
        using var db = Connection();
        return await db.QuerySingleOrDefaultAsync<Driver>("SELECT d.*, u.full_name, u.phone, u.email FROM drivers d JOIN users u ON u.id = d.user_id WHERE d.user_id = @UserId", new { UserId = userId });
    }

    public async Task<Driver?> GetByIdAsync(Guid id)
    {
        using var db = Connection();
        return await db.QuerySingleOrDefaultAsync<Driver>("SELECT d.*, u.full_name, u.phone, u.email FROM drivers d JOIN users u ON u.id = d.user_id WHERE d.id = @Id", new { Id = id });
    }

    public async Task<Vehicle?> GetVehicleAsync(Guid driverId)
    {
        using var db = Connection();
        return await db.QuerySingleOrDefaultAsync<Vehicle>("SELECT * FROM vehicles WHERE driver_id = @DriverId AND is_active = true", new { DriverId = driverId });
    }

    public async Task UpdateStatusAsync(Guid driverId, string status)
    {
        using var db = Connection();
        await db.ExecuteAsync("UPDATE drivers SET status = @Status, updated_at = NOW() WHERE id = @Id", new { Status = status, Id = driverId });
    }

    public async Task UpdateLocationAsync(Guid driverId, double lat, double lng)
    {
        using var db = Connection();
        await db.ExecuteAsync("UPDATE drivers SET current_location = ST_SetSRID(ST_MakePoint(@Lng, @Lat), 4326)::geography, updated_at = NOW() WHERE id = @Id", new { Lat = lat, Lng = lng, Id = driverId });
    }

    public async Task<List<NearbyDriverResponse>> GetNearbyAsync(double lat, double lng, int radiusKm)
    {
        using var db = Connection();
        var sql = @"SELECT d.id AS DriverId, u.full_name AS FullName, d.rating AS Rating, ST_Y(d.current_location::geometry) AS Latitude, ST_X(d.current_location::geometry) AS Longitude, ROUND((ST_Distance(d.current_location, ST_SetSRID(ST_MakePoint(@Lng, @Lat), 4326)::geography) / 1000)::numeric, 2) AS DistanceKm, v.plate_number AS PlateNumber, v.model AS VehicleModel, v.color AS VehicleColor FROM drivers d JOIN users u ON u.id = d.user_id JOIN vehicles v ON v.driver_id = d.id WHERE d.status = 'available' AND d.current_location IS NOT NULL AND ST_DWithin(d.current_location, ST_SetSRID(ST_MakePoint(@Lng, @Lat), 4326)::geography, @RadiusMeters) ORDER BY DistanceKm ASC LIMIT 10";
        var result = await db.QueryAsync<NearbyDriverResponse>(sql, new { Lat = lat, Lng = lng, RadiusMeters = radiusKm * 1000 });
        return result.ToList();
    }

    public async Task<PagedResult<Driver>> GetAllAsync(string? status, int page, int pageSize)
    {
        using var db = Connection();
        var offset = (page - 1) * pageSize;
        var where = status != null ? "WHERE d.status = @Status" : "";
        var total = await db.QuerySingleAsync<int>($"SELECT COUNT(*) FROM drivers d {where}", new { Status = status });
        var items = await db.QueryAsync<Driver>($"SELECT d.*, u.full_name, u.phone, u.email FROM drivers d JOIN users u ON u.id = d.user_id {where} ORDER BY d.created_at DESC LIMIT @PageSize OFFSET @Offset", new { Status = status, PageSize = pageSize, Offset = offset });
        return new PagedResult<Driver> { Items = items.ToList(), TotalCount = total, Page = page, PageSize = pageSize };
    }

    // ── Driver Performance Index / Three-Strike Policy (BP §VI, §IX) ──

    // Increments strike_count and applies the corresponding consequence
    // (warning / 7-day suspension / permanent ban) in a single statement,
    // then records the strike. Returns null if the driver doesn't exist
    // or is already banned (a banned driver can't accumulate further strikes).
    public async Task<DriverStrike?> AddStrikeAsync(Guid driverId, string reason, Guid issuedBy)
    {
        using var db = Connection();
        var sql = @"
            WITH updated AS (
                UPDATE drivers
                SET strike_count = strike_count + 1,
                    status = CASE
                        WHEN strike_count + 1 = 2 THEN 'suspended'
                        WHEN strike_count + 1 >= 3 THEN 'banned'
                        ELSE status
                    END,
                    suspended_until = CASE
                        WHEN strike_count + 1 = 2 THEN NOW() + INTERVAL '7 days'
                        ELSE NULL
                    END,
                    updated_at = NOW()
                WHERE id = @DriverId AND status != 'banned'
                RETURNING id, strike_count, suspended_until
            )
            INSERT INTO driver_strikes (driver_id, strike_number, reason, issued_by, consequence, expires_at)
            SELECT
                id,
                strike_count,
                @Reason,
                @IssuedBy,
                CASE
                    WHEN strike_count = 1 THEN 'Formal warning issued — mandatory re-training session required'
                    WHEN strike_count = 2 THEN 'Suspended from the platform for 7 days'
                    ELSE 'Permanently removed from the BiyahePro network'
                END,
                suspended_until
            FROM updated
            RETURNING *";
        return await db.QuerySingleOrDefaultAsync<DriverStrike>(sql, new { DriverId = driverId, Reason = reason, IssuedBy = issuedBy });
    }

    public async Task<List<DriverStrike>> GetStrikesAsync(Guid driverId)
    {
        using var db = Connection();
        var result = await db.QueryAsync<DriverStrike>(
            "SELECT * FROM driver_strikes WHERE driver_id = @DriverId ORDER BY issued_at DESC",
            new { DriverId = driverId });
        return result.ToList();
    }

    // Called once a strike-2 (7-day) suspension window has passed. Does NOT
    // touch permanent bans (strike 3) — those require a manual admin
    // ReinstateAsync-style action, not an automatic lift.
    public async Task LiftSuspensionAsync(Guid driverId)
    {
        using var db = Connection();
        await db.ExecuteAsync(
            "UPDATE drivers SET status = 'offline', suspended_until = NULL, updated_at = NOW() WHERE id = @DriverId AND status = 'suspended'",
            new { DriverId = driverId });
    }

    // ── Earnings summary (driver "Earnings" screen) ─────────────────
// Computed from completed trips' fare_amount directly — there's no
// commission/payout ledger in the schema yet, so this is a live
// aggregation, not a record of an actual settled payout.
public async Task<DriverEarningsResponse> GetEarningsSummaryAsync(Guid driverId)
{
    using var db = Connection();

    var totals = await db.QuerySingleAsync<(decimal TotalEarnings, int TotalTrips)>(
        @"SELECT COALESCE(SUM(fare_amount), 0) AS total_earnings, COUNT(*)::int AS total_trips
          FROM trips WHERE driver_id = @DriverId AND status = 'completed'",
        new { DriverId = driverId });

    var week = await db.QuerySingleAsync<(decimal WeekEarnings, int WeekTrips)>(
        @"SELECT COALESCE(SUM(fare_amount), 0) AS week_earnings, COUNT(*)::int AS week_trips
          FROM trips
          WHERE driver_id = @DriverId AND status = 'completed'
            AND date_trunc('week', completed_at) = date_trunc('week', NOW())",
        new { DriverId = driverId });

    var priorWeekEarnings = await db.QuerySingleAsync<decimal>(
        @"SELECT COALESCE(SUM(fare_amount), 0)
          FROM trips
          WHERE driver_id = @DriverId AND status = 'completed'
            AND date_trunc('week', completed_at) = date_trunc('week', NOW()) - INTERVAL '7 days'",
        new { DriverId = driverId });

    decimal? weekChangePercent = priorWeekEarnings > 0
        ? Math.Round((week.WeekEarnings - priorWeekEarnings) / priorWeekEarnings * 100, 0)
        : null;

    var averages = await db.QuerySingleAsync<(decimal AvgFare, double AvgMinutes)>(
        @"SELECT COALESCE(AVG(fare_amount), 0) AS avg_fare, COALESCE(AVG(duration_minutes), 0) AS avg_minutes
          FROM trips WHERE driver_id = @DriverId AND status = 'completed'",
        new { DriverId = driverId });

    var completion = await db.QuerySingleAsync<(int Completed, int Total)>(
        @"SELECT
            COUNT(*)::int FILTER (WHERE status = 'completed') AS completed,
            COUNT(*)::int FILTER (WHERE status IN ('completed', 'cancelled')) AS total
          FROM trips WHERE driver_id = @DriverId",
        new { DriverId = driverId });
    var completionRate = completion.Total > 0 ? (int)Math.Round(100.0 * completion.Completed / completion.Total) : 100;

    // Mon..Sun of the current calendar week, zero-filled for days with
    // no completed trips yet (so the chart always has 7 bars).
    var dailyRows = (await db.QueryAsync<(DateTime Day, decimal Earnings, int Trips)>(
        @"SELECT completed_at::date AS day, SUM(fare_amount) AS earnings, COUNT(*)::int AS trips
          FROM trips
          WHERE driver_id = @DriverId AND status = 'completed'
            AND date_trunc('week', completed_at) = date_trunc('week', NOW())
          GROUP BY completed_at::date",
        new { DriverId = driverId })).ToDictionary(r => DateOnly.FromDateTime(r.Day));

    var weekStart = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-(int)DateTime.UtcNow.DayOfWeek + (DateTime.UtcNow.DayOfWeek == DayOfWeek.Sunday ? -6 : 1)));
    var dailyEarnings = Enumerable.Range(0, 7).Select(i =>
    {
        var date = weekStart.AddDays(i);
        dailyRows.TryGetValue(date, out var row);
        return new DailyEarningsPoint(date.ToString("ddd"), date, row.Earnings, row.Trips);
    }).ToList();

    // Last 5 days with at least one completed trip, most recent first —
    // stands in for a "Daily Payouts" list until a real payout ledger exists.
    var payoutRows = await db.QueryAsync<(DateTime Day, decimal Earnings, int Trips)>(
        @"SELECT completed_at::date AS day, SUM(fare_amount) AS earnings, COUNT(*)::int AS trips
          FROM trips
          WHERE driver_id = @DriverId AND status = 'completed'
          GROUP BY completed_at::date
          ORDER BY day DESC
          LIMIT 5",
        new { DriverId = driverId });
    var recentPayouts = payoutRows
        .Select(r => new DailyEarningsPoint(r.Day.ToString("MMM d"), DateOnly.FromDateTime(r.Day), r.Earnings, r.Trips))
        .ToList();

    return new DriverEarningsResponse(
        TotalEarnings: totals.TotalEarnings,
        TotalTrips: totals.TotalTrips,
        WeekEarnings: week.WeekEarnings,
        WeekTrips: week.WeekTrips,
        WeekEarningsChangePercent: weekChangePercent,
        AvgFare: Math.Round(averages.AvgFare, 2),
        AvgTimeMinutes: (int)Math.Round(averages.AvgMinutes),
        CompletionRatePercent: completionRate,
        DailyEarnings: dailyEarnings,
        RecentPayouts: recentPayouts
    );
}
}