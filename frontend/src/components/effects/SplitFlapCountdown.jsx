import { useEffect, useMemo, useState, useRef } from 'react';

const calculate = (target) => {
  const remaining = Math.max(0, new Date(target).getTime() - Date.now());
  return {
    total: remaining,
    days: Math.floor(remaining / 86_400_000),
    hours: Math.floor((remaining / 3_600_000) % 24),
    minutes: Math.floor((remaining / 60_000) % 60),
    seconds: Math.floor((remaining / 1_000) % 60),
  };
};

function DigitCell({ value }) {
  const [displayValue, setDisplayValue] = useState(value);
  const [glitching, setGlitching] = useState(false);
  const isInitial = useRef(true);

  useEffect(() => {
    // Skip glitch on initial render
    if (isInitial.current) {
      isInitial.current = false;
      setDisplayValue(value);
      return;
    }

    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setDisplayValue(value);
      return;
    }

    setGlitching(true);
    let ticks = 0;
    const interval = setInterval(() => {
      if (ticks < 3) {
        // Scramble with a random digit (0-9)
        setDisplayValue(Math.floor(Math.random() * 10));
        ticks++;
      } else {
        // Settle on the final value
        setDisplayValue(value);
        setGlitching(false);
        clearInterval(interval);
      }
    }, 45);

    return () => clearInterval(interval);
  }, [value]);

  return (
    <div className={`digit-cell ${glitching ? 'glitching' : ''}`}>
      <span className="ghost-cyan" aria-hidden="true">{displayValue}</span>
      <span className="ghost-lime" aria-hidden="true">{displayValue}</span>
      <span className="real">{displayValue}</span>
    </div>
  );
}

export default function SplitFlapCountdown({ target }) {
  const [clock, setClock] = useState(() => {
    const initial = calculate(target);
    return { current: initial };
  });

  useEffect(() => {
    const update = () => {
      setClock({ current: calculate(target) });
    };
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [target]);

  const units = useMemo(() => [
    ['DAYS', String(clock.current.days).padStart(2, '0')],
    ['HOURS', String(clock.current.hours).padStart(2, '0')],
    ['MINUTES', String(clock.current.minutes).padStart(2, '0')],
    ['SECONDS', String(clock.current.seconds).padStart(2, '0')],
  ], [clock]);

  if (clock.current.total === 0) {
    return <div className="countdown-live"><span /> The signal is live</div>;
  }

  return (
    <div 
      className="hero-countdown" 
      aria-label={`${clock.current.days} days, ${clock.current.hours} hours, ${clock.current.minutes} minutes, and ${clock.current.seconds} seconds until Noctivus`}
    >
      {/* Corner bracket decorations */}
      <span className="hero-countdown__bl" aria-hidden="true" />
      <span className="hero-countdown__br" aria-hidden="true" />
      
      <div className="hero-countdown__units" aria-hidden="true">
        {units.map(([label, value]) => (
          <div className="hero-countdown__unit" key={label}>
            <div className="digits">
              {value.split('').map((char, index) => (
                <DigitCell key={`${label}-${index}-${char}`} value={char} />
              ))}
            </div>
            <small>{label}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
