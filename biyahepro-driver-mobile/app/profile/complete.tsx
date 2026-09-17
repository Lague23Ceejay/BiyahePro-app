import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton } from '@/src/components/AppButton';
import { AppInput } from '@/src/components/AppInput';
import { useAuth } from '@/src/context/AuthContext';
import { api } from '@/src/lib/api';
import { colors } from '@/src/theme/colors';

export default function CompleteProfileScreen() {
  const { session } = useAuth();
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [year, setYear] = useState('');
  const [vehicleType, setVehicleType] = useState<'motorcycle' | 'motorcab'>('motorcycle');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session?.accessToken) return;
    api.getProfile(session.accessToken).then(profile => {
      const vehicle = profile.vehicle;
      setLicenseNumber(profile.licenseNumber || '');
      setLicenseExpiry(profile.licenseExpiry || '');
      setPlateNumber(vehicle?.plateNumber || '');
      setMake(vehicle?.make || '');
      setModel(vehicle?.model || '');
      setColor(vehicle?.color || '');
      setYear(vehicle?.year ? String(vehicle.year) : '');
      if (vehicle?.vehicleType === 'motorcab') setVehicleType('motorcab');
    }).catch(() => undefined);
  }, [session?.accessToken]);

  async function submit() {
    if (!session?.accessToken) return;
    setError('');
    setLoading(true);
    try {
      await api.completeProfile(session.accessToken, {
        licenseNumber: licenseNumber.trim(),
        licenseExpiry: licenseExpiry.trim(),
        plateNumber: plateNumber.trim(),
        make: make.trim(),
        model: model.trim(),
        color: color.trim(),
        year: Number(year),
        vehicleType,
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save your driver profile.');
    } finally {
      setLoading(false);
    }
  }

  const valid = Boolean(licenseNumber.trim() && /^\d{4}-\d{2}-\d{2}$/.test(licenseExpiry.trim()) && plateNumber.trim() && make.trim() && model.trim() && color.trim() && /^\d{4}$/.test(year.trim()));

  return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Complete your profile</Text>
      <Text style={styles.subtitle}>Add your driver's license and registered vehicle before receiving rides.</Text>
      <Text style={styles.sectionTitle}>Driver's license</Text>
      <AppInput label="License number" value={licenseNumber} onChangeText={setLicenseNumber} placeholder="N01-23-456789" autoCapitalize="characters" />
      <AppInput label="License expiry" value={licenseExpiry} onChangeText={setLicenseExpiry} placeholder="YYYY-MM-DD" />
      <Text style={styles.sectionTitle}>Registered vehicle</Text>
      <View style={styles.row}>{(['motorcycle', 'motorcab'] as const).map(type => <Pressable key={type} style={[styles.typeButton, vehicleType === type && styles.typeButtonActive]} onPress={() => setVehicleType(type)}><Text style={[styles.typeText, vehicleType === type && styles.typeTextActive]}>{type === 'motorcycle' ? 'Motorcycle' : 'Motorcab / Baobao'}</Text></Pressable>)}</View>
      <AppInput label="Plate number" value={plateNumber} onChangeText={setPlateNumber} placeholder="DAP-101" autoCapitalize="characters" />
      <View style={styles.row}><View style={styles.half}><AppInput label="Make" value={make} onChangeText={setMake} placeholder="Honda" /></View><View style={styles.half}><AppInput label="Model" value={model} onChangeText={setModel} placeholder="TMX" /></View></View>
      <View style={styles.row}><View style={styles.half}><AppInput label="Color" value={color} onChangeText={setColor} placeholder="Red" /></View><View style={styles.half}><AppInput label="Year" value={year} onChangeText={setYear} placeholder="2022" keyboardType="number-pad" /></View></View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <AppButton title="Save profile" onPress={submit} loading={loading} disabled={!valid} />
      <AppButton title="Cancel" onPress={() => router.back()} variant="secondary" />
    </ScrollView>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.background }, content: { padding: 24, gap: 12, paddingVertical: 40 }, title: { color: colors.text, fontSize: 28, fontWeight: '900' }, subtitle: { color: colors.muted, fontSize: 14, marginBottom: 4 }, sectionTitle: { color: colors.text, fontSize: 14, fontWeight: '900', marginTop: 10 }, row: { flexDirection: 'row', gap: 8 }, half: { flex: 1 }, typeButton: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, typeButtonActive: { borderColor: colors.brand, backgroundColor: '#FFF1E8' }, typeText: { color: colors.muted, fontWeight: '900', fontSize: 12 }, typeTextActive: { color: colors.brand }, error: { color: colors.danger, fontSize: 13 }, });
