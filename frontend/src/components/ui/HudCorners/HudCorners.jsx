import React from 'react';
import './HudCorners.css';

export function HudCorners({ accent = 'cyan', children, className = '' }) {
  const accentVar = `var(--${accent})`;

  return (
    <div className={`hud-corners-container ${className}`}>
      <div className="hud-corner tl" style={{ '--accent': accentVar }} />
      <div className="hud-corner tr" style={{ '--accent': accentVar }} />
      <div className="hud-corner bl" style={{ '--accent': accentVar }} />
      <div className="hud-corner br" style={{ '--accent': accentVar }} />
      {children}
    </div>
  );
}
