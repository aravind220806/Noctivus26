import React from 'react';
import './HudPanel.css';

export function HudPanel({
  accent = 'cyan',
  scanlines = false,
  label = '',
  children,
  className = ''
}) {
  const accentVar = `var(--${accent})`;

  return (
    <div
      className={`hud-panel panel ${scanlines ? 'scanlines' : ''} ${className}`}
      style={{ '--accent': accentVar }}
    >
      {label && <div className="hud-label">{label}</div>}
      <div style={{ position: 'relative', zIndex: 5, width: '100%' }}>
        {children}
      </div>
    </div>
  );
}
