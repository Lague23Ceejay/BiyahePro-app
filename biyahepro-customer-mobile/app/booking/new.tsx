// File path in project: biyahepro-customer-mobile/app/booking/new.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LeafletMapPicker, type LeafletMapPickerHandle } from '@/src/components/LeafletMapPicker';
import { ZonePlacePicker } from '@/src/components/ZonePlacePicker';
import { AppButton } from '@/src/components/AppButton';
import { AppInput } from '@/src/components/AppInput';
import { api, getFareBookingFee, getServiceArea, type ServiceArea } from '@/src/lib/api';
import { useAuth } from '@/src/context/AuthContext';
import type { FareEstimate, BookTripRequest } from '@/src/types/api';
import { MAP_ZONES, type FareZone, type ZonePlace } from '@/src/data/dapitanZones';
import { colors } from '@/src/theme/colors';

type Point = {
  latitude: number;
  longitude: number;
  address: string;
  fareZoneId?: string;
  farePlaceId?: string;
};
type MapTarget = 'pickup' | 'dropoff';

const DEFAULT_PICKUP: Point = { latitude: 8.6555, longitude: 123.4243, address: '' };
const DEFAULT_DROPOFF: Point = { latitude: 8.668, longitude: 123.417, address: '' };

function formatAddress(address?: Location.LocationGeocodedAddress) {
  if (!address) return '';
  return [address.name, address.street, address.city, address.region]
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index)
    .join(', ');
}

export default function NewBookingScreen() {
  const { session } = useAuth();
  const mapRef = useRef<LeafletMapPickerHandle>(null);
  const scrollRef = useRef<ScrollView>(null);
  const pointSelectionVersions = useRef({ pickup: 0, dropoff: 0 });
  const estimateRequestId = useRef(0);
  // Toggled off for the duration of a touch that starts inside the map
  // card, so the WebView's own pan/zoom gesture gets the swipe instead of
  // the outer ScrollView also scrolling the whole page at the same time.
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [pickup, setPickup] = useState<Point>(DEFAULT_PICKUP);
  const [dropoff, setDropoff] = useState<Point>(DEFAULT_DROPOFF);
  const [target, setTarget] = useState<MapTarget>('pickup');
  const [center, setCenter] = useState<{ latitude: number; longitude: number }>(DEFAULT_PICKUP);
  const [locationLoading, setLocationLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [zonePickerOpen, setZonePickerOpen] = useState(false);
  const [zonePickerZoneId, setZonePickerZoneId] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<FareEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<BookTripRequest['paymentMethod']>('cash');
  const [vehicleType, setVehicleType] = useState<BookTripRequest['vehicleType']>('motorcycle');
  const [rideTiming, setRideTiming] = useState<'now' | 'later'>('now');
  const [scheduledFor, setScheduledFor] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  // Tracks which field (if any) is mid forward-geocode, so the input can
  // show a small "Locating…" state and getEstimate can be blocked until
  // it resolves — otherwise a fast tap on "Estimate fare" right after
  // typing could fire before the coordinates it depends on are ready.
  const [geocodingTarget, setGeocodingTarget] = useState<MapTarget | null>(null);
  const [serviceArea, setServiceArea] = useState<ServiceArea | undefined>();
  const [bookingFee, setBookingFee] = useState<number | null>(null);
  const [bookingFeeError, setBookingFeeError] = useState('');
  const [spScRequested, setSpScRequested] = useState(false);

  const activePoint = target === 'pickup' ? pickup : dropoff;
  const hasAddresses = Boolean(pickup.address.trim() && dropoff.address.trim());
  const hasOfficialRoute = Boolean(
    pickup.fareZoneId && pickup.farePlaceId && dropoff.fareZoneId && dropoff.farePlaceId,
  );

  useEffect(() => {
    loadCurrentLocation();
    let mounted = true;
    const refreshServiceArea = () => getServiceArea().then(area => { if (mounted) setServiceArea(area); }).catch(() => undefined);
    refreshServiceArea();
    getFareBookingFee()
      .then(fee => { if (mounted) { setBookingFee(fee); setBookingFeeError(''); } })
      .catch((e: unknown) => {
        if (mounted) setBookingFeeError(e instanceof Error ? e.message : 'Unable to load the current booking fee.');
      });
    const timer = setInterval(refreshServiceArea, 15000);
    return () => { mounted = false; clearInterval(timer); };
  }, []);

  async function reverseGeocode(latitude: number, longitude: number) {
    try {
      const result = await Location.reverseGeocodeAsync({ latitude, longitude });
      return formatAddress(result[0]) || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    } catch {
      return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    }
  }

  async function loadCurrentLocation() {
    const selectionVersion = ++pointSelectionVersions.current.pickup;
    setLocationLoading(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setError('Location permission was not granted. You can still select both points manually on the map.');
        return;
      }

      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const point = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
        address: await reverseGeocode(current.coords.latitude, current.coords.longitude),
      };
      if (selectionVersion !== pointSelectionVersions.current.pickup) return;
      setPickup(point);
      invalidateEstimate();
      setCenter(point);
      mapRef.current?.flyTo(point, 16);
    } catch {
      setError('We could not read your current location. Please choose your pickup on the map.');
    } finally {
      setLocationLoading(false);
    }
  }

  async function selectPoint(latitude: number, longitude: number) {
    setError('');
    const pointTarget = target;
    const selectionVersion = ++pointSelectionVersions.current[pointTarget];
    const address = await reverseGeocode(latitude, longitude);
    if (selectionVersion !== pointSelectionVersions.current[pointTarget]) return;
    const point = { latitude, longitude, address };
    if (pointTarget === 'pickup') setPickup(point);
    else setDropoff(point);
    invalidateEstimate();
  }

  function focusPoint(point: Point) {
    setCenter(point);
    mapRef.current?.flyTo(point, 16);
  }

  function openZonePicker(zoneId: string | null) {
    // Two Modals can't be shown at once on iOS, so leave fullscreen-map mode first.
    setIsMapExpanded(false);
    setZonePickerZoneId(zoneId);
    setZonePickerOpen(true);
  }

  // A place chosen from the zone picker becomes the active pickup/destination.
  function applyZonePlace(zone: FareZone, place: ZonePlace) {
    const pointTarget = target;
    pointSelectionVersions.current[pointTarget] += 1;
    const point: Point = {
      latitude: place.latitude,
      longitude: place.longitude,
      address: zone.id === 'zone-1' ? 'Dapitan Island Poblacion' : `${place.name}, Dapitan City`,
      fareZoneId: zone.id,
      farePlaceId: place.id,
    };
    setError('');
    if (pointTarget === 'pickup') setPickup(point);
    else setDropoff(point);
    invalidateEstimate();
    setZonePickerOpen(false);
    focusPoint(point);
  }

  function setAddress(targetPoint: MapTarget, value: string) {
    pointSelectionVersions.current[targetPoint] += 1;
    invalidateEstimate();
    if (targetPoint === 'pickup') setPickup((p) => ({ ...p, address: value, fareZoneId: undefined, farePlaceId: undefined }));
    else setDropoff((p) => ({ ...p, address: value, fareZoneId: undefined, farePlaceId: undefined }));
  }

  function openSchedulePicker() {
    const minimumDate = new Date(Date.now() + 30 * 60 * 1000);
    if (Platform.OS !== 'android') {
      setShowPicker(true);
      return;
    }

    const current = scheduledFor || new Date(Date.now() + 45 * 60 * 1000);
    DateTimePickerAndroid.open({
      value: current,
      mode: 'date',
      minimumDate,
      onChange: (event, date) => {
        if (event.type === 'dismissed' || !date) return;

        const selectedDate = new Date(current);
        selectedDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
        DateTimePickerAndroid.open({
          value: selectedDate,
          mode: 'time',
          onChange: (timeEvent, time) => {
            if (timeEvent.type === 'dismissed' || !time) return;

            selectedDate.setHours(time.getHours(), time.getMinutes(), 0, 0);
            setScheduledFor(selectedDate);
          },
        });
      },
    });
  }

  // Free, OS-level forward geocoding (address text -> coordinates) via
  // expo-location — the same no-cost, no-API-key service already used by
  // reverseGeocode above, just running the other direction. Fired when the
  // user finishes editing an address field (onEndEditing), not on every
  // keystroke, so we're not hammering the geocoder while they're mid-type.
  async function forwardGeocode(targetPoint: MapTarget, address: string) {
    const trimmed = address.trim();
    if (!trimmed) return;

    const selectionVersion = ++pointSelectionVersions.current[targetPoint];
    setGeocodingTarget(targetPoint);
    setError('');
    try {
      const results = await Location.geocodeAsync(trimmed);
      const hit = results[0];
      if (!hit) {
        setError(`Couldn't find a location for "${trimmed}". Try a more specific address, or tap the map instead.`);
        return;
      }
      if (selectionVersion !== pointSelectionVersions.current[targetPoint]) return;
      const point = { latitude: hit.latitude, longitude: hit.longitude, address: trimmed };
      if (targetPoint === 'pickup') setPickup(point);
      else setDropoff(point);
      invalidateEstimate();
      if (target === targetPoint) focusPoint(point);
    } catch {
      setError('Address lookup failed. Please check your connection, or tap the map instead.');
    } finally {
      setGeocodingTarget(null);
    }
  }

  const coordinates = useMemo(() => ({
    pickupLatitude: pickup.latitude,
    pickupLongitude: pickup.longitude,
    dropoffLatitude: dropoff.latitude,
    dropoffLongitude: dropoff.longitude,
    pickupZoneId: pickup.fareZoneId,
    pickupPlaceId: pickup.farePlaceId,
    dropoffZoneId: dropoff.fareZoneId,
    dropoffPlaceId: dropoff.farePlaceId,
  }), [pickup, dropoff]);

  function invalidateEstimate() {
    estimateRequestId.current += 1;
    setEstimate(null);
    setLoading(false);
  }

  async function getEstimate() {
    setError('');
    if (!hasAddresses) {
      setError('Please provide both pickup and destination addresses.');
      return;
    }
    if (!hasOfficialRoute) {
      setError('Choose pickup and destination from the official fare-zone list. Unlisted routes cannot be booked at an official fare.');
      return;
    }
    const requestId = ++estimateRequestId.current;
    setLoading(true);
    setEstimate(null);
    try {
      const nextEstimate = await api.estimateFare({ ...coordinates, spScRequested });
      if (requestId !== estimateRequestId.current) return;
      setEstimate(nextEstimate);
      setBookingFee(nextEstimate.bookingFee);
      setBookingFeeError('');
    } catch (e) {
      if (requestId === estimateRequestId.current)
        setError(e instanceof Error ? e.message : 'Unable to estimate fare.');
    } finally {
      if (requestId === estimateRequestId.current) setLoading(false);
    }
  }

  async function confirmBooking() {
    if (!session || !estimate) return;

    if (rideTiming === 'later') {
      if (!scheduledFor) {
        setError('Please choose a date and time for your scheduled ride.');
        return;
      }
      // Mirrors the backend's ops.scheduled_min_lead_minutes check (default
      // 30) — this is just a fast client-side check so the user doesn't
      // wait on a round-trip for an obviously-too-soon time; the backend
      // is still the source of truth and will reject it either way.
      const minLeadMs = 30 * 60 * 1000;
      if (scheduledFor.getTime() < Date.now() + minLeadMs) {
        setError('Scheduled rides must be booked at least 30 minutes in advance.');
        return;
      }
    }

    setBooking(true);
    setError('');
    try {
      const trip = await api.bookTrip({
        ...coordinates,
        pickupAddress: pickup.address.trim(),
        dropoffAddress: dropoff.address.trim(),
        paymentMethod,
        vehicleType,
        spScRequested,
        scheduledFor: rideTiming === 'later' && scheduledFor ? scheduledFor.toISOString() : null,
      }, session.accessToken);

      if (rideTiming === 'later') {
        Alert.alert(
          'Ride scheduled',
          `Your ${vehicleType} ride is scheduled for ${scheduledFor!.toLocaleString()}. We'll match you with a driver closer to your ride time.`
        );
        router.replace('/(tabs)/bookings');
      } else {
        router.replace({ pathname: '/booking/searching', params: { tripId: trip.id } });
      }
    } catch (e) {
      Alert.alert('Booking failed', e instanceof Error ? e.message : 'Unable to book your ride.');
    } finally {
      setBooking(false);
    }
  }

  // Shared by the inline map card and the fullscreen Modal. `expanded` only
  // changes which icon the corner button shows.
  function renderMapContent(expanded: boolean) {
    return (
      <>
        <LeafletMapPicker
          key={serviceArea ? `${serviceArea.latitude}-${serviceArea.longitude}-${serviceArea.radiusKm}` : 'default-service-area'}
          ref={mapRef}
          initialCenter={center}
          initialZoom={15}
          pickup={pickup}
          dropoff={dropoff}
          onMapPress={(point) => selectPoint(point.latitude, point.longitude)}
          onReady={() => setMapReady(true)}
          serviceArea={serviceArea}
          zones={MAP_ZONES}
          // Tapping a "Zone N" label zooms to that zone and opens its place list.
          onZonePress={(zoneId) => { mapRef.current?.focusZone(zoneId); openZonePicker(zoneId); }}
        />
        <View style={styles.mapOverlay} pointerEvents="none">
          <Text style={styles.mapHint}>Tap anywhere to place the {target === 'pickup' ? 'pickup' : 'destination'} pin.</Text>
        </View>
        <View style={styles.mapActions}>
          <Pressable style={[styles.locationButton, locationLoading && styles.disabled]} onPress={loadCurrentLocation} disabled={locationLoading}>
            {locationLoading ? <ActivityIndicator size="small" color={colors.brand} /> : <Text style={styles.locationIcon}>⌖</Text>}
            <Text style={styles.locationButtonText}>Use my location</Text>
          </Pressable>
        </View>
        <Pressable style={styles.expandButton} onPress={() => setIsMapExpanded(!expanded)} hitSlop={10}>
          <Text style={styles.expandIcon}>{expanded ? '⤬' : '⛶'}</Text>
        </Pressable>
        {!mapReady && <View style={styles.mapLoading}><ActivityIndicator color={colors.brand} /><Text style={styles.mapLoadingText}>Loading map…</Text></View>}
      </>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={scrollEnabled}
      >
        <View>
          <Text style={styles.title}>Book a ride</Text>
          <Text style={styles.subtitle}>Set your pickup and destination on the map.</Text>
        </View>

        {!isMapExpanded && (
          <View
            style={styles.mapCard}
            onTouchStart={() => setScrollEnabled(false)}
            onTouchEnd={() => setScrollEnabled(true)}
            onTouchCancel={() => setScrollEnabled(true)}
          >
            {renderMapContent(false)}
          </View>
        )}

        {/* Fullscreen mode: the same map content inside a Modal. Only one of
            the two is ever mounted, so there is one WebView and one ref. */}
        <Modal visible={isMapExpanded} animationType="slide" onRequestClose={() => setIsMapExpanded(false)}>
          <View style={styles.fullscreenMapCard}>{isMapExpanded ? renderMapContent(true) : null}</View>
        </Modal>

        <View style={styles.selectorRow}>
          <Pressable style={[styles.selector, target === 'pickup' && styles.selectorActive]} onPress={() => { setTarget('pickup'); focusPoint(pickup); }}>
            <View style={[styles.dot, { backgroundColor: colors.brand }]} />
            <View style={styles.selectorText}><Text style={styles.selectorLabel}>PICKUP</Text><Text numberOfLines={1} style={styles.selectorValue}>{pickup.address || 'Choose pickup point'}</Text></View>
          </Pressable>
          <Pressable style={[styles.selector, target === 'dropoff' && styles.selectorActive]} onPress={() => { setTarget('dropoff'); focusPoint(dropoff); }}>
            <View style={[styles.dot, { backgroundColor: '#E85D5D' }]} />
            <View style={styles.selectorText}><Text style={styles.selectorLabel}>DESTINATION</Text><Text numberOfLines={1} style={styles.selectorValue}>{dropoff.address || 'Choose destination'}</Text></View>
          </Pressable>
        </View>

        <Pressable style={styles.zoneButton} onPress={() => openZonePicker(null)}>
          <Text style={styles.zoneButtonText}>Choose {target === 'pickup' ? 'pickup' : 'destination'} by zone · see fares</Text>
          <Text style={styles.zoneButtonChevron}>›</Text>
        </Pressable>
        {!!bookingFeeError && <Text style={styles.geocodingHint}>{bookingFeeError} The fare estimate will show the configured fee.</Text>}

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: spScRequested }}
          style={[styles.spScOption, spScRequested && styles.spScOptionSelected]}
          onPress={() => { setSpScRequested(!spScRequested); invalidateEstimate(); }}
        >
          <View style={[styles.spScCheckbox, spScRequested && styles.spScCheckboxSelected]}>
            {spScRequested && <Text style={styles.spScCheck}>✓</Text>}
          </View>
          <View style={styles.spScText}>
            <Text style={styles.spScTitle}>Request SP/SC discount</Text>
            <Text style={styles.spScHint}>A valid ID must be checked by your driver at pickup. The discount applies only after verification.</Text>
          </View>
        </Pressable>

        <AppInput
          label="Pickup address"
          value={pickup.address}
          onChangeText={(v) => setAddress('pickup', v)}
          onEndEditing={() => forwardGeocode('pickup', pickup.address)}
          placeholder="Pickup address"
        />
        {geocodingTarget === 'pickup' && <Text style={styles.geocodingHint}>Locating…</Text>}
        <AppInput
          label="Destination"
          value={dropoff.address}
          onChangeText={(v) => setAddress('dropoff', v)}
          onEndEditing={() => forwardGeocode('dropoff', dropoff.address)}
          placeholder="Where are you going?"
        />
        {geocodingTarget === 'dropoff' && <Text style={styles.geocodingHint}>Locating…</Text>}

        <View style={styles.coordinateCard}>
          <Text style={styles.coordinateTitle}>{target === 'pickup' ? 'Pickup coordinates' : 'Destination coordinates'}</Text>
          <Text style={styles.coordinateText}>{activePoint.latitude.toFixed(6)}, {activePoint.longitude.toFixed(6)}</Text>
        </View>

        <Text style={styles.sectionTitle}>Vehicle type</Text>
        <View style={styles.paymentRow}>
          {(['motorcycle', 'motorcab'] as const).map((type) => (
            <Pressable
              key={type}
              style={[styles.payment, vehicleType === type && styles.paymentActive]}
              onPress={() => setVehicleType(type)}
            >
              <Text style={[styles.paymentText, vehicleType === type && styles.paymentTextActive]}>
                {type === 'motorcycle' ? 'Motorcycle' : 'Motorcab / Baobao'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>When</Text>
        <View style={styles.paymentRow}>
          <Pressable
            style={[styles.payment, rideTiming === 'now' && styles.paymentActive]}
            onPress={() => { setRideTiming('now'); setScheduledFor(null); }}
          >
            <Text style={[styles.paymentText, rideTiming === 'now' && styles.paymentTextActive]}>Ride now</Text>
          </Pressable>
          <Pressable
            style={[styles.payment, rideTiming === 'later' && styles.paymentActive]}
            onPress={() => setRideTiming('later')}
          >
            <Text style={[styles.paymentText, rideTiming === 'later' && styles.paymentTextActive]}>Schedule for later</Text>
          </Pressable>
        </View>

        {rideTiming === 'later' && (
          <Pressable style={styles.coordinateCard} onPress={openSchedulePicker}>
            <Text style={styles.coordinateTitle}>PICK-UP TIME</Text>
            <Text style={styles.coordinateText}>
              {scheduledFor ? scheduledFor.toLocaleString() : 'Tap to choose a date and time'}
            </Text>
          </Pressable>
        )}
        {showPicker && (
          <DateTimePicker
            value={scheduledFor || new Date(Date.now() + 45 * 60 * 1000)}
            mode="datetime"
            minimumDate={new Date(Date.now() + 30 * 60 * 1000)}
            onChange={(_event, date) => {
              setShowPicker(Platform.OS === 'ios');
              if (date) setScheduledFor(date);
            }}
          />
        )}

        <Text style={styles.sectionTitle}>Payment method</Text>
        <View style={styles.paymentRow}>
          {(['cash', 'gcash', 'card'] as const).map((method) => (
            <Pressable key={method} style={[styles.payment, paymentMethod === method && styles.paymentActive]} onPress={() => setPaymentMethod(method)}>
              <Text style={[styles.paymentText, paymentMethod === method && styles.paymentTextActive]}>{method.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}
        <AppButton title="Estimate fare" onPress={getEstimate} loading={loading} disabled={!hasAddresses || geocodingTarget !== null} />

        {estimate && (
          <View style={styles.estimateCard}>
            <View style={styles.estimateHeader}><Text style={styles.estimateTitle}>Your trip estimate</Text><Text style={styles.paymentBadge}>{paymentMethod.toUpperCase()}</Text></View>
            <View style={styles.priceRow}><Text style={styles.muted}>Distance</Text><Text style={styles.value}>{estimate.estimatedDistanceKm.toFixed(1)} km</Text></View>
            <View style={styles.priceRow}><Text style={styles.muted}>Estimated time</Text><Text style={styles.value}>{estimate.estimatedMinutes} min</Text></View>
            <View style={styles.priceRow}><Text style={styles.muted}>Regular base fare</Text><Text style={styles.value}>₱{Number(estimate.baseFare).toFixed(2)}</Text></View>
            {spScRequested && estimate.discountedBaseFare != null && (
              <View style={styles.priceRow}><Text style={styles.muted}>SP/SC base fare if verified</Text><Text style={styles.value}>₱{Number(estimate.discountedBaseFare).toFixed(2)}</Text></View>
            )}
            <View style={styles.priceRow}><Text style={styles.muted}>Booking fee</Text><Text style={styles.value}>₱{Number(estimate.bookingFee).toFixed(2)}</Text></View>
            <View style={[styles.priceRow, styles.total]}><Text style={styles.totalLabel}>{spScRequested ? 'Total before ID verification' : 'Estimated total'}</Text><Text style={styles.totalValue}>₱{Number(estimate.estimatedTotal).toFixed(2)}</Text></View>
            {spScRequested && estimate.discountedTotal != null && (
              <View style={styles.priceRow}><Text style={styles.muted}>SP/SC total if driver verifies ID</Text><Text style={styles.value}>₱{Number(estimate.discountedTotal).toFixed(2)}</Text></View>
            )}
            <AppButton title={rideTiming === 'later' ? 'Schedule ride' : 'Confirm ride'} onPress={confirmBooking} loading={booking} />
          </View>
        )}
      </ScrollView>
      <ZonePlacePicker
        visible={zonePickerOpen}
        target={target}
        initialZoneId={zonePickerZoneId}
        pickup={pickup}
        dropoff={dropoff}
        bookingFee={bookingFee}
        onClose={() => setZonePickerOpen(false)}
        onSelect={applyZonePlace}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12, paddingBottom: 30 },
  title: { fontSize: 28, fontWeight: '900', color: colors.text },
  subtitle: { marginTop: 3, color: colors.muted },
  mapCard: { height: 330, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, position: 'relative' },
  map: { ...StyleSheet.absoluteFill },
  mapOverlay: { position: 'absolute', top: 12, left: 12, right: 12, alignItems: 'center' },
  mapHint: { backgroundColor: 'rgba(255,255,255,0.94)', color: colors.text, fontSize: 12, fontWeight: '700', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, overflow: 'hidden' },
  mapActions: { position: 'absolute', bottom: 12, left: 12 },
  locationButton: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.surface, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 10, borderWidth: 1, borderColor: colors.border },
  locationIcon: { color: colors.brand, fontSize: 20, fontWeight: '900' },
  locationButtonText: { color: colors.text, fontWeight: '800', fontSize: 12 },
  disabled: { opacity: 0.65 },
  fullscreenMapCard: { flex: 1, backgroundColor: colors.surface, position: 'relative' },
  expandButton: {
    position: 'absolute', top: 14, right: 14, width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  expandIcon: { color: '#fff', fontSize: 18 },
  zoneButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: colors.brandSoft, borderRadius: 14, borderWidth: 1, borderColor: colors.brand,
  },
  zoneButtonText: { color: colors.brand, fontWeight: '800', fontSize: 14 },
  zoneButtonChevron: { color: colors.brand, fontSize: 22 },
  spScOption: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  spScOptionSelected: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  spScCheckbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  spScCheckboxSelected: { borderColor: colors.brand, backgroundColor: colors.brand },
  spScCheck: { color: '#fff', fontWeight: '900', fontSize: 14 },
  spScText: { flex: 1 },
  spScTitle: { color: colors.text, fontWeight: '800' },
  spScHint: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  mapLoading: { ...StyleSheet.absoluteFill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 8 },
  mapLoadingText: { color: colors.muted },
  selectorRow: { gap: 8 },
  selector: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: colors.surface, borderRadius: 15, padding: 12, borderWidth: 1, borderColor: colors.border },
  selectorActive: { borderColor: colors.brand, borderWidth: 2 },
  dot: { width: 11, height: 11, borderRadius: 6 },
  selectorText: { flex: 1 },
  selectorLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  selectorValue: { color: colors.text, fontWeight: '700', marginTop: 3 },
  coordinateCard: { backgroundColor: colors.brandSoft, borderRadius: 12, padding: 10 },
  coordinateTitle: { color: colors.brandDark, fontSize: 11, fontWeight: '900' },
  coordinateText: { color: colors.text, fontSize: 12, marginTop: 3 },
  geocodingHint: { color: colors.brandDark, fontSize: 12, fontWeight: '700', marginTop: -6 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: colors.text, marginTop: 3 },
  paymentRow: { flexDirection: 'row', gap: 8 },
  payment: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  paymentActive: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  paymentText: { color: colors.muted, fontWeight: '900', fontSize: 12 },
  paymentTextActive: { color: colors.brandDark },
  error: { color: colors.danger, lineHeight: 19 },
  estimateCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 18, gap: 11, borderWidth: 1, borderColor: colors.border },
  estimateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  estimateTitle: { fontSize: 20, fontWeight: '900', color: colors.text },
  paymentBadge: { fontSize: 10, fontWeight: '900', color: colors.brandDark, backgroundColor: colors.brandSoft, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between' },
  muted: { color: colors.muted },
  value: { color: colors.text, fontWeight: '700' },
  total: { borderTopWidth: 1, borderColor: colors.border, paddingTop: 12, marginTop: 4 },
  totalLabel: { fontSize: 18, fontWeight: '900', color: colors.text },
  totalValue: { fontSize: 22, fontWeight: '900', color: colors.brand },
});