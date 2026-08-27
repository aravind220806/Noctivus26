import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { site } from './data/site';
import { events, type EventItem } from './data/events';
import EventCard from './components/EventCard';
import FaqAccordion from './components/FaqAccordion';
import RegistrationModal from './components/RegistrationModal';
import Icon from './components/Icon';
import SplitFlapCountdown from './components/effects/SplitFlapCountdown';
import useReveal from './hooks/useReveal';
import { Nav } from './components/layout/Nav';

const LightRays = lazy(() => import('./components/effects/LightRays'));
const VenueMap = lazy(() => import('./components/VenueMap'));

const directionsUrl =
  'https://www.google.com/maps/dir/?api=1&destination=Velammal+Engineering+College%2C+Surapet%2C+Chennai+600066';

interface NetworkInformation extends EventTarget {
  saveData?: boolean;
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformation;
  mozConnection?: NetworkInformation;
  webkitConnection?: NetworkInformation;
  deviceMemory?: number;
}

export default function App() {
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [registration, setRegistration] = useState<string | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState<boolean>(false);
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  useReveal();

  useEffect(() => {
    const controller = new AbortController();
    const apiBase = import.meta.env.VITE_API_URL || '';
    fetch(`${apiBase}/api/events`, { signal: controller.signal })
      .then((response) =>
        response.ok ? response.json() : Promise.reject(new Error('Event service unavailable'))
      )
      .then((data) => setRegistrationOpen(data.registrationOpen === true))
      .catch((error) => {
        if (error.name !== 'AbortError') setRegistrationOpen(false);
      });
    return () => controller.abort();
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

  const openRegistration = (eventId: string | null = null) => {
    setSelectedEvent(null);
    setRegistration(eventId || 'open');
  };

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div
        className="scroll-progress"
        style={{ '--scroll-progress': `${scrollProgress}%` } as React.CSSProperties}
        aria-hidden="true"
      />
      <Nav />

      <main id="main">
        <Hero onRegister={() => openRegistration()} />
        <About />
        <Events onSelect={setSelectedEvent} />
        <Schedule />
        <Experience />
        <Faq />
        <Contact onRegister={() => openRegistration()} />
      </main>
      <Footer />

      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onRegister={() => openRegistration(selectedEvent.id)}
        />
      )}
      {registration && (
        <RegistrationModal
          events={events}
          registrationOpen={registrationOpen}
          initialEventId={registration === 'open' ? null : registration}
          onClose={() => setRegistration(null)}
        />
      )}
    </>
  );
}

function AdaptiveLightRays() {
  const [enabled, setEnabled] = useState<boolean>(false);

  useEffect(() => {
    const nav = navigator as NavigatorWithConnection;
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const smallScreen = window.matchMedia('(max-width: 700px)').matches;
    const lowMemory = Boolean(nav.deviceMemory && nav.deviceMemory <= 4);
    const lowCpu = Boolean(nav.hardwareConcurrency && nav.hardwareConcurrency <= 4);
    setEnabled(!(reducedMotion || connection?.saveData || smallScreen || lowMemory || lowCpu));
  }, []);

  if (!enabled) return <div className="hero__ambient" aria-hidden="true" />;

  return (
    <Suspense fallback={<div className="hero__ambient" aria-hidden="true" />}>
      <div className="hero__rays" aria-hidden="true">
        <LightRays
          raysOrigin="top-center"
          raysColor="#d3dcff"
          raysSpeed={0.8}
          lightSpread={0.88}
          rayLength={1.8}
          fadeDistance={1.4}
          saturation={0.82}
          followMouse
          mouseInfluence={0.05}
          noiseAmount={0.02}
          distortion={0.025}
          className="hero__rays-canvas"
        />
      </div>
    </Suspense>
  );
}

function DeferredVenueMap() {
  const [ready, setReady] = useState<boolean>(false);
  const [mobilePreview, setMobilePreview] = useState<boolean>(false);
  const [deviceDirectionsUrl, setDeviceDirectionsUrl] = useState<string>(directionsUrl);
  const shellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const nav = navigator as NavigatorWithConnection;
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
    const constrained =
      connection?.saveData ||
      window.matchMedia('(max-width: 700px)').matches ||
      Boolean(nav.deviceMemory && nav.deviceMemory <= 4);
    const appleMobile =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const android = /Android/i.test(navigator.userAgent);
    if (appleMobile)
      setDeviceDirectionsUrl('https://maps.apple.com/?daddr=13.1483288,80.1916095&dirflg=d');
    else if (android)
      setDeviceDirectionsUrl(
        'geo:0,0?q=13.1483288,80.1916095(Velammal%20Engineering%20College)'
      );
    setMobilePreview(Boolean(constrained));
    if (constrained || !shellRef.current) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setReady(true);
          observer.disconnect();
        }
      },
      { rootMargin: '240px' }
    );
    observer.observe(shellRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="venue-map-shell" ref={shellRef}>
      {ready ? (
        <Suspense fallback={<div className="venue-map__loading">Loading map…</div>}>
          <VenueMap
            latitude={site.coordinates.latitude}
            longitude={site.coordinates.longitude}
            directionsUrl={deviceDirectionsUrl}
          />
          <a className="venue-map__directions" href={deviceDirectionsUrl}>
            Get directions <Icon name="arrow" size={15} />
          </a>
        </Suspense>
      ) : mobilePreview ? (
        <div className="venue-map__preview venue-map__preview--real">
          <iframe
            title="Map of Velammal Engineering College"
            loading="lazy"
            src="https://www.openstreetmap.org/export/embed.html?bbox=80.1836%2C13.1433%2C80.1996%2C13.1533&amp;layer=mapnik&amp;marker=13.1483288%2C80.1916095"
            tabIndex={-1}
          />
          <a
            className="venue-map__preview-link"
            href={deviceDirectionsUrl}
            aria-label="Open directions to Velammal Engineering College"
          >
            <span className="venue-map__preview-action">
              <Icon name="pin" size={18} />
              <span>
                <strong>Get directions</strong>
                <small>Opens in your maps app</small>
              </span>
              <Icon name="arrow" size={16} />
            </span>
          </a>
          <small className="venue-map__attribution">© OpenStreetMap contributors</small>
        </div>
      ) : (
        <div className="venue-map__preview venue-map__preview--loading">
          <span className="venue-map__pin">
            <Icon name="pin" size={22} />
          </span>
          <div>
            <strong>Surapet, Chennai</strong>
            <small>Velammal Engineering College</small>
          </div>
        </div>
      )}
    </div>
  );
}

function Hero({ onRegister }: { onRegister: () => void }) {
  return (
    <section className="hero" id="home">
      <AdaptiveLightRays />
      <div className="hero__grain" aria-hidden="true" />
      <div className="page-width hero__inner">
        <div className="hero__main">
          <img
            className="hero__logo"
            src="/brand/noctivus-emblem.webp"
            alt="Noctivus emblem"
            width="480"
            height="534"
            fetchPriority="high"
          />
          <h1>
            NOCTIVUS <span>'26</span>
          </h1>
          <p className="hero__tagline">
            Eight events. One charged campus. A symposium built for ideas, instincts, and fearless
            problem-solving.
          </p>
          <SplitFlapCountdown target={site.eventStart} />
          <div className="hero__actions">
            <button
              className="button button-primary button-large"
              type="button"
              onClick={onRegister}
            >
              Register now
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionTitle({
  kicker,
  title,
  description,
}: {
  kicker: string;
  title: ReactNode;
  description?: string;
}) {
  return (
    <header className="section-title" data-reveal>
      <div>
        <span className="kicker">{kicker}</span>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
    </header>
  );
}

function About() {
  return (
    <section className="section about" id="about">
      <div className="page-width">
        <SectionTitle
          kicker="ABOUT NOCTIVUS"
          title={
            <>
              Built for students who
              <br />
              <span className="muted-title">want to make things happen.</span>
            </>
          }
        />
        <div className="about-grid">
          <div className="about-copy" data-reveal>
            <p className="lead">
              Noctivus is the annual national-level symposium of the Department of CSE (Cyber
              Security), Velammal Engineering College.
            </p>
            <p>
              Across eight technical and non-technical events, participants solve security problems,
              build products, test their instincts, and compete through high-energy team
              challenges.
            </p>
          </div>
          <div className="about-manifesto" data-reveal>
            <span>WHAT TO EXPECT</span>
            <strong>Practical challenges</strong>
            <strong>Clear judging</strong>
            <strong>Serious competition</strong>
          </div>
        </div>
        <figure className="about-showcase" data-reveal>
          <div className="about-showcase__image">
            <img
              src="/images/noctivus-students.webp"
              alt="Students gathered at Noctivus"
              width="1400"
              height="1050"
              loading="lazy"
              decoding="async"
            />
          </div>
          <figcaption>
            <span className="kicker">THE NOCTIVUS EXPERIENCE</span>
            <strong>
              Built by students.
              <br />
              Driven by curiosity.
            </strong>
            <p>
              A day shaped by collaboration, competition, and the people bold enough to show up and
              take part.
            </p>
          </figcaption>
        </figure>
        <Stats />
      </div>
    </section>
  );
}

function Stats() {
  const values = [
    ['08', 'Events'],
    ['05', 'Technical events'],
    ['03', 'Non-technical events'],
    ['26 Sep', 'Event date'],
  ];
  return (
    <div className="stats-grid" data-reveal>
      {values.map(([value, label]) => (
        <div className="stat" key={label}>
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

function Events({ onSelect }: { onSelect: (event: EventItem) => void }) {
  const [filter, setFilter] = useState<string>('All');
  const filters = ['All', 'Technical', 'Non-technical'];
  const visibleEvents = useMemo(
    () => (filter === 'All' ? events : events.filter((event) => event.category === filter)),
    [filter]
  );

  return (
    <section className="section events-section" id="events">
      <div className="page-width">
        <SectionTitle
          kicker="EVENTS"
          title="Choose your event."
          description="Explore the official event lineup. Rules, formats, fees, and timings will be announced soon."
        />
        <div className="event-filters" role="group" aria-label="Filter events">
          {filters.map((item) => (
            <button
              type="button"
              aria-pressed={filter === item}
              onClick={() => setFilter(item)}
              key={item}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 mt-8">
          {visibleEvents.map((event, index) => (
            <EventCard event={event} onSelect={onSelect} index={index} key={event.id} />
          ))}
        </div>
        <p className="events-note" data-reveal>
          <span>*</span> Final rules, capacities, and event timings will be locked before registration
          opens.
        </p>
      </div>
    </section>
  );
}

function Schedule() {
  return (
    <section className="section schedule-section" id="schedule">
      <div className="page-width">
        <SectionTitle
          kicker="SCHEDULE"
          title="The day is taking shape."
          description="The official event-day schedule and reporting times will be published after every event format is confirmed."
        />
        <div className="schedule-reveal" data-reveal>
          <div>
            <span className="schedule-reveal__signal" aria-hidden="true" />
            <span className="kicker">COMING SOON</span>
          </div>
          <h3>
            One campus.
            <br />
            Eight challenges.
            <br />
            <span>One unforgettable day.</span>
          </h3>
          <p>
            Technical events, non-technical events, final rounds, and the awards ceremony will all be
            mapped into one clear schedule before registration opens.
          </p>
          <a className="button button-secondary" href="#contact">
            Get official updates <Icon name="arrow" />
          </a>
        </div>
      </div>
    </section>
  );
}

function Experience() {
  return (
    <section className="section experience-section" id="experience">
      <div className="page-width">
        <SectionTitle
          kicker="PARTICIPANT INFORMATION"
          title="Before you arrive."
          description="Rules, travel information, and official updates will be published here as they are confirmed."
        />
        <div className="experience-grid">
          <article className="feature-panel feature-panel--brochure" data-reveal>
            <span className="panel-label">EVENT BROCHURE</span>
            <h3>Rules and event formats</h3>
            <p>
              The official brochure will include complete rules, judging criteria, reporting times,
              and coordinator details for every event.
            </p>
            <button className="button button-secondary" disabled>
              Available soon
            </button>
          </article>
          <article className="feature-panel feature-panel--transport" data-reveal>
            <span className="panel-label">TRAVEL</span>
            <h3>Campus transport</h3>
            <p>
              Bus routes and pickup points will be published after transport arrangements are
              confirmed.
            </p>
          </article>
          <article className="feature-panel feature-panel--community" data-reveal>
            <span className="panel-label">OFFICIAL UPDATES</span>
            <h3>Participant announcements</h3>
            <p>
              Registered participants will receive schedule changes and reporting instructions
              through the official communication channel.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section className="section faq-section" id="faq">
      <div className="page-width">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12" data-reveal>
          <span className="kicker">FREQUENTLY ASKED QUESTIONS</span>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mt-3 text-[#e2e8f0]">
            FAQ
          </h2>
          <p className="text-sm sm:text-base text-[#94a3b8] mt-3">
            Everything you need to know before Sept 26.
          </p>
        </div>
        <div data-reveal>
          <FaqAccordion />
        </div>
      </div>
    </section>
  );
}

function Contact({ onRegister }: { onRegister: () => void }) {
  return (
    <section className="section contact-section" id="contact">
      <div className="page-width contact-layout">
        <div data-reveal>
          <span className="kicker">CONTACT & REGISTRATION</span>
          <h2>
            Ready to
            <br />
            take part?
          </h2>
          <p>
            Choose your event, verify your participant details, and complete the registration
            through secure UPI payment.
          </p>
          <button className="button button-primary button-large" onClick={onRegister}>
            Register now <Icon name="arrow" />
          </button>
        </div>
        <div className="contact-card" data-reveal>
          <div>
            <span>
              <small>EMAIL</small>
              <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>
            </span>
            <Icon name="mail" />
          </div>
          <div>
            <span>
              <small>PHONE</small>
              <a href={`tel:${site.contactPhone.replace(/\s/g, '')}`}>{site.contactPhone}</a>
            </span>
            <Icon name="phone" />
          </div>
          <div>
            <span>
              <small>VENUE</small>
              <a href={directionsUrl} target="_blank" rel="noreferrer">
                Velammal Engineering College
              </a>
            </span>
            <Icon name="pin" />
          </div>
          <p className="placeholder-note">
            Coordinator contact details are placeholders until the organizing committee confirms
            them.
          </p>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer>
      <div className="page-width">
        <div className="footer-venue">
          <div className="footer-venue__copy">
            <span className="kicker">FIND THE VENUE</span>
            <h2>
              Velammal
              <br />
              Engineering College
            </h2>
            <address>{site.address}</address>
            <a
              className="button button-secondary"
              href={directionsUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open directions <Icon name="external" />
            </a>
          </div>
          <DeferredVenueMap />
        </div>
        <div className="footer-grid">
          <a href="#top" className="footer-brand">
            NOCTIVUS<span>.</span>
            <small>'26</small>
          </a>
          <p>
            Department of CSE (Cyber Security)
            <br />
            Velammal Engineering College
          </p>
          <div className="footer-links">
            {Object.entries(site.social).map(([name, url]) => (
              <a href={url} target="_blank" rel="noreferrer" key={name}>
                {name}
                <Icon name="external" size={13} />
              </a>
            ))}
          </div>
          <div className="footer-bottom">
            <span>© 2026 Noctivus. All rights reserved.</span>
            <a href="#top">Back to top ↑</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function EventModal({
  event,
  onClose,
  onRegister,
}: {
  event: EventItem;
  onClose: () => void;
  onRegister: () => void;
}) {
  useEffect(() => {
    document.body.classList.add('modal-open');
    const keydown = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', keydown);
    return () => {
      document.body.classList.remove('modal-open');
      window.removeEventListener('keydown', keydown);
    };
  }, [onClose]);

  return (
    <div
      className="modal-shell"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <article
        className={`event-modal accent-${event.accent}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-modal-title"
      >
        <button
          className="icon-button event-modal__close"
          onClick={onClose}
          aria-label="Close event details"
        >
          <Icon name="close" />
        </button>
        <div className="event-modal__visual">
          <span>Official event</span>
          <img
            className="event-modal__emblem"
            src="/brand/noctivus-emblem.webp"
            alt=""
            width="480"
            height="534"
          />
          <small>{event.category}</small>
        </div>
        <div className="event-modal__content">
          <span className="kicker">EVENT REGISTRATION</span>
          <h2 id="event-modal-title">{event.name}</h2>
          <p className="event-modal__lead">
            Registration is now open. Complete event format, rules, venue, and timing will be
            announced separately.
          </p>
          <div className="rules">
            <h3>Registration fee</h3>
            <p>
              {event.category === 'Technical' ? 'Technical event' : 'Non-technical event'} entry ·
              ₹{event.fee} per registration.
            </p>
          </div>
          <div className="event-modal__action">
            <div>
              <small>AMOUNT</small>
              <strong>₹{event.fee}</strong>
            </div>
            <button className="button button-primary" type="button" onClick={onRegister}>
              Register now <Icon name="arrow" />
            </button>
          </div>
        </div>
      </article>
    </div>
  );
}
