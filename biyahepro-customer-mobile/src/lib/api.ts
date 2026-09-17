import { Platform } from 'react-native';
import type {
  AuthResponse,
  BookTripRequest,
  FareEstimate,
  FareEstimateRequest,
  PagedResult,
  RateTripPayload,
  RegisterPayload,
  Trip,
} from '@/src/types/api';
import { loadSession, saveSession } from '@/src/lib/session';

const fallbackBaseUrl = Platform.select({
  android: 'http://10.0.2.2:5000',
  ios: 'http://localhost:5000',
  default: 'http://localhost:5000',
});

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

let refreshPromise: Promise<string | null> | null = null;

async function readError(response: Response) {
  try {
    const body = await response.json();
    if (typeof body === 'string') return body;
    return body?.message || body?.title || 'Request failed.';
  } catch {
    return `Request failed with status ${response.status}.`;
  }
}

async function refreshAccessToken() {
  const session = await loadSession();
  if (!session?.refreshToken) return null;

  const refreshed = await request<AuthResponse>('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify(session.refreshToken),
  }, undefined, false);
  await saveSession({ ...refreshed, rememberDevice: session.rememberDevice });
  return refreshed.accessToken;
}

async function request<T>(path: string, init: RequestInit = {}, token?: string, retryOnUnauthorized = true) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });

  if (response.status === 401 && token && retryOnUnauthorized) {
    refreshPromise ??= refreshAccessToken().finally(() => { refreshPromise = null; });
    try {
      const refreshedToken = await refreshPromise;
      if (refreshedToken) return request<T>(path, init, refreshedToken, false);
    } catch {
      // Keep the original unauthorized error when the refresh token is invalid.
    }
  }

  if (!response.ok) throw new Error(await readError(response));
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  login(email: string, password: string) {
    return request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  register(payload: RegisterPayload) {
    return request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ ...payload, role: 'customer' }),
    });
  },

  estimateFare(payload: FareEstimateRequest) {
    return request<FareEstimate>('/api/trips/estimate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  bookTrip(payload: BookTripRequest, token: string) {
    return request<Trip>('/api/trips', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token);
  },

  getTripHistory(token: string, page = 1, pageSize = 20) {
    return request<PagedResult<Trip>>(`/api/trips/history?page=${page}&pageSize=${pageSize}`, {}, token);
  },

  cancelTrip(tripId: string, reason: string, token: string) {
    return request<Trip>(`/api/trips/${tripId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }, token);
  },

  rateTrip(tripId: string, payload: RateTripPayload, token: string) {
    return request<{ message: string }>(`/api/trips/${tripId}/rate`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token);
  },
};
