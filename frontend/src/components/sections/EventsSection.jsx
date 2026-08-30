import React, { useMemo, useState } from 'react';
import { events } from '../../data/site.js';
import { HeadingBar } from '../ui/HeadingBar/HeadingBar';
import { NotchedButton } from '../ui/NotchedButton/NotchedButton';
import { HudCorners } from '../ui/HudCorners/HudCorners';

export function EventsSection({ onSelect }) {
  const [filter, setFilter] = useState('All');
  
  const categories = ['All', 'Technical', 'Non-technical'];

  // Filter out the workshop/demo event to keep exactly the 8 authoritative events
  const authoritativeEvents = useMemo(() => {
    return events.filter(e => e.id !== 'cyber-awareness-workshop');
  }, []);

  const visibleEvents = useMemo(() => {
    if (filter === 'All') return authoritativeEvents;
    return authoritativeEvents.filter(e => e.category === filter);
  }, [filter, authoritativeEvents]);

  const getGridSpanClass = (index, total) => {
    if (total === 8) {
      if (index >= 6) return 'grid-span-3'; // Row 3: 2 cards span 3 cols each
    }
    return 'grid-span-2'; // Default: Row 1 & 2 cards span 2 cols each
  };

  return (
    <section className="events-section" id="events" style={{ padding: '4rem 2rem' }}>
      <HeadingBar level="h2" text="CHOOSE YOUR EVENT" sectionIndex="03 / 05" />
      
      {/* Categories / Filters */}
      <div className="event-filters" role="group" aria-label="Filter events">
        {categories.map((cat) => {
          const isActive = filter === cat;
          return (
            <NotchedButton
              key={cat}
              variant={isActive ? 'primary' : 'ghost'}
              accent="cyan"
              onClick={() => setFilter(cat)}
              className="filter-btn"
              style={{ padding: '0.6rem 1.2rem', fontSize: '0.8rem' }}
            >
              {cat}
            </NotchedButton>
          );
        })}
      </div>

      {/* Events Grid */}
      <div className="events-grid">
        {visibleEvents.map((event, index) => {
          const spanClass = getGridSpanClass(index, visibleEvents.length);
          const formattedIndex = String(index + 1).padStart(2, '0');

          return (
            <div 
              key={event.id} 
              className={`${spanClass}`}
              onClick={() => onSelect(event)}
            >
              <HudCorners accent={event.accent || 'cyan'}>
                <article 
                  className="event-card panel scanlines"
                  style={{ '--accent': `var(--${event.accent || 'cyan'})` }}
                >
                  <div className="event-card-header">
                    <span className="event-card-index">{formattedIndex}</span>
                    <span className="event-card-category">{event.category}</span>
                  </div>
                  
                  <div className="event-card-body">
                    <h3 className="event-card-title">{event.name}</h3>
                    <p className="event-card-desc">{event.format}</p>
                  </div>

                  <div className="event-card-footer">
                    <span className="event-card-meta">
                      FEE: ₹{event.fee}
                    </span>
                    <span className="event-card-cta">
                      VIEW DETAILS &gt;
                    </span>
                  </div>
                </article>
              </HudCorners>
            </div>
          );
        })}
      </div>
    </section>
  );
}
