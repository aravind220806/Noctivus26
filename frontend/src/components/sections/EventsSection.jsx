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
    if (!filter || filter === 'All') return authoritativeEvents;
    const filterLower = filter.toLowerCase();
    return authoritativeEvents.filter((e) => {
      const catLower = e.category?.toLowerCase();
      if (filterLower === 'technical') {
        return catLower === 'technical' || catLower === 'workshop';
      }
      return catLower === filterLower;
    });
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

      {/* Interactive Swiper Carousel replacing old grid */}
      <CyberHeroSwiper
        eventsData={visibleEvents}
        onSelect={onSelect}
        onRegister={onRegister}
      />
    </section>
  );
}
