import { Platform } from 'react-native';
import type { LoginResponse, RegisterPayload } from '@/src/types/api';
const fallbackBaseUrl = Platform.select({ android: 'http://10.0.2.2:5000', ios: 'http://localhost:5000', default: 'http://localhost:5000' });
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || fallbackBaseUrl || '').replace(/\/$/, '');
export const api = {
  async login(email: string, password: string) {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    if (!response.ok) throw new Error('Unable to sign in with those details.');
    return response.json() as Promise<LoginResponse>;
  },
  async register(payload: RegisterPayload) {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { message?: string; errors?: Record<string, string[]> } | null;
      const validation = body?.errors ? Object.values(body.errors).flat()[0] : undefined;
      throw new Error(validation || body?.message || 'Unable to create your driver account.');
    }
    return response.json() as Promise<LoginResponse>;
  },
};
