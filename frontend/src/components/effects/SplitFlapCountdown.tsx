import { useEffect, useMemo, useState } from 'react';
import SplitFlapText from './SplitFlapText';

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

export default function SplitFlapCountdown({ target }: SplitFlapCountdownProps) {
  const [clock, setClock] = useState<{ previous: CountdownTime; current: CountdownTime }>(() => {
    const initial = calculate(target);
    return { previous: initial, current: initial };
  });

  useEffect(() => {
    const update = () =>
      setClock((value) => ({ previous: value.current, current: calculate(target) }));
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [target]);

  const units: [string, string, string][] = useMemo(
    () => [
      ['DAYS', String(clock.previous.days).padStart(3, '0'), String(clock.current.days).padStart(3, '0')],
      ['HOURS', String(clock.previous.hours).padStart(2, '0'), String(clock.current.hours).padStart(2, '0')],
      ['MINUTES', String(clock.previous.minutes).padStart(2, '0'), String(clock.current.minutes).padStart(2, '0')],
      ['SECONDS', String(clock.previous.seconds).padStart(2, '0'), String(clock.current.seconds).padStart(2, '0')],
    ],
    [clock]
  );

  if (clock.current.total === 0)
    return <div className="countdown-live"><span /> The signal is live</div>;

  return (
    <div
      className="hero-countdown"
      aria-label={`${clock.current.days} days, ${clock.current.hours} hours, ${clock.current.minutes} minutes, and ${clock.current.seconds} seconds until Noctivus`}
    >
      <span className="hero-countdown__eyebrow" aria-hidden="true">
        <i /> COUNTDOWN TO NOCTIVUS '26 <i />
      </span>
      <div className="hero-countdown__units" aria-hidden="true">
        {units.map(([label, previous, value]) => (
          <div className="hero-countdown__unit" key={label}>
            <SplitFlapText
              words={[previous, value]}
              flipDuration={0.08}
              stagger={0.035}
              cycleDelay={400}
              charset="numeric"
              flipsPerChar={3}
              tileColor="#101522"
              textColor="#dce5ff"
              tileRadius={5}
              gap={4}
              fontSize={40}
              loop={false}
              padTo={label === 'DAYS' ? 3 : 2}
            />
            <small>{label}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
