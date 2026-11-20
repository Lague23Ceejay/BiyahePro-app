-- Public passenger homepage content managed through the admin dashboard.
-- Text, card data, SEO fields and image/QR URLs are stored as JSON.
INSERT INTO app_settings (key, value, data_type, category, label, description, is_public)
VALUES (
    'website.passenger_content',
    '{}',
    'json',
    'general',
    'Passenger website content',
    'Public passenger homepage copy, cards, image URLs, app QR code and SEO metadata',
    true
)
ON CONFLICT (key) DO NOTHING;
