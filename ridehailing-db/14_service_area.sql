-- Shared service-area center and radius controlled by admins.
-- Safe to rerun against an existing database.
INSERT INTO app_settings (key, value, data_type, category, label, description, is_public)
VALUES
  ('service_area.latitude', '8.152', 'number', 'operations', 'Service area latitude', 'Center latitude used by customer and driver maps', true),
  ('service_area.longitude', '123.258', 'number', 'operations', 'Service area longitude', 'Center longitude used by customer and driver maps', true),
  ('service_area.radius_km', '5', 'number', 'operations', 'Service area radius', 'Radius of the admin-controlled service area in kilometers', true)
ON CONFLICT (key) DO NOTHING;
