import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { colors } from '@/src/theme/colors';

export function MapPreview({ compact = false }: { compact?: boolean }) {
  return <View style={[styles.wrap, compact && styles.compact]}><MapView style={StyleSheet.absoluteFill} initialRegion={{ latitude: 8.152, longitude: 123.258, latitudeDelta: 0.08, longitudeDelta: 0.08 }}><Marker coordinate={{ latitude: 8.152, longitude: 123.258 }} title="BiyahePro pickup" /></MapView><View style={styles.badge}><Text style={styles.badgeText}>Maps</Text></View><View style={styles.status}><View style={styles.dot} /><Text style={styles.statusText}>Accepting rides</Text></View></View>;
}

const styles = StyleSheet.create({ wrap: { height: 205, overflow: 'hidden', backgroundColor: '#9CDCE9' }, compact: { height: 180 }, badge: { position: 'absolute', top: 10, left: 12, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 2 }, badgeText: { color: '#1671D9', fontSize: 12, fontWeight: '700' }, status: { position: 'absolute', right: 12, bottom: 12, backgroundColor: '#fff', borderRadius: 15, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }, dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success }, statusText: { color: colors.text, fontSize: 12, fontWeight: '700' } });
