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
  Clock,
  LayoutGrid,
  ListFilter,
  Terminal,
  MapPin,
} from 'lucide-react';
import { HeadingBar } from '../ui/HeadingBar/HeadingBar';

const RAIL_COLORS = {
  Technical: 'cyan',
  'Non-Technical': 'lime',
  Workshop: 'violet',
  General: 'teal',
};

const events = [
  // ── Plenary & Breaks ──────────────────────────────────────────────────────
  {
    id: 'registration',
    title: 'Registration & Check-in',
    shortTitle: 'Registration & Kit',
    category: 'General',
    venue: 'Main Reception & Desk',
    description: 'Participant check-in, ID verification.',
    color: 'teal',
    icon: User,
    timeDisplay: '08:00 AM - 08:45 AM',
    durationDisplay: '45 mins',
    bars: [
      { id: 'registration-b1', start: 8.0, end: 8.75, label: 'Registration & Kit', tooltipDuration: '45 mins' },
    ],
    agendaEntries: [
      {
        id: 'registration-ag',
        startTime: 8.0,
        timeDisplay: '08:00 AM - 08:45 AM',
        duration: '45 mins',
        title: 'Registration & Check-in',
        badge: 'Plenary',
      },
    ],
  },
  {
    id: 'inauguration',
    title: 'Inauguration Ceremony',
    shortTitle: 'Inauguration',
    category: 'General',
    venue: 'Main Auditorium',
    description: 'Welcome address, dignitary speeches, and symposium commencement.',
    color: 'teal',
    icon: User,
    timeDisplay: '08:45 AM - 10:00 AM',
    durationDisplay: '1h 15m',
    bars: [
      { id: 'inauguration-b1', start: 8.75, end: 10.0, label: 'Inauguration Ceremony', tooltipDuration: '1h 15m' },
    ],
    agendaEntries: [
      {
        id: 'inauguration-ag',
        startTime: 8.75,
        timeDisplay: '08:45 AM - 10:00 AM',
        duration: '1h 15m',
        title: 'Inauguration Ceremony',
        badge: 'Plenary',
      },
    ],
  },
  {
    id: 'lunch',
    title: 'Lunch Break & Refreshments',
    shortTitle: 'Lunch Break',
    category: 'General',
    venue: 'Dining Arena',
    description: 'Complimentary lunch buffet, refreshments, and networking. All event tracks paused.',
    color: 'teal',
    icon: Coffee,
    timeDisplay: '12:00 PM - 01:00 PM',
    durationDisplay: '1 hr',
    bars: [
      { id: 'lunch-b1', start: 12.0, end: 13.0, label: 'Lunch Break & Refreshments', tooltipDuration: '1 hr' },
    ],
    agendaEntries: [
      {
        id: 'lunch-ag',
        startTime: 12.0,
        timeDisplay: '12:00 PM - 01:00 PM',
        duration: '1 hr',
        title: 'Lunch Break & Refreshments',
        badge: 'Symposium Break',
      },
    ],
  },

  // ── Full-Day Events (Continuous with Lunch Break — NOT 2 Sessions) ─────────
  {
    id: 'ctf',
    title: 'NULL CORE 2.0 CTF',
    shortTitle: 'NULL CORE CTF',
    category: 'Technical',
    venue: 'Cyber Security Lab 1',
    description: 'High-intensity cybersecurity & ethical hacking challenges (continuous competition running through 3:30 PM with lunch break).',
    color: 'cyan',
    icon: Shield,
    isFullDay: true,
    timeDisplay: '10:15 AM - 03:30 PM (Break: 12:00 PM - 01:00 PM)',
    durationDisplay: '4h 15m active',
    bars: [
      { id: 'ctf-b1', start: 10.25, end: 12.0, label: 'NULL CORE 2.0 CTF', tooltipDuration: '4h 15m active' },
      { id: 'ctf-b2', start: 13.0, end: 15.5, label: 'NULL CORE 2.0 CTF', tooltipDuration: '4h 15m active' },
    ],
    agendaEntries: [
      {
        id: 'ctf-ag1',
        startTime: 10.25,
        timeDisplay: '10:15 AM - 12:00 PM',
        duration: '1h 45m',
        title: 'NULL CORE 2.0 CTF',
        badge: 'Full-Day Event',
        description: 'High-intensity cybersecurity & ethical hacking challenges (continues after lunch break).',
      },
      {
        id: 'ctf-ag2',
        startTime: 13.0,
        timeDisplay: '01:00 PM - 03:30 PM',
        duration: '2h 30m',
        title: 'NULL CORE 2.0 CTF (Continuation)',
        badge: 'Continuation',
        description: 'Continuous competition resumes from morning session through 3:30 PM.',
      },
    ],
  },
  {
    id: 'playground-of-hackers',
    title: 'Playground of Hackers',
    shortTitle: 'Playground of Hackers',
    category: 'Workshop',
    venue: 'Cyber Security Lab 2',
    description: 'An intensive hands-on offensive & defensive cybersecurity workshop uncovering real-world exploit vectors, ethical hacking techniques, and live labs.',
    color: 'violet',
    icon: Terminal,
    isFullDay: true,
    timeDisplay: '10:15 AM - 03:30 PM (Break: 12:00 PM - 01:00 PM)',
    durationDisplay: '4h 15m active',
    bars: [
      { id: 'workshop-b1', start: 10.25, end: 12.0, label: 'Playground of Hackers', tooltipDuration: '4h 15m active' },
      { id: 'workshop-b2', start: 13.0, end: 15.5, label: 'Playground of Hackers', tooltipDuration: '4h 15m active' },
    ],
    agendaEntries: [
      {
        id: 'workshop-ag1',
        startTime: 10.25,
        timeDisplay: '10:15 AM - 12:00 PM',
        duration: '1h 45m',
        title: 'Playground of Hackers',
        badge: 'Full-Day Workshop',
        description: 'Intensive hands-on offensive & defensive cybersecurity workshop (continues after lunch break).',
      },
      {
        id: 'workshop-ag2',
        startTime: 13.0,
        timeDisplay: '01:00 PM - 03:30 PM',
        duration: '2h 30m',
        title: 'Playground of Hackers (Continuation)',
        badge: 'Continuation',
        description: 'Hands-on cybersecurity workshop resumes through 3:30 PM.',
      },
    ],
  },

  // ── Two-Session Technical Events (Session 1 & Session 2) ───────────────────
  {
    id: 'bug-hunt',
    title: 'Bug Hunt',
    shortTitle: 'Bug Hunt',
    category: 'Technical',
    venue: 'Cyber Security Lab 2',
    description: 'Hands-on live system vulnerability discovery and exploit reporting.',
    color: 'cyan',
    icon: Search,
    timeDisplay: 'Session 1: 10:15 AM - 12:00 PM | Session 2: 01:00 PM - 03:30 PM',
    durationDisplay: '1h 45m / 2h 30m',
    bars: [
      { id: 'bug-hunt-b1', start: 10.25, end: 12.0, label: 'Bug Hunt (Session 1)', sessionName: 'Session 1', tooltipDuration: '1h 45m' },
      { id: 'bug-hunt-b2', start: 13.0, end: 15.5, label: 'Bug Hunt (Session 2)', sessionName: 'Session 2', tooltipDuration: '2h 30m' },
    ],
    agendaEntries: [
      {
        id: 'bug-hunt-ag1',
        startTime: 10.25,
        timeDisplay: '10:15 AM - 12:00 PM',
        duration: '1h 45m',
        title: 'Bug Hunt (Session 1)',
        badge: 'Session 1',
      },
      {
        id: 'bug-hunt-ag2',
        startTime: 13.0,
        timeDisplay: '01:00 PM - 03:30 PM',
        duration: '2h 30m',
        title: 'Bug Hunt (Session 2)',
        badge: 'Session 2',
      },
    ],
  },
  {
    id: 'prompt-heist',
    title: 'Prompt Heist',
    shortTitle: 'Prompt Heist',
    category: 'Technical',
    venue: 'AI & Data Lab',
    description: 'Adversarial prompt injection and LLM jailbreaking battle.',
    color: 'cyan',
    icon: Bot,
    timeDisplay: 'Session 1: 10:15 AM - 12:00 PM | Session 2: 01:00 PM - 03:30 PM',
    durationDisplay: '1h 45m / 2h 30m',
    bars: [
      { id: 'prompt-heist-b1', start: 10.25, end: 12.0, label: 'Prompt Heist (Session 1)', sessionName: 'Session 1', tooltipDuration: '1h 45m' },
      { id: 'prompt-heist-b2', start: 13.0, end: 15.5, label: 'Prompt Heist (Session 2)', sessionName: 'Session 2', tooltipDuration: '2h 30m' },
    ],
    agendaEntries: [
      {
        id: 'prompt-heist-ag1',
        startTime: 10.25,
        timeDisplay: '10:15 AM - 12:00 PM',
        duration: '1h 45m',
        title: 'Prompt Heist (Session 1)',
        badge: 'Session 1',
      },
      {
        id: 'prompt-heist-ag2',
        startTime: 13.0,
        timeDisplay: '01:00 PM - 03:30 PM',
        duration: '2h 30m',
        title: 'Prompt Heist (Session 2)',
        badge: 'Session 2',
      },
    ],
  },
  {
    id: 'vibe-coding',
    title: 'Secure X Vibe Coding',
    shortTitle: 'Secure X Coding',
    category: 'Technical',
    venue: 'Software Lab 3',
    description: 'Rapid AI-assisted secure application development showdown.',
    color: 'cyan',
    icon: Code,
    timeDisplay: 'Session 1: 10:15 AM - 12:00 PM | Session 2: 01:00 PM - 03:30 PM',
    durationDisplay: '1h 45m / 2h 30m',
    bars: [
      { id: 'vibe-coding-b1', start: 10.25, end: 12.0, label: 'Secure X Coding (Session 1)', sessionName: 'Session 1', tooltipDuration: '1h 45m' },
      { id: 'vibe-coding-b2', start: 13.0, end: 15.5, label: 'Secure X Coding (Session 2)', sessionName: 'Session 2', tooltipDuration: '2h 30m' },
    ],
    agendaEntries: [
      {
        id: 'vibe-coding-ag1',
        startTime: 10.25,
        timeDisplay: '10:15 AM - 12:00 PM',
        duration: '1h 45m',
        title: 'Secure X Vibe Coding (Session 1)',
        badge: 'Session 1',
      },
      {
        id: 'vibe-coding-ag2',
        startTime: 13.0,
        timeDisplay: '01:00 PM - 03:30 PM',
        duration: '2h 30m',
        title: 'Secure X Vibe Coding (Session 2)',
        badge: 'Session 2',
      },
    ],
  },
  {
    id: 'ignite',
    title: 'Ignite Ideathon',
    shortTitle: 'Ignite Ideathon',
    category: 'Technical',
    venue: 'Seminar Hall 1',
    description: 'Innovation, product prototyping, and venture pitch presentations.',
    color: 'cyan',
    icon: Lightbulb,
    timeDisplay: 'Session 1: 10:15 AM - 12:00 PM | Session 2: 01:00 PM - 03:30 PM',
    durationDisplay: '1h 45m / 2h 30m',
    bars: [
      { id: 'ignite-b1', start: 10.25, end: 12.0, label: 'Ignite Ideathon (Session 1)', sessionName: 'Session 1', tooltipDuration: '1h 45m' },
      { id: 'ignite-b2', start: 13.0, end: 15.5, label: 'Ignite Ideathon (Session 2)', sessionName: 'Session 2', tooltipDuration: '2h 30m' },
    ],
    agendaEntries: [
      {
        id: 'ignite-ag1',
        startTime: 10.25,
        timeDisplay: '10:15 AM - 12:00 PM',
        duration: '1h 45m',
        title: 'Ignite Ideathon (Session 1)',
        badge: 'Session 1',
      },
      {
        id: 'ignite-ag2',
        startTime: 13.0,
        timeDisplay: '01:00 PM - 03:30 PM',
        duration: '2h 30m',
        title: 'Ignite Ideathon (Session 2)',
        badge: 'Session 2',
      },
    ],
  },

  // ── Two-Session Non-Technical Events (Session 1 & Session 2) ───────────────
  {
    id: 'mystery-hunt',
    title: 'Mystery Hunt',
    shortTitle: 'Mystery Hunt',
    category: 'Non-Technical',
    venue: 'Campus Arena',
    description: 'Solve a crime case using the clues and evidence given by the organizers.',
    color: 'lime',
    icon: Search,
    timeDisplay: 'Session 1: 10:15 AM - 12:00 PM | Session 2: 01:00 PM - 03:30 PM',
    durationDisplay: '1h 45m / 2h 30m',
    bars: [
      { id: 'mystery-hunt-b1', start: 10.25, end: 12.0, label: 'Mystery Hunt (Session 1)', sessionName: 'Session 1', tooltipDuration: '1h 45m' },
      { id: 'mystery-hunt-b2', start: 13.0, end: 15.5, label: 'Mystery Hunt (Session 2)', sessionName: 'Session 2', tooltipDuration: '2h 30m' },
    ],
    agendaEntries: [
      {
        id: 'mystery-hunt-ag1',
        startTime: 10.25,
        timeDisplay: '10:15 AM - 12:00 PM',
        duration: '1h 45m',
        title: 'Mystery Hunt (Session 1)',
        badge: 'Session 1',
      },
      {
        id: 'mystery-hunt-ag2',
        startTime: 13.0,
        timeDisplay: '01:00 PM - 03:30 PM',
        duration: '2h 30m',
        title: 'Mystery Hunt (Session 2)',
        badge: 'Session 2',
      },
    ],
  },
  {
    id: 'tune-trap',
    title: 'Tune Trap',
    shortTitle: 'Tune Trap',
    category: 'Non-Technical',
    venue: 'Open Air Theatre',
    description: 'Music trivia, audio reverse analysis, and rhythm challenges.',
    color: 'lime',
    icon: Music,
    timeDisplay: 'Session 1: 10:15 AM - 12:00 PM | Session 2: 01:00 PM - 03:30 PM',
    durationDisplay: '1h 45m / 2h 30m',
    bars: [
      { id: 'tune-trap-b1', start: 10.25, end: 12.0, label: 'Tune Trap (Session 1)', sessionName: 'Session 1', tooltipDuration: '1h 45m' },
      { id: 'tune-trap-b2', start: 13.0, end: 15.5, label: 'Tune Trap (Session 2)', sessionName: 'Session 2', tooltipDuration: '2h 30m' },
    ],
    agendaEntries: [
      {
        id: 'tune-trap-ag1',
        startTime: 10.25,
        timeDisplay: '10:15 AM - 12:00 PM',
        duration: '1h 45m',
        title: 'Tune Trap (Session 1)',
        badge: 'Session 1',
      },
      {
        id: 'tune-trap-ag2',
        startTime: 13.0,
        timeDisplay: '01:00 PM - 03:30 PM',
        duration: '2h 30m',
        title: 'Tune Trap (Session 2)',
        badge: 'Session 2',
      },
    ],
  },
  {
    id: 'ipl-bidverse',
    title: 'IPL Auction Arena',
    shortTitle: 'IPL Auction Arena',
    category: 'Non-Technical',
    venue: 'Seminar Hall 2',
    description: 'Strategic auction simulation and sports management battle.',
    color: 'lime',
    icon: Trophy,
    timeDisplay: 'Session 1: 10:15 AM - 12:00 PM | Session 2: 01:00 PM - 03:30 PM',
    durationDisplay: '1h 45m / 2h 30m',
    bars: [
      { id: 'ipl-b1', start: 10.25, end: 12.0, label: 'IPL Auction (Session 1)', sessionName: 'Session 1', tooltipDuration: '1h 45m' },
      { id: 'ipl-b2', start: 13.0, end: 15.5, label: 'IPL Auction (Session 2)', sessionName: 'Session 2', tooltipDuration: '2h 30m' },
    ],
    agendaEntries: [
      {
        id: 'ipl-ag1',
        startTime: 10.25,
        timeDisplay: '10:15 AM - 12:00 PM',
        duration: '1h 45m',
        title: 'IPL Auction Arena (Session 1)',
        badge: 'Session 1',
      },
      {
        id: 'ipl-ag2',
        startTime: 13.0,
        timeDisplay: '01:00 PM - 03:30 PM',
        duration: '2h 30m',
        title: 'IPL Auction Arena (Session 2)',
        badge: 'Session 2',
      },
    ],
  },
];

const startHour = 8.0;
const endHour = 16.0;
const totalHalfHours = Math.round((endHour - startHour) * 2); // 16 half-hours → 8:00 AM to 4:00 PM
const rowHeight = 52;

/** Continuous span an event occupies for lane packing (covers lunch gaps on multi-bar tracks). */
function getEventSpan(event) {
  const starts = event.bars.map((b) => b.start);
  const ends = event.bars.map((b) => b.end);
  return { start: Math.min(...starts), end: Math.max(...ends) };
}

/**
 * Greedy lane packing: put each event on the first row that has no time overlap.
 * Sequential events share a line; a new line opens only when that slot is taken.
 * Shorter events are placed first so plenary/breaks keep the top spine and
 * long parallel tracks open new rows instead of stealing those gaps.
 * Workshop is preferred above other same-span tracks (e.g. CTF).
 */
function assignTrackLanes(eventList) {
  const sorted = [...eventList].sort((a, b) => {
    const spanA = getEventSpan(a);
    const spanB = getEventSpan(b);
    const durA = spanA.end - spanA.start;
    const durB = spanB.end - spanB.start;
    if (durA !== durB) return durA - durB;
    if (spanA.start !== spanB.start) return spanA.start - spanB.start;
    if (a.category === 'Workshop' && b.category !== 'Workshop') return -1;
    if (b.category === 'Workshop' && a.category !== 'Workshop') return 1;
    return 0;
  });

  const laneIntervals = []; // laneIntervals[i] = [{ start, end }, ...]
  const laneById = {};

  const fitsLane = (occupied, span) =>
    occupied.every((block) => block.end <= span.start || span.end <= block.start);

  sorted.forEach((event) => {
    const span = getEventSpan(event);
    let lane = laneIntervals.findIndex((occupied) => fitsLane(occupied, span));
    if (lane === -1) {
      lane = laneIntervals.length;
      laneIntervals.push([]);
    }
    laneIntervals[lane].push(span);
    laneById[event.id] = lane;
  });

  return { laneById, laneCount: laneIntervals.length };
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
  const [hoveredEventId, setHoveredEventId] = useState(null);
  const [hoveredBarId, setHoveredBarId] = useState(null);

  // Category event counts (distinct events)
  const categoryCounts = useMemo(() => {
    return {
      ALL: events.length,
      TECHNICAL: events.filter((e) => e.category === 'Technical').length,
      'NON-TECHNICAL': events.filter((e) => e.category === 'Non-Technical').length,
      WORKSHOP: events.filter((e) => e.category === 'Workshop').length,
      CEREMONY: events.filter((e) => e.category === 'General').length,
    };
  }, []);

  const filteredEvents = useMemo(() => {
    if (selectedCategory === 'ALL') return events;
    if (selectedCategory === 'TECHNICAL') return events.filter((e) => e.category === 'Technical');
    if (selectedCategory === 'NON-TECHNICAL') return events.filter((e) => e.category === 'Non-Technical');
    if (selectedCategory === 'WORKSHOP') return events.filter((e) => e.category === 'Workshop');
    if (selectedCategory === 'CEREMONY') return events.filter((e) => e.category === 'General');
    return events;
  }, [selectedCategory]);

  // Pack all events into the fewest rows (non-overlapping share a line)
  const { laneById, laneCount } = useMemo(() => assignTrackLanes(events), []);

  const containerHeight = Math.max(laneCount, 1) * rowHeight;

  // Process chronological agenda groups
  const agendaGroups = useMemo(() => {
    const allEntries = [];
    filteredEvents.forEach((event) => {
      event.agendaEntries.forEach((entry) => {
        allEntries.push({
          ...entry,
          parentEvent: event,
          category: event.category,
          color: event.color,
          icon: event.icon,
          venue: event.venue,
          description: entry.description || event.description,
        });
      });
    });

    // Group entries by startTime
    const groupsMap = {};
    allEntries.forEach((entry) => {
      if (!groupsMap[entry.startTime]) {
        groupsMap[entry.startTime] = [];
      }
      groupsMap[entry.startTime].push(entry);
    });

    return Object.keys(groupsMap)
      .map(Number)
      .sort((a, b) => a - b)
      .map((startTime) => {
        const groupEntries = groupsMap[startTime];
        const isConcurrent = groupEntries.length > 1;

        let sessionSubtitle = '';
        if (startTime === 10.25) {
          sessionSubtitle = 'Morning Session & Full-Day Events';
        } else if (startTime === 12.0) {
          sessionSubtitle = 'Symposium Lunch Break';
        } else if (startTime === 13.0) {
          sessionSubtitle = 'Afternoon Session 2 & Event Continuations';
        }

        return {
          startTime,
          formattedStart: formatTimeRange(startTime),
          isConcurrent,
          count: groupEntries.length,
          subtitle: sessionSubtitle,
          entries: groupEntries,
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
          {/* Half-hour grid lines */}
          <div
            className="timeline-grid__lines"
            style={{ gridTemplateColumns: `repeat(${totalHalfHours}, minmax(0, 1fr))` }}
          >
            {[...Array(totalHalfHours)].map((_, i) => (
              <div key={i} className="timeline-grid__line" />
            ))}
          </div>
          {/* Render event bars & connectors */}
          {events.map((event) => {
            const isDimmed =
              selectedCategory !== 'ALL' &&
              ((selectedCategory === 'TECHNICAL' && event.category !== 'Technical') ||
                (selectedCategory === 'NON-TECHNICAL' && event.category !== 'Non-Technical') ||
                (selectedCategory === 'WORKSHOP' && event.category !== 'Workshop') ||
                (selectedCategory === 'CEREMONY' && event.category !== 'General'));

            const isEventHovered = hoveredEventId === event.id;
            const EventIcon = event.icon;
            const top = (laneById[event.id] ?? 0) * rowHeight;

            return (
              <div key={event.id} style={{ '--accent-color': `var(--${event.color})` }}>
                {/* Individual segment blocks for the event */}
                {event.bars.map((bar) => {
                  const widthPercent =
                    ((bar.end - bar.start) / (endHour - startHour)) * 100 - 0.4;
                  const leftPercent =
                    ((bar.start - startHour) / (endHour - startHour)) * 100;
                  const isThisBarHovered = hoveredBarId === bar.id;
                  const isBarActive = isEventHovered || isThisBarHovered;

                  return (
                    <div
                      key={bar.id}
                      className={`timeline-bar timeline-bar--${event.color} ${isDimmed ? 'timeline-bar--dimmed' : ''} ${isBarActive ? 'timeline-bar--hovered' : ''}`}
                      style={{
                        left: `${leftPercent}%`,
                        width: `${widthPercent}%`,
                        top: `${top}px`,
                        height: '42px',
                      }}
                      onMouseEnter={() => {
                        setHoveredEventId(event.id);
                        setHoveredBarId(bar.id);
                      }}
                      onMouseLeave={() => {
                        setHoveredEventId(null);
                        setHoveredBarId(null);
                      }}
                      tabIndex={0}
                      aria-label={`${bar.label || event.title}: ${formatTimeRange(bar.start)} to ${formatTimeRange(bar.end)}`}
                    >
                      <div className="timeline-bar__content">
                        <EventIcon className="timeline-bar__icon" />
                        <span className="timeline-bar__label">{bar.label || event.title}</span>
                      </div>

                      {/* Interactive Neon HUD Tooltip on Hover */}
                      {isThisBarHovered && (
                        <div className="timeline-bar__tooltip" role="tooltip">
                          <div className="tooltip-header">
                            <span className={`tooltip-tag tooltip-tag--${event.color}`}>
                              {event.category.toUpperCase()}
                            </span>
                            <span className="tooltip-duration">
                              {event.isFullDay
                                ? '4h 15m (Active)'
                                : bar.tooltipDuration || formatDuration(bar.start, bar.end)}
                            </span>
                          </div>
                          <div className="tooltip-title">
                            {event.isFullDay
                              ? event.title
                              : bar.sessionName
                                ? `${event.title} (${bar.sessionName})`
                                : event.title}
                          </div>
                          <div className="tooltip-meta">
                            <span className="tooltip-time">
                              <Clock size={12} />
                              {event.isFullDay
                                ? '10:15 AM - 03:30 PM (Break: 12:00 - 1:00 PM)'
                                : `${formatTimeRange(bar.start)} - ${formatTimeRange(bar.end)}`}
                            </span>
                            {event.venue && (
                              <span className="tooltip-venue">
                                <MapPin size={12} />
                                {event.venue}
                              </span>
                            )}
                          </div>
                          <p className="tooltip-desc">{event.description}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
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
                  {group.count} Parallel Events
                </span>
              )}
              {group.subtitle && (
                <span className="time-group__concurrency-tag" style={{ color: 'var(--cyan)', borderColor: 'rgba(0, 221, 242, 0.25)', background: 'rgba(0, 221, 242, 0.08)' }}>
                  {group.subtitle}
                </span>
              )}
            </div>

            <div className="time-group__cards">
              {group.entries.map((entry) => {
                const EntryIcon = entry.icon;
                return (
                  <div
                    className={`agenda-row agenda-row--${entry.color}`}
                    key={entry.id}
                  >
                    <div className="agenda-row__icon-wrap">
                      <EntryIcon size={18} />
                    </div>
                    <div className="agenda-row__details">
                      <div className="agenda-row__top">
                        <span className="agenda-row__title">{entry.title}</span>
                        <span className={`agenda-row__category-badge agenda-row__category-badge--${entry.color}`}>
                          {entry.badge || entry.category}
                        </span>
                      </div>
                      <div className="agenda-row__meta">
                        <span className="agenda-row__time">
                          <Clock size={12} />
                          {entry.timeDisplay} {entry.duration && !entry.timeDisplay.includes('(') ? `(${entry.duration})` : ''}
                        </span>
                      </div>
                      <p className="agenda-row__description">{entry.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Closing Wrap-up Card at 3:30 PM */}
        <div className="time-group">
          <span className="time-group__tick" style={{ background: 'var(--teal)', boxShadow: '0 0 10px var(--teal)' }} aria-hidden="true" />
          <div className="time-group__header">
            <span className="time-group__time-badge">03:30 PM</span>
            <span className="time-group__concurrency-tag" style={{ color: 'var(--teal)', borderColor: 'rgba(32, 178, 170, 0.25)', background: 'rgba(32, 178, 170, 0.08)' }}>
              Symposium Conclusion
            </span>
          </div>
          <div className="agenda-conclusion-card">
            <Clock className="agenda-conclusion-card__icon" size={20} />
            <div>
              <div className="agenda-conclusion-card__title">All Events Conclude</div>
              <p className="agenda-conclusion-card__desc">
                All competition tracks and workshops wrap up by 3:30 PM.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <section className="timeline-section" id="schedule">
      <div className="timeline-container">
        <HeadingBar level="h2" text="SCHEDULE" sectionIndex="04 / 05" />

        {/* Interactive Controls Bar: Category Filters & Desktop View Switcher */}
        <div className="timeline-controls">
          <div className="timeline-filters">
            {/* Desktop: buttons */}
            <div className="timeline-filters-buttons">
              <button
                type="button"
                className={`timeline-filter-btn ${selectedCategory === 'ALL' ? 'timeline-filter-btn--active' : ''}`}
                onClick={() => setSelectedCategory('ALL')}
              >
                All Events ({categoryCounts.ALL})
              </button>
              <button
                type="button"
                className={`timeline-filter-btn ${selectedCategory === 'TECHNICAL' ? 'timeline-filter-btn--active' : ''}`}
                onClick={() => setSelectedCategory('TECHNICAL')}
              >
                <span className="filter-dot filter-dot--cyan" /> Technical ({categoryCounts.TECHNICAL})
              </button>
              <button
                type="button"
                className={`timeline-filter-btn ${selectedCategory === 'NON-TECHNICAL' ? 'timeline-filter-btn--active' : ''}`}
                onClick={() => setSelectedCategory('NON-TECHNICAL')}
              >
                <span className="filter-dot filter-dot--lime" /> Non-Technical ({categoryCounts['NON-TECHNICAL']})
              </button>
              <button
                type="button"
                className={`timeline-filter-btn ${selectedCategory === 'WORKSHOP' ? 'timeline-filter-btn--active' : ''}`}
                onClick={() => setSelectedCategory('WORKSHOP')}
              >
                <span className="filter-dot filter-dot--violet" /> Workshop ({categoryCounts.WORKSHOP})
              </button>
              <button
                type="button"
                className={`timeline-filter-btn ${selectedCategory === 'CEREMONY' ? 'timeline-filter-btn--active' : ''}`}
                onClick={() => setSelectedCategory('CEREMONY')}
              >
                <span className="filter-dot filter-dot--teal" /> Plenary & Breaks ({categoryCounts.CEREMONY})
              </button>
            </div>
            {/* Mobile: dropdown */}
            <div className="timeline-filters-dropdown">
              <select
                className="timeline-filter-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                aria-label="Filter schedule by category"
              >
                <option value="ALL">All Events ({categoryCounts.ALL})</option>
                <option value="TECHNICAL">Technical ({categoryCounts.TECHNICAL})</option>
                <option value="NON-TECHNICAL">Non-Technical ({categoryCounts['NON-TECHNICAL']})</option>
                <option value="WORKSHOP">Workshop ({categoryCounts.WORKSHOP})</option>
                <option value="CEREMONY">Plenary & Breaks ({categoryCounts.CEREMONY})</option>
              </select>
              <span className="timeline-filter-chevron" aria-hidden="true">▾</span>
            </div>
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
      </div>
    </section>
  );
}
