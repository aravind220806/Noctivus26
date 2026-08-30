import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import Icon from '../Icon.jsx';
import { SectionTitle } from './SectionTitle';
import { events } from '../../data/site.js';

export function EventsSection({ onSelect }) {
  const [filter, setFilter] = useState('All');
  const filters = ['All', 'Technical', 'Non-technical', 'Workshops'];
  const visibleEvents = useMemo(
    () => (filter === 'All' ? events : events.filter((event) => event.category === filter)),
    [filter]
  );

  return (
    <section className="section events-section" id="events">
      <div className="page-width">
        <SectionTitle
          kicker="EVENTS"
          title="Choose your event."
          description="Explore the official event lineup. Rules, formats, fees, and timings will be announced soon."
        />
        <div className="event-filters" role="group" aria-label="Filter events">
          {filters.map((item) => (
            <button type="button" aria-pressed={filter === item} onClick={() => setFilter(item)} key={item}>
              {item}
            </button>
          ))}
        </div>
        <div className="events-grid">
          {visibleEvents.map((event, index) => (
            <motion.article
              className={`event-card accent-${event.accent}`}
              data-reveal
              style={{ '--reveal-order': index }}
              key={event.id}
              layoutId={`event-card-${event.id}`}
            >
              <motion.button
                className="event-card__button"
                onClick={() => onSelect(event)}
                aria-label={`View ${event.name} rules and regulations`}
                whileHover="hover"
              >
                <motion.img
                  className="event-card__photo"
                  src={event.image}
                  alt=""
                  loading="lazy"
                  width="720"
                  height="480"
                  style={{ objectPosition: event.imagePosition }}
                  variants={{ hover: { scale: 1.05 } }}
                />
                <div className="event-card__content">
                  <div className="event-card__meta">
                    <span className="event-card__date">SEP 26</span>
                    <span className="event-category">{event.category}</span>
                  </div>
                  <div className="event-card__body">
                    <h3>{event.name}</h3>
                    <p>{event.format}</p>
                  </div>
                  <div className="event-card__footer">
                    <span className="event-card__cta">
                      View rules <Icon name="arrow" size={16} />
                    </span>
                  </div>
                </div>
              </motion.button>
            </motion.article>
          ))}
        </div>
        <p className="events-note" data-reveal>
          <span>*</span> Final rules, capacities, and event timings will be locked before registration opens.
        </p>
      </div>
    </section>
  );
}
