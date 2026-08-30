import React from 'react';
import './AsymSection.css';

export function AsymSection({ leftContent, rightContent, className = '' }) {
  return (
    <div className={`asym-section ${className}`}>
      <div className="asym-left panel scanlines">
        {leftContent}
      </div>
      <div className="asym-right">
        {rightContent}
      </div>
    </div>
  );
}
