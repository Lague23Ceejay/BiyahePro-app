// File path in project: biyahepro-customer-mobile/app/booking/new.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LeafletMapPicker, type LeafletMapPickerHandle } from '@/src/components/LeafletMapPicker';
import { AppButton } from '@/src/components/AppButton';
import { AppInput } from '@/src/components/AppInput';
import { api } from '@/src/lib/api';
import { useAuth } from '@/src/context/AuthContext';
import type { FareEstimate, BookTripRequest } from '@/src/types/api';
import { colors } from '@/src/theme/colors';

type Point = { latitude: number; longitude: number; address: string };
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

  const activePoint = target === 'pickup' ? pickup : dropoff;
  const hasAddresses = Boolean(pickup.address.trim() && dropoff.address.trim());

  useEffect(() => {
    loadCurrentLocation();
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
      setPickup(point);
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
    const address = await reverseGeocode(latitude, longitude);
    const point = { latitude, longitude, address };
    if (target === 'pickup') setPickup(point);
    else setDropoff(point);
    setEstimate(null);
  }

  function focusPoint(point: Point) {
    setCenter(point);
    mapRef.current?.flyTo(point, 16);
  }

  function setAddress(targetPoint: MapTarget, value: string) {
    setEstimate(null);
    if (targetPoint === 'pickup') setPickup((p) => ({ ...p, address: value }));
    else setDropoff((p) => ({ ...p, address: value }));
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

    setGeocodingTarget(targetPoint);
    setError('');
    try {
      const results = await Location.geocodeAsync(trimmed);
      const hit = results[0];
      if (!hit) {
        setError(`Couldn't find a location for "${trimmed}". Try a more specific address, or tap the map instead.`);
        return;
      }
      const point = { latitude: hit.latitude, longitude: hit.longitude, address: trimmed };
      if (targetPoint === 'pickup') setPickup(point);
      else setDropoff(point);
      setEstimate(null);
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
  }), [pickup, dropoff]);

  async function getEstimate() {
    setError('');
    if (!hasAddresses) {
      setError('Please provide both pickup and destination addresses.');
      return;
    }
    setLoading(true);
    setEstimate(null);
    try {
      setEstimate(await api.estimateFare(coordinates));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to estimate fare.');
    } finally {
      setLoading(false);
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

        <View
          style={styles.mapCard}
          onTouchStart={() => setScrollEnabled(false)}
          onTouchEnd={() => setScrollEnabled(true)}
          onTouchCancel={() => setScrollEnabled(true)}
        >
          <LeafletMapPicker
            ref={mapRef}
            initialCenter={center}
            initialZoom={15}
            pickup={pickup}
            dropoff={dropoff}
            onMapPress={(point) => selectPoint(point.latitude, point.longitude)}
            onReady={() => setMapReady(true)}
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
          {!mapReady && <View style={styles.mapLoading}><ActivityIndicator color={colors.brand} /><Text style={styles.mapLoadingText}>Loading map…</Text></View>}
        </View>

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
            <View style={styles.priceRow}><Text style={styles.muted}>Base fare</Text><Text style={styles.value}>₱{Number(estimate.baseFare).toFixed(2)}</Text></View>
            <View style={styles.priceRow}><Text style={styles.muted}>Booking fee</Text><Text style={styles.value}>₱{Number(estimate.bookingFee).toFixed(2)}</Text></View>
            <View style={[styles.priceRow, styles.total]}><Text style={styles.totalLabel}>Estimated total</Text><Text style={styles.totalValue}>₱{Number(estimate.estimatedTotal).toFixed(2)}</Text></View>
            <AppButton title={rideTiming === 'later' ? 'Schedule ride' : 'Confirm ride'} onPress={confirmBooking} loading={booking} />
          </View>
        )}
      </ScrollView>
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