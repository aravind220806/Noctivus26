import { useEffect, useMemo, useRef, useState } from 'react';
import './CircularGallery.css';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export default function CircularGallery({
  items = [],
  bend = 2,
  textColor = '#F4EFE4',
  scrollEase = 0.03,
  font = "600 20px var(--display-font)",
  className = '',
  onActiveChange,
  onPosterClick,
  autoScroll = false,
  autoScrollMs = 2600,
}) {
  const data = useMemo(() => items.filter((item) => item?.image), [items]);
  const count = data.length;
  const [active, setActive] = useState(Math.min(1, Math.max(0, count - 1)));
  const dragRef = useRef(null);

  useEffect(() => {
    onActiveChange?.(active, data[active]);
  }, [active, data, onActiveChange]);

  const moveBy = (step) => {
    if (count < 2) return;
    setActive((current) => (current + step + count) % count);
  };

  useEffect(() => {
    if (!autoScroll || count < 2) return undefined;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % count);
    }, autoScrollMs);
    return () => window.clearInterval(timer);
  }, [autoScroll, autoScrollMs, count]);

  const getOffset = (index) => {
    let offset = index - active;
    if (count > 1) {
      offset = ((offset % count) + count) % count;
      if (offset > count / 2) offset -= count;
    }
    return offset;
  };

  return (
    <div
      className={`circular-gallery ${className}`.trim()}
      style={{ '--cg-text': textColor, '--cg-font': font, '--cg-ease': `${clamp(scrollEase * 18, 0.18, 0.55)}s` }}
      onWheel={(event) => {
        event.preventDefault();
        const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
        if (Math.abs(delta) > 8) moveBy(delta > 0 ? 1 : -1);
      }}
      onPointerDown={(event) => {
        dragRef.current = { x: event.clientX, moved: false };
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag) return;
        const dx = event.clientX - drag.x;
        if (Math.abs(dx) > 54) {
          drag.moved = true;
          moveBy(dx < 0 ? 1 : -1);
          drag.x = event.clientX;
        }
      }}
      onPointerUp={() => { dragRef.current = null; }}
      onPointerCancel={() => { dragRef.current = null; }}
    >
      <div className="circular-gallery__track">
        {data.map((item, index) => {
          const offset = getOffset(index);
          const abs = Math.abs(offset);
          return (
            <button
              key={item.image}
              type="button"
              className={`circular-gallery__card${offset === 0 ? ' is-active' : ''}`}
              style={{
                '--cg-offset': offset,
                '--cg-abs': abs,
                '--cg-y': `${abs * bend * 18}px`,
                '--cg-mobile-y': `${abs * bend * 10}px`,
                '--cg-z': `${abs * -90}px`,
                '--cg-mobile-z': `${abs * -70}px`,
                '--cg-scale': 1 - Math.min(abs, 3) * 0.14,
                '--cg-mobile-scale': 1 - Math.min(abs, 3) * 0.16,
                '--cg-opacity': 1 - Math.min(abs, 3) * 0.2,
                '--cg-bend': bend,
                zIndex: 20 - abs,
              }}
              aria-label={`Preview ${item.text || item.title}`}
              onClick={() => {
                if (offset === 0) onPosterClick?.(item);
                else setActive(index);
              }}
            >
              <img src={item.image} alt={item.alt || item.text || item.title || ''} width={item.width || 900} height={item.height || 1200} loading={offset === 0 ? 'eager' : 'lazy'} decoding="async" draggable="false" />
            </button>
          );
        })}
      </div>

      <button className="circular-gallery__nav circular-gallery__nav--prev" type="button" aria-label="Previous poster" onClick={() => moveBy(-1)}>‹</button>
      <button className="circular-gallery__nav circular-gallery__nav--next" type="button" aria-label="Next poster" onClick={() => moveBy(1)}>›</button>
      <button className="circular-gallery__hit" type="button" onClick={() => onPosterClick?.(data[active])}>
        <span>{data[active]?.text || data[active]?.title}</span>
      </button>
    </div>
  );
}
