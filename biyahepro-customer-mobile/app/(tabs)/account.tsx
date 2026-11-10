import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/src/components/AppButton';
import { useAuth } from '@/src/context/AuthContext';
import { colors } from '@/src/theme/colors';

export default function AccountScreen() {
  const { session, signOut } = useAuth();
  async function logout() { await signOut(); router.replace('/(auth)/login'); }
  return (
    <View style={styles.page}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{session?.fullName?.slice(0, 1).toUpperCase()}</Text></View>
      <Text style={styles.name}>{session?.fullName}</Text>
      <Text style={styles.role}>Passenger account</Text>
      <View style={styles.card}><Text style={styles.label}>User ID</Text><Text style={styles.value}>{session?.userId}</Text></View>
      <AppButton title="Sign out" onPress={logout} variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: 22, backgroundColor: colors.background, gap: 12, alignItems: 'stretch' },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brand, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginTop: 18 }, avatarText: { color: '#fff', fontSize: 30, fontWeight: '900' },
  name: { textAlign: 'center', fontSize: 24, fontWeight: '900', color: colors.text }, role: { textAlign: 'center', color: colors.muted, marginBottom: 18 },
  card: { backgroundColor: colors.surface, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 10 }, label: { fontSize: 12, color: colors.muted, fontWeight: '700' }, value: { color: colors.text, marginTop: 4, fontSize: 13 },
});
