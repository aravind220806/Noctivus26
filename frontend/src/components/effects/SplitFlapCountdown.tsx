import { Fragment, useEffect, useState } from 'react';

export interface CountdownTime {
  total: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export interface SplitFlapCountdownProps {
  target: string | Date | number;
}

const calculate = (target: string | Date | number): CountdownTime => {
  const remaining = Math.max(0, new Date(target).getTime() - Date.now());
  return {
    total: remaining,
    days: Math.floor(remaining / 86_400_000),
    hours: Math.floor((remaining / 3_600_000) % 24),
    minutes: Math.floor((remaining / 60_000) % 60),
    seconds: Math.floor((remaining / 1_000) % 60),
  };
};

interface DigitState {
  current: string;
  previous: string;
  flipKey: number;  // incremented each flip → Fragment key forces CSS anim restart
}

// Single-state FlipDigit: no RAF, no separate flipping boolean — glitch-free
function FlipDigit({ digit }: { digit: string }) {
  const [state, setState] = useState<DigitState>({
    current: digit,
    previous: digit,
    flipKey: 0,
  });

  // Atomically swap current/previous and bump the key when the digit prop changes
  useEffect(() => {
    setState(prev => {
      if (digit === prev.current) return prev;           // no change → no re-render
      return { current: digit, previous: prev.current, flipKey: prev.flipKey + 1 };
    });
  }, [digit]);

  // After the animation (500ms = fold 240ms + unfold 240ms + 20ms buffer),
  // reset previous = current so the flap elements unmount cleanly
  useEffect(() => {
    if (state.previous === state.current) return;
    const t = window.setTimeout(() => {
      setState(prev => ({ ...prev, previous: prev.current }));
    }, 520);
    return () => clearTimeout(t);
  }, [state.flipKey]); // only re-run when a new flip starts

  const isAnimating = state.previous !== state.current;

  return (
    <div className="fc-digit">
      {/* Static back plates — always show the NEW (current) digit */}
      <div className="fc-half fc-half--top">
        <span className="fc-char">{state.current}</span>
      </div>
      <div className="fc-half fc-half--bot">
        <span className="fc-char">{state.current}</span>
      </div>

      {/* Animated flaps — keyed so React remounts them every flip */}
      {isAnimating && (
        <Fragment key={state.flipKey}>
          {/* Top flap: OLD digit, folds down 0° → -90° */}
          <div className="fc-flap fc-flap--top">
            <span className="fc-char">{state.previous}</span>
          </div>
          {/* Bottom flap: NEW digit, unfolds 90° → 0° with short delay */}
          <div className="fc-flap fc-flap--bot">
            <span className="fc-char">{state.current}</span>
          </div>
        </Fragment>
      )}

      <div className="fc-seam" />
    </div>
  );
}

function UnitGroup({ label, value, padTo }: { label: string; value: number; padTo: number }) {
  const digits = String(value).padStart(padTo, '0').split('');
  return (
    <div className="hero-countdown__unit">
      <div className="fc-digits-row">
        {digits.map((d, i) => (
          <FlipDigit key={`${label}-${i}`} digit={d} />
        ))}
      </div>
      <small>{label}</small>
    </div>
  );
}

export default function SplitFlapCountdown({ target }: SplitFlapCountdownProps) {
  const [clock, setClock] = useState<CountdownTime>(() => calculate(target));

  useEffect(() => {
    const update = () => setClock(calculate(target));
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [target]);

  if (clock.total === 0)
    return <div className="countdown-live"><span /> The signal is live</div>;

  return (
    <div
      className="hero-countdown"
      aria-label={`${clock.days} days, ${clock.hours} hours, ${clock.minutes} minutes, and ${clock.seconds} seconds until Noctivus`}
    >
      <span className="hero-countdown__eyebrow" aria-hidden="true">
        <i /> COUNTDOWN TO NOCTIVUS '26 <i />
      </span>
      <div className="hero-countdown__units" aria-hidden="true">
        <UnitGroup label="DAYS"    value={clock.days}    padTo={3} />
        <UnitGroup label="HOURS"   value={clock.hours}   padTo={2} />
        <UnitGroup label="MINUTES" value={clock.minutes} padTo={2} />
        <UnitGroup label="SECONDS" value={clock.seconds} padTo={2} />
      </div>
    </div>
  );
}


