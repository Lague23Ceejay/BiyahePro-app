import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Bike,
  Check,
  ChevronDown,
  CircleHelp,
  MapPin,
  Menu,
  Navigation,
  QrCode,
  Smartphone,
  Wallet,
  X,
} from 'lucide-react';
import { API_BASE } from '../../lib/api';
import SpecularButton from '../../components/effects/SpecularButton';
import {
  DEFAULT_PASSENGER_WEBSITE_CONTENT,
  normalizePassengerWebsiteContent,
  resolveWebsiteImageUrl,
  safeWebsiteUrl,
} from '../../data/passengerWebsiteContent';
import './PassengerHome.css';

const CONTENT_SETTING_KEY = 'website.passenger_content';

const featureIcons = [Wallet, MapPin, Navigation, Check];
const specularSurfaceHandlers = {
  onPointerEnter: updateSpecularLight,
  onPointerMove: updateSpecularLight,
  onPointerDown: updateSpecularLight,
  onPointerUp: resetSpecularLight,
  onPointerLeave: resetSpecularLight,
};

export default function PassengerHome() {
  const [content, setContent] = useState(DEFAULT_PASSENGER_WEBSITE_CONTENT);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;

    const sections = document.querySelectorAll('.passenger-site [data-reveal]');
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -32px 0px' });

    document.documentElement.classList.add('has-scroll-reveal');
    sections.forEach(section => observer.observe(section));
    return () => {
      observer.disconnect();
      document.documentElement.classList.remove('has-scroll-reveal');
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE}/api/settings/public`)
      .then(async response => {
        if (!response.ok) throw new Error(`Public site content returned ${response.status}.`);
        return response.json();
      })
      .then(settings => {
        const setting = Array.isArray(settings) && settings.find(item => item.key === CONTENT_SETTING_KEY);
        if (setting?.value) {
          const parsed = JSON.parse(setting.value);
          if (active) setContent(normalizePassengerWebsiteContent(parsed));
        }
      })
      .catch(error => {
        console.warn('Using built-in passenger website content because the public settings could not be loaded.', error);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const title = typeof content.seo.title === 'string' && content.seo.title.trim()
      ? content.seo.title.trim()
      : DEFAULT_PASSENGER_WEBSITE_CONTENT.seo.title;
    const description = typeof content.seo.description === 'string' && content.seo.description.trim()
      ? content.seo.description.trim()
      : DEFAULT_PASSENGER_WEBSITE_CONTENT.seo.description;
    document.title = title;
    setMeta('description', description);
    setMeta('keywords', content.seo.keywords);
    setMeta('og:title', title, 'property');
    setMeta('og:description', description, 'property');
    setMeta('og:type', 'website', 'property');
    setMeta('og:image', resolveWebsiteImageUrl(content.hero.imageUrl), 'property');
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', title);
    setMeta('twitter:description', description);
    setMeta('twitter:image', resolveWebsiteImageUrl(content.hero.imageUrl));
    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = `${window.location.origin}${window.location.pathname}`;

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'passenger-website-structured-data';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          name: 'BiyahePro',
          url: window.location.origin,
          description,
        },
        {
          '@type': 'MobileApplication',
          name: content.download.appTitle || 'BiyahePro passenger app',
          applicationCategory: 'TravelApplication',
          operatingSystem: 'Android, iOS',
          description,
          areaServed: { '@type': 'City', name: 'Dapitan City' },
        },
        {
          '@type': 'FAQPage',
          mainEntity: content.faqs.map(item => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: { '@type': 'Answer', text: item.answer },
          })),
        },
      ],
    });
    document.getElementById(script.id)?.remove();
    document.head.appendChild(script);
    return () => script.remove();
  }, [content]);

  function closeMenu() {
    setMenuOpen(false);
  }

  const heroImage = resolveWebsiteImageUrl(content.hero.imageUrl);
  const aboutImage = resolveWebsiteImageUrl(content.about.imageUrl);
  const qrImage = resolveWebsiteImageUrl(content.download.qrImageUrl);

  return (
    <main className="passenger-site">
      <header className="site-header">
        <a className="brand-lockup" href="#top" aria-label="BiyahePro home" onClick={closeMenu}>
          <span className="brand-mark"><Bike aria-hidden="true" /></span>
          <span><strong>BiyahePro</strong><small>PASSENGER APP · DAPITAN</small></span>
        </a>
        <button className="mobile-menu-toggle" type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(open => !open)}>
          {menuOpen ? <X /> : <Menu />}
        </button>
        <nav className={menuOpen ? 'site-nav is-open' : 'site-nav'} aria-label="Main navigation">
          <a href="#rides" onClick={closeMenu}>Ride options</a>
          <a href="#how-it-works" onClick={closeMenu}>How it works</a>
          <a href="#about" onClick={closeMenu}>About the app</a>
          <a href="#faq" onClick={closeMenu}>FAQs</a>
        </nav>
        <a className="button button-outline header-help" href="#faq">Get help <CircleHelp size={16} aria-hidden="true" /></a>
        <SpecularLink href="#download" className="header-download">Get the app <QrCode size={17} aria-hidden="true" /></SpecularLink>
      </header>

      <section className="hero-section section-wrap" id="top" data-reveal>
        <div className="hero-copy">
          <span className="eyebrow"><span className="status-dot" />{content.hero.eyebrow}</span>
          <h1>{content.hero.title}</h1>
          <p className="hero-description">{content.hero.description}</p>
          <div className="hero-actions">
            <SpecularLink href="#download" variant="dark" className="hero-primary-cta">
              Explore the app <ArrowRight size={17} aria-hidden="true" />
            </SpecularLink>
            <SpecularLink href="#rides" variant="outline" className="hero-secondary-cta">See ride options <ArrowDown size={16} aria-hidden="true" /></SpecularLink>
          </div>
          <div className="hero-location"><MapPin size={17} aria-hidden="true" /><span>Serving Dapitan City, Zamboanga del Norte</span></div>
        </div>
        <div className={`hero-art specular-surface${heroImage ? ' has-image' : ''}`} {...specularSurfaceHandlers}>
          {heroImage
            ? <SpecularPhoto image={heroImage} alt={content.hero.imageAlt} className="hero-photo-specular" />
            : <div className="hero-art-default" aria-hidden="true">
              <span className="hero-sun" />
              <span className="hero-road" />
              <span className="hero-route route-one" />
              <span className="hero-route route-two" />
              <div className="phone-preview">
                <div className="phone-speaker" />
                <div className="phone-topline"><span>BiyahePro</span><span className="phone-location"><MapPin size={10} /> Dapitan</span></div>
                <div className="map-preview"><span className="map-road road-a" /><span className="map-road road-b" /><span className="map-road road-c" /><span className="map-pin"><MapPin size={17} fill="currentColor" /></span></div>
                <div className="phone-destination"><small>YOUR DESTINATION</small><strong>Choose a place in Dapitan</strong></div>
                <div className="phone-option"><span className="ride-icon"><Bike size={17} /></span><span><strong>Choose your ride</strong><small>Motorcycle or motorcab</small></span><ArrowRight size={15} /></div>
              </div>
              <div className="floating-note note-fare"><span className="note-icon"><Wallet size={16} /></span><span><small>BEFORE YOU BOOK</small><strong>See your fare estimate</strong></span></div>
              <div className="floating-note note-local"><MapPin size={16} /><span>Made for local trips</span></div>
            </div>}
          <div className="hero-caption"><span className="caption-dot" /> One app for everyday Dapitan rides</div>
        </div>
      </section>

      <section className="service-section section-wrap" id="rides" data-reveal>
        <div className="section-heading">
          <div><span className="eyebrow">RIDE OPTIONS</span><h2>{content.services.heading}</h2></div>
          <p>{content.services.description}</p>
        </div>
        <div className="service-grid">
          {content.services.cards.map((card, index) => {
            const image = resolveWebsiteImageUrl(card.imageUrl);
            return (
            <article className={`service-card service-card-${index % 2}`} key={`${card.title}-${index}`}>
              <div className={`service-image specular-surface${image ? ' has-image' : ''}`} {...specularSurfaceHandlers}>
                {image
                  ? <SpecularPhoto image={image} alt={card.imageAlt} className="service-photo-specular" />
                  : <div className="service-image-placeholder" aria-hidden="true"><span className="service-orb" /><span className="service-road" /><span className="service-vehicle"><Bike /></span></div>}
                <span className="image-label"><Bike size={14} aria-hidden="true" /> RIDE IN DAPITAN</span>
              </div>
              <div className="service-card-content">
                <div className="service-title-row"><div><h3>{card.title}</h3><span>{card.subtitle}</span></div><span className="service-number">0{index + 1}</span></div>
                <p>{card.description}</p>
                <a href="#download" className="text-link">Check the app <ArrowRight size={16} aria-hidden="true" /></a>
              </div>
            </article>
            );
          })}
        </div>
      </section>

      <section className="steps-section" id="how-it-works" data-reveal>
        <div className="section-wrap steps-layout">
          <div className="steps-intro"><span className="eyebrow eyebrow-light">HOW IT WORKS</span><h2>{content.steps.heading}</h2><p>{content.steps.description}</p><SpecularLink href="#download">Get the passenger app <ArrowRight size={17} aria-hidden="true" /></SpecularLink></div>
          <div className="steps-list">
            {content.steps.cards.map((step, index) => <article className="step-card" key={`${step.title}-${index}`}><span className="step-index">0{index + 1}</span><div><h3>{step.title}</h3><p>{step.description}</p></div><ArrowRight className="step-arrow" size={18} aria-hidden="true" /></article>)}
          </div>
        </div>
      </section>

      <section className="benefits-section section-wrap" data-reveal>
        <div className="section-heading benefits-heading">
          <div><span className="eyebrow">YOUR TRIP, MADE CLEAR</span><h2>{content.features.heading}</h2></div>
          <p>Know what to expect as you book. Fare estimates and ride details are shown in the passenger app.</p>
        </div>
        <div className="benefit-grid">
          {content.features.cards.map((feature, index) => {
            const Icon = featureIcons[index % featureIcons.length];
            return <article className="benefit-card" key={`${feature.title}-${index}`}><span className="benefit-icon"><Icon size={20} aria-hidden="true" /></span><h3>{feature.title}</h3><p>{feature.description}</p></article>;
          })}
        </div>
      </section>

      <section className="about-section section-wrap" id="about" data-reveal>
        <div className={`about-visual specular-surface${aboutImage ? ' has-image' : ''}`} {...specularSurfaceHandlers}>
          {aboutImage
            ? <SpecularPhoto image={aboutImage} alt={content.about.imageAlt} className="about-photo-specular" />
            : <div className="about-app-card" aria-hidden="true">
              <span className="about-app-brand"><span className="brand-mark"><Bike /></span> BiyahePro</span>
              <span className="about-app-label">YOUR RIDE, YOUR ROUTE</span>
              <span className="about-map"><span className="about-map-line line-a" /><span className="about-map-line line-b" /><span className="about-map-line line-c" /><MapPin className="about-pin" size={28} fill="currentColor" /></span>
              <span className="about-ride-option"><Bike size={19} /><span><strong>Motorcycle</strong><small>Review your fare estimate</small></span><Check size={17} /></span>
            </div>}
        </div>
        <div className="about-copy"><span className="eyebrow">ABOUT BIYAHEPRO</span><h2>{content.about.heading}</h2><p>{content.about.description}</p><div className="about-points"><span><Check size={15} /> Destination-based fare estimates</span><span><Check size={15} /> Motorcycle and motorcab options</span><span><Check size={15} /> Trip updates in the passenger app</span></div><a className="text-link" href="#download">Explore the passenger app <ArrowRight size={16} /></a></div>
      </section>

      <section className="faq-section section-wrap" id="faq" data-reveal>
        <div className="faq-intro"><span className="eyebrow">PASSENGER FAQS</span><h2>Good to know before you go.</h2><p>Answers about booking a BiyahePro ride in Dapitan City.</p><a className="text-link" href="#download">Open the app <ArrowRight size={16} /></a></div>
        <div className="faq-list">
          {content.faqs.map((faq, index) => <details className="faq-item" key={`${faq.question}-${index}`} open={index === 0}><summary><span>{faq.question}</span><ChevronDown size={18} aria-hidden="true" /></summary><p>{faq.answer}</p></details>)}
        </div>
      </section>

      <section className="download-section" id="download" data-reveal>
        <div className="section-wrap download-layout">
          <div className="download-copy"><span className="eyebrow eyebrow-light">YOUR NEXT RIDE IS A FEW TAPS AWAY</span><h2>{content.download.heading}</h2><p>{content.download.description}</p><span className="download-location"><MapPin size={16} /> Dapitan City, Zamboanga del Norte</span></div>
          <div className="download-card specular-surface" {...specularSurfaceHandlers}>
            <div className="download-card-heading"><span className="download-device"><Smartphone size={19} /></span><span><small>GET STARTED</small><strong>{content.download.appTitle}</strong></span></div>
            {qrImage
              ? <div className="qr-frame"><img src={qrImage} alt={content.download.qrImageAlt} loading="lazy" /></div>
              : <div className="qr-placeholder"><QrCode size={45} strokeWidth={1.4} /><span>App download QR code</span><small>Check back soon for the download link.</small></div>}
            <div className="download-links">
              {safeWebsiteUrl(content.download.androidUrl) && <a href={safeWebsiteUrl(content.download.androidUrl)} target="_blank" rel="noreferrer">Android <ArrowRight size={14} /></a>}
              {safeWebsiteUrl(content.download.iosUrl) && <a href={safeWebsiteUrl(content.download.iosUrl)} target="_blank" rel="noreferrer">iPhone <ArrowRight size={14} /></a>}
              {!safeWebsiteUrl(content.download.androidUrl) && !safeWebsiteUrl(content.download.iosUrl) && <span>Android and iPhone links will appear here when available.</span>}
            </div>
          </div>
        </div>
      </section>

      <footer className="site-footer" data-reveal>
        <div className="section-wrap footer-main">
          <a className="brand-lockup footer-brand" href="#top"><span className="brand-mark"><Bike aria-hidden="true" /></span><span><strong>BiyahePro</strong><small>PASSENGER APP · DAPITAN</small></span></a>
          <p>Motorcycle and motorcab ride booking for everyday trips around Dapitan City.</p>
          <nav aria-label="Footer navigation"><a href="#rides">Ride options</a><a href="#how-it-works">How it works</a><a href="#faq">Passenger FAQs</a><a href="#download">Get the app</a></nav>
        </div>
        <div className="section-wrap footer-bottom"><span>© {new Date().getFullYear()} BiyahePro</span><a href="#admin">Admin</a><span>Made for local rides in Dapitan City.</span></div>
      </footer>
    </main>
  );
}

function SpecularPhoto({ image, alt, className }) {
  return (
    <div
      role="img"
      aria-label={alt || undefined}
      className={`specular-photo ${className}`}
    >
      <img src={image} alt="" loading="lazy" decoding="async" />
    </div>
  );
}

function updateSpecularLight(event) {
  const bounds = event.currentTarget.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const x = Math.min(100, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * 100));
  const y = Math.min(100, Math.max(0, ((event.clientY - bounds.top) / bounds.height) * 100));
  event.currentTarget.style.setProperty('--specular-x', `${x}%`);
  event.currentTarget.style.setProperty('--specular-y', `${y}%`);
  event.currentTarget.style.setProperty('--specular-opacity', '1');
}

function resetSpecularLight(event) {
  event.currentTarget.style.setProperty('--specular-opacity', '.46');
}

function SpecularLink({ variant = 'primary', className = '', children, ...linkProps }) {
  const isOutline = variant === 'outline';
  const isDark = variant === 'dark';

  return (
    <SpecularButton
      as="a"
      size="sm"
      radius={999}
      tint={isOutline ? '#ffffff' : isDark ? '#17130f' : '#e98b00'}
      tintOpacity={isOutline ? 0.54 : 1}
      textColor={isDark ? '#ffffff' : '#17130f'}
      lineColor="#78c8ff"
      baseColor="#174f8b"
      intensity={1.65}
      idleIntensity={0.65}
      shineSize={12}
      shineFade={36}
      thickness={1.3}
      glow={0.35}
      proximity={150}
      className={`passenger-specular-link passenger-specular-link--${variant}${className ? ` ${className}` : ''}`}
      {...linkProps}
    >
      {children}
    </SpecularButton>
  );
}

function setMeta(name, content, attribute = 'name') {
  if (!content) return;
  let element = document.head.querySelector(`meta[${attribute}="${name}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, name);
    document.head.appendChild(element);
  }
  element.content = content;
}
