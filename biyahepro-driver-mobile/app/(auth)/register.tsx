import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { Link, router } from 'expo-router';
import { AppButton } from '@/src/components/AppButton';
import { AppInput } from '@/src/components/AppInput';
import { useAuth } from '@/src/context/AuthContext';
import { colors } from '@/src/theme/colors';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [fullName, setFullName] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  async function submit() { setError(''); setLoading(true); try { await register({ fullName: fullName.trim(), email: email.trim(), phone: phone.trim(), password, role: 'driver' }); router.replace('/(tabs)'); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to create your driver account.'); } finally { setLoading(false); } }
  const valid = Boolean(fullName.trim() && email.trim() && phone.trim() && /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password));
  return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><Text style={styles.back}>‹</Text><Text style={styles.title}>Create driver account</Text><Text style={styles.subtitle}>Register to receive and complete BiyahePro rides.</Text><AppInput label="Full name" value={fullName} onChangeText={setFullName} placeholder="Rodel Mangubat" /><AppInput label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" /><AppInput label="Mobile number" value={phone} onChangeText={setPhone} placeholder="09XXXXXXXXX" keyboardType="phone-pad" /><AppInput label="Password" value={password} onChangeText={setPassword} placeholder="8+ chars, uppercase, number, symbol" secureTextEntry /><Text style={styles.hint}>Use at least 8 characters with an uppercase letter, number, and symbol.</Text>{error ? <Text style={styles.error}>{error}</Text> : null}<AppButton title="Create Driver Account" onPress={submit} loading={loading} disabled={!valid} /><Text style={styles.footer}>Already registered? <Link href="/(auth)/login" style={styles.link}>Sign in</Link></Text></ScrollView></KeyboardAvoidingView>;
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.background }, content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 14 }, back: { color: colors.text, fontSize: 28, marginBottom: 5 }, title: { color: colors.text, fontSize: 28, fontWeight: '900' }, subtitle: { color: colors.muted, fontSize: 14, marginBottom: 9 }, hint: { color: colors.muted, fontSize: 11, lineHeight: 16 }, error: { color: colors.danger, fontSize: 13 }, footer: { color: colors.muted, textAlign: 'center', marginTop: 3 }, link: { color: colors.brand, fontWeight: '800' } });