-- Stores the shared customer/driver launcher icon in the database so EAS
-- builds can fetch the latest icon without relying on ephemeral app storage.
CREATE TABLE IF NOT EXISTS app_brand_assets (
    asset_key   TEXT PRIMARY KEY,
    content     BYTEA NOT NULL,
    content_type TEXT NOT NULL CHECK (content_type = 'image/png'),
    updated_by  UUID REFERENCES users(id),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE ON app_brand_assets TO ridehailing_app;
