import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { site } from '../../data/site.js';
import { NotchedButton } from '../ui/NotchedButton/NotchedButton';

const EVENT_ORDER = [
  'ideathon',
  'cyber-heist-ctf',
  'iot-exploit',
  'secure-x-vibecode',
  'mind-cage',
  'mystery-hunt',
  'tune-trap',
  'auction-arena',
];

export function EventModal({ event, onClose, onRegister }) {
  const [page, setPage] = useState(0);

  if (!event) return null;

  const pages = [
    { key: 'overview', title: 'OVERVIEW' },
    { key: 'rules',    title: 'RULES & FORMAT' },
    { key: 'info',     title: 'GOOD TO KNOW' },
  ];

  const eventIndex = event.id ? EVENT_ORDER.indexOf(event.id) : -1;
  const displayIndex = eventIndex >= 0
    ? String(eventIndex + 1).padStart(2, '0')
    : '--';

  const isRegisterable = event.registerable !== false;

  useEffect(() => {
    document.body.classList.add('modal-open');
    const keydown = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', keydown);
    return () => {
      document.body.classList.remove('modal-open');
      window.removeEventListener('keydown', keydown);
    };
  }, [onClose]);

  return (
    <motion.div
      className="event-modal-shell"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <motion.article
        className={`event-modal-panel panel accent-${event.accent || 'cyan'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-modal-title"
        style={{ '--accent': `var(--${event.accent || 'cyan'})` }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <span className="em-corner em-corner--tl" aria-hidden="true" />
        <span className="em-corner em-corner--tr" aria-hidden="true" />
        <span className="em-corner em-corner--bl" aria-hidden="true" />
        <span className="em-corner em-corner--br" aria-hidden="true" />

        <header className="em-header">
          <div className="em-header-left">
            <span className="em-index">{displayIndex}</span>
            <h1 className="em-title" id="event-modal-title">{event.name}</h1>
          </div>
          <button className="em-close" onClick={onClose} aria-label="Close event details">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <line x1="1" y1="1" x2="15" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="square"/>
              <line x1="15" y1="1" x2="1" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="square"/>
            </svg>
            <span className="em-close-label">ESC</span>
          </button>
        </header>

        <div className="em-tabs" role="tablist" aria-label="Event information sections">
          {pages.map((p, i) => (
            <button
              key={p.key}
              role="tab"
              aria-selected={page === i}
              className={`em-tab ${page === i ? 'active' : ''}`}
              onClick={() => setPage(i)}
            >
              {p.title}
            </button>
          ))}
        </div>

        <div className="em-body" aria-live="polite">
          {page === 0 && (
            <div className="em-content">
              <p className="em-desc">{event.format}</p>
              <div className="em-meta-row">
                <div className="em-meta-item">
                  <span className="em-meta-label">FEE</span>
                  <span className="em-meta-value">
                    {event.fee === 0 ? 'FREE' : `Rs.${event.fee}`}
                  </span>
                </div>
                <div className="em-meta-item">
                  <span className="em-meta-label">CATEGORY</span>
                  <span className="em-meta-value">{event.category}</span>
                </div>
                <div className="em-meta-item">
                  <span className="em-meta-label">DATE</span>
                  <span className="em-meta-value">26 SEP 2026</span>
                </div>
              </div>
            </div>
          )}

          {page === 1 && (
            <div className="em-content">
              <ol className="em-rules-list">
                {event.details?.map((item) => (
                  <li key={item} className="em-rule-item">
                    <span className="em-rule-bullet" aria-hidden="true">--</span>
                    {item}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {page === 2 && (
            <div className="em-content">
              <p className="em-desc">
                {event.category} event. Solo registration.
                Bring a valid college ID and follow the final reporting instructions shared by the organizing team.
              </p>
              <p className="em-desc em-desc--muted">
                Contact: {site.contactEmail} or {site.contactPhone}.
              </p>
            </div>
          )}
        </div>

        <footer className="em-footer">
          <div className="em-page-counter">
            {pages.map((_, i) => (
              <span
                key={i}
                className={`em-dot ${page === i ? 'active' : ''}`}
                aria-hidden="true"
              />
            ))}
          </div>
          {isRegisterable && (
            <NotchedButton
              variant="primary"
              accent={event.accent || 'cyan'}
              onClick={onRegister}
              style={{ padding: '0.7rem 1.8rem', fontSize: '0.85rem' }}
            >
              REGISTER NOW
            </NotchedButton>
          )}
        </footer>
      </motion.article>
    </motion.div>
  );
}
