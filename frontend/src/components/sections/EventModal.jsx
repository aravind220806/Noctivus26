import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { site } from '../../data/site.js';

function NotebookDoodles() {
  return (
    <div className="notebook-doodles" aria-hidden="true">
      <svg className="notebook-tape notebook-tape--one" width="96" height="28" viewBox="0 0 96 28">
        <path d="M3 9c18-5 31 3 48-2 15-4 25-2 42 3l-4 14c-18-4-29-5-45-1-14 4-26-3-41 1Z" fill="rgba(20,18,15,.08)" stroke="#14120F" strokeWidth="1" strokeLinejoin="round" />
      </svg>
      <svg className="notebook-tape notebook-tape--two" width="82" height="26" viewBox="0 0 82 26">
        <path d="M2 6c12 2 24-3 38-2 15 1 28 7 40 5l-5 14c-13-1-26-3-39-3-12 0-22 1-34 3Z" fill="rgba(20,18,15,.07)" stroke="#14120F" strokeWidth="1" strokeLinejoin="round" />
      </svg>
      <svg className="notebook-scribble notebook-scribble--one" width="116" height="44" viewBox="0 0 116 44">
        <path d="M3 25c16-20 31-22 43-6 13 17 31 18 47-3 7-9 14-11 20-7" stroke="#14120F" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        <path d="M18 37c23-6 48-5 77 1" stroke="#14120F" strokeWidth="1" fill="none" strokeLinecap="round" opacity=".65" />
      </svg>
      <svg className="notebook-scribble notebook-scribble--two" width="86" height="58" viewBox="0 0 86 58">
        <path d="M12 46 42 8l30 38H12Z" stroke="#14120F" strokeWidth="1.3" fill="none" strokeLinejoin="round" />
        <path d="M42 8v38M24 31h36" stroke="#14120F" strokeWidth="1" fill="none" strokeLinecap="round" />
      </svg>
      <span className="notebook-rough-note notebook-rough-note--one">check timing</span>
      <span className="notebook-rough-note notebook-rough-note--two">bring ID</span>
    </div>
  );
}

function NotebookSquiggle() {
  return (
    <svg className="notebook-squiggle" width="200" height="12" viewBox="0 0 200 12">
      <path d="M2 6 Q 20 2, 40 6 T 80 6 T 120 6 T 160 6 T 198 6" stroke="#14120F" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function PencilDoodle() {
  return (
    <svg className="notebook-pencil" width="24" height="24" viewBox="0 0 24 24">
      <path d="M3 21l3-1 11-11-2-2L4 18l-1 3z" stroke="#14120F" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 6l2-2 2 2-2 2-2-2z" stroke="#14120F" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function OverviewDoodle() {
  return (
    <svg className="notebook-page-art notebook-page-art--overview" width="170" height="130" viewBox="0 0 170 130">
      <path d="M18 98c20-28 44-40 72-34 18 4 28-12 42-26 8-8 15-10 21-5" stroke="#14120F" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d="M22 96c35 6 66 4 114-3M38 82c12-18 23-23 35-19 12 5 21 0 31-10" stroke="#14120F" strokeWidth="1" fill="none" strokeLinecap="round" />
      <path d="M64 44l19-20 19 20M83 24v55M54 79h58" stroke="#14120F" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="132" cy="70" r="8" stroke="#14120F" strokeWidth="1.1" fill="none" />
    </svg>
  );
}

function RulesDoodle() {
  return (
    <svg className="notebook-page-art notebook-page-art--rules" width="142" height="160" viewBox="0 0 142 160">
      <path d="M32 22h76M32 56h76M32 90h76M32 124h76" stroke="#14120F" strokeWidth="1.2" strokeLinecap="round" opacity=".68" />
      <path d="M13 18l8 8 15-18M13 52l8 8 15-18M13 86l8 8 15-18M13 120l8 8 15-18" stroke="#14120F" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M100 14c16 12 23 25 20 39M114 49l7 8 8-7" stroke="#14120F" strokeWidth="1.1" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InfoDoodle() {
  return (
    <svg className="notebook-page-art notebook-page-art--info" width="156" height="146" viewBox="0 0 156 146">
      <path d="M36 111c15-30 34-45 56-45s35 15 49 45" stroke="#14120F" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      <path d="M48 111c9-18 24-27 44-27s34 9 42 27" stroke="#14120F" strokeWidth="1" fill="none" strokeLinecap="round" opacity=".7" />
      <path d="M77 34c0-15 25-15 25 0 0 10-9 12-13 19M89 69v1" stroke="#14120F" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M12 124c34 5 74 5 132 0" stroke="#14120F" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M19 43c9-8 18-7 27 2M21 53c8-4 15-4 23 1" stroke="#14120F" strokeWidth="1" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function EventTechDoodle({ eventId }) {
  const drawings = {
    ideathon: <><path d="M26 118h116M42 118V82h84v36M58 82V56h52v26M70 56V36h28v20" /><path d="M42 82l-18-20M126 82l18-20M58 56 44-26M110 56 66-26" /><circle cx="84" cy="24" r="10" /><path d="M76 140c13-10 31-10 44 0" /></>,
    'cyber-heist-ctf': <><rect x="38" y="56" width="92" height="64" rx="6" /><path d="M58 56V42c0-16 12-28 26-28s26 12 26 28v14" /><path d="M64 92h40M64 78h24M84 92l20 18" /><circle cx="110" cy="82" r="8" /></>,
    'iot-exploit': <><rect x="48" y="42" width="72" height="72" rx="8" /><path d="M64 58h40v40H64zM20 58h28M120 58h28M20 78h28M120 78h28M20 98h28M120 98h28M64 18v24M84 18v24M104 18v24M64 114v24M84 114v24M104 114v24" /><circle cx="84" cy="78" r="10" /></>,
    'secure-x-vibecode': <><path d="M52 46 22 78l30 32M116 46l30 32-30 32M96 32 72 124" /><rect x="42" y="18" width="84" height="124" rx="8" opacity=".35" /></>,
    'mind-cage': <><path d="M84 24c-30 0-52 20-52 46 0 18 12 33 31 40l-4 22 22-16h3c30 0 52-20 52-46S114 24 84 24z" /><path d="M68 66c0-10 7-18 17-18 9 0 16 6 16 15 0 15-18 13-18 29M83 108v2" /><path d="M44 86h20M104 86h20" /></>,
    'mystery-hunt': <><circle cx="72" cy="66" r="34" /><path d="M96 90l34 34M50 68c10-18 28-26 50-22" /><path d="M36 122c24-18 44-17 64 0 18 15 34 14 50-4" /></>,
    'tune-trap': <><path d="M58 34v74c0 10-9 18-21 18s-20-7-20-16 9-16 21-16c8 0 14 3 20 8M58 34l72-16v70c0 10-9 18-21 18s-20-7-20-16 9-16 21-16c8 0 14 3 20 8M58 54l72-16" /><path d="M26 38c-9 5-14 13-14 24M142 58c8 6 12 14 12 24" /></>,
    'auction-arena': <><path d="M54 48l34 34M44 58l34 34M50 42l44 44" /><rect x="28" y="84" width="78" height="18" rx="3" transform="rotate(-45 67 93)" /><path d="M96 116h46M104 132h30M70 118c-18-5-31-16-38-34" /></>,
    'cyber-awareness-workshop': <><path d="M84 18 132 38v34c0 32-18 54-48 70-30-16-48-38-48-70V38l48-20z" /><path d="M62 78l16 16 32-38" /><path d="M54 124h60" /></>,
  };

  return (
    <svg className="notebook-event-art" width="168" height="152" viewBox="0 0 168 152" aria-hidden="true">
      {drawings[eventId] || drawings.ideathon}
    </svg>
  );
}

function StarDoodle() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20">
      <path d="M10 1l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6z" stroke="#14120F" strokeWidth="1.2" fill="none" strokeLinejoin="round" />
    </svg>
  );
}

export function EventModal({ event, onClose }) {
  const [page, setPage] = useState(0);
  const pages = [
    {
      key: 'overview',
      title: event.name,
      body: <p>{event.format}</p>,
    },
    {
      key: 'rules',
      title: 'Rules & Format',
      body: (
        <ol>
          {event.details?.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      ),
    },
    {
      key: 'know',
      title: 'Good to Know',
      body: (
        <>
          <p>
            {event.category} event. Team size: {event.teamMin || 1}-{event.teamMax || 1}. Bring a valid college ID and follow the final reporting instructions shared by the organizing team.
          </p>
          <p>
            Questions? Reach out at {site.contactEmail} or {site.contactPhone}.
          </p>
        </>
      ),
    },
  ];

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
      className="modal-shell notebook-shell"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.article
        className={`notebook-view notebook-view--${pages[page].key} notebook-view--event-${event.id}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-modal-title"
        layoutId={`event-card-${event.id}`}
      >
        <button className="notebook-close" onClick={onClose} aria-label="Close event details">
          <svg width="20" height="20" viewBox="0 0 20 20">
            <path d="M3 3l14 14M17 3L3 17" stroke="#14120F" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <NotebookDoodles />
        <span className="notebook-entry-note">Entry: ₹{event.fee || 0}</span>
        <div className={`notebook-page notebook-page--${pages[page].key}`} aria-live="polite" key={pages[page].key}>
          <span className="notebook-page-label">
            Page {page + 1} — {page === 0 ? 'Overview' : pages[page].title}
          </span>
          <h1 id="event-modal-title">{pages[page].title}</h1>
          {page === 0 && <OverviewDoodle />}
          {page === 0 && <EventTechDoodle eventId={event.id} />}
          {page !== 0 && <NotebookSquiggle />}
          {page === 1 && <PencilDoodle />}
          {page === 1 && <RulesDoodle />}
          {page === 2 && <InfoDoodle />}
          <div className="notebook-body">{pages[page].body}</div>
          {page === 2 && (
            <div className="notebook-callout">
              <StarDoodle />
              <span>Keep your confirmation and college ID ready at the desk.</span>
            </div>
          )}
          <span className="notebook-page-number">0{page + 1}/03</span>
        </div>
        <div className="notebook-nav">
          <button type="button" aria-label="Previous page" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>
            ‹
          </button>
          <div className="notebook-dots" aria-hidden="true">
            {pages.map((item, index) => (
              <span className={page === index ? 'is-active' : ''} key={item.key} />
            ))}
          </div>
          <button type="button" aria-label="Next page" disabled={page === 2} onClick={() => setPage((current) => Math.min(2, current + 1))}>
            ›
          </button>
        </div>
      </motion.article>
    </motion.div>
  );
}
