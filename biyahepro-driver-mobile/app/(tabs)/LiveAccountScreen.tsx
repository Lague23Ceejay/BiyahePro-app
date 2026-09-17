import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton } from '@/src/components/AppButton';
import { useAuth } from '@/src/context/AuthContext';
import { api } from '@/src/lib/api';
import { colors } from '@/src/theme/colors';

export default function LiveAccountScreen() {
  const { session, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [earnings, setEarnings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.accessToken) return;
    Promise.all([api.getProfile(session.accessToken), api.getEarnings(session.accessToken)])
      .then(([nextProfile, nextEarnings]) => { setProfile(nextProfile); setEarnings(nextEarnings); })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [session?.accessToken]);

  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.brand} /></View>;
  const name = profile?.fullName || session?.fullName || 'Driver';
  const vehicle = profile?.vehicle;
  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <View style={styles.top}><Text style={styles.title}>Driver Profile</Text><Text style={styles.name}>{name}</Text><Text style={styles.meta}>{vehicle ? `${vehicle.vehicleType} · ${vehicle.plateNumber}` : 'Vehicle profile not registered'}</Text></View>
    <View style={styles.stats}><Stat value={String(profile?.totalTrips ?? 0)} label="Total Trips" /><Stat value={Number(profile?.rating ?? 0).toFixed(1)} label="Rating" /><Stat value={`P${Number(earnings?.totalEarnings ?? 0).toFixed(2)}`} label="Earnings" /></View>
    <View style={styles.card}><Text style={styles.cardTitle}>Verification</Text><Text style={styles.detail}>{profile?.isDocumentsVerified ? 'All documents approved' : 'Documents pending review'}</Text></View>
    <View style={styles.card}><Text style={styles.cardTitle}>Vehicle</Text><Text style={styles.detail}>{vehicle ? `${vehicle.vehicleType} · ${vehicle.plateNumber}` : 'Not registered'}</Text></View>
    {(!profile?.licenseNumber || !vehicle) && <AppButton title="Complete your profile" onPress={() => router.push('/profile/complete' as never)} />}
    <Pressable style={{ margin: 18, borderWidth: 1, borderColor: colors.danger, borderRadius: 12, minHeight: 46, alignItems: 'center', justifyContent: 'center' }} onPress={signOut}><Text style={{ color: colors.danger, fontWeight: '900' }}>Sign Out</Text></Pressable>
  </ScrollView>;
}

function Stat({ value, label }: { value: string; label: string }) { return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.background }, content: { paddingBottom: 25 }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center' }, top: { backgroundColor: colors.brand, padding: 18, paddingTop: 25 }, title: { color: '#fff', fontSize: 16, fontWeight: '900' }, name: { color: '#fff', fontSize: 19, fontWeight: '900', marginTop: 20 }, meta: { color: '#FFE7D9', fontSize: 12, marginTop: 3 }, stats: { backgroundColor: colors.surface, margin: 18, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-around' }, stat: { alignItems: 'center' }, statValue: { color: colors.brand, fontSize: 17, fontWeight: '900' }, statLabel: { color: colors.muted, fontSize: 11, marginTop: 3 }, card: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, marginHorizontal: 18, marginBottom: 12, padding: 14 }, cardTitle: { color: colors.text, fontSize: 13, fontWeight: '800' }, detail: { color: colors.muted, fontSize: 12, marginTop: 5 } });
