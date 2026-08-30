import { useState, useRef, useEffect } from 'react';

export default function LineSidebar({
  items = [],
  accentColor = '#00E6B8',
  textColor = '#E2E8F0',
  markerColor = 'rgba(255, 255, 255, 0.35)',
  showIndex = true,
  showMarker = true,
  proximityRadius = 100,
  maxShift = 24,
  falloff = 'smooth',
  markerLength = 45,
  markerGap = 0,
  tickScale = 0.5,
  scaleTick = true,
  itemGap = 22,
  fontSize = 0.9,
  smoothing = 100,
  defaultActive = 0,
  active = 0,
  onItemClick,
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  return (
    <nav className="line-sidebar-nav" aria-label="Section sidebar navigation">
      <ul
        className="line-sidebar-list"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: `${itemGap}px`,
          listStyle: 'none',
          margin: 0,
          padding: 0,
        }}
      >
        {items.map((item, index) => {
          const isActive = active === index;
          const isHovered = hoveredIndex === index;
          const currentTextColor = isActive ? accentColor : isHovered ? '#FFFFFF' : textColor;

          return (
            <li
              key={`${item}-${index}`}
              className="line-sidebar-item"
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer',
                transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => onItemClick?.(index)}
            >
              {/* Optional Index */}
              {showIndex && (
                <span
                  style={{
                    fontFamily: 'var(--mono-font, monospace)',
                    fontSize: `${fontSize * 0.75}rem`,
                    color: isActive ? accentColor : 'rgba(255,255,255,0.4)',
                    opacity: isActive || isHovered ? 1 : 0.6,
                    transition: 'color 0.2s ease, opacity 0.2s ease',
                  }}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
              )}

              {/* Label */}
              <span
                className="line-sidebar-label"
                style={{
                  fontSize: `${fontSize}rem`,
                  fontWeight: isActive ? 700 : 500,
                  color: currentTextColor,
                  letterSpacing: '0.05em',
                  transition: 'color 0.2s ease, transform 0.2s ease',
                  transform: isActive || isHovered ? 'translateX(-4px)' : 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {item}
              </span>

              {/* Marker / Tick */}
              {showMarker && (
                <span
                  className="line-sidebar-marker"
                  style={{
                    display: 'inline-block',
                    width: isActive ? `${markerLength}px` : isHovered ? `${markerLength * 0.7}px` : `${markerLength * 0.4}px`,
                    height: '2px',
                    backgroundColor: isActive ? accentColor : isHovered ? '#FFFFFF' : markerColor,
                    borderRadius: '0',
                    clipPath: 'polygon(3px 0, 100% 0, 100% 100%, 0 100%, 0 3px)',
                    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: isActive ? `0 0 12px ${accentColor}` : 'none',
                  }}
                />
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
