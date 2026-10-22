// Full-screen "choose by zone" picker.
//
//   • Zones are listed in numeric order (Zone 1, 2, 3, 4, 5 & 6).
//   • Opening a zone lists its barangays/places A–Z with the ordinance fares.
//   • The search box looks across every zone (accent-insensitive, and it also
//     understands the ordinance's own spellings, e.g. "Sto. Nino", "Binonoc").
//   • The map above the list shows every zone as a coloured area; picking a
//     zone (from the list OR by tapping its "Zone N" label on the map) zooms
//     in and shows that zone's places as tappable dots.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { LeafletMapPicker, type LeafletMapPickerHandle } from '@/src/components/LeafletMapPicker';
import {
  MAP_ZONES,
  SORTED_ZONES,
  formatPeso,
  getZone,
  searchPlaces,
  zoneSummary,
  type FareZone,
  type ZonePlace,
} from '@/src/data/dapitanZones';
import { colors } from '@/src/theme/colors';

type Point = { latitude: number; longitude: number };

type Props = {
  visible: boolean;
  target: 'pickup' | 'dropoff';
  /** Zone to open on, e.g. when the user tapped a zone label on the booking map. */
  initialZoneId: string | null;
  pickup: Point;
  dropoff: Point;
  bookingFee: number | null;
  onClose: () => void;
  onSelect: (zone: FareZone, place: ZonePlace) => void;
};

const POBLACION_CENTER = { latitude: 8.6549, longitude: 123.4243 };

function PlaceRow({ zone, place, showZone, bookingFee, onPress }: {
  zone: FareZone;
  place: ZonePlace;
  showZone: boolean;
  bookingFee: number | null;
  onPress: () => void;
}) {
  const origin = zone.id === 'zone-1' ? 'Trips within the poblacion' : `Fare from ${zone.fareOrigin}`;
  return (
    <Pressable style={styles.placeRow} onPress={onPress}>
      <View style={[styles.zoneBar, { backgroundColor: zone.color }]} />
      <View style={styles.placeText}>
        <Text style={styles.placeName}>{place.name}</Text>
        <Text style={styles.placeMeta}>{showZone ? `${zone.label} · ` : ''}{origin}</Text>
      </View>
      <View style={styles.fareBox}>
        <Text style={styles.fareRegular}>Regular base {formatMoney(place.regularFare)}</Text>
        <Text style={styles.fareSp}>SP/SC base {formatMoney(place.spFare)}</Text>
        {bookingFee != null && <Text style={styles.fareTotal}>SP/SC total {formatMoney(place.spFare + bookingFee)}</Text>}
      </View>
    </Pressable>
  );
}

export function ZonePlacePicker({ visible, target, initialZoneId, pickup, dropoff, bookingFee, onClose, onSelect }: Props) {
  const mapRef = useRef<LeafletMapPickerHandle>(null);
  const [activeZoneId, setActiveZoneId] = useState<string | null>(initialZoneId);
  const [query, setQuery] = useState('');

  // Start fresh every time the picker opens.
  useEffect(() => {
    if (visible) {
      setQuery('');
      setActiveZoneId(initialZoneId);
    }
  }, [visible, initialZoneId]);

  const activeZone = getZone(activeZoneId);
  const searching = query.trim().length > 0;
  const results = useMemo(() => (searching ? searchPlaces(query) : []), [query, searching]);

  function openZone(zoneId: string | null) {
    setActiveZoneId(zoneId);
    setQuery('');
    mapRef.current?.focusZone(zoneId);
  }

  function choose(zone: FareZone, place: ZonePlace) {
    onSelect(zone, place);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{target === 'pickup' ? 'Choose pickup' : 'Choose destination'}</Text>
            <Text style={styles.subtitle}>By fare zone · City Ordinance No. 2022-483</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeButton}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        <View style={styles.searchWrap}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search barangay or place"
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {searching && (
            <Pressable onPress={() => setQuery('')} hitSlop={10}>
              <Text style={styles.clearText}>✕</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.mapBox}>
          <LeafletMapPicker
            ref={mapRef}
            initialCenter={POBLACION_CENTER}
            initialZoom={11}
            pickup={pickup}
            dropoff={dropoff}
            zones={MAP_ZONES}
            initialFocusZoneId={initialZoneId}
            // Tapping empty map does nothing here — places are chosen from the list or the dots.
            onMapPress={() => undefined}
            onReady={() => mapRef.current?.focusZone(activeZoneId)}
            onZonePress={openZone}
            onPlacePress={(zoneId, placeId) => {
              const zone = getZone(zoneId);
              const place = zone?.places.find((p) => p.id === placeId);
              if (zone && place) choose(zone, place);
            }}
          />
        </View>

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
          {searching ? (
            results.length > 0 ? (
              results.map(({ zone, place }) => (
              <PlaceRow key={`${zone.id}-${place.id}`} zone={zone} place={place} showZone bookingFee={bookingFee} onPress={() => choose(zone, place)} />
              ))
            ) : (
              <Text style={styles.empty}>No places match “{query.trim()}”. Try another spelling.</Text>
            )
          ) : activeZone ? (
            <>
              <Pressable style={styles.backRow} onPress={() => openZone(null)} hitSlop={8}>
                <Text style={styles.backText}>‹ All zones</Text>
              </Pressable>
              <View style={styles.zoneHeading}>
                <View style={[styles.zoneBadge, { backgroundColor: activeZone.color }]}>
                  <Text style={styles.zoneBadgeText}>{activeZone.label}</Text>
                </View>
                <Text style={styles.zoneHeadingText}>{activeZone.description}</Text>
              </View>
              {activeZone.places.map((place) => (
                <PlaceRow key={place.id} zone={activeZone} place={place} showZone={false} bookingFee={bookingFee} onPress={() => choose(activeZone, place)} />
              ))}
            </>
          ) : (
            SORTED_ZONES.map((zone) => (
              <Pressable key={zone.id} style={styles.zoneCard} onPress={() => openZone(zone.id)}>
                <View style={[styles.zoneBadge, { backgroundColor: zone.color }]}>
                  <Text style={styles.zoneBadgeText}>{zone.label}</Text>
                </View>
                <Text style={styles.zoneSummary}>{zoneSummary(zone, bookingFee)}</Text>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))
          )}
          <Text style={styles.footnote}>
            Fares use City Ordinance No. 2022-483. SP/SC pricing requires a valid ID checked by your driver at pickup.
            {bookingFee == null ? ' The current booking fee will appear in your estimate.' : ''}
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

function formatMoney(amount: number) {
  return `₱${amount.toFixed(2)}`;
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 8 : 54,
  },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 10, gap: 12 },
  headerText: { flex: 1 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 12, color: colors.muted, marginTop: 2 },
  closeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 16, color: colors.text },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 18, marginBottom: 10, paddingHorizontal: 14,
    backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, height: 46, fontSize: 15, color: colors.text },
  clearText: { fontSize: 15, color: colors.muted, paddingLeft: 8 },
  mapBox: { height: 230, marginHorizontal: 18, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  list: { flex: 1 },
  listContent: { padding: 18, gap: 10, paddingBottom: 40 },
  zoneCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: colors.surface,
    borderRadius: 16, borderWidth: 1, borderColor: colors.border,
  },
  zoneBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  zoneBadgeText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  zoneSummary: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 18 },
  chevron: { fontSize: 24, color: colors.muted },
  backRow: { paddingVertical: 2 },
  backText: { color: colors.brand, fontWeight: '800', fontSize: 14 },
  zoneHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  zoneHeadingText: { flex: 1, color: colors.muted, fontSize: 13 },
  placeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: colors.surface,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  zoneBar: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  placeText: { flex: 1 },
  placeName: { fontSize: 15, fontWeight: '800', color: colors.text },
  placeMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  fareBox: { alignItems: 'flex-end', maxWidth: '48%' },
  fareRegular: { fontSize: 11, fontWeight: '700', color: colors.text },
  fareSp: { fontSize: 11, color: colors.muted, marginTop: 2 },
  fareTotal: { fontSize: 11, fontWeight: '800', color: colors.brand, marginTop: 2 },
  empty: { textAlign: 'center', color: colors.muted, fontSize: 14, marginTop: 24 },
  footnote: { fontSize: 11, color: colors.muted, textAlign: 'center', marginTop: 8, lineHeight: 16 },
});