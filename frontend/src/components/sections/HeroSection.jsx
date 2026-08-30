import React from 'react';
import SplitFlapCountdown from '../effects/SplitFlapCountdown.jsx';
import { site } from '../../data/site.js';
import { AsymSection } from '../ui/AsymSection/AsymSection';
import { NotchedButton } from '../ui/NotchedButton/NotchedButton';

export function HeroSection({ onRegister }) {
  return (
    <section className="hero-section" id="home">
      <AsymSection
        leftContent={
          <div className="hero-visual-panel">
            <img 
              className="hero-logo-img" 
              src="/logo.png" 
              alt="Noctivus Dragon Emblem" 
              width="480" 
              height="534" 
              fetchPriority="high" 
            />
            <div className="hero-countdown-wrap">
              <SplitFlapCountdown target={site.eventStart} />
            </div>
          </div>
        }
        rightContent={
          <div className="hero-info-wrapper">
            <span className="hero-eyebrow">{site.eyebrow}</span>
            <h1 className="hero-title">
              NOCTIVUS <span>'26</span>
            </h1>
            <p className="hero-tagline">
              National-level technical symposium organized by the Department of CSE (Cyber Security) at Velammal Engineering College.
            </p>

            <div className="hero-actions-container">
              <NotchedButton 
                variant="primary" 
                onClick={onRegister}
              >
                REGISTER NOW
              </NotchedButton>
              <NotchedButton 
                variant="ghost" 
                as="a" 
                href="#events"
              >
                EXPLORE EVENTS
              </NotchedButton>
            </div>
          </div>
        }
      />

      {/* Quiet Cut-Edge Boundary Numeral Indicator */}
      <div className="hero-cut-boundary">
        <span>01 / 05</span>
        <span className="hero-cut-chevron" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M2 4L6 8L10 4" strokeLinecap="square" strokeLinejoin="miter"/>
          </svg>
        </span>
      </div>
    </section>
  );
}
