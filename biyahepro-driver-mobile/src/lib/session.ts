import * as SecureStore from 'expo-secure-store';
import type { DriverSession } from '@/src/types/api';
const key = 'biyahepro-driver-session';
export async function loadSession() { const raw = await SecureStore.getItemAsync(key); return raw ? JSON.parse(raw) as DriverSession : null; }
export async function saveSession(session: DriverSession) { await SecureStore.setItemAsync(key, JSON.stringify(session)); }
export async function clearSession() { await SecureStore.deleteItemAsync(key); }
