import { Component, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { AnimatePresence } from 'motion/react';
import { events } from './data/site.js';
import Navbar from './components/Navbar.jsx';
import Sidebar from './components/navigation/Sidebar.jsx';
import MobileDrawer from './components/navigation/MobileDrawer.jsx';
import { TickDivider } from './components/ui/TickDivider/TickDivider';
import { HeroSection } from './components/sections/HeroSection.jsx';
import { AboutSection } from './components/sections/AboutSection.jsx';
import { EventsSection } from './components/sections/EventsSection.jsx';
import { CrewSection } from './components/sections/CrewSection.jsx';
import { FooterSection } from './components/sections/FooterSection.jsx';
import useReveal from './hooks/useReveal.js';
import { getApiBase } from './lib/api';

const RegistrationModal = lazy(() => import('./components/RegistrationModal.jsx').then(m => ({ default: m.default || m.RegistrationModal })));
const EventModal = lazy(() => import('./components/sections/EventModal.jsx').then(m => ({ default: m.default || m.EventModal })));
const TimelineSection = lazy(() => import('./components/sections/TimelineSection.jsx').then(m => ({ default: m.default || m.TimelineSection })));
const WebsiteIntro = lazy(() => import('./components/intro/WebsiteIntro.jsx').then(m => ({ default: m.default || m.WebsiteIntro })));

const sectionsList = ['home', 'about', 'events', 'schedule', 'coordinators', 'footer'];

export default function App() {
  const [showIntro, setShowIntro] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        // Always show intro on first load (dev mode); comment out for production
        return true;
        // return !sessionStorage.getItem('intro-done');
      }
    } catch (e) {
      console.warn('sessionStorage is not accessible:', e);
    }
    return true;
  });
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [registration, setRegistration] = useState(null);
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [activeSection, setActiveSection] = useState('home');
  const scrollProgressRef = useRef(null);
  const registerableEvents = useMemo(() => events.filter((event) => event.registerable !== false), []);
  useReveal();

  useEffect(() => {
    const controller = new AbortController();
    const apiBase = getApiBase();
    fetch(`${apiBase}/api/events`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Event service unavailable'))))
      .then((data) => {
        if (typeof data.registrationOpen === 'boolean') {
          setRegistrationOpen(data.registrationOpen);
        }
      })
      .catch((error) => {
        if (error.name !== 'AbortError') console.warn('Registration API check fallback: default to open in dev');
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    let frame = 0;
    const updateProgress = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const progress = max > 0 ? (window.scrollY / max) * 100 : 0;
        scrollProgressRef.current?.style.setProperty('--scroll-progress', `${progress}%`);
      });
    };
    updateProgress();
    window.addEventListener('scroll', updateProgress, { passive: true });
    return () => {
      window.removeEventListener('scroll', updateProgress);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  // Scrollspy logic
  useEffect(() => {
    const observers = [];
    sectionsList.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveSection(id);
          }
        },
        {
          rootMargin: '-30% 0px -60% 0px',
        }
      );
      observer.observe(el);
      observers.push(observer);
    });

    return () => {
      observers.forEach((o) => o.disconnect());
    };
  }, []);

  const [selectedCategory, setSelectedCategory] = useState('All');

  const navigateToSection = (id, category = null) => {
    if (category) {
      setSelectedCategory(category);
    }
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSelectEventById = (eventId) => {
    const ev = events.find((e) => e.id === eventId);
    if (ev) {
      setSelectedEvent(ev);
    }
  };

  const openRegistration = (eventId = null) => {
    setSelectedEvent(null);
    setRegistration(eventId || 'open');
  };

  return (
    <ErrorBoundary>
      {showIntro && (
        <Suspense fallback={null}>
          <WebsiteIntro onComplete={() => setShowIntro(false)} />
        </Suspense>
      )}

      <div className="scroll-progress" ref={scrollProgressRef} aria-hidden="true" />
      
      <Navbar 
        activeSection={activeSection} 
        onNavigate={navigateToSection} 
        onRegister={() => openRegistration()} 
        onSelectEvent={handleSelectEventById}
      />

      <main className="main-container" id="main">
        <HeroSection onRegister={() => openRegistration()} />
        <AboutSection />
        <TickDivider />
        <EventsSection 
          onSelect={setSelectedEvent} 
          onRegister={openRegistration}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />
        <TickDivider />
        <Suspense fallback={<div className="timeline-loading" style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Loading timeline...</div>}>
          <TimelineSection />
        </Suspense>
        <TickDivider />
        <CrewSection />
        <FooterSection />
      </main>

      <AnimatePresence>
        {selectedEvent && (
          <Suspense fallback={null}>
            <EventModal
              event={selectedEvent}
              onClose={() => setSelectedEvent(null)}
              onRegister={() => openRegistration(selectedEvent.id)}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {registration && (
        <Suspense fallback={<div className="admin-loading">Loading registration...</div>}>
          <RegistrationModal
            events={registerableEvents}
            registrationOpen={registrationOpen}
            initialEventId={registration === 'open' ? null : registration}
            onClose={() => setRegistration(null)}
          />
        </Suspense>
      )}
    </ErrorBoundary>
  );
}

class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('CRITICAL UNCAUGHT ERROR:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="app-error" role="alert" style={{ padding: '3rem', color: '#ff4d4d', fontFamily: 'monospace' }}>
          <h1>Something went wrong.</h1>
          <pre style={{ background: '#111', padding: '1rem', overflow: 'auto', border: '1px solid #333', color: '#00c8e0' }}>
            {this.state.error?.toString()}
            {'\n'}
            {this.state.error?.stack}
          </pre>
          <button className="button button-primary" type="button" onClick={() => window.location.reload()} style={{ marginTop: '1rem' }}>
            Reload page
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}
