// File path in project: ridehailing-client/src/components/admin/AdminDashboard.jsx
import { useState, useEffect } from 'react';
import { Shield, Settings, CreditCard, LogOut, Car, Users, UserCog, LayoutDashboard, BarChart3, MapPin } from 'lucide-react';
import LiveTrips from './LiveTrips';
import AuditLogs from './AuditLogs';
import DriversPanel from './DriversPanel';
import UsersPanel from './UsersPanel';
import OverviewPanel from './OverviewPanel';
import FleetTrackingPanel from './FleetTrackingPanel';
import LeafletMap from './LeafletMap';
import { apiFetch } from '../../lib/api';

const OFFICIAL_FARE_ZONES = [
  { zone: 'Zone 1', origin: 'Within Poblacion', rows: [['Within Dapitan Island Poblacion', 15]] },
  { zone: 'Zone 2', origin: 'Poblacion / Polo', rows: [['Polo', 20], ['Sulangon', 15], ['Oyan', 22], ['Burgos', 30], ['Ilaya', 35], ['Barcelona', 40], ['Opao', 45], ['Potungan', 50], ['Dampalan', 60]] },
  { zone: 'Zone 3', origin: 'Polo', rows: [['San Pedro', 12], ['San Vicente', 20], ['Owaon', 20], ['Liyang', 20], ['Larayan', 26]] },
  { zone: 'Zone 4', origin: 'Poblacion', rows: [['Talisay', 16], ['Sto. Niño', 20], ['Taquilon', 35], ['Canlucan', 60], ['Tag-ulo', 60], ['Guimputlan (₱60 fare listing)', 60], ['Guimputlan (₱70 fare listing)', 70], ['Banganan', 60], ['Carang', 40]] },
  { zone: 'Zone 5 & 6', origin: 'Poblacion', rows: [['Binonoc', 20], ['Oro', 30], ['Napo', 40], ['Baylimango', 40], ['Kauswagan', 40], ['Daro', 60]] },
];

export default function AdminDashboard({ onLogout, onAuthError, adminName }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({});
  const [saveError, setSaveError] = useState('');
  const [serviceAreaSaving, setServiceAreaSaving] = useState(false);
  const [serviceAreaMessage, setServiceAreaMessage] = useState('');

  useEffect(() => {
    if (activeTab !== 'general' && activeTab !== 'fares') return;

    async function loadBackendSettings() {
      try {
        setLoading(true);
        // /api/settings (not /public) returns every setting, including
        // non-public ones like fare.booking_fee — admin-only, so this
        // goes through apiFetch to send the bearer token.
        const response = await apiFetch('/api/settings');
        if (response.ok) {
          const data = await response.json();
          const mappedSettings = {};
          data.forEach(item => { mappedSettings[item.key] = item.value; });
          mappedSettings['service_area.latitude'] ??= '8.152';
          mappedSettings['service_area.longitude'] ??= '123.258';
          mappedSettings['service_area.radius_km'] ??= '5';
          setSettings(mappedSettings);
        }
      } catch (error) {
        if (error.isAuthError) { onAuthError(); return; }
        console.error("Failed to reach backend API server:", error);
      } finally {
        setLoading(false);
      }
    }
    loadBackendSettings();
  }, [activeTab]);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaveError('');
    try {
      const response = await apiFetch('/api/settings/ops.driver_search_radius_km', {
        method: 'PATCH',
        body: JSON.stringify({ value: settings['ops.driver_search_radius_km'] }),
      });
      if (!response.ok) throw new Error('Unable to save the driver search radius.');
      alert('Driver search radius successfully saved.');
    } catch (error) {
      if (error.isAuthError) { onAuthError(); return; }
      setSaveError('Error updating database settings.');
    }
  };

  const handleSaveFareSettings = async (e) => {
    e.preventDefault();
    setSaveError('');
    const bookingFee = Number(settings['fare.booking_fee']);
    if (!Number.isFinite(bookingFee) || bookingFee < 0) {
      setSaveError('Enter a valid booking fee of zero or more.');
      return;
    }
    try {
      const response = await apiFetch('/api/settings/fare.booking_fee', {
        method: 'PATCH',
        body: JSON.stringify({ value: bookingFee.toFixed(2) }),
      });
      if (!response.ok) throw new Error('Unable to save the booking fee.');
      alert('Booking fee successfully saved.');
    } catch (error) {
      if (error.isAuthError) { onAuthError(); return; }
      setSaveError(error instanceof Error ? error.message : 'Error updating the booking fee.');
    }
  };

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveServiceArea = async () => {
    setServiceAreaSaving(true);
    setServiceAreaMessage('');
    try {
      for (const key of ['service_area.latitude', 'service_area.longitude', 'service_area.radius_km']) {
        const response = await apiFetch(`/api/settings/${key}`, {
          method: 'PATCH',
          body: JSON.stringify({ value: settings[key] }),
        });
        if (!response.ok) throw new Error(`Unable to save ${key}.`);
      }
      setServiceAreaMessage('Service area saved and published to customer and driver maps.');
    } catch (error) {
      if (error.isAuthError) { onAuthError(); return; }
      setServiceAreaMessage(error instanceof Error ? error.message : 'Unable to save the service area.');
    } finally {
      setServiceAreaSaving(false);
    }
  };

  const serviceArea = {
    lat: Number(settings['service_area.latitude'] || 8.152),
    lng: Number(settings['service_area.longitude'] || 123.258),
  };

  return (
    <div className="fixed inset-0 bg-slate-950 flex text-slate-100 font-sans z-10">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between p-4">
        <div>
          <div className="flex items-center gap-3 px-2 py-4 border-b border-slate-800 mb-6">
            <Shield className="w-6 h-6 text-amber-500" />
            <div>
              <div className="font-bold text-lg tracking-wide leading-tight">BiyahePro Admin</div>
              {adminName && <div className="text-xs text-slate-500">{adminName}</div>}
            </div>
          </div>

          <nav className="space-y-1">
            <button type="button" onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition ${activeTab === 'dashboard' ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/10' : 'text-slate-400 hover:bg-slate-800'}`}>
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </button>
            <button type="button" onClick={() => setActiveTab('users')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition ${activeTab === 'users' ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/10' : 'text-slate-400 hover:bg-slate-800'}`}>
              <Users className="w-4 h-4" /> Users
            </button>
            <button type="button" onClick={() => setActiveTab('trips')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition ${activeTab === 'trips' ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/10' : 'text-slate-400 hover:bg-slate-800'}`}>
              <Car className="w-4 h-4" /> Rides
            </button>
            <button type="button" onClick={() => setActiveTab('analytics')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition ${activeTab === 'analytics' ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/10' : 'text-slate-400 hover:bg-slate-800'}`}>
              <BarChart3 className="w-4 h-4" /> Analytics
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('general')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition ${
                activeTab === 'general' ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/10' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <Settings className="w-4 h-4" /> Settings
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('fares')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition ${
                activeTab === 'fares' ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/10' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <CreditCard className="w-4 h-4" /> Fare Pricing Management
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('trips')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition ${
                activeTab === 'trips' ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/10' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <Car className="w-4 h-4" /> Live System Trips
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('drivers')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition ${
                activeTab === 'drivers' ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/10' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <UserCog className="w-4 h-4" /> Fleet & Driver Performance
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('fleet-map')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition ${
                activeTab === 'fleet-map' ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/10' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <MapPin className="w-4 h-4" /> Driver Location Map
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition ${
                activeTab === 'audit' ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/10' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <Users className="w-4 h-4" /> Admin Activity Audit Logs
            </button>
          </nav>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-950/20 transition border border-transparent hover:border-red-900/30"
        >
          <LogOut className="w-4 h-4" /> Terminate Session
        </button>
      </div>

      {/* Main Workspace Panel Container */}
      <div className="flex-1 overflow-y-auto p-8">
        {activeTab === 'dashboard' && <OverviewPanel onAuthError={onAuthError} />}
        {activeTab === 'users' && <UsersPanel onAuthError={onAuthError} />}
        {activeTab === 'trips' && <LiveTrips onAuthError={onAuthError} />}
        {activeTab === 'analytics' && <OverviewPanel onAuthError={onAuthError} />}
        {activeTab === 'drivers' && <DriversPanel onAuthError={onAuthError} />}
        {activeTab === 'fleet-map' && <FleetTrackingPanel onAuthError={onAuthError} />}
        {activeTab === 'audit' && <AuditLogs onAuthError={onAuthError} />}
        {(activeTab === 'general' || activeTab === 'fares') && (
          <div className="mb-6 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800">
              <h2 className="font-bold">Service Area</h2>
              <p className="text-xs text-slate-400 mt-1">
                Drag the orange marker or tap the map to choose the service-area center. Save the change to publish the circle to customer and driver maps.
              </p>
            </div>
            <LeafletMap
              center={serviceArea}
              radiusKm={Number(settings['service_area.radius_km'] || 5)}
              onMove={(point) => {
                handleSettingChange('service_area.latitude', point.lat.toFixed(6));
                handleSettingChange('service_area.longitude', point.lng.toFixed(6));
                setServiceAreaMessage('Unsaved service-area location.');
              }}
            />
            <div className="flex flex-wrap items-center gap-3 p-4">
              <button
                type="button"
                onClick={handleSaveServiceArea}
                disabled={serviceAreaSaving || loading}
                className="bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold px-5 py-2.5 rounded-xl transition text-sm"
              >
                {serviceAreaSaving ? 'Saving service area…' : 'Save service area'}
              </button>
              {serviceAreaMessage && <p role="status" className="text-sm text-slate-300">{serviceAreaMessage}</p>}
              <p className="w-full text-xs text-slate-500">
                Center: {serviceArea.lat.toFixed(6)}, {serviceArea.lng.toFixed(6)} · Radius: {Number(settings['service_area.radius_km'] || 5)} km
              </p>
            </div>
          </div>
        )}
        {(activeTab !== 'general' && activeTab !== 'fares' && activeTab !== 'dashboard' && activeTab !== 'users' && activeTab !== 'trips' && activeTab !== 'analytics' && activeTab !== 'drivers' && activeTab !== 'fleet-map' && activeTab !== 'audit') && <p className="text-slate-400">Select an admin section.</p>}
        {activeTab !== 'general' && activeTab !== 'fares' && activeTab !== 'dashboard' && activeTab !== 'users' && activeTab !== 'trips' && activeTab !== 'analytics' && activeTab !== 'drivers' && activeTab !== 'fleet-map' && activeTab !== 'audit' ? null : null}
        {activeTab !== 'general' && activeTab !== 'fares' ? null : (
        <>
        {(activeTab === 'general' || activeTab === 'fares') && loading ? (
          <div className="text-amber-500 font-semibold text-sm">Syncing parameters data table...</div>
        ) : (
          <>
            {activeTab === 'general' && (
              <form onSubmit={handleSaveSettings} className="max-w-xl space-y-6">
                <header className="mb-8">
                  <h1 className="text-2xl font-bold tracking-tight">System Control Variables</h1>
                  <p className="text-slate-400 text-sm mt-1">Configure operational behaviors across the fleet</p>
                </header>
                <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-400 tracking-wider mb-2">
                      Driver Proximity Search Radius (KM)
                    </label>
                    <input
                      type="number"
                      value={settings['ops.driver_search_radius_km'] || '5'}
                      onChange={(e) => handleSettingChange('ops.driver_search_radius_km', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-amber-500 focus:outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-400 tracking-wider mb-2">
                      Fare Calculation
                    </label>
                    <p className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-300">
                      Official zone fares apply. Surge multipliers do not change ordinance fares.
                    </p>
                  </div>
                </div>
                <button type="submit" className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-3 rounded-xl transition text-sm">
                  Commit Parameters Change
                </button>
              </form>
            )}

            {activeTab === 'fares' && (
              <form onSubmit={handleSaveFareSettings} className="max-w-5xl space-y-6">
                <header className="mb-8">
                  <h1 className="text-2xl font-bold tracking-tight">Official Zone Fare Schedule</h1>
                  <p className="text-slate-400 text-sm mt-1">Official base fares for listed routes. SP/SC receives 20% off the base fare after the driver verifies a valid ID.</p>
                </header>
                <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
                  <div className="max-h-[55vh] overflow-auto rounded-xl border border-slate-800">
                    <table className="w-full min-w-[680px] text-left text-xs">
                      <thead className="sticky top-0 bg-slate-950 text-slate-400">
                        <tr>
                          <th className="p-3">Destination / Origin</th>
                          <th className="p-3 text-right">Regular base</th>
                          <th className="p-3 text-right">SP/SC base</th>
                          <th className="p-3 text-right">SP/SC total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {OFFICIAL_FARE_ZONES.flatMap(group => [
                          <tr key={`${group.zone}-heading`} className="bg-slate-800/70 text-amber-300">
                            <th colSpan="4" className="px-3 py-2 text-left">{group.zone} · Origin: {group.origin}</th>
                          </tr>,
                          ...group.rows.map(([name, regularFare]) => {
                            const discountedBase = Number(regularFare) * 0.8;
                            const bookingFee = Number(settings['fare.booking_fee'] || '5.00');
                            return (
                              <tr key={`${group.zone}-${name}`} className="border-t border-slate-800 text-slate-200">
                                <td className="p-3">{name}</td>
                                <td className="p-3 text-right">₱{Number(regularFare).toFixed(2)}</td>
                                <td className="p-3 text-right">₱{discountedBase.toFixed(2)}</td>
                                <td className="p-3 text-right font-semibold">₱{(discountedBase + bookingFee).toFixed(2)}</td>
                              </tr>
                            );
                          })
                        ])}
                      </tbody>
                    </table>
                  </div>
                  <div className="max-w-xs">
                    <label className="block text-xs font-semibold uppercase text-slate-400 tracking-wider mb-2">
                      Booking Fee (PHP)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={settings['fare.booking_fee'] || '5.00'}
                      onChange={(e) => handleSettingChange('fare.booking_fee', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-amber-500 focus:outline-none transition"
                    />
                    <p className="text-xs text-slate-500 mt-1">Added to the fare. SP/SC discount applies to the base fare only.</p>
                  </div>
                </div>
                {saveError && <p className="text-sm text-red-400">{saveError}</p>}
                <button type="submit" className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-3 rounded-xl transition text-sm">
                  Save Booking Fee
                </button>
              </form>
            )}

          </>
        )}
        </>
        )}
      </div>
    </div>
  );
}