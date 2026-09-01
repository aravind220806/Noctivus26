import React, { useEffect, useMemo, useState } from 'react';
import { events } from '../../data/site.js';
import { HeadingBar } from '../ui/HeadingBar/HeadingBar';
import { NotchedButton } from '../ui/NotchedButton/NotchedButton';
import { CyberHeroSwiper } from './CyberHeroSwiper';

export function EventsSection({ onSelect, onRegister, selectedCategory, onSelectCategory }) {
  const [filter, setFilter] = useState(selectedCategory || 'All');

  // Keep internal filter in sync if selectedCategory changes
  useEffect(() => {
    if (selectedCategory) {
      setFilter(selectedCategory);
    }
  }, [selectedCategory]);
  
  const categories = ['All', 'Technical', 'Non-technical', 'Workshop'];

  const authoritativeEvents = useMemo(() => {
    return events;
  }, []);

  const visibleEvents = useMemo(() => {
    if (filter === 'All') return authoritativeEvents;
    return authoritativeEvents.filter(e => e.category === filter);
  }, [filter, authoritativeEvents]);

  const handleFilterChange = (cat) => {
    setFilter(cat);
    onSelectCategory?.(cat);
  };

  return (
    <section className="events-section" id="events">
      <HeadingBar level="h2" text="CHOOSE YOUR EVENT" sectionIndex="03 / 05" />
      
      {/* Categories / Filters */}
      <div className="event-filters" role="group" aria-label="Filter events">
        {categories.map((cat) => {
          const isActive = filter === cat;
          const filterAccent = cat === 'Non-technical' ? 'lime' : cat === 'Workshop' ? 'violet' : 'cyan';
          return (
            <NotchedButton
              key={cat}
              variant={isActive ? 'primary' : 'ghost'}
              accent={filterAccent}
              onClick={() => handleFilterChange(cat)}
              className="filter-btn"
              style={{ padding: '0.6rem 1.2rem', fontSize: '0.8rem' }}
            >
              {cat}
            </NotchedButton>
          );
        })}
      </div>

<<<<<<< HEAD
      {/* Interactive Swiper Carousel replacing old grid */}
      <CyberHeroSwiper 
        eventsData={visibleEvents}
        onSelect={onSelect}
        onRegister={onRegister}
      />
=======
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
                    <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.75rem', color: 'var(--accent, #00f0ff)', opacity: 0.9 }}>
                      TEAM: {event.teamSize || 'Individual'}
                    </div>
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
>>>>>>> 58abbd5a1d0b1682e17663090580bb78bc9df626
    </section>
  );
}
