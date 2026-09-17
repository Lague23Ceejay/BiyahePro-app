import { useEffect, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { API_BASE_URL } from '@/src/lib/api';

export type NewTripRequest = {
  id: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  fareAmount?: number;
  paymentMethod?: string;
  vehicleType?: string;
  requestedAt?: string;
};

type DriverRideHandlers = {
  onNewTrip?: (request: NewTripRequest) => void;
  onTripCancelled?: (tripId: string) => void;
};

let connection: signalR.HubConnection | null = null;
let connectionToken: string | null = null;

function getConnection(token: string) {
  if (connection && connectionToken === token) return connection;
  connection?.stop();
  connectionToken = token;
  connection = new signalR.HubConnectionBuilder()
    .withUrl(`${API_BASE_URL}/hubs/ride`, { accessTokenFactory: () => token })
    .withAutomaticReconnect()
    .build();
  return connection;
}

async function ensureStarted(nextConnection: signalR.HubConnection) {
  if (nextConnection.state === signalR.HubConnectionState.Disconnected)
    await nextConnection.start();
}

export async function setHubAvailability(token: string, available: boolean) {
  const nextConnection = getConnection(token);
  await ensureStarted(nextConnection);
  await nextConnection.invoke('SetAvailability', available);
}

export function stopDriverRideHub() {
  const currentConnection = connection;
  connection = null;
  connectionToken = null;
  currentConnection?.stop().catch(() => {});
}

export function useDriverRideEvents(token: string | undefined, handlers: DriverRideHandlers) {
  const handlersRef = useRef(handlers);
  const [connected, setConnected] = useState(false);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!token) return;
    let active = true;
    const nextConnection = getConnection(token);
    const onNewTrip = (payload: NewTripRequest & { tripId: string }) => {
      handlersRef.current.onNewTrip?.({ ...payload, id: payload.tripId });
    };
    const onTripCancelled = (payload: { tripId: string }) => {
      handlersRef.current.onTripCancelled?.(payload.tripId);
    };

    nextConnection.on('NewTripRequest', onNewTrip);
    nextConnection.on('TripCancelled', onTripCancelled);
    nextConnection.onreconnecting(() => active && setConnected(false));
    nextConnection.onreconnected(() => active && setConnected(true));
    nextConnection.onclose(() => active && setConnected(false));
    ensureStarted(nextConnection)
      .then(() => active && setConnected(true))
      .catch(() => active && setConnected(false));

    return () => {
      active = false;
      nextConnection.off('NewTripRequest', onNewTrip);
      nextConnection.off('TripCancelled', onTripCancelled);
    };
  }, [token]);

  return connected;
}