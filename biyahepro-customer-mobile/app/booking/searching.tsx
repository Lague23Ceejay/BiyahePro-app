import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { api } from '@/src/lib/api';
import { describeProgress } from '@/src/lib/geo';
import { LiveTripMap } from '@/src/components/LiveTripMap';
import type { Trip } from '@/src/types/api';
import { useTripUpdates } from '@/src/lib/tripHub';
import { colors } from '@/src/theme/colors';

const LIVE_STATUSES = ['accepted', 'en_route', 'arrived', 'in_progress'];

export default function SearchingForDriverScreen() {
  const { session } = useAuth();
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const { status: pushedStatus, connectionState, driverLocation } = useTripUpdates(tripId, session?.accessToken, 'requested');
  // Full trip snapshot: gives us the pickup/drop-off coordinates for the map,
  // the driver's name/plate, and doubles as the one-time status catch-up.
  const [trip, setTrip] = useState<Trip | null>(null);
  const seedStatus = trip?.status ?? null;
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');
  const navigatedRef = useRef(false);

  // Catch-up + trip details. Re-runs when the pushed status changes so the
  // driver's name/plate show up as soon as someone accepts. Each run's
  // cleanup flips `active`, so a slow response from an earlier run can never
  // overwrite a newer snapshot (out-of-order responses are simply dropped).
  useEffect(() => {
    if (!session || !tripId) return;
    let active = true;
    api.getTripHistory(session.accessToken, 1, 20)
      .then((result) => {
        const found = result.items.find((item) => item.id === tripId);
        if (active && found) setTrip(found);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [session, tripId, pushedStatus]);

  const status = pushedStatus === 'requested' && seedStatus ? seedStatus : pushedStatus;

  useEffect(() => {
    if (navigatedRef.current || !tripId) return;
    if (status === 'completed') {
      navigatedRef.current = true;
      router.replace({ pathname: '/booking/rate' as any, params: { tripId } } as any);
    } else if (status === 'cancelled') {
      navigatedRef.current = true;
      router.replace('/(tabs)/bookings');
    }
  }, [status, tripId]);

  const currentStatus = status ?? 'requested';
  const assigned = LIVE_STATUSES.includes(currentStatus);

  const pickup = trip && trip.pickupLatitude != null && trip.pickupLongitude != null
    ? { latitude: trip.pickupLatitude, longitude: trip.pickupLongitude } : null;
  const dropoff = trip && trip.dropoffLatitude != null && trip.dropoffLongitude != null
    ? { latitude: trip.dropoffLatitude, longitude: trip.dropoffLongitude } : null;
  const target: 'pickup' | 'dropoff' = currentStatus === 'in_progress' ? 'dropoff' : 'pickup';
  const progress = describeProgress(driverLocation, target === 'dropoff' ? dropoff : pickup);

  // Copy that follows the ride instead of saying "on the way" the whole time.
  const driverInfo = [trip?.driverName, trip?.plateNumber].filter(Boolean).join(' · ');
  let title = 'Finding your driver';
  let subtitle = 'We sent your booking to available drivers nearby.';
  let liveCopy = 'Waiting for a driver to accept your booking';
  if (currentStatus === 'arrived') {
    title = 'Your driver has arrived';
    subtitle = driverInfo ? `Meet ${driverInfo} at the pickup point.` : 'Meet your driver at the pickup point.';
    liveCopy = 'Driver is at the pickup point';
  } else if (currentStatus === 'in_progress') {
    title = 'Trip in progress';
    subtitle = 'Sit back — you are on your way to your destination.';
    liveCopy = progress === 'Right here' ? 'Arriving at your destination' : progress ? `${progress} to destination` : 'On the way to your destination';
  } else if (assigned) {
    title = 'Driver on the way';
    subtitle = driverInfo ? `${driverInfo} is heading to your pickup point.` : 'Your ride has been accepted. Your driver is on the way.';
    liveCopy = progress === 'Right here' ? 'Your driver is almost there' : progress ? `${progress} away` : 'Locating your driver…';
  }

  async function cancelBooking() {
    if (!session?.accessToken || !tripId) return;
    setCancelling(true);
    setError('');
    try {
      await api.cancelTrip(tripId, 'Customer cancelled the booking.', session.accessToken);
      router.replace('/(tabs)/bookings');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to cancel this booking.');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <View style={styles.page}>
      {assigned ? (
        <View style={styles.mapWrap}>
          <LiveTripMap pickup={pickup} dropoff={dropoff} driver={driverLocation} target={target} driverLabel="Driver" height={250} />
        </View>
      ) : (
        <View style={styles.circle}><ActivityIndicator size="large" color={colors.brand} /></View>
      )}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      <View style={styles.statusCard}>
        <View style={[styles.statusDot, connectionState !== 'connected' && styles.statusDotMuted]} />
        <View style={styles.statusText}>
          <Text style={styles.statusTitle}>{currentStatus.replace('_', ' ').toUpperCase()}</Text>
          <Text style={styles.statusCopy}>
            {connectionState === 'connecting'
              ? 'Connecting to live tracking…'
              : connectionState === 'disconnected'
                ? 'Reconnecting…'
                : liveCopy}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.secondaryButton} onPress={() => router.replace('/(tabs)/bookings')}><Text style={styles.secondaryText}>View my bookings</Text></Pressable>
        <Pressable style={styles.cancelButton} onPress={cancelBooking} disabled={cancelling}><Text style={styles.cancelText}>{cancelling ? 'Cancelling...' : 'Cancel booking'}</Text></Pressable>
        <Pressable style={styles.linkButton} onPress={() => router.replace('/(tabs)')}><Text style={styles.linkText}>Back to home</Text></Pressable>
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background, padding: 24, alignItems: 'center', justifyContent: 'center' },
  mapWrap: { width: '100%', borderRadius: 18, overflow: 'hidden', marginBottom: 18, borderWidth: 1, borderColor: colors.border },
  circle: { width: 104, height: 104, borderRadius: 52, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 26 },
  title: { fontSize: 28, fontWeight: '900', color: colors.text, textAlign: 'center' },
  subtitle: { marginTop: 8, color: colors.muted, textAlign: 'center', lineHeight: 21, maxWidth: 330 },
  statusCard: { width: '100%', marginTop: 26, flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 16 },
  statusDot: { width: 13, height: 13, borderRadius: 7, backgroundColor: colors.brand },
  statusDotMuted: { backgroundColor: colors.muted },
  statusText: { flex: 1 },
  statusTitle: { color: colors.brandDark, fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  statusCopy: { color: colors.muted, marginTop: 4, lineHeight: 18 },
  actions: { width: '100%', marginTop: 22, gap: 10 },
  secondaryButton: { backgroundColor: colors.brand, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  secondaryText: { color: '#fff', fontWeight: '900' },
  linkButton: { paddingVertical: 10, alignItems: 'center' },
  linkText: { color: colors.brandDark, fontWeight: '800' },
  cancelButton: { paddingVertical: 10, alignItems: 'center' },
  cancelText: { color: colors.danger, fontWeight: '800' },
  error: { color: colors.danger, textAlign: 'center', marginTop: 12 },
});