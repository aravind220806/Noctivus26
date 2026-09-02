import React from 'react';

export function CardFooter({
  line1 = 'PROPERTY OF NOCTIVUS 26',
  line2 = 'STUDENT COUNCIL',
}) {
  return (
    <footer className="noc-card-footer">
      <div className="noc-card-footer-emblem left" aria-hidden="true">
        <svg viewBox="0 0 32 20" width="18" height="12" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M1 10L6 4L11 10L16 1L21 10L26 4L31 10L24 16L16 19L8 16L1 10Z" />
          <path d="M16 1L16 19" strokeWidth="0.8" />
          <path d="M8 16L16 10L24 16" strokeWidth="0.8" />
        </svg>
      </div>
      <div className="noc-card-footer-text-wrap">
        <span className="noc-card-footer-text">{line1}</span>
        {line2 && <span className="noc-card-footer-subtext">{line2}</span>}
      </div>
      <div className="noc-card-footer-emblem right" aria-hidden="true">
        <svg viewBox="0 0 32 20" width="18" height="12" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M1 10L6 4L11 10L16 1L21 10L26 4L31 10L24 16L16 19L8 16L1 10Z" />
          <path d="M16 1L16 19" strokeWidth="0.8" />
          <path d="M8 16L16 10L24 16" strokeWidth="0.8" />
        </svg>
      </div>
    </footer>
  );
}
