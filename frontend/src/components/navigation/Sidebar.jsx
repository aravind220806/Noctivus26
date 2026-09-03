import React, { useEffect, useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { site } from '../../data/site.js';
import { NotchedButton } from '../ui/NotchedButton/NotchedButton';
import './Sidebar.css';

const NAV_ITEMS = ['HOME', 'ABOUT', 'EVENTS', 'SCHEDULE', 'COORDINATORS'];
const SECTION_IDS = ['home', 'about', 'events', 'schedule', 'coordinators'];

export default function Sidebar({ activeSection, onNavigate, onRegister }) {
  const [scrollPercent, setScrollPercent] = useState(0);

  const activeIndex = Math.max(0, SECTION_IDS.indexOf(activeSection));
  const formattedCurrent = String(activeIndex + 1).padStart(2, '0');
  const formattedTotal = String(SECTION_IDS.length).padStart(2, '0');

  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = totalHeight > 0 ? (window.scrollY / totalHeight) * 80 : 0;
      setScrollPercent(Math.min(80, Math.max(0, progress)));
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handlePrev = () => {
    const targetIdx = activeIndex > 0 ? activeIndex - 1 : 0;
    onNavigate(SECTION_IDS[targetIdx]);
  };

  const handleNext = () => {
    const targetIdx = activeIndex < SECTION_IDS.length - 1 ? activeIndex + 1 : SECTION_IDS.length - 1;
    onNavigate(SECTION_IDS[targetIdx]);
  };

  return (
    <nav className="desktop-sidebar" aria-label="Desktop rail navigation">
      {/* Up / Down Navigation Controls */}
      <div className="rail-nav-arrows">
        <button 
          className="rail-arrow-btn" 
          onClick={handlePrev}
          title="Previous section"
          aria-label="Previous section"
        >
          <ChevronUp size={18} />
        </button>
        <button 
          className="rail-arrow-btn" 
          onClick={handleNext}
          title="Next section"
          aria-label="Next section"
        >
          <ChevronDown size={18} />
        </button>
      </div>

      {/* Position Indicator 01 / 05 */}
      <div className="rail-position">
        <span className="rail-pos-current">{formattedCurrent}</span>
        <span className="rail-pos-divider" />
        <span className="rail-pos-total">{formattedTotal}</span>
      </div>

      {/* Vertical Rail Progress & Section Dot Markers */}
      <div className="rail-body">
        <div className="rail-progress-track" />
        <div 
          className="rail-progress-fill" 
          style={{ height: `${scrollPercent}%` }} 
        />

        <div className="rail-items-list">
          {NAV_ITEMS.map((label, idx) => {
            const isActive = activeIndex === idx;
            return (
              <button
                key={label}
                className={`rail-item ${isActive ? 'active' : ''}`}
                onClick={() => onNavigate(SECTION_IDS[idx])}
                aria-label={`Navigate to ${label}`}
              >
                <span className="rail-item-dot" />
                <span className="rail-item-tooltip">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Social Icons Stack */}
      <div className="rail-social">
        {Object.entries(site.social).map(([name, url]) => (
          <a
            key={name}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="rail-social-link"
            title={name}
            aria-label={name}
          >
            {name === 'Instagram' && (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
              </svg>
            )}
            {name === 'LinkedIn' && (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
                <rect x="2" y="9" width="4" height="12"/>
                <circle cx="4" cy="4" r="2"/>
              </svg>
            )}
            {name === 'X' && (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4l11.733 16h4.267l-11.733 -16z"/>
                <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772"/>
              </svg>
            )}
          </a>
        ))}
      </div>

      {/* Register CTA */}
      <div className="rail-cta-wrap">
        <NotchedButton
          variant="primary"
          accent="lime"
          onClick={onRegister}
          className="rail-cta-btn"
        >
          REG
        </NotchedButton>
      </div>
    </nav>
  );
}
