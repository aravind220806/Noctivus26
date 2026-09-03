import React from 'react';
import './HeadingBar.css';

export function HeadingBar({ level = 'h1', text, sectionIndex, children, className = '' }) {
  const Component = level;
  const content = text || children;

  return (
    <div className={`heading-container ${className}`}>
      <Component>
        {content}
        <span className="heading-cursor">_</span>
      </Component>
      <div className={`h-bar ${level}-bar`} />
    </div>
  );
}
