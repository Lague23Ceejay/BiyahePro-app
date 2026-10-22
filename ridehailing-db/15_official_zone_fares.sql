-- Official zone fares replace the distance-based fare formula.
-- SP/SC eligibility is requested by the customer and verified by the
-- assigned driver at pickup before the trip can start.

ALTER TABLE trips
    ADD COLUMN IF NOT EXISTS regular_base_fare NUMERIC(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sp_sc_status TEXT NOT NULL DEFAULT 'not_requested';

UPDATE trips
SET regular_base_fare = base_fare
WHERE regular_base_fare = 0 AND base_fare <> 0;

ALTER TABLE trips
    DROP CONSTRAINT IF EXISTS trips_sp_sc_status_check;

ALTER TABLE trips
    ADD CONSTRAINT trips_sp_sc_status_check
    CHECK (sp_sc_status IN ('not_requested', 'pending', 'verified', 'rejected'));

UPDATE app_settings
SET is_public = TRUE,
    label = 'Booking fee',
    description = 'Flat booking fee added to every official zone fare (PHP)'
WHERE key = 'fare.booking_fee';
