-- File path in project: ridehailing-db/03_trips.sql
-- File path in project: ridehailing-db/03_trips.sql
-- ============================================================
-- 03_trips.sql
-- Trip lifecycle: requested → accepted → en_route →
--                 arrived → in_progress → completed | cancelled
-- ============================================================

CREATE TABLE IF NOT EXISTS trips (
    id                  UUID        PRIMARY KEY DEFAULT uuidv7(),
    customer_id         UUID        NOT NULL REFERENCES users(id),
    driver_id           UUID        REFERENCES drivers(id),   -- NULL until accepted

    -- Locations stored as PostGIS geography for accurate distance calc
    pickup_location     GEOGRAPHY(POINT, 4326) NOT NULL,
    dropoff_location    GEOGRAPHY(POINT, 4326) NOT NULL,
    pickup_address      TEXT        NOT NULL,
    dropoff_address     TEXT        NOT NULL,

    -- Trip state machine
    status              TEXT        NOT NULL DEFAULT 'requested'
                                    CHECK (status IN (
                                        'scheduled',
                                        'requested',
                                        'accepted',
                                        'en_route',
                                        'arrived',
                                        'in_progress',
                                        'completed',
                                        'cancelled'
                                    )),

    -- Requested ride type (BP §III "Vehicle Options") — motorcycle (single
    -- ride) or motorcab/baobao (multi-passenger). A driver can only accept
    -- a trip whose vehicle_type matches their own registered vehicle.
    vehicle_type        TEXT       NOT NULL DEFAULT 'motorcycle'
                                    CHECK (vehicle_type IN ('motorcycle', 'motorcab')),

    -- Scheduled rides (BP §III) — set when booked in advance; a background
    -- sweep flips status 'scheduled' -> 'requested' once this arrives.
    scheduled_for       TIMESTAMPTZ,

    -- Official fare schedule snapshot and the booking fee at request time
    regular_base_fare  NUMERIC(10,2) NOT NULL DEFAULT 0,
    base_fare           NUMERIC(10,2) NOT NULL DEFAULT 0,
    distance_fare       NUMERIC(10,2) NOT NULL DEFAULT 0,
    time_fare           NUMERIC(10,2) NOT NULL DEFAULT 0,
    surge_multiplier    NUMERIC(4,2) NOT NULL DEFAULT 1.00,
    booking_fee         NUMERIC(10,2) NOT NULL DEFAULT 0,   -- flat ancillary fee (see fare.booking_fee setting)
    fare_amount         NUMERIC(10,2) NOT NULL DEFAULT 0,   -- final total, includes booking_fee
    sp_sc_status        TEXT NOT NULL DEFAULT 'not_requested'
                                    CHECK (sp_sc_status IN ('not_requested', 'pending', 'verified', 'rejected')),

    -- Distance and duration
    distance_km         NUMERIC(8,2),
    duration_minutes    INT,

    -- Payment
    payment_method      TEXT        NOT NULL DEFAULT 'cash'
                                    CHECK (payment_method IN ('cash', 'gcash', 'card')),
    payment_status      TEXT        NOT NULL DEFAULT 'pending'
                                    CHECK (payment_status IN ('pending', 'paid', 'refunded')),

    -- Cancellation
    cancelled_by        TEXT        CHECK (cancelled_by IN ('customer', 'driver', 'system')),
    cancel_reason       TEXT,

    -- Timestamps for each state change
    requested_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at         TIMESTAMPTZ,
    en_route_at         TIMESTAMPTZ,
    arrived_at          TIMESTAMPTZ,
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    cancelled_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_trips_customer    ON trips (customer_id);
CREATE INDEX IF NOT EXISTS idx_trips_driver      ON trips (driver_id);
CREATE INDEX IF NOT EXISTS idx_trips_status      ON trips (status);
CREATE INDEX IF NOT EXISTS idx_trips_requested_at ON trips (requested_at DESC);

-- Fast lookup for the activation sweep: "which scheduled trips are due?"
CREATE INDEX IF NOT EXISTS idx_trips_scheduled_pending
    ON trips (scheduled_for)
    WHERE status = 'scheduled';

-- Spatial indexes for pickup/dropoff queries
CREATE INDEX IF NOT EXISTS idx_trips_pickup
    ON trips USING GIST (pickup_location);
CREATE INDEX IF NOT EXISTS idx_trips_dropoff
    ON trips USING GIST (dropoff_location);

GRANT SELECT, INSERT, UPDATE ON trips TO ridehailing_app;

-- ============================================================
-- Trip location history (breadcrumb trail from driver GPS)
-- ============================================================
CREATE TABLE IF NOT EXISTS trip_locations (
    id              UUID        PRIMARY KEY DEFAULT uuidv7(),
    trip_id         UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    location        GEOGRAPHY(POINT, 4326) NOT NULL,
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trip_locations_trip
    ON trip_locations (trip_id, recorded_at DESC);

GRANT SELECT, INSERT ON trip_locations TO ridehailing_app;