// File path in project: biyahepro-customer-mobile/src/lib/tripHub.ts
// Thin wrapper around @microsoft/signalr for the customer app's live trip
// feed. Mirrors RideHailing.API/Hubs/RideHub.cs:
//   - every connection auto-joins `user_{userId}` (server-side, on connect)
//     and receives TripAccepted / TripStatusChanged / TripCancelled there.
//   - JoinTripRoom(tripId) additionally joins `trip_{tripId}` to receive
//     DriverLocationUpdated while a ride is in progress.
import { useEffect, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { API_BASE_URL } from '@/src/lib/api';

export type DriverLocation = { latitude: number; longitude: number };

export type TripHubState = {
  status: string | null;
  driverId: string | null;
  driverLocation: DriverLocation | null;
  cancelled: boolean;
  connectionState: 'connecting' | 'connected' | 'disconnected';
};

// One shared connection per access token is enough — trip rooms are just
// joined/left as screens mount/unmount, so booking a second ride while
// viewing history doesn't spin up duplicate sockets.
let sharedConnection: signalR.HubConnection | null = null;
let sharedToken: string | null = null;

function getConnection(token: string) {
  if (sharedConnection && sharedToken === token) return sharedConnection;

  sharedConnection?.stop();
  sharedToken = token;
  sharedConnection = new signalR.HubConnectionBuilder()
    .withUrl(`${API_BASE_URL}/hubs/ride`, { accessTokenFactory: () => token })
    .withAutomaticReconnect()
    .build();

  return sharedConnection;
}

// Subscribes to live updates for a single trip. Pass `initialStatus` to
// seed state before the first server event arrives (e.g. the status the
// booking screen already has from the initial POST /api/trips response).
export function useTripUpdates(tripId: string | undefined, token: string | undefined, initialStatus?: string) {
  const [state, setState] = useState<TripHubState>({
    status: initialStatus ?? null,
    driverId: null,
    driverLocation: null,
    cancelled: false,
    connectionState: 'connecting',
  });
  const joinedRef = useRef(false);

  useEffect(() => {
    if (!tripId || !token) return;

    let cancelledEffect = false;
    const connection = getConnection(token);

    const onTripAccepted = (payload: { tripId: string; driverId: string }) => {
      if (payload.tripId !== tripId) return;
      setState((prev) => ({ ...prev, status: 'accepted', driverId: payload.driverId }));
    };

    const onTripStatusChanged = (payload: { tripId: string; status: string }) => {
      if (payload.tripId !== tripId) return;
      setState((prev) => ({ ...prev, status: payload.status }));
    };

    const onTripCancelled = (payload: { tripId: string }) => {
      if (payload.tripId !== tripId) return;
      setState((prev) => ({ ...prev, status: 'cancelled', cancelled: true }));
    };

    const onDriverLocationUpdated = (payload: { tripId?: string; latitude: number; longitude: number; driverId: string }) => {
      // The connection is shared across screens, so ignore pings that belong
      // to a different trip's room (the server includes tripId on each ping).
      if (payload.tripId && payload.tripId !== tripId) return;
      if (!Number.isFinite(payload.latitude) || !Number.isFinite(payload.longitude)) return;
      setState((prev) => ({
        ...prev,
        driverId: payload.driverId,
        driverLocation: { latitude: payload.latitude, longitude: payload.longitude },
      }));
    };

    connection.on('TripAccepted', onTripAccepted);
    connection.on('TripStatusChanged', onTripStatusChanged);
    connection.on('TripCancelled', onTripCancelled);
    connection.on('DriverLocationUpdated', onDriverLocationUpdated);

    const join = async () => {
      try {
        if (connection.state === signalR.HubConnectionState.Disconnected) {
          await connection.start();
        }
        if (cancelledEffect) return;
        await connection.invoke('JoinTripRoom', tripId);
        joinedRef.current = true;
        setState((prev) => ({ ...prev, connectionState: 'connected' }));
      } catch {
        if (!cancelledEffect) setState((prev) => ({ ...prev, connectionState: 'disconnected' }));
      }
    };
    join();

    connection.onreconnected(() => {
      setState((prev) => ({ ...prev, connectionState: 'connected' }));
      connection.invoke('JoinTripRoom', tripId).catch(() => {});
    });
    connection.onreconnecting(() => setState((prev) => ({ ...prev, connectionState: 'connecting' })));
    connection.onclose(() => setState((prev) => ({ ...prev, connectionState: 'disconnected' })));

    return () => {
      cancelledEffect = true;
      connection.off('TripAccepted', onTripAccepted);
      connection.off('TripStatusChanged', onTripStatusChanged);
      connection.off('TripCancelled', onTripCancelled);
      connection.off('DriverLocationUpdated', onDriverLocationUpdated);
      if (joinedRef.current) {
        connection.invoke('LeaveTripRoom', tripId).catch(() => {});
        joinedRef.current = false;
      }
    };
  }, [tripId, token]);

  return state;
}