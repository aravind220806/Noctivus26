import { useRef } from 'react';

export default function SpotlightCard({ children, className = '', accent = 'cyan' }) {
  const cardRef = useRef(null);

  const handlePointerMove = (event) => {
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
