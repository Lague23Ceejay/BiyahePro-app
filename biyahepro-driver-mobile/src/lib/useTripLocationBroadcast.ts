// While a trip is active: watch the phone's GPS, expose the latest position
// to the UI, and stream it to the customer through the SignalR hub.
//
// This is separate from useLocationSync (a 15 s REST ping that keeps the
// driver discoverable for new requests). That ping updates the database only —
// it never reaches the customer — so live tracking needs this hook.
import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { sendTripLocation } from '@/src/lib/rideHub';
import type { LatLng } from '@/src/lib/geo';

const SEND_INTERVAL_MS = 4000;

export function useTripLocationBroadcast(token: string | undefined, tripId: string | undefined, active: boolean) {
  const [position, setPosition] = useState<LatLng | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || !tripId || !active) {
      setPosition(null);
      return;
    }

    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;
    let inFlight = false; // never stack up sends if the network is slow

    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        if (!cancelled) setError('Location permission is needed so the customer can see you on the map.');
        return;
      }

      const watcher = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: SEND_INTERVAL_MS, distanceInterval: 5 },
        (next) => {
          if (cancelled) return;
          const point = { latitude: next.coords.latitude, longitude: next.coords.longitude };
          setPosition(point);
          setError('');
          if (inFlight) return;
          inFlight = true;
          sendTripLocation(token, tripId, point.latitude, point.longitude)
            .catch(() => { /* a missed ping is fine — the next one follows in seconds */ })
            .finally(() => { inFlight = false; });
        },
      );

      // The effect may have been cleaned up while we were awaiting the
      // permission prompt / watcher setup — release the watcher immediately
      // instead of leaking a GPS subscription nobody is listening to.
      if (cancelled) watcher.remove();
      else subscription = watcher;
    })().catch(() => {
      if (!cancelled) setError('Unable to read your location. Check that GPS is turned on.');
    });

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [token, tripId, active]);

  return { position, error };
}