import React from 'react';

export function CardHeader({ type = 'student' }) {
  const centerLabel =
    type === 'faculty'
      ? 'FACULTY COORDINATE'
      : type === 'registration'
      ? 'REGISTRATION UNIT'
      : 'STUDENT COORDINATE';

  return (
    <header className="noc-card-header">
      <div className="noc-card-header-left">
        <span className="noc-card-brand">NOCTIVUS</span>
        <span className="noc-card-tag">[26]</span>
      </div>
      <div className="noc-card-header-center">
        <span className="noc-card-classification">{centerLabel}</span>
      </div>
      <div className="noc-card-header-right">
        {/* Outline battery with 4 bars */}
        <div className="noc-battery-indicator" aria-label="Status: Battery Full / Online">
          <div className="noc-battery-shell">
            <span className="noc-battery-segment is-active" />
            <span className="noc-battery-segment is-active" />
            <span className="noc-battery-segment is-active" />
            <span className="noc-battery-segment is-active" />
          </div>
          <span className="noc-battery-nipple" />
        </div>
      </div>
    </header>
  );
}
