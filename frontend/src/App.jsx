import { Component, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { events } from './data/site.js';
import RegistrationModal from './components/RegistrationModal.jsx';
import Navbar from './components/Navbar.jsx';
import useReveal from './hooks/useReveal.js';
import { getApiBase } from './lib/api';
import { HeroSection } from './components/sections/HeroSection';
import { AboutSection } from './components/sections/AboutSection';
import { EventsSection } from './components/sections/EventsSection';
import { TimelineSection } from './components/sections/TimelineSection';
import { BrochureSection } from './components/sections/BrochureSection';
import { CrewSection } from './components/sections/CrewSection';
import { ContactSection } from './components/sections/ContactSection';
import { SocialMediaSection } from './components/sections/SocialMediaSection';
import { LocationMapSection } from './components/sections/LocationMapSection';
import { FooterSection } from './components/sections/FooterSection';
import { EventModal } from './components/sections/EventModal';

export default function App() {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [registration, setRegistration] = useState(null);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const scrollProgressRef = useRef(null);
  const registerableEvents = useMemo(() => events.filter((event) => event.registerable !== false), []);
  useReveal();

  useEffect(() => {
    const controller = new AbortController();
    const apiBase = getApiBase();
    fetch(`${apiBase}/api/events`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Event service unavailable'))))
      .then((data) => setRegistrationOpen(data.registrationOpen === true))
      .catch((error) => {
        if (error.name !== 'AbortError') setRegistrationOpen(false);
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

  const openRegistration = (eventId = null) => {
    setSelectedEvent(null);
    setRegistration(eventId || 'open');
  };

  return (
    <ErrorBoundary>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="scroll-progress" ref={scrollProgressRef} aria-hidden="true" />
      <Navbar />

      <main id="main">
        <HeroSection onRegister={() => openRegistration()} />
        <AboutSection />
        <EventsSection onSelect={setSelectedEvent} />
        <TimelineSection />
        <BrochureSection />
        <CrewSection />
        <ContactSection onRegister={() => openRegistration()} />
        <SocialMediaSection />
        <LocationMapSection />
      </main>
      <FooterSection />

      <AnimatePresence>
        {selectedEvent && <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
      </AnimatePresence>
      {registration && (
        <RegistrationModal
          events={registerableEvents}
          registrationOpen={registrationOpen}
          initialEventId={registration === 'open' ? null : registration}
          onClose={() => setRegistration(null)}
        />
      )}
    </ErrorBoundary>
  );
}

class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="app-error" role="alert">
          <h1>Something went wrong.</h1>
          <button className="button button-primary" type="button" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}
