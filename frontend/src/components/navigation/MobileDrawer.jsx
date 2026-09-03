import React, { useState, useEffect, useRef } from 'react';
import LineSidebar from '../LineSidebar';
import { NotchedButton } from '../ui/NotchedButton/NotchedButton';
import './MobileDrawer.css';

const NAV_ITEMS   = ['HOME', 'ABOUT', 'EVENTS', 'SCHEDULE', 'COORDINATORS'];
const SECTION_IDS = ['home', 'about', 'events', 'schedule', 'coordinators'];

export default function MobileDrawer({ activeSection, onNavigate, onRegister }) {
  const [isOpen, setIsOpen]   = useState(false);
  const drawerRef             = useRef(null);
  const hamburgerRef          = useRef(null);
  const activeIndex           = SECTION_IDS.indexOf(activeSection);

  const closeDrawer = () => setIsOpen(false);
  const toggleOpen  = () => setIsOpen(o => !o);

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && isOpen) {
        closeDrawer();
        hamburgerRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  // Click outside
  useEffect(() => {
    const onOutside = (e) => {
      if (
        isOpen &&
        drawerRef.current && !drawerRef.current.contains(e.target) &&
        hamburgerRef.current && !hamburgerRef.current.contains(e.target)
      ) closeDrawer();
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [isOpen]);

  const handleNavClick = (index) => {
    closeDrawer();
    onNavigate(SECTION_IDS[index]);
  };

  return (
    <>
      <header className="mobile-header">
        <span className="mobile-logo">NOCTIVUS '26</span>
        <button
          ref={hamburgerRef}
          className={`hamburger-btn ${isOpen ? 'open' : ''}`}
          onClick={toggleOpen}
          aria-label="Toggle navigation menu"
          aria-expanded={isOpen}
          aria-controls="mobile-drawer-nav"
        >
          <span className="hamburger-line" aria-hidden="true" />
          <span className="hamburger-line" aria-hidden="true" />
          <span className="hamburger-line" aria-hidden="true" />
        </button>
      </header>

      <nav
        ref={drawerRef}
        id="mobile-drawer-nav"
        className={`mobile-drawer ${isOpen ? 'open' : ''}`}
        aria-label="Mobile main navigation"
      >
        <div className="drawer-linesidebar">
          <LineSidebar
            items={NAV_ITEMS}
            active={activeIndex >= 0 ? activeIndex : 0}
            accentColor="var(--cyan)"
            textColor="var(--text)"
            markerColor="var(--line)"
            showIndex={true}
            showMarker={true}
            proximityRadius={160}
            maxShift={24}
            falloff="smooth"
            markerLength={40}
            markerGap={0}
            tickScale={0.5}
            scaleTick={true}
            itemGap={36}
            fontSize={1.3}
            smoothing={80}
            onItemClick={handleNavClick}
          />
        </div>

        <div className="drawer-cta">
          <NotchedButton
            variant="primary"
            onClick={() => { closeDrawer(); onRegister(); }}
            style={{ width: '100%', padding: '1rem 2rem', fontSize: '0.9rem' }}
          >
            REGISTER
          </NotchedButton>
        </div>
      </nav>
    </>
  );
}
