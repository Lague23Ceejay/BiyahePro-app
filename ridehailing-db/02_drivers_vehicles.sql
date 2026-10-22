-- File path in project: ridehailing-db/02_drivers_vehicles.sql
-- ============================================================
-- 02_drivers_vehicles.sql
-- Driver profiles, vehicles, and live location tracking
-- ============================================================

-- Driver profile (extends users where role = 'driver')
CREATE TABLE IF NOT EXISTS drivers (
    id                  UUID        PRIMARY KEY DEFAULT uuidv7(),
    user_id             UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    license_number      TEXT        NOT NULL UNIQUE,
    license_expiry      DATE        NOT NULL,
    status              TEXT        NOT NULL DEFAULT 'offline'
                                    CHECK (status IN ('offline', 'available', 'on_trip', 'suspended', 'banned')),
    current_location    GEOGRAPHY(POINT, 4326),   -- PostGIS: lat/lng live position
    last_location_at    TIMESTAMPTZ,              -- Time of most recent driver location ping
    rating              NUMERIC(3,2) NOT NULL DEFAULT 5.00,
    -- Driver Performance Index / Three-Strike Policy (BP §VI Quality Control, §IX Risk Analysis)
    dpi_review_flag     BOOLEAN     NOT NULL DEFAULT false,  -- true when rating drops below 4.2 — triggers automatic review
    strike_count        SMALLINT    NOT NULL DEFAULT 0,      -- 1 = warning, 2 = 7-day suspension, 3 = permanent ban
    suspended_until     TIMESTAMPTZ,                         -- set on strike 2; NULL once lifted or for permanent bans
    total_trips         INT         NOT NULL DEFAULT 0,
    is_documents_verified BOOLEAN   NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Spatial index for "find drivers near me" queries (ST_DWithin)
CREATE INDEX IF NOT EXISTS idx_drivers_location
    ON drivers USING GIST (current_location);

CREATE INDEX IF NOT EXISTS idx_drivers_status
    ON drivers (status);

CREATE OR REPLACE TRIGGER trg_drivers_updated_at
    BEFORE UPDATE ON drivers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

GRANT SELECT, INSERT, UPDATE ON drivers TO ridehailing_app;

-- ============================================================
-- Vehicles
-- ============================================================
CREATE TABLE IF NOT EXISTS vehicles (
    id              UUID        PRIMARY KEY DEFAULT uuidv7(),
    driver_id       UUID        NOT NULL UNIQUE REFERENCES drivers(id) ON DELETE CASCADE,
    plate_number    TEXT        NOT NULL UNIQUE,
    make            TEXT        NOT NULL,   -- e.g. Toyota
    model           TEXT        NOT NULL,   -- e.g. Vios
    color           TEXT        NOT NULL,
    year            SMALLINT    NOT NULL,
    vehicle_type    TEXT        NOT NULL DEFAULT 'motorcycle'
                                -- BiyahePro only runs motorcycles (single rides) and
                                -- motorcabs/baobao (multi-passenger) per the business plan —
                                -- no sedan/suv/van in this fleet.
                                CHECK (vehicle_type IN ('motorcycle', 'motorcab')),
    is_active       BOOLEAN     NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicles_plate
    ON vehicles USING GIN (plate_number gin_trgm_ops);

GRANT SELECT, INSERT, UPDATE ON vehicles TO ridehailing_app;