import React from 'react';
import './NotchedButton.css';

export function NotchedButton({
  variant = 'primary',
  accent = 'cyan',
  children,
  onClick,
  className = '',
  as: Component = 'button',
  ...props
}) {
  const accentVar = `var(--${accent})`;

  if (variant === 'ghost') {
    return (
      <div className="btn-ghost-wrapper" style={{ '--accent': accentVar }}>
        <Component
          className={`notched-button btn-ghost ${className}`}
          onClick={onClick}
          {...props}
        >
          {children}
        </Component>
      </div>
    );
  }

  return (
    <Component
      className={`notched-button btn-primary ${className}`}
      style={{ '--accent': accentVar }}
      onClick={onClick}
      {...props}
    >
      {children}
    </Component>
  );
}
