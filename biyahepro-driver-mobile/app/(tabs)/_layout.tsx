import { Redirect, Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { useAuth } from '@/src/context/AuthContext';
import { colors } from '@/src/theme/colors';
const icon = (label: string, color: ColorValue) => <Text style={{ color, fontSize: 17, fontWeight: '800' }}>{label}</Text>;
export default function TabsLayout() { const { session, isLoading } = useAuth(); if (!isLoading && !session) return <Redirect href="/(auth)/login" />; return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.brand, tabBarInactiveTintColor: colors.muted, tabBarStyle: { height: 64, paddingBottom: 8, borderTopColor: colors.border } }}><Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => icon('▦', color) }} /><Tabs.Screen name="active" options={{ title: 'Active', tabBarIcon: ({ color }) => icon('▣', color) }} /><Tabs.Screen name="earnings" options={{ title: 'Earnings', tabBarIcon: ({ color }) => icon('◎', color) }} /><Tabs.Screen name="account" options={{ title: 'Profile', tabBarIcon: ({ color }) => icon('♙', color) }} /></Tabs>; }
