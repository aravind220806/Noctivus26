import { useState, useMemo } from 'react';
import {
  User,
  Shield,
  Search,
  Bot,
  Code,
  Lightbulb,
  Music,
  Trophy,
  Coffee,
  CheckCircle,
  Award,
  Clock,
  MapPin,
  Calendar,
  Sparkles,
  LayoutGrid,
  ListFilter,
  Terminal,
} from 'lucide-react';
import { HeadingBar } from '../ui/HeadingBar/HeadingBar';

const RAIL_COLORS = {
  Technical: 'cyan',
  'Non-Technical': 'lime',
  Workshop: 'violet',
  General: 'teal',
};

const events = [
  {
    id: 'registration',
    title: 'Registration & Check-in',
    shortTitle: 'Registration & Kit',
    start: 8.0,
    end: 9.25,
    icon: User,
    category: 'General',
    venue: 'Main Reception & Desk',
    description: 'Participant check-in, ID verification, and welcome kit distribution.',
    color: 'teal',
    trackRow: 0,
  },
  {
    id: 'inauguration',
    title: 'Inauguration Ceremony',
    shortTitle: 'Inauguration',
    start: 9.25,
    end: 10.0,
    icon: User,
    category: 'General',
    venue: 'Main Auditorium',
    description: 'Welcome address, dignitary speeches, and symposium commencement.',
    color: 'teal',
    trackRow: 1,
  },
  {
    id: 'ctf',
    title: 'NULL CORE 2.0 CTF',
    shortTitle: 'NULL CORE CTF',
    start: 10.0,
    end: 13.0,
    icon: Shield,
    category: 'Technical',
    venue: 'Cyber Security Lab 1',
    description: 'High-intensity cybersecurity & ethical hacking challenges.',
    color: 'cyan',
    trackRow: 0,
  },
  {
    id: 'bug-hunt',
    title: 'Bug Hunt',
    shortTitle: 'Bug Hunt',
    start: 10.0,
    end: 13.0,
    icon: Search,
    category: 'Technical',
    venue: 'Cyber Security Lab 2',
    description: 'Hands-on live system vulnerability discovery and exploit reporting.',
    color: 'cyan',
    trackRow: 1,
  },
  {
    id: 'prompt-heist',
    title: 'Prompt Heist',
    shortTitle: 'Prompt Heist',
    start: 10.0,
    end: 13.0,
    icon: Bot,
    category: 'Technical',
    venue: 'AI & Data Lab',
    description: 'Adversarial prompt injection and LLM jailbreaking battle.',
    color: 'cyan',
    trackRow: 2,
  },
  {
    id: 'vibe-coding',
    title: 'Secure X Vibe Coding',
    shortTitle: 'Secure X Coding',
    start: 10.0,
    end: 13.0,
    icon: Code,
    category: 'Technical',
    venue: 'Software Lab 3',
    description: 'Rapid AI-assisted secure application development showdown.',
    color: 'cyan',
    trackRow: 3,
  },
  {
    id: 'ignite',
    title: 'IGNITE (Idea Pitch)',
    shortTitle: 'IGNITE Pitch',
    start: 10.0,
    end: 13.0,
    icon: Lightbulb,
    category: 'Technical',
    venue: 'Seminar Hall 1',
    description: 'Innovation, product prototyping, and venture pitch presentations.',
    color: 'cyan',
    trackRow: 4,
  },
  {
    id: 'mystery-hunt',
    title: 'Mystery Hunt',
    shortTitle: 'Mystery Hunt',
    start: 10.0,
    end: 13.0,
    icon: Search,
    category: 'Non-Technical',
    venue: 'Campus Arena',
    description: 'Campus-wide cryptic clues, logic puzzles, and treasure hunt.',
    color: 'lime',
    trackRow: 5,
  },
  {
    id: 'tune-trap',
    title: 'Tune Trap',
    shortTitle: 'Tune Trap',
    start: 10.0,
    end: 13.0,
    icon: Music,
    category: 'Non-Technical',
    venue: 'Open Air Theatre',
    description: 'Music trivia, audio reverse analysis, and rhythm challenges.',
    color: 'lime',
    trackRow: 6,
  },
  {
    id: 'ipl-bidverse',
    title: 'IPL Bidverse',
    shortTitle: 'IPL Bidverse',
    start: 10.0,
    end: 13.0,
    icon: Trophy,
    category: 'Non-Technical',
    venue: 'Seminar Hall 2',
    description: 'Strategic auction simulation and sports management battle.',
    color: 'lime',
    trackRow: 7,
  },
  {
    id: 'playground-of-hackers',
    title: 'Playground of Hackers',
    shortTitle: 'Playground of Hackers',
    start: 10.0,
    end: 15.0,
    icon: Terminal,
    category: 'Workshop',
    venue: 'Cyber Security Lab 2',
    description: 'An intensive hands-on offensive & defensive cybersecurity workshop uncovering real-world exploit vectors, ethical hacking techniques, and live labs.',
    color: 'violet',
    trackRow: 8,
  },
  {
    id: 'lunch',
    title: 'Lunch Break & Refreshments',
    shortTitle: 'Lunch Break',
    start: 13.0,
    end: 14.0,
    icon: Coffee,
    category: 'General',
    venue: 'Dining Arena',
    description: 'Complimentary lunch buffet, refreshments, and networking.',
    color: 'teal',
    trackRow: 0,
  },
  {
    id: 'finals',
    title: 'Finals & Project Evaluations',
    shortTitle: 'Finals & Evaluations',
    start: 14.0,
    end: 15.25,
    icon: CheckCircle,
    category: 'Technical',
    venue: 'Main Evaluation Labs',
    description: 'Final round defense, live demonstrations, and jury scorings.',
    color: 'cyan',
    trackRow: 0,
  },
  {
    id: 'valedictory',
    title: 'Valedictory & Awards Ceremony',
    shortTitle: 'Valedictory & Awards',
    start: 15.25,
    end: 16.5,
    icon: Award,
    category: 'General',
    venue: 'Main Auditorium',
    description: 'Winner felicitations, cash prize distributions, and closing ceremony.',
    color: 'teal',
    trackRow: 1,
  },
];

const startHour = 8.0;
const endHour = 16.5;
const totalHalfHours = Math.round((endHour - startHour) * 2);
const rowHeight = 52;

function formatTime(hour24) {
  const h = Math.floor(hour24);
  const min = hour24 % 1 === 0 ? '00' : '30';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h12}:${min} ${ampm}`;
}

function formatTimeRange(hour24) {
  const h = Math.floor(hour24);
  const minsDecimal = Math.round((hour24 % 1) * 60);
  const min = String(minsDecimal).padStart(2, '0');
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const padHour = String(h12).padStart(2, '0');
  return `${padHour}:${min} ${period}`;
}

function formatDuration(start, end) {
  const diffHours = end - start;
  const hours = Math.floor(diffHours);
  const minutes = Math.round((diffHours % 1) * 60);
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours} hr${hours > 1 ? 's' : ''}`;
  return `${minutes} mins`;
}

export function TimelineSection() {
  const [activeTab, setActiveTab] = useState('timeline'); // 'timeline' | 'agenda' on desktop
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [hoveredEvent, setHoveredEvent] = useState(null);

  const filteredEvents = useMemo(() => {
    if (selectedCategory === 'ALL') return events;
    if (selectedCategory === 'TECHNICAL') return events.filter((e) => e.category === 'Technical');
    if (selectedCategory === 'NON-TECHNICAL') return events.filter((e) => e.category === 'Non-Technical');
    if (selectedCategory === 'WORKSHOP') return events.filter((e) => e.category === 'Workshop');
    if (selectedCategory === 'CEREMONY') return events.filter((e) => e.category === 'General');
    return events;
  }, [selectedCategory]);

  const maxRows = useMemo(() => {
    const rows = events.map((e) => e.trackRow ?? 0);
    return Math.max(...rows, 0) + 1;
  }, []);

  const containerHeight = maxRows * rowHeight;

  // Process mobile / agenda groups chronologically sorted
  const agendaGroups = useMemo(() => {
    const sorted = [...filteredEvents].sort((a, b) => a.start - b.start);

    const groupsMap = {};
    sorted.forEach((event) => {
      if (!groupsMap[event.start]) {
        groupsMap[event.start] = [];
      }
      groupsMap[event.start].push(event);
    });

    return Object.keys(groupsMap)
      .map(Number)
      .sort((a, b) => a - b)
      .map((startTime) => {
        const groupEvents = groupsMap[startTime];
        const isConcurrent = groupEvents.length > 1;
        return {
          startTime,
          formattedStart: formatTimeRange(startTime),
          isConcurrent,
          count: groupEvents.length,
          events: groupEvents,
        };
      });
  }, [filteredEvents]);

  const renderTimelineContent = () => (
    <div className="timeline-scroll">
      <div className="timeline-frame">
        {/* HUD corner brackets decoration */}
        <span className="hud-corner hud-corner--tl" aria-hidden="true" />
        <span className="hud-corner hud-corner--tr" aria-hidden="true" />
        <span className="hud-corner hud-corner--bl" aria-hidden="true" />
        <span className="hud-corner hud-corner--br" aria-hidden="true" />

        {/* Time axis */}
        <div className="timeline-axis">
          {[...Array(totalHalfHours + 1)].map((_, i) => {
            const current = startHour + i * 0.5;
            const isHour = current % 1 === 0;
            return (
              <div
                key={i}
                className={`timeline-tick ${isHour ? 'timeline-tick--hour' : ''}`}
                style={{ left: `${(i / totalHalfHours) * 100}%` }}
              >
                <span className="timeline-tick__mark" />
                {isHour && (
                  <span className="timeline-tick__label">
                    {formatTime(current)}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Grid lines & timeline bars */}
        <div className="timeline-grid" style={{ height: `${containerHeight}px` }}>
          <div
            className="timeline-grid__lines"
            style={{ gridTemplateColumns: `repeat(${totalHalfHours}, minmax(0, 1fr))` }}
          >
            {[...Array(totalHalfHours)].map((_, i) => (
              <div key={i} className="timeline-grid__line" />
            ))}
          </div>

          {events.map((event) => {
            const isFilteredOut = selectedCategory !== 'ALL' &&
              ((selectedCategory === 'TECHNICAL' && event.category !== 'Technical') ||
               (selectedCategory === 'NON-TECHNICAL' && event.category !== 'Non-Technical') ||
               (selectedCategory === 'WORKSHOP' && event.category !== 'Workshop') ||
               (selectedCategory === 'CEREMONY' && event.category !== 'General'));

            const widthPercent =
              ((event.end - event.start) / (endHour - startHour)) * 100 - 0.4;
            const leftPercent =
              ((event.start - startHour) / (endHour - startHour)) * 100;
            const top = (event.trackRow ?? 0) * rowHeight;
            const EventIcon = event.icon;
            const isHovered = hoveredEvent?.id === event.id;

            return (
              <div
                key={event.id}
                className={`timeline-bar timeline-bar--${event.color} ${isFilteredOut ? 'timeline-bar--dimmed' : ''} ${isHovered ? 'timeline-bar--hovered' : ''}`}
                style={{
                  left: `${leftPercent}%`,
                  width: `${widthPercent}%`,
                  top: `${top}px`,
                  height: '42px',
                }}
                onMouseEnter={() => setHoveredEvent(event)}
                onMouseLeave={() => setHoveredEvent(null)}
                tabIndex={0}
                aria-label={`${event.title}: ${formatTimeRange(event.start)} to ${formatTimeRange(event.end)} at ${event.venue}`}
              >
                <div className="timeline-bar__content">
                  <EventIcon className="timeline-bar__icon" />
                  <span className="timeline-bar__label">{event.title}</span>
                </div>

                {/* Interactive Neon HUD Tooltip on Hover */}
                {isHovered && (
                  <div className="timeline-bar__tooltip" role="tooltip">
                    <div className="tooltip-header">
                      <span className={`tooltip-tag tooltip-tag--${event.color}`}>
                        {event.category.toUpperCase()}
                      </span>
                      <span className="tooltip-duration">
                        {formatDuration(event.start, event.end)}
                      </span>
                    </div>
                    <div className="tooltip-title">{event.title}</div>
                    <div className="tooltip-meta">
                      <span className="tooltip-time">
                        <Clock size={12} />
                        {formatTimeRange(event.start)} – {formatTimeRange(event.end)}
                      </span>
                      <span className="tooltip-venue">
                        <MapPin size={12} />
                        {event.venue}
                      </span>
                    </div>
                    <p className="tooltip-desc">{event.description}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderAgendaContent = () => (
    <div className="timeline-agenda">
      <span className="hud-corner hud-corner--tl" aria-hidden="true" />
      <span className="hud-corner hud-corner--tr" aria-hidden="true" />
      <span className="hud-corner hud-corner--bl" aria-hidden="true" />
      <span className="hud-corner hud-corner--br" aria-hidden="true" />

      <div className="agenda-timeline">
        {agendaGroups.map((group) => (
          <div className="time-group" key={group.startTime}>
            <span
              className="time-group__tick"
              style={group.isConcurrent ? { background: 'var(--lime)', boxShadow: '0 0 10px var(--lime)' } : {}}
              aria-hidden="true"
            />
            <div className="time-group__header">
              <span className="time-group__time-badge">{group.formattedStart}</span>
              {group.isConcurrent && (
                <span className="time-group__concurrency-tag">
                  ⚡ {group.count} Parallel Events
                </span>
              )}
            </div>

            <div className="time-group__cards">
              {group.events.map((event) => {
                const EventIcon = event.icon;
                return (
                  <div
                    className={`agenda-row agenda-row--${event.color}`}
                    key={event.id}
                  >
                    <div className="agenda-row__icon-wrap">
                      <EventIcon size={18} />
                    </div>
                    <div className="agenda-row__details">
                      <div className="agenda-row__top">
                        <span className="agenda-row__title">{event.title}</span>
                        <span className={`agenda-row__category-badge agenda-row__category-badge--${event.color}`}>
                          {event.category}
                        </span>
                      </div>
                      <div className="agenda-row__meta">
                        <span className="agenda-row__time">
                          <Clock size={12} />
                          {formatTimeRange(event.start)} – {formatTimeRange(event.end)} ({formatDuration(event.start, event.end)})
                        </span>
                        <span className="agenda-row__venue">
                          <MapPin size={12} />
                          {event.venue}
                        </span>
                      </div>
                      <p className="agenda-row__description">{event.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <section className="timeline-section" id="schedule">
      <HeadingBar level="h2" text="SCHEDULE" sectionIndex="04 / 05" />

      {/* Interactive Controls Bar: Category Filters & Desktop View Switcher */}
      <div className="timeline-controls">
        <div className="timeline-filters">
          <button
            type="button"
            className={`timeline-filter-btn ${selectedCategory === 'ALL' ? 'timeline-filter-btn--active' : ''}`}
            onClick={() => setSelectedCategory('ALL')}
          >
            All Events ({events.length})
          </button>
          <button
            type="button"
            className={`timeline-filter-btn ${selectedCategory === 'TECHNICAL' ? 'timeline-filter-btn--active' : ''}`}
            onClick={() => setSelectedCategory('TECHNICAL')}
          >
            <span className="filter-dot filter-dot--cyan" /> Technical
          </button>
          <button
            type="button"
            className={`timeline-filter-btn ${selectedCategory === 'NON-TECHNICAL' ? 'timeline-filter-btn--active' : ''}`}
            onClick={() => setSelectedCategory('NON-TECHNICAL')}
          >
            <span className="filter-dot filter-dot--lime" /> Non-Technical
          </button>
          <button
            type="button"
            className={`timeline-filter-btn ${selectedCategory === 'WORKSHOP' ? 'timeline-filter-btn--active' : ''}`}
            onClick={() => setSelectedCategory('WORKSHOP')}
          >
            <span className="filter-dot filter-dot--violet" /> Workshop
          </button>
          <button
            type="button"
            className={`timeline-filter-btn ${selectedCategory === 'CEREMONY' ? 'timeline-filter-btn--active' : ''}`}
            onClick={() => setSelectedCategory('CEREMONY')}
          >
            <span className="filter-dot filter-dot--teal" /> Plenary & Breaks
          </button>
        </div>

        {/* Desktop View Switcher (Hidden on Mobile) */}
        <div className="timeline-view-switch" role="tablist" aria-label="Schedule View">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'timeline'}
            className={`timeline-switch-btn ${activeTab === 'timeline' ? 'timeline-switch-btn--active' : ''}`}
            onClick={() => setActiveTab('timeline')}
            title="Gantt Timeline View"
          >
            <LayoutGrid size={14} />
            <span>Timeline</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'agenda'}
            className={`timeline-switch-btn ${activeTab === 'agenda' ? 'timeline-switch-btn--active' : ''}`}
            onClick={() => setActiveTab('agenda')}
            title="Chronological Agenda List"
          >
            <ListFilter size={14} />
            <span>Agenda</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: Desktop View (> 900px) — Switches between Timeline and Agenda based on activeTab */}
      <div className="timeline-desktop-view">
        {activeTab === 'timeline' ? renderTimelineContent() : renderAgendaContent()}
      </div>

      {/* VIEW 2: Mobile View (<= 900px) — Always renders Agenda View */}
      <div className="timeline-mobile-view">
        {renderAgendaContent()}
      </div>
    </section>
  );
}
