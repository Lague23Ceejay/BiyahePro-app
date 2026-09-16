import { useState, useEffect } from 'react';
import { RefreshCw, UserCheck } from 'lucide-react';
import { apiFetch } from '../../lib/api';

export default function AuditLogs({ onAuthError }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchAuditLogs() {
    try {
      setLoading(true);
      const response = await apiFetch('/api/settings/audit?limit=100');
      if (response.ok) {
        const data = await response.json();
        setLogs(data || []);
      }
    } catch (error) {
      if (error.isAuthError) { onAuthError?.(); return; }
      console.error("Failed to load administration audit logs:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold">Admin Activity Audit Logs</h2>
          <p className="text-slate-400 text-sm mt-0.5">Track any changing parameters made across the platform</p>
        </div>
        <button
          onClick={fetchAuditLogs}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 px-4 py-2 rounded-xl text-sm font-medium transition"
        >
          <RefreshCw className="w-4 h-4" /> Refresh Logs
        </button>
      </div>

      {loading ? (
        <div className="text-slate-400 text-sm">Loading security log nodes...</div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 bg-slate-950/40 border-b border-slate-800 text-xs font-semibold uppercase text-slate-400 tracking-wider">
            Active System Parameter Nodes
          </div>
          <div className="divide-y divide-slate-800/60">
            {logs.map((log) => (
              <div key={log.id} className="p-4 flex items-start gap-4 hover:bg-slate-800/20 transition">
                <div className="bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 text-amber-500 shrink-0 mt-0.5">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="font-mono text-xs text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 font-bold">
                      {log.action}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-slate-200 text-sm font-medium">{log.entityType} {log.entityId ? `· ${log.entityId}` : ''}</p>
                  <p className="text-slate-400 text-xs mt-1">By {log.adminName || 'admin'}</p>
                  <div className="mt-2 text-xs flex items-center gap-2">
                    <span className="text-slate-500">Live Engine Value:</span>
                    <span className="font-mono bg-slate-950 text-emerald-400 font-semibold px-2 py-0.5 rounded border border-slate-800/60">
                      {log.newValue ? JSON.stringify(log.newValue) : '{}'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
