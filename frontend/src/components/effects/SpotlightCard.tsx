import { useRef, type PointerEvent, type ReactNode } from 'react';

export interface SpotlightCardProps {
  children?: ReactNode;
  className?: string;
  accent?: string;
}

export default function SpotlightCard({ children, className = '', accent = 'cyan' }: SpotlightCardProps) {
  const cardRef = useRef<HTMLElement | null>(null);

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const card = cardRef.current;
    if (!card) return;
    const bounds = card.getBoundingClientRect();
    card.style.setProperty('--spot-x', `${event.clientX - bounds.left}px`);
    card.style.setProperty('--spot-y', `${event.clientY - bounds.top}px`);
  };

  return (
    <article ref={cardRef} onPointerMove={handlePointerMove} className={`spotlight-card accent-${accent} ${className}`}>
      {children}
    </article>
  );
}
