import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(''); setLoading(true);
    try {
      await register({ fullName: fullName.trim(), email: email.trim(), phone: phone.trim(), password }, rememberDevice);
      router.replace('/(tabs)');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to create account.'); }
    finally { setLoading(false); }
  }

  const valid = fullName && email && phone && password.length >= 8;
  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Your customer profile will be used for ride bookings.</Text>
        <AppInput label="Full name" value={fullName} onChangeText={setFullName} placeholder="Juan Dela Cruz" />
        <AppInput label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="you@example.com" />
        <AppInput label="Phone" keyboardType="phone-pad" value={phone} onChangeText={setPhone} placeholder="09XXXXXXXXX" />
        <AppInput label="Password" secureTextEntry value={password} onChangeText={setPassword} placeholder="8+ chars, uppercase, number, symbol" />
        <Pressable style={styles.remember} onPress={() => setRememberDevice(value => !value)}><Text style={styles.checkbox}>{rememberDevice ? '✓' : ''}</Text><Text style={styles.rememberText}>Remember this device</Text></Pressable>
        {!!error && <Text style={styles.error}>{error}</Text>}
        <AppButton title="Create customer account" onPress={submit} loading={loading} disabled={!valid} />
        <Text style={styles.footer}>Already registered? <Link href="/(auth)/login" style={styles.link}>Sign in</Link></Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 14 },
  title: { fontSize: 30, fontWeight: '900', color: colors.text },
  subtitle: { fontSize: 15, color: colors.muted, marginBottom: 10 },
  error: { color: colors.danger, fontSize: 13 }, remember: { flexDirection: 'row', alignItems: 'center', gap: 8 }, checkbox: { width: 20, height: 20, borderWidth: 1, borderColor: colors.brand, borderRadius: 5, textAlign: 'center', color: colors.brand, fontWeight: '900' }, rememberText: { color: colors.muted, fontSize: 12 },
  footer: { textAlign: 'center', color: colors.muted, marginTop: 8 },
  link: { color: colors.brand, fontWeight: '700' },
});
