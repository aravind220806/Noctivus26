import { useRef, useState, useCallback, useEffect } from 'react';
import './LineSidebar.css';

const FALLOFF_CURVES = {
  linear: p => p,
  smooth: p => p * p * (3 - 2 * p),
  sharp:  p => p * p * p,
};

const LineSidebar = ({
  items = [],
  accentColor    = '#00C8E0',
  textColor      = '#E8EDE8',
  markerColor    = 'rgba(232,237,232,0.25)',
  showIndex      = true,
  showMarker     = true,
  proximityRadius = 120,
  maxShift       = 20,
  falloff        = 'smooth',
  markerLength   = 48,
  markerGap      = 0,
  tickScale      = 0.5,
  scaleTick      = true,
  itemGap        = 28,
  fontSize       = 0.85,
  smoothing      = 100,
  defaultActive  = null,
  active         = null,   // external controlled active index (scrollspy)
  onItemClick,
  className      = '',
}) => {
  const listRef     = useRef(null);
  const itemRefs    = useRef([]);
  const targetsRef  = useRef([]);
  const currentRef  = useRef([]);
  const rafRef      = useRef(null);
  const lastRef     = useRef(0);
  const activeRef   = useRef(defaultActive);
  const smoothingRef = useRef(smoothing);

  // Prefer external `active` prop over internal state (scrollspy wins)
  const [internalActive, setInternalActive] = useState(defaultActive);
  const resolvedActive = active !== null ? active : internalActive;
  activeRef.current    = resolvedActive;
  smoothingRef.current = smoothing;

  const runFrame = useCallback(now => {
    const dt  = Math.min((now - lastRef.current) / 1000, 0.05);
    lastRef.current = now;
    const tau = Math.max(smoothingRef.current, 1) / 1000;
    const k   = 1 - Math.exp(-dt / tau);

    let moving = false;
    const els = itemRefs.current;
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      if (!el) continue;
      const target = Math.max(targetsRef.current[i] || 0, activeRef.current === i ? 1 : 0);
      const cur    = currentRef.current[i] || 0;
      const next   = cur + (target - cur) * k;
      const settled = Math.abs(target - next) < 0.0015;
      const value  = settled ? target : next;
      currentRef.current[i] = value;
      el.style.setProperty('--effect', value.toFixed(4));
      if (!settled) moving = true;
    }
    rafRef.current = moving ? requestAnimationFrame(runFrame) : null;
  }, []);

  const startLoop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    lastRef.current = performance.now();
    rafRef.current  = requestAnimationFrame(runFrame);
  }, [runFrame]);

  const handlePointerMove = useCallback(e => {
    const list = listRef.current;
    if (!list) return;
    const rect     = list.getBoundingClientRect();
    const pointerY = e.clientY - rect.top;
    const ease     = FALLOFF_CURVES[falloff] ?? FALLOFF_CURVES.linear;
    const els      = itemRefs.current;
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      if (!el) continue;
      const center   = el.offsetTop + el.offsetHeight / 2;
      const distance = Math.abs(pointerY - center);
      targetsRef.current[i] = ease(Math.max(0, 1 - distance / proximityRadius));
    }
    startLoop();
  }, [falloff, proximityRadius, startLoop]);

  const handlePointerLeave = useCallback(() => {
    targetsRef.current = targetsRef.current.map(() => 0);
    startLoop();
  }, [startLoop]);

  const handleClick = useCallback((index, label) => {
    setInternalActive(index);
    onItemClick?.(index, label);
  }, [onItemClick]);

  useEffect(() => { startLoop(); }, [resolvedActive, startLoop]);

  useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  return (
    <nav
      className={`line-sidebar${showMarker ? ' line-sidebar--markers' : ''}${scaleTick ? ' line-sidebar--scale-tick' : ''}${className ? ` ${className}` : ''}`}
      aria-label="Section navigation"
      style={{
        '--accent-color':  accentColor,
        '--text-color':    textColor,
        '--marker-color':  markerColor,
        '--marker-length': `${markerLength}px`,
        '--marker-gap':    `${markerGap}px`,
        '--tick-scale':    tickScale,
        '--max-shift':     `${maxShift}px`,
        '--item-gap':      `${itemGap}px`,
        '--font-size':     `${fontSize}rem`,
        '--smoothing':     `${smoothing}ms`,
      }}
    >
      <ul
        ref={listRef}
        className="line-sidebar__list"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        {items.map((label, index) => (
          <li
            key={`${label}-${index}`}
            ref={el => { itemRefs.current[index] = el; }}
            className="line-sidebar__item"
            aria-current={resolvedActive === index ? 'true' : undefined}
            onClick={() => handleClick(index, label)}
          >
            {showMarker && <span className="line-sidebar__marker" aria-hidden="true" />}
            <span className="line-sidebar__label">
              {showIndex && (
                <span className="line-sidebar__index">
                  {String(index + 1).padStart(2, '0')}
                </span>
              )}
              <span className="line-sidebar__text">{label}</span>
            </span>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default LineSidebar;
