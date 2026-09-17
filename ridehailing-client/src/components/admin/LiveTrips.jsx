import React, { useState, useEffect } from 'react';
import { RefreshCw, MapPin } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import StatusBadge from '../ui/StatusBadge';

export default function LiveTrips({ onAuthError }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchLiveTrips() {
    try {
      setLoading(true);
      // Fetches standard history logs from your backend controller
      const response = await apiFetch('/api/trips/history?page=1&pageSize=50');
      if (response.ok) {
        const data = await response.json();
        setTrips(data.items || []);
      }
    } catch (error) {
      if (error.isAuthError) { onAuthError?.(); return; }
      console.error("Failed to fetch live system trips:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLiveTrips();
    const timer = window.setInterval(fetchLiveTrips, 10000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold">Live System Trips</h2>
          <p className="text-slate-400 text-sm mt-0.5">Monitor active bookings flowing through the ecosystem</p>
        </div>
        <button
          onClick={fetchLiveTrips}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 px-4 py-2 rounded-xl text-sm font-medium transition"
        >
          <RefreshCw className="w-4 h-4" /> Refresh Logs
        </button>
      </div>

      {loading ? (
        <div className="text-slate-400 text-sm">Loading bookings tracking matrix...</div>
      ) : trips.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl text-center text-slate-500 text-sm">
          No bookings currently found in the system.
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-950/40">
                <th className="p-4">Customer</th>
                <th className="p-4">Driver</th>
                <th className="p-4">Pickup / Dropoff Route</th>
                <th className="p-4">Fare</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {trips.map((trip) => (
                <tr key={trip.id} className="hover:bg-slate-800/20 transition">
                  <td className="p-4 font-medium">{trip.customerName || 'Passenger'}</td>
                  <td className="p-4 text-slate-300">{trip.driverName || 'Searching...'}</td>
                  <td className="p-4 space-y-1">
                    <div className="flex items-center gap-2 text-slate-300">
                      <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="truncate max-w-[200px]">{trip.pickupAddress}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                      <MapPin className="w-3.5 h-3.5 text-green-400 shrink-0" />
                      <span className="truncate max-w-[200px]">{trip.dropoffAddress}</span>
                    </div>
                  </td>
                  <td className="p-4 font-mono font-semibold text-amber-400">₱{trip.fareAmount}</td>
                  <td className="p-4">
                    <StatusBadge status={trip.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}