import { API_BASE } from '../lib/api';

export const DEFAULT_PASSENGER_WEBSITE_CONTENT = {
  seo: {
    title: 'BiyahePro | Motorcycle and Motorcab Rides in Dapitan City',
    description: 'Book a motorcycle or motorcab ride in Dapitan City, Zamboanga del Norte. See your estimated fare before booking with the BiyahePro passenger app.',
    keywords: 'BiyahePro, Dapitan City ride app, motorcycle taxi Dapitan, motorcab Dapitan, Zamboanga del Norte transport',
  },
  hero: {
    eyebrow: 'LOCAL RIDES, MADE SIMPLE',
    title: 'Your next ride around Dapitan starts here.',
    description: 'Book a motorcycle or motorcab, choose your pickup and destination, and review your estimated fare in the BiyahePro passenger app.',
    imageAssetKey: 'website-hero',
    imageUrl: '',
    imageAlt: 'BiyahePro passenger rides in Dapitan City',
  },
  services: {
    heading: 'Choose the ride that fits your trip.',
    description: 'BiyahePro brings motorcycle and motorcab booking together in one passenger app for trips around Dapitan City.',
    cards: [
      {
        title: 'Motorcycle',
        subtitle: 'A practical ride for everyday trips',
        description: 'Set your pickup and destination, review the fare estimate, and request a motorcycle ride from the app.',
        imageAssetKey: 'service-card-motorcycle',
        imageUrl: '',
        imageAlt: 'Motorcycle ride available in the BiyahePro app',
      },
      {
        title: 'Motorcab / Baobao',
        subtitle: 'A motorcab option in the same app',
        description: 'Choose a motorcab when it suits your trip. Your available ride options and fare estimate appear before you confirm.',
        imageAssetKey: 'service-card-motorcab',
        imageUrl: '',
        imageAlt: 'Motorcab ride available in the BiyahePro app',
      },
    ],
  },
  steps: {
    heading: 'Book a ride in a few steps.',
    description: 'Use the passenger app to set up your trip and follow its status.',
    cards: [
      { title: 'Choose your locations', description: 'Set your pickup and destination on the map or search available fare-zone places.' },
      { title: 'Review your estimate', description: 'See the estimated fare and booking fee before you confirm your request.' },
      { title: 'Request and follow your ride', description: 'Choose an available ride and payment option, then check trip updates in the app.' },
    ],
  },
  features: {
    heading: 'Useful details, before you ride.',
    cards: [
      { title: 'Fare estimate before booking', description: 'Review the estimated total and the official destination used as the fare guide.' },
      { title: 'Dapitan fare zones', description: 'Browse listed destinations and their fares in the passenger app.' },
      { title: 'Trip status updates', description: 'Follow your booking and driver location during an active trip.' },
      { title: 'Payment options in the app', description: 'Choose from the payment methods currently enabled for your account.' },
    ],
  },
  about: {
    heading: 'Built for getting around Dapitan.',
    description: 'BiyahePro is a passenger ride-booking app for motorcycle and motorcab trips. Set your pickup and destination, check the fare estimate, and book with trip details in one place.',
    imageAssetKey: 'website-about',
    imageUrl: '',
    imageAlt: 'BiyahePro passenger app ride booking screen',
  },
  faqs: [
    { question: 'Where can I book a BiyahePro ride?', answer: 'BiyahePro bookings are available within the service area configured for Dapitan City. Pickup and destination must both be within the active service area.' },
    { question: 'How is my fare estimated?', answer: 'The app uses the nearest listed official destination fare as a guide and shows the booking fee and estimated total before you confirm. Your exact estimate appears in the app.' },
    { question: 'Which rides can I choose?', answer: 'The passenger app offers motorcycle and motorcab (Baobao) ride options, subject to availability.' },
    { question: 'How can I pay for my ride?', answer: 'Payment options that are currently enabled for the service are shown in the passenger app when you book.' },
  ],
  download: {
    heading: 'Ready to book your next ride?',
    description: 'Get the BiyahePro passenger app to check available rides and fares around Dapitan.',
    imageAssetKey: 'website-download-qr',
    qrImageUrl: '',
    qrImageAlt: 'Scan to get the BiyahePro passenger app',
    appTitle: 'BiyahePro passenger app',
    androidUrl: '',
    iosUrl: '',
  },
};

function normalizeCards(value, defaults, includeImageKeys = false) {
  if (!Array.isArray(value)) return defaults;
  return value
    .filter(card => card && typeof card === 'object')
    .map((card, index) => ({
      ...(defaults[index] || {}),
      ...card,
      ...(includeImageKeys && typeof card.imageAssetKey !== 'string'
        ? { imageAssetKey: defaults[index]?.imageAssetKey || `service-card-legacy-${index}` }
        : {}),
    }));
}

export function normalizePassengerWebsiteContent(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_PASSENGER_WEBSITE_CONTENT;

  const content = { ...DEFAULT_PASSENGER_WEBSITE_CONTENT, ...value };
  for (const section of ['seo', 'hero', 'services', 'steps', 'features', 'about', 'download']) {
    content[section] = {
      ...DEFAULT_PASSENGER_WEBSITE_CONTENT[section],
      ...(value[section] && typeof value[section] === 'object' ? value[section] : {}),
    };
  }
  for (const section of ['services', 'steps', 'features']) {
    content[section].cards = normalizeCards(
      value[section]?.cards,
      DEFAULT_PASSENGER_WEBSITE_CONTENT[section].cards,
      section === 'services',
    );
  }
  content.faqs = normalizeCards(value.faqs, DEFAULT_PASSENGER_WEBSITE_CONTENT.faqs);
  return content;
}

export function safeWebsiteUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const candidate = value.trim();
  if (candidate.startsWith('/') && !candidate.startsWith('//') && !candidate.includes('\\')) return candidate;
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
}

export function resolveWebsiteImageUrl(value) {
  if (typeof value !== 'string') return '';
  const asset = /^asset:([a-z0-9-]{1,60})(?::(\d+))?$/.exec(value);
  if (asset) {
    const url = `${API_BASE}/api/branding/website-image/${asset[1]}`;
    return asset[2] ? `${url}?v=${asset[2]}` : url;
  }
  return safeWebsiteUrl(value);
}
