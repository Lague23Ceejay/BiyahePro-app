-- File path in project: ridehailing-db/06_seed.sql
-- ============================================================
-- 06_seed.sql
-- Default app_settings rows — edit these from the admin panel,
-- never by hand in production.
-- ============================================================

INSERT INTO app_settings (key, value, data_type, category, label, description, is_public) VALUES

-- ── Fare settings ────────────────────────────────────────────
('fare.base_amount',       '40.00',  'number',  'fare',       'Base flag-down fare',      'Starting fare for every trip (PHP)',                    false),
('fare.per_km',            '12.00',  'number',  'fare',       'Per km rate',              'Added to fare for each km travelled (PHP)',              false),
('fare.per_minute',        '2.50',   'number',  'fare',       'Per minute rate',          'Added to fare for each minute in-trip (PHP)',            false),
('fare.minimum',           '80.00',  'number',  'fare',       'Minimum fare',             'Lowest possible fare regardless of distance (PHP)',      false),
('fare.cancellation_fee',  '25.00',  'number',  'fare',       'Cancellation fee',         'Fee charged when customer cancels after driver accepts', false),
('fare.booking_fee',       '5.00',   'number',  'fare',       'Booking fee',              'Flat ancillary fee added to every completed ride (PHP) — see BP break-even analysis', false),

-- ── Surge settings ───────────────────────────────────────────
('surge.enabled',          'true',   'boolean', 'surge',      'Surge pricing enabled',    'Master toggle for surge pricing',                       false),
('surge.multiplier',       '1.00',   'number',  'surge',      'Current surge multiplier', 'Applied on top of base fare (1.0 = no surge)',          true),
('surge.max_multiplier',   '3.00',   'number',  'surge',      'Max surge cap',            'Surge multiplier will never exceed this value',         false),
('surge.trigger_threshold','30',     'number',  'surge',      'Surge trigger (req/min)',  'Requests per minute that activates auto-surge',         false),

-- ── Operations settings ──────────────────────────────────────
('ops.driver_search_radius_km', '5',  'number', 'operations', 'Driver search radius',     'How far (km) to search for available drivers',          false),
('ops.cancel_window_minutes',   '3',  'number', 'operations', 'Cancel window (minutes)',  'Customer can cancel free within this window',           true),
('ops.driver_arrival_timeout',  '10', 'number', 'operations', 'Driver arrival timeout',   'Minutes before trip is auto-cancelled if driver no-show',false),
('ops.location_ping_seconds',   '5',  'number', 'operations', 'Location ping interval',   'How often driver app sends location update (seconds)',  false),
('ops.max_active_trips_driver', '1',  'number', 'operations', 'Max concurrent trips',     'Active trips allowed per driver at once',               false),
('ops.scheduled_min_lead_minutes', '30', 'number', 'operations', 'Scheduled ride lead time', 'Earliest a scheduled ride can be booked ahead of its requested time', false),
('service_area.latitude', '8.152', 'number', 'operations', 'Service area latitude', 'Center latitude used by customer and driver maps', true),
('service_area.longitude', '123.258', 'number', 'operations', 'Service area longitude', 'Center longitude used by customer and driver maps', true),
('service_area.radius_km', '5', 'number', 'operations', 'Service area radius', 'Radius of the admin-controlled service area in kilometers', true),

-- ── Feature flags ────────────────────────────────────────────
('feature.cash_payment',        'true',  'boolean', 'features', 'Cash payments',          'Allow cash as payment method',                          true),
('feature.gcash_payment',       'true',  'boolean', 'features', 'GCash payments',         'Allow GCash as payment method',                         true),
('feature.card_payment',        'false', 'boolean', 'features', 'Card payments',          'Allow card as payment method (requires gateway setup)', true),
('feature.scheduled_rides',     'false', 'boolean', 'features', 'Scheduled rides',        'Allow customers to book rides in advance',              true),
('feature.ride_sharing',        'false', 'boolean', 'features', 'Ride sharing',           'Allow multiple customers per trip',                     true),
('feature.driver_rating_required', 'true','boolean','features', 'Rating required',        'Force customer to rate before booking next trip',       false),

-- ── Notification settings ────────────────────────────────────
('notif.driver_accepted_msg',  'Your driver is on the way!', 'string', 'notifications', 'Driver accepted message', 'Push notification text when driver accepts trip', false),
('notif.driver_arrived_msg',   'Your driver has arrived.',   'string', 'notifications', 'Driver arrived message',  'Push notification text when driver arrives',      false),
('notif.trip_completed_msg',   'Trip completed. Rate your driver!', 'string', 'notifications', 'Trip completed message', 'Push notification text on trip completion', false)

ON CONFLICT (key) DO NOTHING;