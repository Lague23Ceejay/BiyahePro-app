// File path in project: biyahepro-driver-mobile/src/lib/useLocationSync.ts
//
// Without this, driver.Latitude/Longitude on the backend are never set,
// which means GET /api/drivers/me/requests always returns an empty list —
// the pending-nearby-trips query requires a known driver location. This
// hook is what actually makes "Incoming Requests" work at all.
import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { api } from '@/src/lib/api';
import type { DriverSession } from '@/src/types/api';

const PING_INTERVAL_MS = 15000;

export function useLocationSync(session: DriverSession | null, onError?: (message: string) => void) {
  const tokenRef = useRef(session?.accessToken);
  tokenRef.current = session?.accessToken;

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function pingOnce() {
      const token = tokenRef.current;
      if (!token) return;
      try {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        await api.updateLocation(token, position.coords.latitude, position.coords.longitude);
      } catch {
        onError?.('Location access is needed to receive nearby ride requests. Enable location permission for the driver app.');
      }
    }

    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted' || cancelled) return;
      await pingOnce();
      timer = setInterval(pingOnce, PING_INTERVAL_MS);
    })().catch(() => onError?.('Location access is needed to receive nearby ride requests. Enable location permission for the driver app.'));

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [session?.accessToken, onError]);
}