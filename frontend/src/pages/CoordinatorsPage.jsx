import React, { useEffect, useState } from 'react';
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
    <div className="noc-database-page">
      {/* Navbar with active coordinators state */}
      <Navbar
        activeSection="coordinators"
        onNavigate={handleNavbarNavigate}
        onRegister={() => setRegistrationModalOpen(true)}
      />

      <main className="noc-database-main">
        {/* Page Hero */}
        <div className="noc-db-hero">
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
