import React, { useEffect, useState, useCallback } from 'react';
import Navbar from '../components/Navbar';
import { FooterSection } from '../components/sections/FooterSection';
import RegistrationModal from '../components/RegistrationModal';
import { CoordinatorSectionNav } from '../components/coordinators/CoordinatorSectionNav';
import { CoordinatorSection } from '../components/coordinators/CoordinatorSection';
import {
  facultyCoordinators,
  studentCoordinators,
  registrationCoordinators,
} from '../data/coordinators';
import { events } from '../data/site';
import '../components/coordinators/CoordinatorsPage.css';

export default function CoordinatorsPage() {
  const [activeCategory, setActiveCategory] = useState('faculty');
  const [registrationModalOpen, setRegistrationModalOpen] = useState(false);
  const [isPrivacyBlurred, setIsPrivacyBlurred] = useState(false);
  const [securityNotice, setSecurityNotice] = useState(null);

  const showSecurityNotice = useCallback((msg = 'CONTENT PROTECTED: SCREEN CAPTURE & DOWNLOAD RESTRICTED') => {
    setSecurityNotice(msg);
    setTimeout(() => {
      setSecurityNotice((prev) => (prev === msg ? null : prev));
    }, 2800);
  }, []);

  // Anti-Screenshot, Anti-Print & Window-Blur Privacy Shield
  useEffect(() => {
    const handleBlur = () => {
      // Obfuscate coordinator credentials when window loses focus (e.g. Snipping tool, screen capture tools)
      setIsPrivacyBlurred(true);
    };

    const handleFocus = () => {
      setIsPrivacyBlurred(false);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsPrivacyBlurred(true);
      } else {
        setIsPrivacyBlurred(false);
      }
    };

    const handleKeyDown = (e) => {
      // Block PrintScreen key
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
        e.preventDefault();
        setIsPrivacyBlurred(true);
        showSecurityNotice('SCREENSHOT CAPTURE RESTRICTED FOR AUTHORIZED DIRECTORY');
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText('');
          }
        } catch {
          // ignore clipboard permission error
        }
        setTimeout(() => setIsPrivacyBlurred(false), 2000);
        return;
      }

      // Block Save (Ctrl+S, Cmd+S), Print (Ctrl+P, Cmd+P), View Source (Ctrl+U, Cmd+U), DevTools (Ctrl+Shift+I/C/J, Cmd+Option+I/C/J)
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      if (isCmdOrCtrl) {
        const key = e.key.toLowerCase();
        if (key === 's' || key === 'p' || key === 'u') {
          e.preventDefault();
          showSecurityNotice('ACTION RESTRICTED: SAVING / PRINTING DISABLED');
          return;
        }

        // Mac screenshot combinations (Command + Shift + 3 / 4 / 5)
        if (e.shiftKey && (key === '3' || key === '4' || key === '5' || key === 'i' || key === 'c' || key === 'j')) {
          e.preventDefault();
          setIsPrivacyBlurred(true);
          showSecurityNotice('CAPTURE & INSPECT SHORTCUTS RESTRICTED');
          setTimeout(() => setIsPrivacyBlurred(false), 2000);
          return;
        }
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText('');
          }
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [showSecurityNotice]);

  // Hash navigation scrolling on initial load or hash change
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '').toLowerCase();
      if (!hash) return;

      const targetId = hash === 'students' ? 'student' : hash;
      const el = document.getElementById(targetId);
      if (el) {
        window.requestAnimationFrame(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        setActiveCategory(targetId);
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // IntersectionObserver to sync active category navigation with scroll
  useEffect(() => {
    const sectionIds = ['faculty', 'student', 'registration'];
    const observers = [];

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveCategory(id);
          }
        },
        {
          rootMargin: '-20% 0px -60% 0px',
        }
      );

      observer.observe(el);
      observers.push(observer);
    });

    return () => {
      observers.forEach((obs) => obs.disconnect());
    };
  }, []);

  const handleNavbarNavigate = (sectionId) => {
    if (sectionId === 'coordinators') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.location.href = `/#${sectionId}`;
    }
  };

  return (
    <div
      className={`noc-database-page ${isPrivacyBlurred ? 'noc-privacy-blurred' : ''}`}
      onContextMenu={(e) => {
        e.preventDefault();
        showSecurityNotice('RIGHT-CLICK CONTEXT MENU IS RESTRICTED');
      }}
      onDragStart={(e) => {
        e.preventDefault();
      }}
    >
      {/* Security Toast Notice */}
      {securityNotice && (
        <aside className="noc-security-toast" role="alert" aria-live="polite">
          <span className="noc-security-toast-icon">⚠️</span>
          <span className="noc-security-toast-text">{securityNotice}</span>
        </aside>
      )}

      {/* Screen Capture / Inactive Window Privacy Shield Overlay */}
      {isPrivacyBlurred && (
        <div className="noc-privacy-overlay" aria-hidden="true">
          <div className="noc-privacy-overlay-box">
            <span className="noc-privacy-overlay-title">SECURITY PROTOCOL ACTIVE</span>
            <span className="noc-privacy-overlay-sub">WINDOW FOCUS LOST — SCREEN CAPTURE RESTRICTED</span>
            <span className="noc-privacy-overlay-hint">CLICK ANYWHERE TO RESUME VIEWING</span>
          </div>
        </div>
      )}

      {/* Navbar with active coordinators state */}
      <Navbar
        activeSection="coordinators"
        onNavigate={handleNavbarNavigate}
        onRegister={() => setRegistrationModalOpen(true)}
      />

      <main className="noc-database-main">
        {/* Page Hero */}
        <div className="noc-db-hero">
          <div className="noc-db-telemetry-strip">
            <span className="noc-telemetry-badge is-live">SYSTEM: ONLINE</span>
            <span className="noc-telemetry-badge">DATABASE: COORDINATORS</span>
            <span className="noc-telemetry-badge">PROTECTION: ACTIVE</span>
            <span className="noc-telemetry-badge">YEAR: 2026</span>
          </div>

          <div className="noc-db-eyebrow">NOCTIVUS '26</div>
          <h1 className="noc-db-title">
            COORDINATOR DATABASE<span className="noc-db-cursor">_</span>
          </h1>
          <p className="noc-db-subtitle">AUTHORIZED PERSONNEL DIRECTORY</p>
        </div>

        {/* Category Navigation Bar */}
        <CoordinatorSectionNav
          activeCategory={activeCategory}
          onSelectCategory={(cat) => setActiveCategory(cat)}
        />

        {/* SECTION 01: Faculty Coordinators */}
        <CoordinatorSection
          id="faculty"
          sectionIndex="01 / 03"
          title="FACULTY COORDINATORS"
          members={facultyCoordinators}
        />

        {/* Technical HUD Divider */}
        <div className="noc-technical-divider" aria-hidden="true">
          <span className="noc-tech-divider-line" />
          <span className="noc-tech-divider-mark">+ + + [ SEC 02 ] + + +</span>
          <span className="noc-tech-divider-line" />
        </div>

        {/* SECTION 02: Student Coordinators */}
        <CoordinatorSection
          id="student"
          sectionIndex="02 / 03"
          title="STUDENT COORDINATORS"
          members={studentCoordinators}
        />

        {/* Technical HUD Divider */}
        <div className="noc-technical-divider" aria-hidden="true">
          <span className="noc-tech-divider-line" />
          <span className="noc-tech-divider-mark">+ + + [ SEC 03 ] + + +</span>
          <span className="noc-tech-divider-line" />
        </div>

        {/* SECTION 03: Registration Desk */}
        <CoordinatorSection
          id="registration"
          sectionIndex="03 / 03"
          title="REGISTRATION DESK"
          members={registrationCoordinators}
        />
      </main>

      {/* Footer */}
      <FooterSection />

      {/* Registration Modal */}
      {registrationModalOpen && (
        <RegistrationModal
          events={events}
          registrationOpen={true}
          onClose={() => setRegistrationModalOpen(false)}
        />
      )}
    </div>
  );
}
