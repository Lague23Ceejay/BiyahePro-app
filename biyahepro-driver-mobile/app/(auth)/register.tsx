import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Link, router } from 'expo-router';
import { AppButton } from '@/src/components/AppButton';
import { AppInput } from '@/src/components/AppInput';
import { useAuth } from '@/src/context/AuthContext';
import { colors } from '@/src/theme/colors';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState(''); // YYYY-MM-DD
  const [plateNumber, setPlateNumber] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [year, setYear] = useState('');
  const [vehicleType, setVehicleType] = useState<'motorcycle' | 'motorcab'>('motorcycle');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError('');
    setLoading(true);
    try {
      await register({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        licenseNumber: licenseNumber.trim(),
        licenseExpiry: licenseExpiry.trim(),
        plateNumber: plateNumber.trim(),
        make: make.trim(),
        model: model.trim(),
        color: color.trim(),
        year: Number(year),
        vehicleType,
      }, rememberDevice);
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create your driver account.');
    } finally {
      setLoading(false);
    }
  }

  const passwordValid = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password);
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(licenseExpiry.trim());
  const yearValid = /^\d{4}$/.test(year.trim());
  const valid = Boolean(
    fullName.trim() && email.trim() && phone.trim() && passwordValid &&
    licenseNumber.trim() && dateValid &&
    plateNumber.trim() && make.trim() && model.trim() && color.trim() && yearValid
  );

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create driver account</Text>
        <Text style={styles.subtitle}>Register to receive and complete BiyahePro rides.</Text>

        <Text style={styles.sectionTitle}>Personal details</Text>
        <AppInput label="Full name" value={fullName} onChangeText={setFullName} placeholder="Rodel Mangubat" />
        <AppInput label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" />
        <AppInput label="Mobile number" value={phone} onChangeText={setPhone} placeholder="09XXXXXXXXX" keyboardType="phone-pad" />
        <AppInput label="Password" value={password} onChangeText={setPassword} placeholder="8+ chars, uppercase, number, symbol" secureTextEntry />
        <Text style={styles.hint}>Use at least 8 characters with an uppercase letter, number, and symbol.</Text>
        <Pressable style={styles.remember} onPress={() => setRememberDevice(value => !value)}><Text style={styles.checkbox}>{rememberDevice ? '✓' : ''}</Text><Text style={styles.rememberText}>Remember this device</Text></Pressable>

        <Text style={styles.sectionTitle}>Driver's license</Text>
        <AppInput label="License number" value={licenseNumber} onChangeText={setLicenseNumber} placeholder="N01-23-456789" autoCapitalize="characters" />
        <AppInput label="License expiry" value={licenseExpiry} onChangeText={setLicenseExpiry} placeholder="YYYY-MM-DD" />

        <Text style={styles.sectionTitle}>Vehicle</Text>
        <View style={styles.row}>
          {(['motorcycle', 'motorcab'] as const).map((type) => (
            <Pressable key={type} style={[styles.typeButton, vehicleType === type && styles.typeButtonActive]} onPress={() => setVehicleType(type)}>
              <Text style={[styles.typeButtonText, vehicleType === type && styles.typeButtonTextActive]}>
                {type === 'motorcycle' ? 'Motorcycle' : 'Motorcab / Baobao'}
              </Text>
            </Pressable>
          ))}
        </View>
        <AppInput label="Plate number" value={plateNumber} onChangeText={setPlateNumber} placeholder="DAP-101" autoCapitalize="characters" />
        <View style={styles.row}>
          <View style={styles.half}><AppInput label="Make" value={make} onChangeText={setMake} placeholder="Honda" /></View>
          <View style={styles.half}><AppInput label="Model" value={model} onChangeText={setModel} placeholder="TMX" /></View>
        </View>
        <View style={styles.row}>
          <View style={styles.half}><AppInput label="Color" value={color} onChangeText={setColor} placeholder="Red" /></View>
          <View style={styles.half}><AppInput label="Year" value={year} onChangeText={setYear} placeholder="2022" keyboardType="number-pad" /></View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <AppButton title="Create Driver Account" onPress={submit} loading={loading} disabled={!valid} />
        <Text style={styles.footer}>Already registered? <Link href="/(auth)/login" style={styles.link}>Sign in</Link></Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 12, paddingVertical: 40 },
  title: { color: colors.text, fontSize: 28, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 14, marginBottom: 4 },
  sectionTitle: { color: colors.text, fontSize: 14, fontWeight: '900', marginTop: 10 },
  hint: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  remember: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: { width: 20, height: 20, borderWidth: 1, borderColor: colors.brand, borderRadius: 5, textAlign: 'center', color: colors.brand, fontWeight: '900' },
  rememberText: { color: colors.muted, fontSize: 12 },
  error: { color: colors.danger, fontSize: 13 },
  footer: { color: colors.muted, textAlign: 'center', marginTop: 3 },
  link: { color: colors.brand, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 8 },
  half: { flex: 1 },
  typeButton: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  typeButtonActive: { borderColor: colors.brand, backgroundColor: '#FFF1E8' },
  typeButtonText: { color: colors.muted, fontWeight: '900', fontSize: 12 },
  typeButtonTextActive: { color: colors.brand },
});