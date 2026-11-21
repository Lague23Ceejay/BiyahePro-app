import { useEffect, useState } from 'react';
import { ExternalLink, Image, Plus, Save, Trash2 } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import {
  DEFAULT_PASSENGER_WEBSITE_CONTENT,
  normalizePassengerWebsiteContent,
  resolveWebsiteImageUrl,
  safeWebsiteUrl,
} from '../../data/passengerWebsiteContent';

const SETTING_KEY = 'website.passenger_content';

export default function PassengerWebsiteEditor({ onAuthError }) {
  const [content, setContent] = useState(DEFAULT_PASSENGER_WEBSITE_CONTENT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    apiFetch('/api/settings')
      .then(async response => {
        if (!response.ok) throw new Error('Unable to load website content from the server.');
        return response.json();
      })
      .then(settings => {
        const setting = settings.find(item => item.key === SETTING_KEY);
        if (setting?.value) {
          let parsed;
          try {
            parsed = JSON.parse(setting.value);
          } catch {
            throw new Error('The saved website content is not valid JSON. Restore the content setting in the database before editing.');
          }
          if (active) setContent(normalizePassengerWebsiteContent(parsed));
        } else if (active) {
          setError('Website content setting is missing. Apply ridehailing-db/20_passenger_website_content.sql, then reload this page.');
        }
      })
      .catch(loadError => {
        if (!active) return;
        if (loadError.isAuthError) onAuthError?.();
        else setError(loadError instanceof Error ? loadError.message : 'Unable to load website content.');
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [onAuthError]);

  function updateField(path, value) {
    setContent(previous => {
      const next = JSON.parse(JSON.stringify(previous));
      let target = next;
      for (const key of path.slice(0, -1)) target = target[key];
      target[path[path.length - 1]] = value;
      return next;
    });
    setMessage('');
  }

  function updateCard(listPath, index, field, value) {
    setContent(previous => {
      const next = JSON.parse(JSON.stringify(previous));
      const cards = listPath.reduce((valueAtPath, key) => valueAtPath[key], next);
      cards[index] = { ...cards[index], [field]: value };
      return next;
    });
    setMessage('');
  }

  function addCard(listPath, template) {
    const cards = listPath.reduce((valueAtPath, key) => valueAtPath[key], content);
    updateField(listPath, [...cards, { ...template }]);
  }

  function removeCard(listPath, index) {
    const cards = listPath.reduce((valueAtPath, key) => valueAtPath[key], content);
    updateField(listPath, cards.filter((_, cardIndex) => cardIndex !== index));
  }

  async function saveContent(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    const appUrls = [content.download.androidUrl, content.download.iosUrl];
    if (appUrls.some(url => url && !safeWebsiteUrl(url))) {
      setError('Use a valid http(s) URL for app download links.');
      return;
    }
    setSaving(true);
    try {
      const response = await apiFetch(`/api/settings/${SETTING_KEY}`, {
        method: 'PATCH',
        body: JSON.stringify({ value: JSON.stringify(content) }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message || 'Unable to save passenger website content.');
      }
      setMessage('Passenger homepage content saved and published.');
    } catch (saveError) {
      if (saveError.isAuthError) { onAuthError?.(); return; }
      setError(saveError instanceof Error ? saveError.message : 'Unable to save passenger website content.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-amber-500 text-sm font-semibold">Loading passenger website content…</p>;

  return (
    <section className="max-w-5xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Passenger Website</h1>
          <p className="mt-1 text-sm text-slate-400">Edit the public homepage copy, SEO fields, ride cards, images, FAQs and app QR code.</p>
        </div>
        <a href="/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-amber-500">
          Preview website <ExternalLink className="h-4 w-4" />
        </a>
      </header>

      {error && <p role="alert" className="mb-4 rounded-xl border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-300">{error}</p>}
      {message && <p role="status" className="mb-4 rounded-xl border border-emerald-900/60 bg-emerald-950/30 p-3 text-sm text-emerald-300">{message}</p>}

      <form onSubmit={saveContent} className="space-y-5">
        <EditorSection title="SEO and search preview" description="These fields update the page title, search description, keywords and structured FAQ data.">
          <Field label="Page title" value={content.seo.title} onChange={value => updateField(['seo', 'title'], value)} />
          <Field label="Meta description" value={content.seo.description} onChange={value => updateField(['seo', 'description'], value)} multiline />
          <Field label="Search keywords" value={content.seo.keywords} onChange={value => updateField(['seo', 'keywords'], value)} />
        </EditorSection>

        <EditorSection title="Homepage hero">
          <Field label="Eyebrow" value={content.hero.eyebrow} onChange={value => updateField(['hero', 'eyebrow'], value)} />
          <Field label="Headline" value={content.hero.title} onChange={value => updateField(['hero', 'title'], value)} />
          <Field label="Description" value={content.hero.description} onChange={value => updateField(['hero', 'description'], value)} multiline />
          <WebsiteImageUpload label="Hero image" assetKey={content.hero.imageAssetKey} value={content.hero.imageUrl} alt={content.hero.imageAlt} onChange={(value, alt) => { updateField(['hero', 'imageUrl'], value); updateField(['hero', 'imageAlt'], alt); }} onAuthError={onAuthError} />
        </EditorSection>

        <CardSection
          title="Ride option cards"
          description="Upload an optional image for each ride card."
          cards={content.services.cards}
          fields={['title', 'subtitle', 'description', 'image']}
          labels={{ title: 'Card title', subtitle: 'Short label', description: 'Card description' }}
          onChange={(index, field, value) => updateCard(['services', 'cards'], index, field, value)}
          onAdd={() => addCard(['services', 'cards'], { title: '', subtitle: '', description: '', imageAssetKey: `service-card-${crypto.randomUUID()}`, imageUrl: '', imageAlt: '' })}
          onRemove={index => removeCard(['services', 'cards'], index)}
          onAuthError={onAuthError}
        />
        <Field label="Ride options heading" value={content.services.heading} onChange={value => updateField(['services', 'heading'], value)} />
        <Field label="Ride options introduction" value={content.services.description} onChange={value => updateField(['services', 'description'], value)} multiline />

        <CardSection
          title="How it works cards"
          cards={content.steps.cards}
          fields={['title', 'description']}
          labels={{ title: 'Step title', description: 'Step details' }}
          onChange={(index, field, value) => updateCard(['steps', 'cards'], index, field, value)}
          onAdd={() => addCard(['steps', 'cards'], { title: '', description: '' })}
          onRemove={index => removeCard(['steps', 'cards'], index)}
        />
        <Field label="How it works heading" value={content.steps.heading} onChange={value => updateField(['steps', 'heading'], value)} />
        <Field label="How it works introduction" value={content.steps.description} onChange={value => updateField(['steps', 'description'], value)} multiline />

        <CardSection
          title="App feature cards"
          cards={content.features.cards}
          fields={['title', 'description']}
          labels={{ title: 'Feature title', description: 'Feature details' }}
          onChange={(index, field, value) => updateCard(['features', 'cards'], index, field, value)}
          onAdd={() => addCard(['features', 'cards'], { title: '', description: '' })}
          onRemove={index => removeCard(['features', 'cards'], index)}
        />
        <Field label="Feature section heading" value={content.features.heading} onChange={value => updateField(['features', 'heading'], value)} />

        <EditorSection title="About BiyahePro">
          <Field label="Heading" value={content.about.heading} onChange={value => updateField(['about', 'heading'], value)} />
          <Field label="Description" value={content.about.description} onChange={value => updateField(['about', 'description'], value)} multiline />
          <WebsiteImageUpload label="About image" assetKey={content.about.imageAssetKey} value={content.about.imageUrl} alt={content.about.imageAlt} onChange={(value, alt) => { updateField(['about', 'imageUrl'], value); updateField(['about', 'imageAlt'], alt); }} onAuthError={onAuthError} />
        </EditorSection>

        <CardSection
          title="Frequently asked questions"
          cards={content.faqs}
          fields={['question', 'answer']}
          labels={{ question: 'Question', answer: 'Answer' }}
          onChange={(index, field, value) => updateCard(['faqs'], index, field, value)}
          onAdd={() => addCard(['faqs'], { question: '', answer: '' })}
          onRemove={index => removeCard(['faqs'], index)}
        />

        <EditorSection title="App download and QR code" description="Upload the app download QR image and add official store or download links.">
          <Field label="Download section heading" value={content.download.heading} onChange={value => updateField(['download', 'heading'], value)} />
          <Field label="Description" value={content.download.description} onChange={value => updateField(['download', 'description'], value)} multiline />
          <Field label="App name" value={content.download.appTitle} onChange={value => updateField(['download', 'appTitle'], value)} />
          <WebsiteImageUpload label="App download QR code" assetKey={content.download.imageAssetKey} value={content.download.qrImageUrl} alt={content.download.qrImageAlt} onChange={(value, alt) => { updateField(['download', 'qrImageUrl'], value); updateField(['download', 'qrImageAlt'], alt); }} onAuthError={onAuthError} />
          <Field label="Android download URL" value={content.download.androidUrl} onChange={value => updateField(['download', 'androidUrl'], value)} />
          <Field label="iPhone download URL" value={content.download.iosUrl} onChange={value => updateField(['download', 'iosUrl'], value)} />
        </EditorSection>

        <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-slate-900/95 p-4 shadow-xl backdrop-blur">
          <p className="text-xs text-slate-400">Changes publish immediately after saving.</p>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-60">
            <Save className="h-4 w-4" /> {saving ? 'Publishing…' : 'Save and publish'}
          </button>
        </div>
      </form>
    </section>
  );
}

function EditorSection({ title, description, children }) {
  return <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
    <h2 className="text-base font-bold text-slate-100">{title}</h2>
    {description && <p className="mt-1 text-xs text-slate-400">{description}</p>}
    <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
  </section>;
}

function Field({ label, value, onChange, multiline = false }) {
  const commonProps = {
    value: value || '',
    onChange: event => onChange(event.target.value),
    className: 'mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-amber-500',
  };
  return <label className="block text-xs font-semibold text-slate-300">{label}
    {multiline ? <textarea {...commonProps} rows={3} /> : <input {...commonProps} type="text" />}
  </label>;
}

function WebsiteImageUpload({ label, assetKey, value, alt, onChange, onAuthError }) {
  const [exists, setExists] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const imageEndpoint = `/api/branding/website-image/${assetKey}`;
  const preview = previewUrl || resolveWebsiteImageUrl(value);

  useEffect(() => {
    let active = true;
    apiFetch(imageEndpoint, { method: 'HEAD' })
      .then(response => {
        if (active) setExists(response.ok);
      })
      .catch(fetchError => {
        if (fetchError.isAuthError) onAuthError?.();
        else if (active && value?.startsWith('asset:')) setError('Unable to check the uploaded image.');
      });
    return () => { active = false; };
  }, [imageEndpoint, onAuthError, value]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function uploadImage(event) {
    const file = event.target.files?.[0];
    setError('');
    setMessage('');
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Choose a PNG, JPEG, or WebP image.');
      event.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Website images must be 5 MB or smaller.');
      event.target.value = '';
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(previous => {
      if (previous) URL.revokeObjectURL(previous);
      return localPreview;
    });
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await apiFetch(imageEndpoint, { method: 'PUT', body });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message || 'Unable to upload this image.');
      }
      onChange(`asset:${assetKey}:${Date.now()}`, alt);
      setExists(true);
      setMessage('Image uploaded. Save and publish to update the homepage content.');
    } catch (uploadError) {
      if (uploadError.isAuthError) { onAuthError?.(); return; }
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to upload this image.');
      setPreviewUrl(previous => {
        if (previous) URL.revokeObjectURL(previous);
        return '';
      });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }

  return <div className="sm:col-span-2">
    <div className="flex flex-wrap items-end gap-4">
      <div className="grid h-20 w-28 place-items-center overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
        {preview
          ? <img src={preview} alt={`${label} preview`} className="h-full w-full object-cover" onError={() => setExists(false)} />
          : <Image className="h-5 w-5 text-slate-600" />}
      </div>
      <div className="min-w-52 flex-1">
        <label className="block text-xs font-semibold text-slate-300">{label}
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadImage} disabled={uploading} className="mt-1 block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-500 file:px-3 file:py-2 file:font-semibold file:text-slate-950 hover:file:bg-amber-400 disabled:opacity-60" />
        </label>
        <p className="mt-1 text-[11px] text-slate-500">PNG, JPEG or WebP · up to 5 MB · {exists ? 'An image is uploaded' : 'No image uploaded yet'}</p>
      </div>
      <div className="min-w-48 flex-1"><Field label="Image alt text" value={alt} onChange={next => onChange(value, next)} /></div>
    </div>
    {uploading && <p role="status" className="mt-2 text-xs text-amber-300">Uploading image…</p>}
    {error && <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
    {message && <p role="status" className="mt-2 text-xs text-emerald-300">{message}</p>}
  </div>;
}

function CardSection({ title, description, cards, fields, labels, onChange, onAdd, onRemove, onAuthError }) {
  return <EditorSection title={title} description={description}>
    {cards.map((card, index) => <div key={index} className="relative space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 sm:col-span-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-200">Card {index + 1}</h3>
        <button type="button" onClick={() => onRemove(index)} aria-label={`Remove card ${index + 1}`} className="rounded-lg p-2 text-slate-500 hover:bg-red-950/40 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(field => field === 'image'
          ? <WebsiteImageUpload key={field} label="Ride image" assetKey={card.imageAssetKey} value={card.imageUrl} alt={card.imageAlt} onChange={(value, alt) => { onChange(index, 'imageUrl', value); onChange(index, 'imageAlt', alt); }} onAuthError={onAuthError} />
          : <Field key={field} label={labels[field]} value={card[field]} onChange={value => onChange(index, field, value)} multiline={['description', 'answer'].includes(field)} />)}
      </div>
    </div>)}
    <button type="button" onClick={onAdd} className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-amber-500 hover:text-amber-300"><Plus className="h-4 w-4" /> Add card</button>
  </EditorSection>;
}
