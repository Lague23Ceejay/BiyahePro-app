import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { AppButton } from '@/src/components/AppButton';
import { AppInput } from '@/src/components/AppInput';
import { useAuth } from '@/src/context/AuthContext';
import { colors } from '@/src/theme/colors';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(''); setLoading(true);
    try { await signIn(email, password, rememberDevice); router.replace('/(tabs)'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to sign in.'); }
    finally { setLoading(false); }
  }

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.logo}><Text style={styles.logoText}>BP</Text></View>
        <Text style={styles.title}>BiyahePro</Text>
        <Text style={styles.subtitle}>Book a local ride in just a few taps.</Text>
        <View style={styles.form}>
          <AppInput label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="you@example.com" />
          <AppInput label="Password" secureTextEntry value={password} onChangeText={setPassword} placeholder="Your password" />
          <Pressable style={styles.remember} onPress={() => setRememberDevice(value => !value)}><Text style={styles.checkbox}>{rememberDevice ? '✓' : ''}</Text><Text style={styles.rememberText}>Remember this device</Text></Pressable>
          {!!error && <Text style={styles.error}>{error}</Text>}
          <AppButton title="Sign in" onPress={submit} loading={loading} disabled={!email || !password} />
        </View>
        <Text style={styles.footer}>New to BiyahePro? <Link href="/(auth)/register" style={styles.link}>Create an account</Link></Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 10 },
  logo: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  logoText: { color: '#fff', fontSize: 22, fontWeight: '900' },
  title: { fontSize: 34, fontWeight: '900', color: colors.text },
  subtitle: { fontSize: 16, color: colors.muted, marginBottom: 22 },
  form: { gap: 14 }, remember: { flexDirection: 'row', alignItems: 'center', gap: 8 }, checkbox: { width: 20, height: 20, borderWidth: 1, borderColor: colors.brand, borderRadius: 5, textAlign: 'center', color: colors.brand, fontWeight: '900' }, rememberText: { color: colors.muted, fontSize: 12 },
  error: { color: colors.danger, fontSize: 13 },
  footer: { textAlign: 'center', color: colors.muted, marginTop: 18 },
  link: { color: colors.brand, fontWeight: '700' },
});
