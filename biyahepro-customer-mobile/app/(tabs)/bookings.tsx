import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { api } from '@/src/lib/api';
import { useAuth } from '@/src/context/AuthContext';
import type { Trip } from '@/src/types/api';
import { colors } from '@/src/theme/colors';

export default function BookingsScreen() {
  const { session } = useAuth();
  const [items, setItems] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (!session) return;
    refresh ? setRefreshing(true) : setLoading(true);
    try { const result = await api.getTripHistory(session.accessToken); setItems(result.items); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load trips.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [session]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.brand} size="large" /></View>;
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
      {!!error && <Text style={styles.error}>{error}</Text>}
      {!items.length && !error ? <View style={styles.empty}><Text style={styles.emptyTitle}>No bookings yet</Text><Text style={styles.muted}>Your rides will appear here.</Text></View> : null}
      {items.map((trip) => <View key={trip.id} style={styles.card}>
        <View style={styles.row}><Text style={styles.status}>{trip.status.replace('_', ' ').toUpperCase()}</Text><Text style={styles.fare}>₱{Number(trip.fareAmount).toFixed(2)}</Text></View>
        <Text style={styles.address}>From: {trip.pickupAddress}</Text>
        <Text style={styles.address}>To: {trip.dropoffAddress}</Text>
        {trip.spScStatus === 'pending' && <Text style={styles.spScNote}>SP/SC ID check pending; regular fare applies until verified.</Text>}
        {trip.spScStatus === 'verified' && <Text style={styles.spScNote}>SP/SC ID verified; 20% discount applied to the base fare.</Text>}
        {trip.spScStatus === 'rejected' && <Text style={styles.spScNote}>SP/SC ID was not verified; regular fare applies.</Text>}
        <Text style={styles.muted}>{new Date(trip.requestedAt).toLocaleString()}</Text>
        {trip.status === 'completed' && (
          <Pressable style={styles.rateButton} onPress={() => router.push({ pathname: '/booking/rate' as any, params: { tripId: trip.id } } as any)}>
            <Text style={styles.rateButtonText}>Rate this trip</Text>
          </Pressable>
        )}
      </View>)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background }, content: { padding: 18, gap: 12 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 7, borderWidth: 1, borderColor: colors.border }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  status: { color: colors.brand, fontSize: 12, fontWeight: '900' }, fare: { fontSize: 18, fontWeight: '900', color: colors.text }, address: { color: colors.text }, muted: { color: colors.muted, fontSize: 13 }, error: { color: colors.danger }, empty: { paddingVertical: 80, alignItems: 'center' }, emptyTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 5 },
  spScNote: { color: colors.brandDark, fontSize: 12, fontWeight: '700' },
  rateButton: { marginTop: 4, alignSelf: 'flex-start', backgroundColor: colors.brandSoft, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 }, rateButtonText: { color: colors.brandDark, fontWeight: '800', fontSize: 13 },
});