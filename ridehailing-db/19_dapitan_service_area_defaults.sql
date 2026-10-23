-- Move only untouched legacy defaults to the Dapitan service area.
-- Any center or radius customized by an admin is left unchanged.
DO $migration$
DECLARE
    area_latitude TEXT;
    area_longitude TEXT;
    area_radius TEXT;
BEGIN
    SELECT value INTO area_latitude
    FROM app_settings WHERE key = 'service_area.latitude';
    SELECT value INTO area_longitude
    FROM app_settings WHERE key = 'service_area.longitude';
    SELECT value INTO area_radius
    FROM app_settings WHERE key = 'service_area.radius_km';

    IF area_latitude = '8.152'
       AND area_longitude = '123.258'
       AND area_radius = '5' THEN
        UPDATE app_settings
        SET value = CASE key
                WHEN 'service_area.latitude' THEN '8.6549'
                WHEN 'service_area.longitude' THEN '123.4243'
                WHEN 'service_area.radius_km' THEN '20'
            END,
            updated_at = NOW()
        WHERE key IN (
            'service_area.latitude',
            'service_area.longitude',
            'service_area.radius_km'
        );
    END IF;
END;
$migration$;
