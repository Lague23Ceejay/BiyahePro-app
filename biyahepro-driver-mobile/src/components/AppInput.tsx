import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';
import { colors } from '@/src/theme/colors';

export function AppInput({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={styles.group}><Text style={styles.label}>{label}</Text><TextInput placeholderTextColor="#98A2B3" style={styles.input} {...props} /></View>;
}

const styles = StyleSheet.create({ group: { gap: 7 }, label: { color: colors.text, fontSize: 12, fontWeight: '700' }, input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 11, paddingHorizontal: 14, color: colors.text, backgroundColor: colors.background, fontSize: 14 } });
