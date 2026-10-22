// Dapitan City fare zones — source: "Fares and Freight", City Ordinance
// No. 2022-483 (the posted fare table).
//
// COORDINATES come from PhilAtlas (the barangay centre point, i.e. roughly
// the middle of each barangay), so a pin placed by choosing a place here
// lands in the barangay but not on a specific street. Customers can still
// nudge the pin on the map afterwards.
//
// FARES: `regularFare` is the ordinance's regular fare. The SP/SC fare is
// calculated as an exact 20% discount from the regular fare.
type LatLng = { latitude: number; longitude: number };

export type ZonePlace = {
  id: string;
  /** Name shown to the customer (official barangay name). */
  name: string;
  /** Other spellings people may type, including the ordinance's own spelling. */
  aliases: string[];
  latitude: number;
  longitude: number;
  regularFare: number;
  /** SP/SC fare after the 20% discount. */
  spFare: number;
};

export type FareZone = {
  id: string;
  /** Sort key: zones are always listed in this numeric order. */
  order: number;
  label: string;
  description: string;
  /** Where the ordinance measures this zone's fares from. */
  fareOrigin: string;
  color: string;
  /** Used instead of an outline for zones that are a single area. */
  circle?: { latitude: number; longitude: number; radiusKm: number };
  /** Always alphabetical. */
  places: ZonePlace[];
};

export function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const spFromRegular = (regular: number) => regular * 0.8;

function place(
  id: string,
  name: string,
  latitude: number,
  longitude: number,
  regularFare: number,
  options: { aliases?: string[] } = {},
): ZonePlace {
  return {
    id,
    name,
    aliases: options.aliases ?? [],
    latitude,
    longitude,
    regularFare,
    spFare: spFromRegular(regularFare),
  };
}

function alphabetical(places: ZonePlace[]) {
  return [...places].sort((a, b) => normalizeText(a.name).localeCompare(normalizeText(b.name)));
}

export const FARE_ZONES: FareZone[] = [
  {
    id: 'zone-1',
    order: 1,
    label: 'Zone 1',
    description: 'Within the Dapitan Island Poblacion',
    fareOrigin: 'Zone 1',
    color: '#16A34A',
    circle: { latitude: 8.6549, longitude: 123.4243, radiusKm: 1.5 },
    places: [
      place('within-poblacion', 'Within the Dapitan Island Poblacion', 8.6549, 123.4243, 15, {
        aliases: ['poblacion', 'dapitan poblacion', 'city center', 'city proper'],
      }),
    ],
  },
  {
    id: 'zone-2',
    order: 2,
    label: 'Zone 2',
    description: 'Poblacion / Polo to the southern barangays',
    fareOrigin: 'Poblacion / Polo',
    color: '#2563EB',
    places: alphabetical([
      place('barcelona', 'Barcelona', 8.5316, 123.4493, 40),
      place('burgos', 'Burgos', 8.5602, 123.4207, 30),
      place('dampalan', 'Dampalan', 8.5222, 123.4962, 60),
      place('ilaya', 'Ilaya', 8.5448, 123.4313, 35),
      place('opao', 'Opao', 8.5354, 123.4768, 45),
      place('oyan', 'Oyan', 8.5849, 123.4105, 22),
      place('polo', 'Polo', 8.6319, 123.4104, 20),
      place('potungan', 'Potungan', 8.5411, 123.4932, 50),
      place('sulangon', 'Sulangon', 8.6124, 123.4179, 15),
    ]),
  },
  {
    id: 'zone-3',
    order: 3,
    label: 'Zone 3',
    description: 'Polo to the western barangays',
    fareOrigin: 'Polo',
    color: '#9333EA',
    places: alphabetical([
      place('larayan', 'Larayan', 8.6173, 123.375, 26),
      place('liyang', 'Liyang', 8.6301, 123.368, 20),
      place('owaon', 'Owaon', 8.6189, 123.3863, 20),
      place('san-pedro', 'San Pedro', 8.6246, 123.3912, 12),
      place('san-vicente', 'San Vicente', 8.6351, 123.3819, 20),
    ]),
  },
  {
    id: 'zone-4',
    order: 4,
    label: 'Zone 4',
    description: 'Poblacion to the northern barangays',
    fareOrigin: 'Poblacion',
    color: '#F59E0B',
    places: alphabetical([
      place('banbanan', 'Banganan', 8.7177, 123.4239, 60, { aliases: ['Banbanan'] }),
      place('canlucani', 'Canlucan', 8.7106, 123.3806, 60, { aliases: ['Canlucani'] }),
      place('carang', 'Carang', 8.7069, 123.4309, 40),
      place('guimputlan-60', 'Guimputlan (₱60 fare)', 8.7232, 123.3994, 60, { aliases: ['Guimputlan'] }),
      place('guimputlan-70', 'Guimputlan (₱70 fare)', 8.7232, 123.3994, 70, { aliases: ['Guimputlan'] }),
      place('santo-nino', 'Santo Niño', 8.6815, 123.4275, 20, { aliases: ['Sto. Nino', 'Sto Nino', 'Santo Nino'] }),
      place('tag-ulo', 'Tag-ulo', 8.7187, 123.3817, 60, { aliases: ['Tagulo', 'Tag ulo'] }),
      place('taguilon', 'Taquilon', 8.6977, 123.4047, 35, { aliases: ['Taguilon'] }),
      place('talisay', 'Talisay', 8.6663, 123.4194, 16, { aliases: ['Matagobtob'] }),
    ]),
  },
  {
    id: 'zone-5-6',
    order: 5,
    label: 'Zone 5 & 6',
    description: 'Poblacion to the eastern barangays',
    fareOrigin: 'Poblacion',
    color: '#DB2777',
    places: alphabetical([
      place('baylimango', 'Baylimango', 8.6983, 123.4403, 40),
      place('daro', 'Daro', 8.6627, 123.477, 60),
      place('kauswagan', 'Kauswagan', 8.6679, 123.4652, 40),
      place('napo', 'Napo', 8.6839, 123.4841, 40),
      place('oro', 'Oro', 8.6753, 123.4588, 30),
      place('sinonoc', 'Binonoc', 8.6688, 123.4392, 20, { aliases: ['Sinonoc'] }),
    ]),
  },
];

/** Zones in numeric order (already ordered above — this guards against future edits). */
export const SORTED_ZONES = [...FARE_ZONES].sort((a, b) => a.order - b.order);

export function getZone(id: string | null | undefined) {
  return SORTED_ZONES.find((zone) => zone.id === id) ?? null;
}

export function formatPeso(amount: number) {
  return `₱${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
}

export function zoneFareRange(zone: FareZone) {
  const fares = zone.places.map((p) => p.regularFare);
  const low = Math.min(...fares);
  const high = Math.max(...fares);
  return low === high ? formatPeso(low) : `${formatPeso(low)}–${formatPeso(high)}`;
}

export function zoneSummary(zone: FareZone, bookingFee?: number | null) {
  if (zone.places.length === 1) {
    const only = zone.places[0];
    const feeText = bookingFee == null ? '' : ` · SP/SC total incl. fee ${formatPeso(only.spFare + bookingFee)}`;
    return `${zone.description} · regular ${formatPeso(only.regularFare)} · SP/SC base ${formatPeso(only.spFare)}${feeText}`;
  }
  return `${zone.description} · ${zone.places.length} places · regular base ${zoneFareRange(zone)}`;
}

/** Case/accent-insensitive search over names and alternate spellings, across every zone. */
export function searchPlaces(query: string): { zone: FareZone; place: ZonePlace }[] {
  const needle = normalizeText(query);
  if (!needle) return [];
  const hits: { zone: FareZone; place: ZonePlace }[] = [];
  for (const zone of SORTED_ZONES) {
    for (const p of zone.places) {
      const haystacks = [p.name, ...p.aliases].map(normalizeText);
      if (haystacks.some((h) => h.includes(needle))) hits.push({ zone, place: p });
    }
  }
  return hits.sort(
    (a, b) => normalizeText(a.place.name).localeCompare(normalizeText(b.place.name)) || a.zone.order - b.zone.order,
  );
}

// ── Map shapes ───────────────────────────────────────────────────────────
type Pair = [number, number]; // [lat, lng]

function cross(o: Pair, a: Pair, b: Pair) {
  // x = longitude, y = latitude
  return (a[1] - o[1]) * (b[0] - o[0]) - (a[0] - o[0]) * (b[1] - o[1]);
}

// Andrew's monotone-chain convex hull.
export function convexHull(points: Pair[]): Pair[] {
  const sorted = [...points].sort((p, q) => p[1] - q[1] || p[0] - q[0]);
  if (sorted.length <= 2) return sorted;
  const lower: Pair[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Pair[] = [];
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

// A padded outline around a zone's places: every place becomes a small ring
// of points (so the shape has some breathing room around each barangay
// centre) and the outline is the hull of all those rings. It is an
// APPROXIMATE coverage area, not an official boundary.
export function zoneOutline(zone: FareZone, paddingKm = 1.0): Pair[] {
  const ring: Pair[] = [];
  for (const p of zone.places) {
    const latPad = paddingKm / 111.32;
    const lngPad = paddingKm / (111.32 * Math.cos((p.latitude * Math.PI) / 180));
    for (let step = 0; step < 12; step += 1) {
      const angle = (step / 12) * 2 * Math.PI;
      ring.push([p.latitude + latPad * Math.sin(angle), p.longitude + lngPad * Math.cos(angle)]);
    }
  }
  return convexHull(ring);
}

export type MapZone = {
  id: string;
  label: string;
  color: string;
  outline?: Pair[];
  circle?: { latitude: number; longitude: number; radiusKm: number };
  labelAt: LatLng;
  places: { id: string; name: string; latitude: number; longitude: number }[];
};

export function toMapZones(zones: FareZone[] = SORTED_ZONES): MapZone[] {
  return zones.map((zone) => {
    const count = zone.places.length;
    const labelAt = zone.circle
      ? { latitude: zone.circle.latitude, longitude: zone.circle.longitude }
      : {
          latitude: zone.places.reduce((sum, p) => sum + p.latitude, 0) / count,
          longitude: zone.places.reduce((sum, p) => sum + p.longitude, 0) / count,
        };
    return {
      id: zone.id,
      label: zone.label,
      color: zone.color,
      outline: zone.circle ? undefined : zoneOutline(zone),
      circle: zone.circle,
      labelAt,
      places: zone.places.map((p) => ({ id: p.id, name: p.name, latitude: p.latitude, longitude: p.longitude })),
    };
  });
}

export const MAP_ZONES: MapZone[] = toMapZones();