import React from 'react';
import './HeadingBar.css';

export function HeadingBar({ level = 'h1', text, className = '' }) {
  const Component = level;

  return (
    <div className={`heading-container ${className}`}>
      <Component>
        {text}
        <span className="heading-cursor">_</span>
      </Component>
      <div className={`h-bar ${level}-bar`} />
    </div>
  );
}
