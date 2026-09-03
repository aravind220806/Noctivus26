import React from 'react';
import './TickDivider.css';

export function TickDivider({ standalone = false, className = '' }) {
  return (
    <div className={`tick-divider ${standalone ? 'standalone' : ''} ${className}`} />
  );
}
