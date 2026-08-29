import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { brochure, crew, events, posters, site, timeline } from './data/site.js';
import RegistrationModal from './components/RegistrationModal.jsx';
import Icon from './components/Icon.jsx';
import PillNav from './components/PillNav.jsx';
import CircularGallery from './components/CircularGallery/CircularGallery.jsx';
import SplitFlapCountdown from './components/effects/SplitFlapCountdown.jsx';
import useReveal from './hooks/useReveal.js';

const VenueMap = lazy(() => import('./components/VenueMap.jsx'));

const directionsUrl = 'https://www.google.com/maps/dir/?api=1&destination=Velammal+Engineering+College%2C+Surapet%2C+Chennai+600066';
const navigationItems = [
  { label: 'Home', href: '#top' },
  { label: 'About', href: '#about' },
  { label: 'Events', href: '#events' },
  { label: 'Timeline', href: '#timeline' },
  { label: 'Contact', href: '#contact' }
];

export default function App() {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [registration, setRegistration] = useState(null);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeHref, setActiveHref] = useState('#top');
  useReveal();

  useEffect(() => {
    const controller = new AbortController();
    const apiBase = import.meta.env.VITE_API_URL || '';
    fetch(`${apiBase}/api/events`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Event service unavailable')))
      .then((data) => setRegistrationOpen(data.registrationOpen === true))
      .catch((error) => {
        if (error.name !== 'AbortError') setRegistrationOpen(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const sections = navigationItems
      .map(({ href }) => document.querySelector(href))
      .filter(Boolean);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveHref(`#${visible.target.id}`);
      },
      { rootMargin: '-28% 0px -58% 0px', threshold: [0.05, 0.3, 0.6] }
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const updateProgress = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(max > 0 ? (window.scrollY / max) * 100 : 0);
    };
    updateProgress();
    window.addEventListener('scroll', updateProgress, { passive: true });
    return () => window.removeEventListener('scroll', updateProgress);
  }, []);

  const openRegistration = (eventId = null) => {
    setSelectedEvent(null);
    setRegistration(eventId || 'open');
  };

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <SiteSnow />
      <div className="scroll-progress" style={{ '--scroll-progress': `${scrollProgress}%` }} aria-hidden="true" />
      <PillNav
        items={navigationItems}
        activeHref={activeHref}
        baseColor="#101427"
        pillColor="rgba(255,255,255,0.07)"
        pillTextColor="#bfc9ea"
        hoveredPillTextColor="#ffffff"
        ctaLabel="Register"
        onCtaClick={() => openRegistration()}
      />

      <main id="main">
        <Hero onRegister={() => openRegistration()} />
        <About />
        <Events onSelect={setSelectedEvent} />
        <Timeline />
        <Brochure />
        <Crew />
        <Contact onRegister={() => openRegistration()} />
        <SocialMedia />
        <LocationMap />
      </main>
      <Footer />

      <AnimatePresence>
        {selectedEvent && <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
      </AnimatePresence>
      {registration && <RegistrationModal events={events.filter((event) => event.registerable !== false)} registrationOpen={registrationOpen} initialEventId={registration === 'open' ? null : registration} onClose={() => setRegistration(null)} />}
    </>
  );
}

function DeferredVenueMap() {
  const [ready, setReady] = useState(false);
  const [mobilePreview, setMobilePreview] = useState(false);
  const [deviceDirectionsUrl, setDeviceDirectionsUrl] = useState(directionsUrl);
  const shellRef = useRef(null);

  useEffect(() => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const constrained = connection?.saveData || window.matchMedia('(max-width: 700px)').matches || (navigator.deviceMemory && navigator.deviceMemory <= 4);
    const appleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const android = /Android/i.test(navigator.userAgent);
    if (appleMobile) setDeviceDirectionsUrl('https://maps.apple.com/?daddr=13.1483288,80.1916095&dirflg=d');
    else if (android) setDeviceDirectionsUrl('geo:0,0?q=13.1483288,80.1916095(Velammal%20Engineering%20College)');
    setMobilePreview(Boolean(constrained));
    if (constrained || !shellRef.current) return undefined;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setReady(true);
        observer.disconnect();
      }
    }, { rootMargin: '240px' });
    observer.observe(shellRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="venue-map-shell" ref={shellRef}>
      {ready ? (
        <Suspense fallback={<div className="venue-map__loading">Loading map…</div>}>
          <VenueMap latitude={site.coordinates.latitude} longitude={site.coordinates.longitude} directionsUrl={deviceDirectionsUrl} />
          <a className="venue-map__directions" href={deviceDirectionsUrl}>Get directions <Icon name="arrow" size={15}/></a>
        </Suspense>
      ) : mobilePreview ? (
        <div className="venue-map__preview venue-map__preview--real">
          <iframe title="Map of Velammal Engineering College" loading="lazy" src="https://www.openstreetmap.org/export/embed.html?bbox=80.1836%2C13.1433%2C80.1996%2C13.1533&amp;layer=mapnik&amp;marker=13.1483288%2C80.1916095" tabIndex="-1" />
          <a className="venue-map__preview-link" href={deviceDirectionsUrl} aria-label="Open directions to Velammal Engineering College"><span className="venue-map__preview-action"><Icon name="pin" size={18}/><span><strong>Get directions</strong><small>Opens in your maps app</small></span><Icon name="arrow" size={16}/></span></a>
          <small className="venue-map__attribution">© OpenStreetMap contributors</small>
        </div>
      ) : (
        <div className="venue-map__preview venue-map__preview--loading">
          <span className="venue-map__pin"><Icon name="pin" size={22}/></span>
          <div><strong>Surapet, Chennai</strong><small>Velammal Engineering College</small></div>
        </div>
      )}
    </div>
  );
}

function Hero({ onRegister }) {
  return (
    <section className="hero" id="top">
      <div className="page-width hero__inner">
        <div className="hero__main">
          <span className="hero__eyebrow">{site.eyebrow}</span>
          <img className="hero__logo" src="/brand/noctivus-emblem.webp" alt="Noctivus emblem" width="480" height="534" fetchPriority="high" />
          <h1>NOCTIVUS <span>'26</span></h1>
          <div className="hero__facts" aria-label="Event information">
            <span><small>WHEN</small>{site.date}</span>
            <span><small>WHERE</small>Velammal Engineering College · Chennai</span>
          </div>
          <SplitFlapCountdown target={site.eventStart} />
          <div className="hero__actions">
            <a className="button button-primary button-large" href="#events">Explore events <Icon name="arrow" /></a>
            <button className="button button-ghost button-large" type="button" onClick={onRegister}>Register now</button>
          </div>
        </div>
      </div>
      <a className="hero__scroll" href="#about"><span /> Discover Noctivus</a>
    </section>
  );
}

function SiteSnow() {
  const flakes = useMemo(() => Array.from({ length: 62 }, (_, index) => {
    const seed = index + 1;
    const kind = index < 7 ? 'large' : index < 25 ? 'medium' : 'small';
    const left = (seed * 37) % 100;
    const size = kind === 'large' ? 24 + ((seed * 19) % 9) : kind === 'medium' ? 12 + ((seed * 19) % 7) : 4 + ((seed * 19) % 5);
    const duration = kind === 'large' ? 12 + ((seed * 23) % 5) : kind === 'medium' ? 16 + ((seed * 23) % 5) : 20 + ((seed * 23) % 9);
    const delay = -((seed * 29) % duration);
    const drift = kind === 'large' ? ((seed * 17) % 41) - 20 : kind === 'medium' ? ((seed * 17) % 31) - 15 : ((seed * 17) % 17) - 8;
    const opacity = kind === 'small' ? 0.3 + (((seed * 11) % 21) / 100) : 0.7 + (((seed * 11) % 21) / 100);
    const rotation = kind === 'large' ? 15 : kind === 'medium' ? 10 : 0;
    return { kind, left, size, duration, delay, drift, opacity, rotation };
  }), []);

  return (
    <div className="site-snow" aria-hidden="true">
      {flakes.map((flake, index) => (
        <span
          key={index}
          className={`site-snow__flake site-snow__flake--${flake.kind}`}
          style={{
            '--snow-left': `${flake.left}%`,
            '--snow-size': `${flake.size}px`,
            '--snow-duration': `${flake.duration}s`,
            '--snow-delay': `${flake.delay}s`,
            '--snow-drift': `${flake.drift}px`,
            '--snow-opacity': flake.opacity,
            '--snow-rotation': `${flake.rotation}deg`,
          }}
        >
          {flake.kind === 'large' && <LargeSnowflake />}
          {flake.kind === 'medium' && <MediumSnowflake />}
          {flake.kind === 'small' && <SmallSnowflake />}
        </span>
      ))}
    </div>
  );
}

function LargeSnowflake() {
  const rotations = [0, 60, 120, 180, 240, 300];
  return (
    <svg viewBox="0 0 32 32" width="32" height="32" focusable="false">
      {rotations.map((rotation) => (
        <g key={rotation} transform={`rotate(${rotation}, 16, 16)`} stroke="#F4EFE4" strokeWidth="2" strokeLinecap="round" fill="none">
          <line x1="16" y1="16" x2="16" y2="2" />
          <line x1="16" y1="7.6" x2="12.5" y2="4.5" strokeWidth="1.5" />
          <line x1="16" y1="7.6" x2="19.5" y2="4.5" strokeWidth="1.5" />
          <line x1="16" y1="4" x2="13.5" y2="2" strokeWidth="1.5" />
          <line x1="16" y1="4" x2="18.5" y2="2" strokeWidth="1.5" />
          <line x1="16" y1="2" x2="14" y2="0.5" strokeWidth="1.2" />
          <line x1="16" y1="2" x2="18" y2="0.5" strokeWidth="1.2" />
        </g>
      ))}
      <polygon points="16,13 18.6,14.5 18.6,17.5 16,19 13.4,17.5 13.4,14.5" fill="#F4EFE4" opacity="0.9" />
    </svg>
  );
}

function MediumSnowflake() {
  const rotations = [0, 60, 120, 180, 240, 300];
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" focusable="false">
      {rotations.map((rotation) => (
        <g key={rotation} transform={`rotate(${rotation}, 12, 12)`} stroke="#F4EFE4" strokeLinecap="round" fill="none">
          <line x1="12" y1="12" x2="12" y2="2" strokeWidth="1.5" />
          <line x1="12" y1="5.5" x2="9.9" y2="3.4" strokeWidth="1" />
          <line x1="12" y1="5.5" x2="14.1" y2="3.4" strokeWidth="1" />
        </g>
      ))}
      <polygon points="12,10 13.7,11 13.7,13 12,14 10.3,13 10.3,11" fill="#F4EFE4" opacity="0.9" />
    </svg>
  );
}

function SmallSnowflake() {
  const rotations = [0, 60, 120, 180, 240, 300];
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" focusable="false">
      {rotations.map((rotation) => (
        <g key={rotation} transform={`rotate(${rotation}, 6, 6)`} stroke="#F4EFE4" strokeWidth="1" strokeLinecap="round" fill="none">
          <line x1="6" y1="6" x2="6" y2="1" />
        </g>
      ))}
    </svg>
  );
}

function SectionTitle({ kicker, title, description }) {
  return <header className="section-title" data-reveal><div><span className="kicker">{kicker}</span><h2>{title}</h2>{description && <p>{description}</p>}</div></header>;
}

function About() {
  return (
    <section className="section about" id="about">
      <div className="page-width">
        <SectionTitle kicker="ABOUT NOCTIVUS" title={<>A student-built symposium<br/><span className="muted-title">hosted by Velammal Engineering College.</span></>} />
        <div className="about-grid">
          <div className="about-copy" data-reveal><p className="lead">Noctivus is the annual national-level symposium of the Department of CSE (Cyber Security), Velammal Engineering College.</p><p>The event brings together technical contests, non-technical challenges, workshops, and campus-wide coordination for students who want to test ideas, sharpen instincts, and compete with purpose.</p><p>Velammal Engineering College, Chennai, hosts Noctivus as a focused student platform for cyber security, computing, collaboration, and practical learning.</p></div>
          <div className="about-manifesto" data-reveal><span>HOST COLLEGE</span><strong>Velammal Engineering College</strong><strong>Department of CSE (Cyber Security)</strong><strong>Chennai, Tamil Nadu</strong></div>
        </div>
        <figure className="about-showcase" data-reveal>
          <div className="about-showcase__image"><img src="/images/noctivus-students.webp" alt="Students gathered at Noctivus" width="1400" height="1050" loading="lazy" decoding="async" /></div>
          <figcaption><span className="kicker">THE NOCTIVUS EXPERIENCE</span><strong>Built by students.<br/>Driven by curiosity.</strong><p>A day shaped by collaboration, competition, and the people bold enough to show up and take part.</p></figcaption>
        </figure>
        <Stats />
      </div>
    </section>
  );
}

function Stats() {
  const values = [['08', 'Events'], ['05', 'Technical events'], ['03', 'Non-technical events'], ['26 Sep', 'Event date']];
  return <div className="stats-grid" data-reveal>{values.map(([value, label]) => <div className="stat" key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>;
}

function Events({ onSelect }) {
  const [filter, setFilter] = useState('All');
  const filters = ['All', 'Technical', 'Non-technical', 'Workshops'];
  const visibleEvents = useMemo(() => filter === 'All' ? events : events.filter((event) => event.category === filter), [filter]);

  return (
    <section className="section events-section" id="events">
      <div className="page-width">
        <SectionTitle kicker="EVENTS" title="Choose your event." description="Explore the official event lineup. Rules, formats, fees, and timings will be announced soon." />
        <div className="event-filters" role="group" aria-label="Filter events">
          {filters.map((item) => <button type="button" aria-pressed={filter === item} onClick={() => setFilter(item)} key={item}>{item}</button>)}
        </div>
        <div className="events-grid">
          {visibleEvents.map((event, index) => (
            <motion.article className={`event-card accent-${event.accent}`} data-reveal style={{ '--reveal-order': index }} key={event.id} layoutId={`event-card-${event.id}`}>
              <motion.button className="event-card__button" onClick={() => onSelect(event)} aria-label={`View ${event.name} rules and regulations`} whileHover="hover">
                <motion.img className="event-card__photo" src={event.image} alt="" loading="lazy" width="720" height="480" style={{ objectPosition: event.imagePosition }} variants={{ hover: { scale: 1.05 } }} />
                <div className="event-card__content">
                  <div className="event-card__meta"><span className="event-card__date">SEP 26</span><span className="event-category">{event.category}</span></div>
                  <div className="event-card__body"><h3>{event.name}</h3><p>{event.format}</p></div>
                  <div className="event-card__footer"><span className="event-card__cta">View rules <Icon name="arrow" size={16}/></span></div>
                </div>
              </motion.button>
            </motion.article>
          ))}
        </div>
        <p className="events-note" data-reveal><span>*</span> Final rules, capacities, and event timings will be locked before registration opens.</p>
      </div>
    </section>
  );
}

function Timeline() {
  return (
    <section className="section schedule-section" id="timeline">
      <div className="page-width">
        <SectionTitle kicker="TIMELINE" title="Event-day schedule." description="The Noctivus day plan from reporting to awards." />
        <div className="timeline" data-reveal>
          {timeline.map(([time, title, description]) => (
            <div className="timeline-row" key={title}>
              <time>{time}</time>
              <span className="timeline-node" aria-hidden="true" />
              <div><h3>{title}</h3><p>{description}</p></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Brochure() {
  const [fullscreenPoster, setFullscreenPoster] = useState(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const downloadRef = useRef(null);
  const posterItems = posters.map((poster) => ({ ...poster, text: poster.title }));

  useEffect(() => {
    if (!downloadOpen) return undefined;
    const onPointerDown = (event) => {
      if (!downloadRef.current?.contains(event.target)) setDownloadOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setDownloadOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [downloadOpen]);

  return (
    <section className="section brochure-section" id="brochure">
      <div className="brochure-full">
        <div className="page-width brochure-full__header">
          <SectionTitle kicker="BROCHURE" title="Posters and downloads." description="Open a poster panel to preview it, then download the poster or the brochure PDF." />
          <div className="brochure-actions" data-reveal>
            <a className="button button-primary" href={brochure.href}>Download brochure <Icon name="external" /></a>
            <a className="button button-secondary" href={posters[0].image} download>Download main poster <Icon name="external" /></a>
          </div>
        </div>
        <div className="brochure-gallery-wrap" data-reveal>
          <CircularGallery
            items={posterItems}
            bend={2}
            textColor="#F4EFE4"
            borderRadius={0.05}
            scrollEase={0.03}
            font="600 20px var(--display-font)"
            onPosterClick={setFullscreenPoster}
          />
        </div>
        <div className="poster-download-menu" data-reveal ref={downloadRef}>
          <button className="button button-secondary poster-download-menu__button" type="button" aria-haspopup="menu" aria-expanded={downloadOpen} onClick={() => setDownloadOpen((open) => !open)}>
            Download Poster <span aria-hidden="true">▾</span>
          </button>
          {downloadOpen && (
            <div className="poster-download-menu__list" role="menu">
              {posters.map((poster) => <a href={poster.image} download role="menuitem" key={poster.image} onClick={() => setDownloadOpen(false)}>{poster.title}</a>)}
            </div>
          )}
        </div>
      </div>
      {fullscreenPoster && (
        <div className="poster-fullscreen" role="dialog" aria-modal="true" aria-label={fullscreenPoster.title} onMouseDown={(event) => event.target === event.currentTarget && setFullscreenPoster(null)}>
          <button className="icon-button poster-fullscreen__close" type="button" aria-label="Close poster preview" onClick={() => setFullscreenPoster(null)}><Icon name="close" /></button>
          <img src={fullscreenPoster.image} alt={fullscreenPoster.alt || fullscreenPoster.title} />
          <a className="button button-primary poster-fullscreen__download" href={fullscreenPoster.image} download>Download <Icon name="external" /></a>
        </div>
      )}
    </section>
  );
}

function Crew() {
  return (
    <section className="section faq-section" id="crew">
      <div className="page-width">
        <SectionTitle kicker="MEET THE CREW" title={<>Coordinators and<br/><span className="muted-title">organizing team.</span></>} />
        <div className="crew-grid" data-reveal>{crew.map(([role, name, contact]) => <article className="crew-card" key={role}><span>{role}</span><h3>{name}</h3><a href={contact.includes('@') ? `mailto:${contact}` : `tel:${contact.replace(/\s/g, '')}`}>{contact}</a></article>)}</div>
      </div>
    </section>
  );
}

function Contact({ onRegister }) {
  return (
    <section className="section contact-section" id="contact">
      <div className="page-width contact-layout">
        <div data-reveal><span className="kicker">CONTACT & REGISTRATION</span><h2>Ready to<br/>take part?</h2><p>Choose your event, verify your participant details, and complete the registration through secure UPI payment.</p><button className="button button-primary button-large" onClick={onRegister}>Register now <Icon name="arrow"/></button></div>
        <div className="contact-card" data-reveal>
          <div><span><small>EMAIL</small><a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a></span><Icon name="mail"/></div>
          <div><span><small>PHONE</small><a href={`tel:${site.contactPhone.replace(/\s/g, '')}`}>{site.contactPhone}</a></span><Icon name="phone"/></div>
          <div><span><small>VENUE</small><a href={directionsUrl} target="_blank" rel="noreferrer">Velammal Engineering College</a></span><Icon name="pin"/></div>
          <p className="placeholder-note">Use the links above for registration questions, payment verification, and event-day updates.</p>
        </div>
      </div>
    </section>
  );
}

function SocialMedia() {
  return (
    <section className="section social-section" id="social">
      <div className="page-width">
        <SectionTitle kicker="SOCIAL MEDIA" title="Follow official updates." description="Announcements, schedule changes, and event-day media will be shared through the official channels." />
        <div className="social-link-grid" data-reveal>{Object.entries(site.social).map(([name, url]) => <a href={url} target="_blank" rel="noreferrer" key={name}><span>{name}</span><Icon name="external" /></a>)}</div>
      </div>
    </section>
  );
}

function LocationMap() {
  return (
    <section className="section location-section" id="location">
      <div className="page-width footer-venue">
        <div className="footer-venue__copy">
          <span className="kicker">LOCATION / MAP</span>
          <h2>Velammal<br/>Engineering College</h2>
          <address>{site.address}</address>
          <a className="button button-secondary" href={directionsUrl} target="_blank" rel="noreferrer">Open directions <Icon name="external" /></a>
        </div>
        <DeferredVenueMap />
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer>
      <div className="page-width">
        <div className="footer-grid">
          <a href="#top" className="footer-brand">NOCTIVUS<span>.</span><small>'26</small></a>
          <p>Department of CSE (Cyber Security)<br/>Velammal Engineering College</p>
          <div className="footer-links">{Object.entries(site.social).map(([name, url]) => <a href={url} target="_blank" rel="noreferrer" key={name}>{name}<Icon name="external" size={13}/></a>)}</div>
          <div className="footer-bottom"><span>© 2026 Noctivus. All rights reserved.</span><a href="#top">Back to top ↑</a></div>
        </div>
      </div>
    </footer>
  );
}

function EventModal({ event, onClose }) {
  const [page, setPage] = useState(0);
  const pages = [
    {
      key: 'overview',
      title: event.name,
      body: <p>{event.format}</p>,
    },
    {
      key: 'rules',
      title: 'Rules & Format',
      body: <ol>{event.details?.map((item) => <li key={item}>{item}</li>)}</ol>,
    },
    {
      key: 'know',
      title: 'Good to Know',
      body: (
        <>
          <p>{event.category} event. Team size: {event.teamMin || 1}-{event.teamMax || 1}. Bring a valid college ID and follow the final reporting instructions shared by the organizing team.</p>
          <p>Questions? Reach out at {site.contactEmail} or {site.contactPhone}.</p>
        </>
      ),
    },
  ];

  useEffect(() => {
    document.body.classList.add('modal-open');
    const keydown = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', keydown);
    return () => { document.body.classList.remove('modal-open'); window.removeEventListener('keydown', keydown); };
  }, [onClose]);

  return (
    <motion.div className="modal-shell notebook-shell" onMouseDown={(e) => e.target === e.currentTarget && onClose()} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.article className="notebook-view" role="dialog" aria-modal="true" aria-labelledby="event-modal-title" layoutId={`event-card-${event.id}`}>
        <button className="notebook-close" onClick={onClose} aria-label="Close event details">
          <svg width="20" height="20" viewBox="0 0 20 20"><path d="M3 3l14 14M17 3L3 17" stroke="#14120F" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>
        <NotebookDoodles />
        <span className="notebook-entry-note">Entry: ₹{event.fee || 0}</span>
        <div className={`notebook-page notebook-page--${pages[page].key}`} aria-live="polite" key={pages[page].key}>
          <span className="notebook-page-label">Page {page + 1} — {page === 0 ? 'Overview' : pages[page].title}</span>
          <h1 id="event-modal-title">{pages[page].title}</h1>
          {page !== 0 && <NotebookSquiggle />}
          {page === 1 && <PencilDoodle />}
          <div className="notebook-body">{pages[page].body}</div>
          {page === 2 && <div className="notebook-callout"><StarDoodle /><span>Keep your confirmation and college ID ready at the desk.</span></div>}
          <span className="notebook-page-number">0{page + 1}/03</span>
        </div>
        <div className="notebook-nav">
          <button type="button" aria-label="Previous page" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>‹</button>
          <div className="notebook-dots" aria-hidden="true">{pages.map((item, index) => <span className={page === index ? 'is-active' : ''} key={item.key} />)}</div>
          <button type="button" aria-label="Next page" disabled={page === 2} onClick={() => setPage((current) => Math.min(2, current + 1))}>›</button>
        </div>
      </motion.article>
    </motion.div>
  );
}

function NotebookDoodles() {
  return (
    <div className="notebook-doodles" aria-hidden="true">
      <svg className="notebook-tape notebook-tape--one" width="96" height="28" viewBox="0 0 96 28"><path d="M3 9c18-5 31 3 48-2 15-4 25-2 42 3l-4 14c-18-4-29-5-45-1-14 4-26-3-41 1Z" fill="rgba(20,18,15,.08)" stroke="#14120F" strokeWidth="1" strokeLinejoin="round"/></svg>
      <svg className="notebook-tape notebook-tape--two" width="82" height="26" viewBox="0 0 82 26"><path d="M2 6c12 2 24-3 38-2 15 1 28 7 40 5l-5 14c-13-1-26-3-39-3-12 0-22 1-34 3Z" fill="rgba(20,18,15,.07)" stroke="#14120F" strokeWidth="1" strokeLinejoin="round"/></svg>
      <svg className="notebook-scribble notebook-scribble--one" width="116" height="44" viewBox="0 0 116 44"><path d="M3 25c16-20 31-22 43-6 13 17 31 18 47-3 7-9 14-11 20-7" stroke="#14120F" strokeWidth="1.4" fill="none" strokeLinecap="round"/><path d="M18 37c23-6 48-5 77 1" stroke="#14120F" strokeWidth="1" fill="none" strokeLinecap="round" opacity=".65"/></svg>
      <svg className="notebook-scribble notebook-scribble--two" width="86" height="58" viewBox="0 0 86 58"><path d="M12 46 42 8l30 38H12Z" stroke="#14120F" strokeWidth="1.3" fill="none" strokeLinejoin="round"/><path d="M42 8v38M24 31h36" stroke="#14120F" strokeWidth="1" fill="none" strokeLinecap="round"/></svg>
      <span className="notebook-rough-note notebook-rough-note--one">check timing</span>
      <span className="notebook-rough-note notebook-rough-note--two">bring ID</span>
    </div>
  );
}

function NotebookSquiggle() {
  return <svg className="notebook-squiggle" width="200" height="12" viewBox="0 0 200 12"><path d="M2 6 Q 20 2, 40 6 T 80 6 T 120 6 T 160 6 T 198 6" stroke="#14120F" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>;
}

function PencilDoodle() {
  return <svg className="notebook-pencil" width="24" height="24" viewBox="0 0 24 24"><path d="M3 21l3-1 11-11-2-2L4 18l-1 3z" stroke="#14120F" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 6l2-2 2 2-2 2-2-2z" stroke="#14120F" strokeWidth="1.5" fill="none"/></svg>;
}

function StarDoodle() {
  return <svg width="20" height="20" viewBox="0 0 20 20"><path d="M10 1l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6z" stroke="#14120F" strokeWidth="1.2" fill="none" strokeLinejoin="round"/></svg>;
}
