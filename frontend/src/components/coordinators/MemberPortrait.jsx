import React from 'react';

export function MemberPortrait({ image, name, role }) {
  if (!image) {
    return (
      <div className="noc-member-portrait-frame noc-member-portrait-empty" aria-label={`Portrait placeholder for ${name}`}>
        <div className="noc-portrait-placeholder-content">
          <div className="noc-portrait-placeholder-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <circle cx="12" cy="10" r="3" />
              <path d="M7 17.5c1.3-1.5 3.1-2.5 5-2.5s3.7 1 5 2.5" />
            </svg>
          </div>
          <div className="noc-portrait-placeholder-badge">OFFICIAL PERSONNEL</div>
          <div className="noc-portrait-placeholder-code">SECURITY CLEARANCE LVL 8</div>
          <div className="noc-portrait-placeholder-sub">DEPARTMENT OF CSE (CYBER SECURITY)</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="noc-member-portrait-frame"
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* Invisible security shield overlay blocking direct clicks/saves */}
      <div className="noc-portrait-security-shield" aria-hidden="true" />

      {/* Subtle security watermark matrix grid overlay */}
      <div className="noc-portrait-watermark-overlay" aria-hidden="true">
        <span className="noc-watermark-tag">NOCTIVUS '26 // PROTECTED</span>
      </div>

      <img
        src={image}
        alt={`${name} - ${role}`}
        className="noc-member-portrait-img"
        loading="lazy"
        decoding="async"
        draggable={false}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}
