-- Track freshness separately from general driver profile updates so the
-- admin fleet map can distinguish a current location from a last-known one.
ALTER TABLE drivers
    ADD COLUMN IF NOT EXISTS last_location_at TIMESTAMPTZ;

GRANT SELECT ON drivers TO ridehailing_app;
