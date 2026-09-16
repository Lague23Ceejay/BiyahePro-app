// File path in project: ridehailing-client/src/components/admin/DriversPanel.jsx
import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle, ShieldOff, ShieldCheck, History } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import StatusBadge from '../ui/StatusBadge';

export default function DriversPanel({ onAuthError }) {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [dpiOnly, setDpiOnly] = useState(false);

  // Per-row UI state: which row has the strike form open, its reason text,
  // whether an action is in flight, and any expanded strike history.
  const [strikeFormFor, setStrikeFormFor] = useState(null);
  const [strikeReason, setStrikeReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyDriverId, setBusyDriverId] = useState(null);
  const [strikeHistoryFor, setStrikeHistoryFor] = useState(null);
  const [strikeHistory, setStrikeHistory] = useState([]);

  async function fetchDrivers() {
    try {
      setLoading(true);
      const query = statusFilter ? `?status=${statusFilter}&pageSize=50` : '?pageSize=50';
      const response = await apiFetch(`/api/drivers${query}`);
      if (response.ok) {
        const data = await response.json();
        setDrivers(data.items || []);
      }
    } catch (error) {
      if (error.isAuthError) { onAuthError?.(); return; }
      console.error('Failed to fetch drivers:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDrivers();
  }, [statusFilter]);

  const visibleDrivers = dpiOnly ? drivers.filter(d => d.dpiReviewFlag) : drivers;

  const runAction = async (driverId, run) => {
    setActionError('');
    setBusyDriverId(driverId);
    try {
      await run();
      await fetchDrivers();
    } catch (error) {
      if (error.isAuthError) { onAuthError?.(); return; }
      setActionError(error.message || 'Action failed.');
    } finally {
      setBusyDriverId(null);
    }
  };

  const handleIssueStrike = (driverId) => {
    runAction(driverId, async () => {
      const response = await apiFetch(`/api/drivers/${driverId}/strikes`, {
        method: 'POST',
        body: JSON.stringify({ reason: strikeReason }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || 'Could not issue strike (driver may already be banned).');
      }
      setStrikeFormFor(null);
      setStrikeReason('');
    });
  };

  const handleSuspend = (driverId) => {
    runAction(driverId, async () => {
      const response = await apiFetch(`/api/drivers/${driverId}/suspend`, { method: 'POST' });
      if (!response.ok) throw new Error('Could not suspend driver.');
    });
  };

  const handleReinstate = (driverId) => {
    runAction(driverId, async () => {
      const response = await apiFetch(`/api/drivers/${driverId}/reinstate`, { method: 'POST' });
      if (!response.ok) throw new Error('Could not reinstate driver.');
    });
  };

  const toggleStrikeHistory = async (driverId) => {
    if (strikeHistoryFor === driverId) {
      setStrikeHistoryFor(null);
      return;
    }
    try {
      const response = await apiFetch(`/api/drivers/${driverId}/strikes`);
      if (response.ok) {
        setStrikeHistory(await response.json());
        setStrikeHistoryFor(driverId);
      }
    } catch (error) {
      if (error.isAuthError) { onAuthError?.(); return; }
      console.error('Failed to fetch strike history:', error);
    }
  };

  return (
    <div className="max-w-5xl">
      <header className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fleet & Driver Performance</h1>
          <p className="text-slate-400 text-sm mt-1">
            Driver Performance Index (DPI) and Three-Strike Policy — BP §VI / §IX
          </p>
        </div>
        <button
          type="button"
          onClick={fetchDrivers}
          className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-amber-500 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </header>

      <div className="flex items-center gap-4 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:border-amber-500 focus:outline-none transition"
        >
          <option value="">All statuses</option>
          <option value="offline">Offline</option>
          <option value="available">Available</option>
          <option value="on_trip">On trip</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
        </select>
        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={dpiOnly}
            onChange={(e) => setDpiOnly(e.target.checked)}
            className="accent-amber-500"
          />
          Show only DPI-flagged (rating &lt; 4.2)
        </label>
      </div>

      {actionError && (
        <p className="text-sm text-red-400 mb-4">{actionError}</p>
      )}

      {loading ? (
        <div className="text-amber-500 font-semibold text-sm">Loading fleet roster...</div>
      ) : visibleDrivers.length === 0 ? (
        <div className="text-slate-500 text-sm">No drivers match this filter.</div>
      ) : (
        <div className="space-y-3">
          {visibleDrivers.map((driver) => (
            <div key={driver.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{driver.fullName || 'Unnamed driver'}</span>
                    <StatusBadge status={driver.status} />
                    {driver.dpiReviewFlag && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border bg-red-500/10 text-red-400 border-red-500/20">
                        <AlertTriangle className="w-3 h-3" /> DPI review
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {driver.phone || 'No phone'} · Rating {Number(driver.rating).toFixed(2)} · {driver.totalTrips} trips · Strikes {driver.strikeCount}/3
                    {driver.suspendedUntil && (
                      <> · Suspended until {new Date(driver.suspendedUntil).toLocaleString()}</>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleStrikeHistory(driver.id)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 px-3 py-2 rounded-lg transition"
                  >
                    <History className="w-3.5 h-3.5" /> History
                  </button>
                  {driver.status === 'suspended' ? (
                    <button
                      type="button"
                      disabled={busyDriverId === driver.id}
                      onClick={() => handleReinstate(driver.id)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-green-400 hover:bg-green-950/30 disabled:opacity-40 px-3 py-2 rounded-lg border border-green-900/30 transition"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" /> Reinstate
                    </button>
                  ) : driver.status !== 'banned' && (
                    <button
                      type="button"
                      disabled={busyDriverId === driver.id}
                      onClick={() => handleSuspend(driver.id)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-950/30 disabled:opacity-40 px-3 py-2 rounded-lg border border-amber-900/30 transition"
                    >
                      <ShieldOff className="w-3.5 h-3.5" /> Suspend
                    </button>
                  )}
                  {driver.status !== 'banned' && (
                    <button
                      type="button"
                      disabled={busyDriverId === driver.id}
                      onClick={() => setStrikeFormFor(strikeFormFor === driver.id ? null : driver.id)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 px-3 py-2 rounded-lg transition"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" /> Issue Strike
                    </button>
                  )}
                </div>
              </div>

              {strikeFormFor === driver.id && (
                <div className="mt-4 pt-4 border-t border-slate-800 flex items-end gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold uppercase text-slate-400 tracking-wider mb-2">
                      Reason for this strike
                    </label>
                    <input
                      type="text"
                      autoFocus
                      value={strikeReason}
                      onChange={(e) => setStrikeReason(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && strikeReason.trim()) handleIssueStrike(driver.id); }}
                      placeholder="e.g. Late arrival at pickup, untidy vehicle"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:border-amber-500 focus:outline-none transition"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!strikeReason.trim() || busyDriverId === driver.id}
                    onClick={() => handleIssueStrike(driver.id)}
                    className="bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-40 font-bold px-4 py-2.5 rounded-xl transition text-sm"
                  >
                    Confirm strike {driver.strikeCount + 1}/3
                  </button>
                </div>
              )}

              {strikeHistoryFor === driver.id && (
                <div className="mt-4 pt-4 border-t border-slate-800">
                  {strikeHistory.length === 0 ? (
                    <p className="text-xs text-slate-500">No strikes on record.</p>
                  ) : (
                    <ul className="space-y-2">
                      {strikeHistory.map((s) => (
                        <li key={s.id} className="text-xs text-slate-400 flex justify-between gap-4">
                          <span>
                            <span className="text-slate-200 font-semibold">Strike {s.strikeNumber}:</span> {s.reason} — {s.consequence}
                          </span>
                          <span className="text-slate-600 shrink-0">{new Date(s.issuedAt).toLocaleDateString()}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}