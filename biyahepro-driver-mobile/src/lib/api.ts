import { Platform } from 'react-native';
import type { LoginResponse, RegisterPayload } from '@/src/types/api';
const fallbackBaseUrl = Platform.select({ android: 'http://10.0.2.2:5000', ios: 'http://localhost:5000', default: 'http://localhost:5000' });
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || fallbackBaseUrl || '').replace(/\/$/, '');
export type ServiceArea = { latitude: number; longitude: number; radiusKm: number };
export async function getServiceArea(): Promise<ServiceArea> {
  const response = await fetch(`${API_BASE_URL}/api/settings/public`);
  if (!response.ok) throw new Error('Unable to load service area.');
  const settings = await response.json() as Array<{ key: string; value: string }>;
  const values = Object.fromEntries(settings.map(setting => [setting.key, Number(setting.value)]));
  const latitude = values['service_area.latitude']; const longitude = values['service_area.longitude']; const radiusKm = values['service_area.radius_km'];
  if (![latitude, longitude, radiusKm].every(Number.isFinite)) throw new Error('Service area is not configured.');
  return { latitude, longitude, radiusKm };
}
async function request<T>(path: string, init: RequestInit = {}, token?: string) {
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) } });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string; errors?: Record<string, string[]> } | null;
    const validation = body?.errors ? Object.values(body.errors).flat()[0] : undefined;
    throw new Error(validation || body?.message || `Request failed with status ${response.status}.`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
export const api = {
  async login(email: string, password: string) {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    if (!response.ok) throw new Error('Unable to sign in with those details.');
    return response.json() as Promise<LoginResponse>;
  },
  async register(payload: RegisterPayload) {
    const response = await fetch(`${API_BASE_URL}/api/auth/register-driver`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { message?: string; errors?: Record<string, string[]> } | null;
      const validation = body?.errors ? Object.values(body.errors).flat()[0] : undefined;
      throw new Error(validation || body?.message || 'Unable to create your driver account.');
    }
    return response.json() as Promise<LoginResponse>;
  },
  async getProfile(token: string) { return request<any>('/api/drivers/me', {}, token); },
  async completeProfile(token: string, payload: { licenseNumber: string; licenseExpiry: string; plateNumber: string; make: string; model: string; color: string; year: number; vehicleType: 'motorcycle' | 'motorcab' }) { return request<any>('/api/drivers/me/profile', { method: 'PUT', body: JSON.stringify(payload) }, token); },
  async getRequests(token: string) { return request<any[]>('/api/drivers/me/requests', {}, token); },
  async getHistory(token: string) { return request<any>('/api/trips/history?page=1&pageSize=20', {}, token); },
  async getEarnings(token: string) { return request<any>('/api/drivers/me/earnings', {}, token); },
  async setAvailability(token: string, available: boolean) { return request<void>('/api/drivers/me/status', { method: 'PATCH', body: JSON.stringify({ available }) }, token); },
  async updateLocation(token: string, latitude: number, longitude: number) { return request<void>('/api/drivers/me/location', { method: 'PATCH', body: JSON.stringify({ latitude, longitude }) }, token); },
  async updateTripStatus(token: string, tripId: string, status: string) { return request<any>(`/api/trips/${tripId}/status`, { method: 'PATCH', body: JSON.stringify({ tripId, status }) }, token); },
  async acceptTrip(token: string, tripId: string) { return request<any>(`/api/trips/${tripId}/accept`, { method: 'POST' }, token); },
  async declineTrip(token: string, tripId: string) { return request<any>(`/api/trips/${tripId}/cancel`, { method: 'POST', body: JSON.stringify({ reason: 'Driver declined the request.' }) }, token); },
};