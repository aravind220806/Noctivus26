import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { events } from '../../data/site.js';
import { HeadingBar } from '../ui/HeadingBar/HeadingBar';
import { NotchedButton } from '../ui/NotchedButton/NotchedButton';
import './EventShowcase.css';

// ── Category accent mapping ──────────────────────────────────────────────────
const CATEGORY_ACCENT = {
  Technical: 'cyan',
  'Non-technical': 'lime',
  'Non-Technical': 'lime',
  Workshop: 'violet',
};

// ── Arrow SVGs ───────────────────────────────────────────────────────────────
function ArrowLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M11 4L6 9L11 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  );
}
function ArrowRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M7 4L12 9L7 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function EventShowcase({ onSelect, onRegister }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(true);
  const transitionTimeout = useRef(null);
  const sectionRef = useRef(null);

  const total = events.length;
  const event = events[activeIndex];
  const accent = CATEGORY_ACCENT[event.category] || 'cyan';

  // ── Navigate with debounce guard ────────────────────────────────────────────
  const navigate = useCallback((dir) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setImageLoaded(false);

    transitionTimeout.current = setTimeout(() => {
      setActiveIndex((prev) => {
        const next = prev + dir;
        if (next < 0) return total - 1;
        if (next >= total) return 0;
        return next;
      });
      setIsTransitioning(false);
    }, 420);
  }, [isTransitioning, total]);

  // ── Keyboard navigation ─────────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowLeft') navigate(-1);
      if (e.key === 'ArrowRight') navigate(1);
    };
    const el = sectionRef.current;
    if (el) el.addEventListener('keydown', handleKey);
    return () => {
      if (el) el.removeEventListener('keydown', handleKey);
      clearTimeout(transitionTimeout.current);
    };
  }, [navigate]);

  // ── Image onLoad handler ────────────────────────────────────────────────────
  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  const progressPct = ((activeIndex + 1) / total) * 100;
  const displayNum = String(activeIndex + 1).padStart(2, '0');
  const displayTotal = String(total).padStart(2, '0');

  return (
    <section
      className="showcase-section"
      id="showcase"
      tabIndex={-1}
      ref={sectionRef}
      aria-label="Event showcase navigator"
    >
      <div className="showcase-inner">
        <HeadingBar level="h2" text="EVENT DOSSIER" sectionIndex="03 / 05" />

        {/* ── Border wrapper (clip-path eats CSS border — use padding + bg instead) ── */}
        <div
          className="showcase-card-border"
          data-category={event.category}
          style={{ '--showcase-accent': `var(--${accent})` }}
        >
          {/* ── Main card ── */}
          <div className="showcase-card">
          {/* ── LEFT: Image panel ── */}
          <div className="showcase-image-panel">
            <AnimatePresence mode="sync">
              <motion.img
                key={event.id}
                src={event.image}
                alt={event.name}
                loading="lazy"
                onLoad={handleImageLoad}
                style={{ objectPosition: event.imagePosition || 'center 40%' }}
                initial={{ opacity: 0, scale: 1.04 }}
                animate={{
                  opacity: imageLoaded ? 1 : 0,
                  scale: 1,
                }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
              />
            </AnimatePresence>

            {/* Overlays */}
            <div className="showcase-image-overlay" aria-hidden="true" />
            <div className="showcase-image-slash" aria-hidden="true" />

            {/* HUD corner markers */}
            <div className="img-hud-corner tl" aria-hidden="true" />
            <div className="img-hud-corner bl" aria-hidden="true" />

            {/* Bottom-left image metadata */}
            <div className="showcase-image-meta" aria-hidden="true">
              <span className="img-meta-tag">NOCTIVUS // EVENT_DB</span>
              <span className="img-meta-tag">SYS.EVENT.{displayNum}</span>
            </div>
          </div>

          {/* ── RIGHT: Info panel ── */}
          <div className={`showcase-info-panel${isTransitioning ? ' showcase-content-transitioning' : ''}`}>
            {/* Ghost event number watermark */}
            <span className="showcase-event-number" aria-hidden="true">
              {displayNum}
            </span>

            <div className="showcase-info-top">
              {/* System label */}
              <p className="showcase-system-label" aria-hidden="true">
                NOCTIVUS '26 // <span>EVENT_DOSSIER</span>
              </p>

              {/* Category badge */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={`cat-${event.id}`}
                  className="showcase-category-badge"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                >
                  {event.category.toUpperCase()} EVENT
                </motion.div>
              </AnimatePresence>

              {/* Event title */}
              <AnimatePresence mode="wait">
                <motion.h3
                  key={`title-${event.id}`}
                  className="showcase-event-title"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.38, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.05 }}
                >
                  {event.name.toUpperCase()}
                </motion.h3>
              </AnimatePresence>

              {/* Description */}
              <AnimatePresence mode="wait">
                <motion.p
                  key={`desc-${event.id}`}
                  className="showcase-event-desc"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.38, ease: 'easeOut', delay: 0.1 }}
                >
                  {event.format}
                </motion.p>
              </AnimatePresence>

              <div className="showcase-divider" aria-hidden="true" />

              {/* Fee */}
              <div className="showcase-fee-block">
                <p className="showcase-fee-label">ENTRY FEE</p>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={`fee-${event.id}`}
                    className="showcase-fee-value"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, delay: 0.12 }}
                  >
                    {event.fee === 0 ? 'FREE' : `₹${event.fee}`}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>

            {/* ── CTA Buttons ── */}
            <div className="showcase-cta-row">
              <NotchedButton
                variant="primary"
                accent={accent}
                onClick={() => onRegister?.(event.id)}
                aria-label={`Register for ${event.name}`}
              >
                REGISTER NOW
              </NotchedButton>
              <NotchedButton
                variant="ghost"
                accent={accent}
                onClick={() => onSelect?.(event)}
                aria-label={`View details for ${event.name}`}
              >
                VIEW DETAILS
              </NotchedButton>
            </div>
          </div>
          {/* end showcase-info-panel */}
        </div>
        {/* end showcase-card */}
        </div>
        {/* end showcase-card-border */}

        {/* ── Bottom bar: progress + dots + navigation ── */}
        <div className="showcase-bottom-bar">
          {/* Progress counter */}
          <div className="showcase-progress" aria-live="polite" aria-label={`Event ${activeIndex + 1} of ${total}`}>
            <span className="showcase-progress-current">{displayNum}</span>
            <span className="showcase-progress-sep">/</span>
            <span className="showcase-progress-total">{displayTotal}</span>
            <div className="showcase-progress-track" aria-hidden="true">
              <div
                className="showcase-progress-fill"
                style={{
                  width: `${progressPct}%`,
                  background: `var(--${accent})`,
                }}
              />
            </div>
          </div>

          {/* Slide dots */}
          <div className="showcase-dots" aria-hidden="true">
            {events.map((_, i) => (
              <button
                key={i}
                className={`showcase-dot${i === activeIndex ? ' active' : ''}`}
                onClick={() => {
                  if (!isTransitioning && i !== activeIndex) {
                    navigate(i - activeIndex);
                  }
                }}
                style={i === activeIndex ? {
                  background: `var(--${accent})`,
                  boxShadow: `0 0 6px var(--${accent})`,
                } : {}}
                aria-hidden="true"
                tabIndex={-1}
              />
            ))}
          </div>

          {/* Navigation arrows */}
          <nav className="showcase-nav" aria-label="Event navigation">
            <button
              className="showcase-nav-btn showcase-nav-btn--prev"
              onClick={() => navigate(-1)}
              disabled={isTransitioning}
              aria-label="Previous event"
            >
              <ArrowLeft />
            </button>
            <button
              className="showcase-nav-btn showcase-nav-btn--next"
              onClick={() => navigate(1)}
              disabled={isTransitioning}
              aria-label="Next event"
            >
              <ArrowRight />
            </button>
          </nav>
        </div>
      </div>
    </section>
  );
}
