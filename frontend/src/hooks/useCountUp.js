import { useEffect, useRef, useState } from 'react';

export default function useCountUp(end, duration = 900) {
  const ref = useRef(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(end);
      return undefined;
    }
    let frame;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      const started = performance.now();
      const tick = (now) => {
        const progress = Math.min((now - started) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(end * eased));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      observer.disconnect();
    }, { threshold: 0.6 });
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [duration, end]);

  return [ref, value];
}
