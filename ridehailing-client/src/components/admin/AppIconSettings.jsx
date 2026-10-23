import { useEffect, useRef, useState } from 'react';
import { ImageUp, RefreshCw } from 'lucide-react';
import { API_BASE, apiFetch } from '../../lib/api';

const MAX_ICON_SIZE_BYTES = 2 * 1024 * 1024;

function AppIconCard({ appType, appName, onAuthError }) {
  const fileInputRef = useRef(null);
  const previewUrlRef = useRef('');
  const [iconAvailable, setIconAvailable] = useState(false);
  const [iconVersion, setIconVersion] = useState(0);
  const [previewUrl, setPreviewUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const endpoint = `/api/branding/app-icon/${appType}`;

  useEffect(() => {
    let active = true;
    apiFetch(endpoint)
      .then(response => {
        if (response.status === 404) {
          if (active) setIconAvailable(false);
          return;
        }
        if (!response.ok) throw new Error(`Unable to load the current ${appName.toLowerCase()} app icon.`);
        if (active) {
          setIconAvailable(true);
          setIconVersion(Date.now());
        }
      })
      .catch(fetchError => {
        if (!active) return;
        if (fetchError.isAuthError) onAuthError?.();
        else setError(fetchError instanceof Error ? fetchError.message : `Unable to load the ${appName.toLowerCase()} app icon.`);
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [appName, endpoint, onAuthError]);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  function handleFileChange(event) {
    const file = event.target.files?.[0] || null;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = '';
    setPreviewUrl('');
    setSelectedFile(null);
    setError('');
    setMessage('');
    if (!file) return;
    if (file.type !== 'image/png') {
      setError('Choose a PNG image. Square PNG files work best as launcher icons.');
      event.target.value = '';
      return;
    }
    if (file.size > MAX_ICON_SIZE_BYTES) {
      setError('The app icon must be 2 MB or smaller.');
      event.target.value = '';
      return;
    }
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setSelectedFile(file);
  }

  async function uploadIcon(event) {
    event.preventDefault();
    if (!selectedFile) {
      setError('Choose a PNG image before saving.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const body = new FormData();
      body.append('file', selectedFile);
      const response = await apiFetch(endpoint, { method: 'PUT', body });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message || `Unable to save the ${appName.toLowerCase()} app icon.`);
      }
      setIconAvailable(true);
      setIconVersion(Date.now());
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = '';
      setPreviewUrl('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setMessage(`${appName} icon saved. Rebuild and redistribute the ${appName.toLowerCase()} app to apply it.`);
    } catch (uploadError) {
      if (uploadError.isAuthError) { onAuthError?.(); return; }
      setError(uploadError instanceof Error ? uploadError.message : `Unable to save the ${appName.toLowerCase()} app icon.`);
    } finally {
      setSaving(false);
    }
  }

  const imageUrl = previewUrl || (iconAvailable ? `${API_BASE}${endpoint}?v=${iconVersion}` : '');
  const inputId = `${appType}-app-icon-file`;

  return (
    <form onSubmit={uploadIcon} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
      <h2 className="text-lg font-semibold text-slate-100">{appName} App</h2>
      <div className="flex flex-wrap items-center gap-5">
        <div className="w-28 h-28 rounded-2xl bg-slate-950 border border-slate-700 flex items-center justify-center overflow-hidden">
          {imageUrl
            ? <img src={imageUrl} alt={`${appName} app icon preview`} className="w-full h-full object-contain" />
            : <span className="text-xs text-slate-500 text-center px-3">{loading ? 'Loading icon…' : 'No custom icon uploaded'}</span>}
        </div>
        <div className="flex-1 min-w-56">
          <label htmlFor={inputId} className="block text-sm font-semibold text-slate-200 mb-2">Upload {appName.toLowerCase()} icon</label>
          <input
            ref={fileInputRef}
            id={inputId}
            type="file"
            accept="image/png,.png"
            onChange={handleFileChange}
            className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-500 file:px-3 file:py-2 file:font-semibold file:text-slate-950 hover:file:bg-amber-400"
          />
          <p className="text-xs text-slate-500 mt-2">
            PNG, square, 512–2048 pixels, up to 2 MB. Use a centered design with safe margins.
          </p>
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      {message && <p role="status" className="text-sm text-green-400">{message}</p>}
      <button
        type="submit"
        disabled={saving || !selectedFile}
        className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
      >
        {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ImageUp className="w-4 h-4" />}
        {saving ? 'Saving icon…' : `Save ${appName.toLowerCase()} icon`}
      </button>
    </form>
  );
}

export default function AppIconSettings({ onAuthError }) {
  return (
    <section className="max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Mobile App Icons</h1>
        <p className="text-slate-400 text-sm mt-1">
          Set independent launcher icons for the customer and driver apps in this section.
        </p>
      </header>

      <div className="space-y-5">
        <AppIconCard appType="customer" appName="Customer" onAuthError={onAuthError} />
        <AppIconCard appType="driver" appName="Driver" onAuthError={onAuthError} />
      </div>

      <div className="mt-5 rounded-xl border border-amber-900/60 bg-amber-950/30 p-4 text-sm text-amber-100">
        Launcher icons are built into mobile apps. Saving an image does not change an app already installed; rebuild and redistribute only the app whose icon changed.
      </div>
    </section>
  );
}
