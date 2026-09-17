import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MapPreview } from '@/src/components/MapPreview';
import { api } from '@/src/lib/api';
import { useAuth } from '@/src/context/AuthContext';
import { colors } from '@/src/theme/colors';
import { useDriverRideEvents } from '@/src/lib/rideHub';

const activeStatuses = new Set(['accepted', 'en_route', 'arrived', 'in_progress']);

// What the driver sees for the current trip status, and the single
// action that advances it. 'accepted' isn't listed here — the moment a
// trip loads as 'accepted' it's auto-advanced to 'en_route' below, since
// there's no distinct "start heading to pickup" action in the design
// (accepting a ride and heading there are the same moment for the driver).
const STEP: Record<string, { label: string; buttonText: string; next: string } | undefined> = {
  en_route:    { label: 'Heading to Pickup', buttonText: 'Arrived at Pickup', next: 'arrived' },
  arrived:     { label: 'Waiting at Pickup', buttonText: 'Start Trip',        next: 'in_progress' },
  in_progress: { label: 'Trip in Progress',  buttonText: 'Complete Trip',     next: 'completed' },
};

export default function ActiveScreen() {
  const { session } = useAuth();
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState('');
  useDriverRideEvents(session?.accessToken, { onTripCancelled: (tripId) => { if (trip?.id === tripId) setTrip(null); } });

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    try {
      const result = await api.getHistory(session.accessToken);
      const found = (result.items || []).find((item: any) => activeStatuses.has(item.status)) || null;
      setTrip(found);
    } catch {
      setTrip(null);
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  // Re-check whenever this tab regains focus (e.g. right after accepting
  // a ride on the Home tab) rather than only once on first mount.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // A freshly-accepted trip has no distinct driver action for "start
  // heading to pickup" in this design — accepting it and heading there
  // are the same moment. Advance it once, automatically.
  useEffect(() => {
    if (!session?.accessToken || !trip || trip.status !== 'accepted') return;
    api.updateTripStatus(session.accessToken, trip.id, 'en_route')
      .then(() => load())
      .catch(() => {});
  }, [trip?.id, trip?.status, session?.accessToken, load]);

  async function advance() {
    if (!session?.accessToken || !trip) return;
    const step = STEP[trip.status];
    if (!step) return;
    setAdvancing(true);
    setError('');
    try {
      await api.updateTripStatus(session.accessToken, trip.id, step.next);
      if (step.next === 'completed') {
        Alert.alert('Trip completed', 'Nice work — this ride has been marked complete.');
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update this trip.');
    } finally {
      setAdvancing(false);
    }
  }

  const step = trip ? STEP[trip.status] : undefined;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <MapPreview compact />
      {loading ? (
        <View style={styles.empty}><ActivityIndicator color={colors.brand} /></View>
      ) : !trip ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No active ride</Text>
          <Text style={styles.muted}>Accepted customer bookings will appear here.</Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.step}>{(step?.label || trip.status).toString()}</Text>
          <Text style={styles.name}>{trip.customerName || 'Customer'}</Text>
          <View style={styles.route}>
            <Text><Text style={styles.green}>●</Text> {trip.pickupAddress}</Text>
            <Text><Text style={styles.orange}>●</Text> {trip.dropoffAddress}</Text>
          </View>
          <Text style={styles.fare}>₱{Number(trip.fareAmount || 0).toFixed(2)}</Text>

          {!!error && <Text style={styles.error}>{error}</Text>}

          {step && (
            <Pressable style={[styles.actionButton, advancing && styles.actionButtonDisabled]} onPress={advance} disabled={advancing}>
              {advancing ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionButtonText}>{step.buttonText}</Text>}
            </Pressable>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 24 },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 34, gap: 8 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 15, borderWidth: 1, borderColor: colors.border, margin: 18, padding: 16 },
  step: { color: colors.brand, fontWeight: '800', textTransform: 'capitalize', marginBottom: 10 },
  name: { color: colors.text, fontWeight: '800', fontSize: 16 },
  route: { backgroundColor: '#F8F9FA', borderRadius: 10, padding: 12, gap: 9, marginVertical: 15 },
  green: { color: colors.success },
  orange: { color: colors.brand },
  fare: { color: colors.brand, fontWeight: '900', fontSize: 17 },
  error: { color: colors.danger, fontSize: 12, marginTop: 10 },
  actionButton: { marginTop: 16, backgroundColor: colors.brand, borderRadius: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  actionButtonDisabled: { opacity: 0.7 },
  actionButtonText: { color: '#fff', fontWeight: '900', fontSize: 15 },
});