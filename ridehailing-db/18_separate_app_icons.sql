-- Seed independent customer and driver icon records from the legacy shared
-- icon when present. Existing per-app icons are preserved on re-run.
INSERT INTO app_brand_assets (asset_key, content, content_type, updated_by, updated_at)
SELECT 'customer_app_icon', content, content_type, updated_by, updated_at
FROM app_brand_assets
WHERE asset_key = 'app_icon'
ON CONFLICT (asset_key) DO NOTHING;

INSERT INTO app_brand_assets (asset_key, content, content_type, updated_by, updated_at)
SELECT 'driver_app_icon', content, content_type, updated_by, updated_at
FROM app_brand_assets
WHERE asset_key = 'app_icon'
ON CONFLICT (asset_key) DO NOTHING;

GRANT SELECT, INSERT, UPDATE ON app_brand_assets TO ridehailing_app;
