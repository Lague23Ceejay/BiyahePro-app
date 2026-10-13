// Distance / ETA helpers shared by the live-tracking UI.
//
// NOTE: these are straight-line ("as the crow flies") figures computed on the
// phone, not road distances — fine for a live "how close is my driver"
// readout, but they will read a little shorter than the road route.
export type LatLng = { latitude: number; longitude: number };

const EARTH_RADIUS_M = 6371000;
// Same 25 km/h average speed the backend's fare/ETA calculation assumes, so
// the on-screen ETA agrees with what the booking screen quoted.
const AVERAGE_SPEED_KMH = 25;

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

export function isValidPoint(p: Partial<LatLng> | null | undefined): p is LatLng {
  return !!p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude);
}

export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Under 1 km -> metres (rounded to the nearest 10 so the number doesn't
// flicker every GPS ping); 1 km and over -> kilometres with one decimal.
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '—';
  const rounded = Math.round(meters / 10) * 10;
  // Check the *rounded* value so 999 m reads "1.0 km", not "1000 m".
  if (rounded < 1000) return `${rounded} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function estimateMinutes(meters: number): number {
  if (!Number.isFinite(meters) || meters <= 0) return 0;
  return Math.max(1, Math.ceil(meters / 1000 / AVERAGE_SPEED_KMH * 60));
}

export function formatEta(minutes: number): string {
  if (minutes <= 1) return '1 min';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

// "850 m · 3 min" — the single string both apps show next to the map.
export function describeProgress(from: LatLng | null | undefined, to: LatLng | null | undefined): string | null {
  if (!isValidPoint(from) || !isValidPoint(to)) return null;
  const meters = haversineMeters(from, to);
  if (meters < 30) return 'Right here';
  return `${formatDistance(meters)} · ${formatEta(estimateMinutes(meters))}`;
}