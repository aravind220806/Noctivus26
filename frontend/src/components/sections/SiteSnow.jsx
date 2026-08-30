import { useMemo } from 'react';

function LargeSnowflake() {
  const rotations = [0, 60, 120, 180, 240, 300];
  return (
    <svg viewBox="0 0 32 32" width="32" height="32" focusable="false">
      {rotations.map((rotation) => (
        <g key={rotation} transform={`rotate(${rotation}, 16, 16)`} stroke="#F4EFE4" strokeWidth="2" strokeLinecap="round" fill="none">
          <line x1="16" y1="16" x2="16" y2="2" />
          <line x1="16" y1="7.6" x2="12.5" y2="4.5" strokeWidth="1.5" />
          <line x1="16" y1="7.6" x2="19.5" y2="4.5" strokeWidth="1.5" />
          <line x1="16" y1="4" x2="13.5" y2="2" strokeWidth="1.5" />
          <line x1="16" y1="4" x2="18.5" y2="2" strokeWidth="1.5" />
          <line x1="16" y1="2" x2="14" y2="0.5" strokeWidth="1.2" />
          <line x1="16" y1="2" x2="18" y2="0.5" strokeWidth="1.2" />
        </g>
      ))}
      <polygon points="16,13 18.6,14.5 18.6,17.5 16,19 13.4,17.5 13.4,14.5" fill="#F4EFE4" opacity="0.9" />
    </svg>
  );
}

function MediumSnowflake() {
  const rotations = [0, 60, 120, 180, 240, 300];
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" focusable="false">
      {rotations.map((rotation) => (
        <g key={rotation} transform={`rotate(${rotation}, 12, 12)`} stroke="#F4EFE4" strokeLinecap="round" fill="none">
          <line x1="12" y1="12" x2="12" y2="2" strokeWidth="1.5" />
          <line x1="12" y1="5.5" x2="9.9" y2="3.4" strokeWidth="1" />
          <line x1="12" y1="5.5" x2="14.1" y2="3.4" strokeWidth="1" />
        </g>
      ))}
      <polygon points="12,10 13.7,11 13.7,13 12,14 10.3,13 10.3,11" fill="#F4EFE4" opacity="0.9" />
    </svg>
  );
}

function SmallSnowflake() {
  const rotations = [0, 60, 120, 180, 240, 300];
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" focusable="false">
      {rotations.map((rotation) => (
        <g key={rotation} transform={`rotate(${rotation}, 6, 6)`} stroke="#F4EFE4" strokeWidth="1" strokeLinecap="round" fill="none">
          <line x1="6" y1="6" x2="6" y2="1" />
        </g>
      ))}
    </svg>
  );
}

export function SiteSnow() {
  const flakes = useMemo(
    () =>
      Array.from({ length: 62 }, (_, index) => {
        const seed = index + 1;
        const kind = index < 7 ? 'large' : index < 25 ? 'medium' : 'small';
        const left = (seed * 37) % 100;
        const size = kind === 'large' ? 24 + ((seed * 19) % 9) : kind === 'medium' ? 12 + ((seed * 19) % 7) : 4 + ((seed * 19) % 5);
        const duration = kind === 'large' ? 12 + ((seed * 23) % 5) : kind === 'medium' ? 16 + ((seed * 23) % 5) : 20 + ((seed * 23) % 9);
        const delay = -((seed * 29) % duration);
        const drift = kind === 'large' ? ((seed * 17) % 41) - 20 : kind === 'medium' ? ((seed * 17) % 31) - 15 : ((seed * 17) % 17) - 8;
        const opacity = kind === 'small' ? 0.3 + (((seed * 11) % 21) / 100) : 0.7 + (((seed * 11) % 21) / 100);
        const rotation = kind === 'large' ? 15 : kind === 'medium' ? 10 : 0;
        return { kind, left, size, duration, delay, drift, opacity, rotation };
      }),
    []
  );

  return (
    <div className="site-snow" aria-hidden="true">
      {flakes.map((flake, index) => (
        <span
          key={index}
          className={`site-snow__flake site-snow__flake--${flake.kind}`}
          style={{
            '--snow-left': `${flake.left}%`,
            '--snow-size': `${flake.size}px`,
            '--snow-duration': `${flake.duration}s`,
            '--snow-delay': `${flake.delay}s`,
            '--snow-drift': `${flake.drift}px`,
            '--snow-opacity': flake.opacity,
            '--snow-rotation': `${flake.rotation}deg`,
          }}
        >
          {flake.kind === 'large' && <LargeSnowflake />}
          {flake.kind === 'medium' && <MediumSnowflake />}
          {flake.kind === 'small' && <SmallSnowflake />}
        </span>
      ))}
    </div>
  );
}
