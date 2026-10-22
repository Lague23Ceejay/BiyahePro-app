import { useCallback, useEffect, useRef, useState } from 'react';
import { MapPin, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../lib/api';

const MAP_HTML = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>
html,body,#map{height:100%;margin:0}.driver-icon{width:22px;height:22px;border:3px solid #fff;border-radius:50%;box-shadow:0 1px 6px #334155}.driver-icon.fresh{background:#22c55e}.driver-icon.stale{background:#94a3b8}.leaflet-popup-content{font:13px Arial;line-height:1.5}
</style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
const map=L.map('map').setView([8.6552,123.4241],13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
const markers=new Map();let hasFramed=false;
function isFresh(at){return !!at&&Date.now()-new Date(at).getTime()<=60000}
function popupContent(driver){
  const box=document.createElement('div');
  const name=document.createElement('strong');name.textContent=driver.fullName||'Driver';box.appendChild(name);
  const details=document.createElement('div');
  details.textContent=(driver.status||'unknown').replace('_',' ')+' · '+(driver.plateNumber||'No plate listed');
  box.appendChild(details);
  const updated=document.createElement('div');
  updated.textContent=driver.lastLocationAt?'Location reported '+new Date(driver.lastLocationAt).toLocaleString():'No report timestamp';
  box.appendChild(updated);
  return box;
}
function update(drivers){
  const current=new Set();
  const points=[];
  drivers.forEach(driver=>{
    if(!Number.isFinite(driver.latitude)||!Number.isFinite(driver.longitude))return;
    current.add(driver.driverId);const point=[driver.latitude,driver.longitude];points.push(point);
    const fresh=isFresh(driver.lastLocationAt);
    const icon=L.divIcon({className:'',html:'<div class="driver-icon '+(fresh?'fresh':'stale')+'"></div>',iconSize:[28,28],iconAnchor:[14,14]});
    let marker=markers.get(driver.driverId);
    if(!marker){marker=L.marker(point,{icon}).addTo(map);markers.set(driver.driverId,marker)}
    else marker.setLatLng(point).setIcon(icon);
    marker.bindPopup(popupContent(driver));
  });
  markers.forEach((marker,id)=>{if(!current.has(id)){map.removeLayer(marker);markers.delete(id)}});
  if(!hasFramed&&points.length){
    hasFramed=true;
    if(points.length===1)map.setView(points[0],15);
    else map.fitBounds(points,{padding:[36,36],maxZoom:15});
  }
}
window.addEventListener('message',event=>{
  if(event.source!==window.parent||event.data?.type!=='fleet-locations'||!Array.isArray(event.data.drivers))return;
  update(event.data.drivers);
});
setTimeout(()=>map.invalidateSize(),300);
</script></body></html>`;

function formatLastSeen(value) {
  if (!value) return 'Timestamp unavailable';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `Updated ${seconds}s ago`;
  if (seconds < 3600) return `Updated ${Math.floor(seconds / 60)}m ago`;
  return `Updated ${Math.floor(seconds / 3600)}h ago`;
}

function isFresh(value) {
  return !!value && Date.now() - new Date(value).getTime() <= 60000;
}

export default function FleetTrackingPanel({ onAuthError }) {
  const iframeRef = useRef(null);
  const activeRequestRef = useRef(null);
  const driversRef = useRef([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);

  const publishLocations = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'fleet-locations', drivers: driversRef.current }, '*');
  }, []);

  const refresh = useCallback(async () => {
    activeRequestRef.current?.abort();
    const controller = new AbortController();
    activeRequestRef.current = controller;
    try {
      const response = await apiFetch('/api/drivers/locations', { signal: controller.signal });
      if (!response.ok) throw new Error('Unable to load driver locations.');
      const locations = await response.json();
      if (controller.signal.aborted) return;
      driversRef.current = locations;
      setDrivers(locations);
      setLastRefresh(new Date());
      setError('');
    } catch (fetchError) {
      if (fetchError.name === 'AbortError') return;
      if (controller.signal.aborted) return;
      if (fetchError.isAuthError) { onAuthError?.(); return; }
      setError(fetchError instanceof Error ? fetchError.message : 'Unable to load driver locations.');
    } finally {
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
        if (!controller.signal.aborted) setLoading(false);
      }
    }
  }, [onAuthError]);

  useEffect(() => {
    const initialRefresh = window.setTimeout(refresh, 0);
    const interval = window.setInterval(() => refresh(), 10000);
    return () => {
      activeRequestRef.current?.abort();
      window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
    };
  }, [refresh]);

  useEffect(() => {
    publishLocations();
  }, [drivers, publishLocations]);

  const freshCount = drivers.filter(driver => isFresh(driver.lastLocationAt)).length;
  const handleMapLoad = () => {
    window.setTimeout(publishLocations, 0);
  };

  return (
    <section className="max-w-7xl">
      <header className="flex flex-wrap justify-between items-start gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Driver Location Monitoring</h1>
          <p className="text-slate-400 text-sm mt-1">
            Current and last-reported driver locations, including when no ride is active. Refreshes every 10 seconds.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setLoading(true); refresh(); }}
          className="flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-amber-400 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh now
        </button>
      </header>

      <div className="flex flex-wrap gap-3 mb-4 text-xs">
        <span className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-slate-300">
          <span className="text-green-400 font-bold">{freshCount}</span> reporting within the last minute
        </span>
        <span className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-slate-300">
          {drivers.length - freshCount} stale last-known location{drivers.length - freshCount === 1 ? '' : 's'}
        </span>
        {lastRefresh && <span className="self-center text-slate-500">Updated {lastRefresh.toLocaleTimeString()}</span>}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="h-[min(65vh,680px)] min-h-[360px] relative">
          <iframe
            ref={iframeRef}
            title="Admin driver location monitoring map"
            srcDoc={MAP_HTML}
            onLoad={handleMapLoad}
            className="h-full w-full border-0"
          />
          {loading && <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 text-amber-400 text-sm">Loading driver locations…</div>}
          {!loading && !drivers.length && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="bg-slate-950/90 border border-slate-700 rounded-xl p-4 text-slate-300 text-sm">
                <MapPin className="w-4 h-4 inline mr-2 text-amber-400" />No driver locations have been reported yet.
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-800 px-4 py-3 text-xs text-slate-400">
          <span><span className="text-green-400">●</span> Fresh report (within 60 seconds)</span>
          <span><span className="text-slate-500">●</span> Stale / last known location</span>
          <span>Locations update only while the driver app can send GPS readings.</span>
        </div>
      </div>

      {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
      {drivers.length > 0 && (
        <div className="mt-4 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 font-semibold text-sm">Drivers with a reported location</div>
          <div className="divide-y divide-slate-800">
            {drivers.map(driver => (
              <div key={driver.driverId} className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <span className="font-semibold text-slate-200">{driver.fullName}</span>
                  <span className="ml-2 text-xs text-slate-500">{driver.plateNumber || 'No plate listed'} · {(driver.status || 'unknown').replace('_', ' ')}</span>
                </div>
                <span className={isFresh(driver.lastLocationAt) ? 'text-green-400 text-xs' : 'text-slate-500 text-xs'}>
                  {formatLastSeen(driver.lastLocationAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
