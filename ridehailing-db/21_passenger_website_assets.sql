-- Stores uploaded public homepage images and the app download QR code.
CREATE TABLE IF NOT EXISTS website_assets (
    asset_key    TEXT PRIMARY KEY,
    content      BYTEA NOT NULL,
    content_type TEXT NOT NULL CHECK (content_type IN ('image/png', 'image/jpeg', 'image/webp')),
    updated_by   UUID REFERENCES users(id),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE ON website_assets TO ridehailing_app;
