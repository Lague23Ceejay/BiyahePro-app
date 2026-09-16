// File path in project: RideHailing.API/Repositories/TripRepository.cs
// File path in project: RideHailing.API/Repositories/TripRepository.cs
using Dapper;
using Npgsql;
using RideHailing.API.Models;

namespace RideHailing.API.Repositories;

public interface ITripRepository
{
    Task<Trip> CreateAsync(Trip trip);
    Task<Trip?> GetByIdAsync(Guid id);
    Task UpdateAsync(Trip trip);
    Task<PagedResult<Trip>> GetHistoryAsync(Guid userId, string role, int page, int pageSize);
    Task<List<Trip>> GetDueScheduledTripsAsync();
    Task ActivateScheduledTripAsync(Guid tripId);
    Task<bool> HasRatingAsync(Guid tripId, Guid ratedBy);
    Task<List<PendingTripResponse>> GetPendingNearbyAsync(string vehicleType, double driverLat, double driverLng, int radiusKm);
    Task AddRatingAsync(Guid tripId, Guid ratedBy, Guid ratedUser, int score, string? comment);
}

public class TripRepository(IConfiguration config) : ITripRepository
{
    public async Task<List<PendingTripResponse>> GetPendingNearbyAsync(string vehicleType, double driverLat, double driverLng, int radiusKm)
{
    using var db = Connection();
    var sql = $@"
        SELECT {TripColumns}, {LatLngSelectExpr},
            uc.full_name AS customer_name,
            ROUND((ST_Distance(t.pickup_location, ST_SetSRID(ST_MakePoint(@Lng, @Lat), 4326)::geography) / 1000)::numeric, 2) AS distance_km
        FROM trips t
        JOIN users uc ON uc.id = t.customer_id
        WHERE t.status = 'requested'
          AND t.vehicle_type = @VehicleType
          AND ST_DWithin(t.pickup_location, ST_SetSRID(ST_MakePoint(@Lng, @Lat), 4326)::geography, @RadiusMeters)
        ORDER BY distance_km ASC
        LIMIT 20";
    var result = await db.QueryAsync<PendingTripResponse>(sql, new
    {
        VehicleType = vehicleType,
        Lat = driverLat,
        Lng = driverLng,
        RadiusMeters = radiusKm * 1000
    });
    return result.ToList();
}
    private NpgsqlConnection Connection() => new(config.GetConnectionString("DefaultConnection"));

    // Reused by GetByIdAsync/GetHistoryAsync/CreateAsync's RETURNING clause.
    // trips.pickup_location / dropoff_location are PostGIS GEOGRAPHY(POINT)
    // columns, not separate *_latitude/*_longitude columns — ST_Y/ST_X pull
    // the coordinates back out so Dapper can bind them onto
    // Trip.PickupLatitude/PickupLongitude/DropoffLatitude/DropoffLongitude
    // (works because Program.cs sets Dapper.DefaultTypeMap.MatchNamesWithUnderscores = true).
    private const string LatLngSelectExpr = @"
        ST_Y(pickup_location::geometry)  AS pickup_latitude,
        ST_X(pickup_location::geometry)  AS pickup_longitude,
        ST_Y(dropoff_location::geometry) AS dropoff_latitude,
        ST_X(dropoff_location::geometry) AS dropoff_longitude";

    // Every trips column except pickup_location/dropoff_location. Those two
    // are raw PostGIS `geography` values — selecting them via `t.*`/`RETURNING *`
    // makes Npgsql try to materialize a `geography` into the untyped object
    // slot Dapper reads through, which throws:
    //   InvalidCastException: Reading as 'System.Object' is not supported
    //   for fields having DataTypeName 'public.geography'
    // We only ever need them as lat/lng anyway (see LatLngSelectExpr above),
    // so they're deliberately left out here rather than mapped.
    private const string TripColumns = @"
        t.id, t.customer_id, t.driver_id, t.pickup_address, t.dropoff_address,
        t.status, t.vehicle_type, t.scheduled_for,
        t.base_fare, t.distance_fare, t.time_fare, t.surge_multiplier, t.booking_fee, t.fare_amount,
        t.distance_km, t.duration_minutes,
        t.payment_method, t.payment_status,
        t.cancelled_by, t.cancel_reason,
        t.requested_at, t.accepted_at, t.en_route_at, t.arrived_at, t.started_at, t.completed_at, t.cancelled_at";

    // Same list without the "t." alias, for the INSERT ... RETURNING clause
    // (CreateAsync inserts directly into `trips`, unaliased).
    private const string TripColumnsUnaliased = @"
        id, customer_id, driver_id, pickup_address, dropoff_address,
        status, vehicle_type, scheduled_for,
        base_fare, distance_fare, time_fare, surge_multiplier, booking_fee, fare_amount,
        distance_km, duration_minutes,
        payment_method, payment_status,
        cancelled_by, cancel_reason,
        requested_at, accepted_at, en_route_at, arrived_at, started_at, completed_at, cancelled_at";

    public async Task<Trip> CreateAsync(Trip trip)
    {
        using var db = Connection();
        var sql = $@"
            INSERT INTO trips (
                customer_id, pickup_location, dropoff_location,
                pickup_address, dropoff_address, payment_method,
                base_fare, distance_fare, surge_multiplier, booking_fee, fare_amount, status, scheduled_for, vehicle_type
            ) VALUES (
                @CustomerId,
                ST_SetSRID(ST_MakePoint(@PickupLongitude, @PickupLatitude), 4326)::geography,
                ST_SetSRID(ST_MakePoint(@DropoffLongitude, @DropoffLatitude), 4326)::geography,
                @PickupAddress, @DropoffAddress, @PaymentMethod,
                @BaseFare, @DistanceFare, @SurgeMultiplier, @BookingFee, @FareAmount, @Status, @ScheduledFor, @VehicleType
            )
            RETURNING {TripColumnsUnaliased}, {LatLngSelectExpr}";
        return await db.QuerySingleAsync<Trip>(sql, trip);
    }

    public async Task<Trip?> GetByIdAsync(Guid id)
    {
        using var db = Connection();
        var sql = $"SELECT {TripColumns}, {LatLngSelectExpr} FROM trips t WHERE t.id = @Id";
        return await db.QuerySingleOrDefaultAsync<Trip>(sql, new { Id = id });
    }

    public async Task UpdateAsync(Trip trip)
    {
        using var db = Connection();
        // NOTE: trips has no updated_at column (per-state timestamps only —
        // see 03_trips.sql), so it's intentionally not set here.
        // Also persists fare_amount (needed for the late-cancellation fee in
        // TripService.CancelAsync) and the en_route/arrived/started
        // timestamps set by TripService.UpdateStatusAsync — both were
        // silently dropped before since this UPDATE never included them.
        var sql = @"
            UPDATE trips SET
                driver_id      = @DriverId,
                status         = @Status,
                payment_status = @PaymentStatus,
                cancelled_by   = @CancelledBy,
                cancel_reason  = @CancelReason,
                fare_amount    = @FareAmount,
                accepted_at    = @AcceptedAt,
                en_route_at    = @EnRouteAt,
                arrived_at     = @ArrivedAt,
                started_at     = @StartedAt,
                completed_at   = @CompletedAt,
                cancelled_at   = @CancelledAt
            WHERE id = @Id";
        await db.ExecuteAsync(sql, trip);
    }

    public async Task<PagedResult<Trip>> GetHistoryAsync(Guid userId, string role, int page, int pageSize)
    {
        using var db = Connection();
        var offset = (page - 1) * pageSize;
        var column = role == "driver" ? "driver_id" : "customer_id";
        var total = await db.QuerySingleAsync<int>($"SELECT COUNT(*) FROM trips WHERE {column} = @UserId", new { UserId = userId });
        var sql = $@"
            SELECT {TripColumns}, {LatLngSelectExpr},
                uc.full_name AS customer_name,
                ud.full_name AS driver_name
            FROM trips t
            LEFT JOIN users uc ON uc.id = t.customer_id
            LEFT JOIN drivers d ON d.id = t.driver_id
            LEFT JOIN users ud ON ud.id = d.user_id
            WHERE t.{column} = @UserId
            ORDER BY t.requested_at DESC
            LIMIT @PageSize OFFSET @Offset";
        var items = await db.QueryAsync<Trip>(sql, new { UserId = userId, PageSize = pageSize, Offset = offset });
        return new PagedResult<Trip> { Items = items.ToList(), TotalCount = total, Page = page, PageSize = pageSize };
    }

    // ── Scheduled rides (BP §III) ──────────────────────────────

    // Scheduled trips whose time has arrived and haven't been activated
    // yet — picked up by ScheduledTripActivationService on a timer.
    public async Task<List<Trip>> GetDueScheduledTripsAsync()
    {
        using var db = Connection();
        var sql = $@"
            SELECT {TripColumns}, {LatLngSelectExpr}
            FROM trips t
            WHERE t.status = 'scheduled' AND t.scheduled_for <= NOW()
            ORDER BY t.scheduled_for ASC";
        var result = await db.QueryAsync<Trip>(sql);
        return result.ToList();
    }

    // Flips a due scheduled trip to 'requested' so it enters the normal
    // dispatch flow — doesn't touch accepted_at/etc, just opens it up
    // for driver matching exactly like a fresh immediate booking.
    public async Task ActivateScheduledTripAsync(Guid tripId)
    {
        using var db = Connection();
        await db.ExecuteAsync(
            "UPDATE trips SET status = 'requested' WHERE id = @Id AND status = 'scheduled'",
            new { Id = tripId });
    }

    // ── Ratings (BP §III step 7 "Rating & Feedback System") ────

    // UNIQUE (trip_id, rated_by) on the ratings table already stops a
    // double-submit at the DB level, but we check first so the service
    // can return a clean "already rated" result instead of a raw
    // constraint-violation exception.
    public async Task<bool> HasRatingAsync(Guid tripId, Guid ratedBy)
    {
        using var db = Connection();
        var count = await db.QuerySingleAsync<int>(
            "SELECT COUNT(*) FROM ratings WHERE trip_id = @TripId AND rated_by = @RatedBy",
            new { TripId = tripId, RatedBy = ratedBy });
        return count > 0;
    }

    // Insert only — trg_update_driver_rating (04_payments_ratings.sql)
    // recomputes drivers.rating / dpi_review_flag automatically when the
    // rated user turns out to be a driver.
    public async Task AddRatingAsync(Guid tripId, Guid ratedBy, Guid ratedUser, int score, string? comment)
    {
        using var db = Connection();
        await db.ExecuteAsync(
            @"INSERT INTO ratings (trip_id, rated_by, rated_user, score, comment)
              VALUES (@TripId, @RatedBy, @RatedUser, @Score, @Comment)",
            new { TripId = tripId, RatedBy = ratedBy, RatedUser = ratedUser, Score = score, Comment = comment });
    }
}