import { useMemo } from 'react';
import {
  User,
  Cpu,
  Shield,
  AlertTriangle,
  Code,
  Music,
  FileText,
  Unlock,
  Smartphone,
  Coffee,
} from 'lucide-react';

const RAIL_COLORS = ['cyan', 'teal', 'lime'];

const events = [
  { title: 'Inauguration', start: 8, end: 9.75, icon: User },
  { title: 'The Art of Hacking (Workshop)', start: 10, end: 12.75, icon: Cpu },
  { title: 'Null Core', start: 10, end: 12.75, icon: Shield },
  { title: 'GlitchGround', start: 10, end: 12.75, icon: AlertTriangle },
  { title: 'Beat Overflow', start: 10, end: 12.75, icon: Code },
  { title: 'Tune Tracker', start: 10, end: 11.25, icon: Music },
  { title: 'Tune Tracker', start: 11.5, end: 12.75, icon: Music },
  { title: 'Paper to Pixel', start: 10, end: 11.25, icon: FileText },
  { title: 'Paper to Pixel', start: 11.5, end: 12.75, icon: FileText },
  { title: 'Escape Room', start: 10, end: 11.25, icon: Unlock },
  { title: 'Escape Room', start: 11.5, end: 12.75, icon: Unlock },
  { title: 'Beyond Screen', start: 10, end: 11.25, icon: Smartphone },
  { title: 'Beyond Screen', start: 11.5, end: 12.75, icon: Smartphone },
  { title: 'Lunch', start: 12.75, end: 13.75, icon: Coffee },
  { title: 'The Art of Hacking (Workshop)', start: 13.75, end: 15.5, icon: Cpu },
];

const startHour = 8;
const endHour = 15.5;
const totalHalfHours = (endHour - startHour) * 2;
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
  return `${h12}:${min}`;
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
      <p className="timeline-title">SCHEDULE</p>
      <div className="timeline-rule" />

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
