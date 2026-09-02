import { useMemo } from 'react';
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
} from 'lucide-react';
import { HeadingBar } from '../ui/HeadingBar/HeadingBar';
import { TickDivider } from '../ui/TickDivider/TickDivider';

const RAIL_COLORS = ['cyan', 'teal', 'lime'];

const events = [
  { title: 'Registration & Check-in', start: 8.5, end: 9.0, icon: User },
  { title: 'Inauguration Ceremony', start: 9.0, end: 10.0, icon: User },
  { title: 'NULL CORE 2.0 CTF', start: 10.0, end: 13.0, icon: Shield },
  { title: 'Bug Hunt', start: 10.0, end: 13.0, icon: Search },
  { title: 'Prompt Heist', start: 10.0, end: 13.0, icon: Bot },
  { title: 'Secure X Vibe Coding', start: 10.0, end: 13.0, icon: Code },
  { title: 'IGNITE (Idea Pitch)', start: 10.0, end: 13.0, icon: Lightbulb },
  { title: 'Mystery Hunt', start: 10.0, end: 13.0, icon: Search },
  { title: 'Tune Trap', start: 10.0, end: 13.0, icon: Music },
  { title: 'IPL Bidverse', start: 10.0, end: 13.0, icon: Trophy },
  { title: 'Lunch Break', start: 13.0, end: 14.0, icon: Coffee },
  { title: 'Finals & Project Evaluations', start: 14.0, end: 15.0, icon: CheckCircle },
  { title: 'Valedictory & Awards Ceremony', start: 15.0, end: 16.0, icon: Award },
];

const startHour = 8.5;
const endHour = 16.0;
const totalHalfHours = Math.round((endHour - startHour) * 2);
const rowHeight = 48;

function assignRows(eventsList) {
  const tracks = [];
  const layout = eventsList.map((e, i) => {
    let row = 0;
    while (tracks[row]?.some((ev) => !(e.end <= ev.start || e.start >= ev.end))) {
      row++;
    }
    if (!tracks[row]) {
      tracks[row] = [];
    }
    tracks[row].push(e);
    return { ...e, row, color: RAIL_COLORS[i % RAIL_COLORS.length] };
  });
  return { layout, maxRows: tracks.length };
}

function formatTime(hour24) {
  const h = Math.floor(hour24);
  const min = hour24 % 1 === 0 ? '00' : '30';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h12}:${min} ${ampm}`;
}

function formatTimeRange(hour24) {
  const h = Math.floor(hour24);
  const minsDecimal = hour24 % 1;
  const min = minsDecimal === 0 ? '00' : minsDecimal === 0.25 ? '15' : minsDecimal === 0.5 ? '30' : '45';
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const padHour = String(h12).padStart(2, '0');
  return `${padHour}:${min} ${period}`;
}

export function TimelineSection() {
  const { layout, maxRows } = assignRows(events);
  const containerHeight = maxRows * rowHeight;

  // Process mobile agenda groups chronologically sorted
  const mobileGroups = useMemo(() => {
    const sorted = [...events].map((e, index) => ({
      ...e,
      originalIndex: index,
      color: RAIL_COLORS[index % RAIL_COLORS.length],
    })).sort((a, b) => a.start - b.start);

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
  }, []);

  return (
    <section className="timeline-section" id="schedule">
      <HeadingBar level="h2" text="SCHEDULE" sectionIndex="04 / 05" />

      {/* Mobile Agenda List View (Default < 701px) */}
      <div className="timeline-agenda">
        {/* HUD corner brackets decoration */}
        <span className="hud-corner hud-corner--tl" aria-hidden="true" />
        <span className="hud-corner hud-corner--tr" aria-hidden="true" />
        <span className="hud-corner hud-corner--bl" aria-hidden="true" />
        <span className="hud-corner hud-corner--br" aria-hidden="true" />

        <div className="agenda-timeline">
          {mobileGroups.map((group) => (
            <div className="time-group" key={group.startTime}>
              <span 
                className="time-group__tick" 
                style={group.isConcurrent ? { background: 'var(--lime)', boxShadow: '0 0 8px var(--lime)' } : {}}
                aria-hidden="true" 
              />
              <div className="time-group__header">
                <span>{group.formattedStart}</span>
                {group.isConcurrent && (
                  <span className="time-group__concurrency-tag">⚡ {group.count} Concurrent</span>
                )}
              </div>

              {group.events.map((event, idx) => {
                const EventIcon = event.icon;
                return (
                  <div 
                    className={`agenda-row agenda-row--${event.color}`} 
                    key={`${group.startTime}-${idx}`}
                  >
                    <div className="agenda-row__icon-wrap">
                      <EventIcon size={16} />
                    </div>
                    <div className="agenda-row__details">
                      <span className="agenda-row__title">{event.title}</span>
                      <span className="agenda-row__time">
                        {formatTimeRange(event.start)} – {formatTimeRange(event.end)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Desktop Gantt View (Media query overrides >= 701px) */}
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

            {layout.map((event, idx) => {
              const widthPercent =
                ((event.end - event.start) / (endHour - startHour)) * 100 - 0.5;
              const leftPercent =
                ((event.start - startHour) / (endHour - startHour)) * 100;
              const top = event.row * rowHeight;
              const EventIcon = event.icon;

              return (
                <div
                  key={idx}
                  className={`timeline-bar timeline-bar--${event.color}`}
                  style={{
                    left: `${leftPercent}%`,
                    width: `${widthPercent}%`,
                    top: `${top}px`,
                    height: '40px',
                  }}
                >
                  <div className="timeline-bar__content">
                    <EventIcon className="timeline-bar__icon" />
                    <span className="timeline-bar__label">{event.title}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
