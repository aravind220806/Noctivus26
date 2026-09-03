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

  const categories = ['All', 'Technical', 'Non-Technical', 'Workshop'];

  const authoritativeEvents = useMemo(() => {
    return events;
  }, []);

  const visibleEvents = useMemo(() => {
    if (!filter || filter.toLowerCase() === 'all') return authoritativeEvents;
    const f = filter.toLowerCase().trim();
    return authoritativeEvents.filter((e) => {
      const c = (e.category || '').toLowerCase().trim();
      if (f === 'technical' || f === 'tech') {
        return (c === 'technical' || c === 'tech') && c !== 'workshop';
      }
      if (f === 'non-technical' || f === 'non-tech') {
        return (c === 'non-technical' || c === 'non-tech' || c === 'non technical') && c !== 'workshop';
      }
      if (f === 'workshop') {
        return c === 'workshop';
      }
      return c === f;
    });
  }, [filter, authoritativeEvents]);

  const handleFilterChange = (cat) => {
    setFilter(cat);
    onSelectCategory?.(cat);
  };

  return (
    <section className="events-section" id="events">
      <HeadingBar level="h2" text="CHOOSE YOUR EVENT" />

      {/* Categories / Filters */}
      <div className="event-filters" role="group" aria-label="Filter events">
        {/* Desktop: buttons */}
        <div className="event-filters-buttons">
          {categories.map((cat) => {
            const isActive = filter.toLowerCase() === cat.toLowerCase();
            const catLower = cat.toLowerCase();
            const filterAccent = catLower === 'non-technical' ? 'lime' : catLower === 'workshop' ? 'violet' : 'cyan';
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
        {/* Mobile: dropdown */}
        <div className="event-filters-dropdown">
          <select
            className="event-filter-select"
            value={filter}
            onChange={(e) => handleFilterChange(e.target.value)}
            aria-label="Filter events by category"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <span className="event-filter-chevron" aria-hidden="true">▾</span>
        </div>
      </div>

      {/* Interactive Swiper Carousel replacing old grid */}
      <CyberHeroSwiper
        eventsData={visibleEvents}
        onSelect={onSelect}
        onRegister={onRegister}
      />
    </section>
  );
}
