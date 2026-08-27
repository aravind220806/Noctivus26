import React from 'react';
import { EventItem } from '../data/events';

interface EventCardProps {
  event: EventItem;
  onSelect: (event: EventItem) => void;
  index: number;
}

export const EventCard: React.FC<EventCardProps> = ({ event, onSelect, index }) => {
  const [month, day] = event.date.split(' ');

  return (
    <article
      className="relative group cursor-pointer transition-all duration-300"
      data-reveal
      style={{ '--reveal-order': index } as React.CSSProperties}
      onClick={() => onSelect(event)}
    >
      {/* Background teal glow-blob */}
      <div
        className="absolute -inset-3 rounded-3xl bg-[#2dd4bf]/15 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        aria-hidden="true"
      />

      {/* Main glass card container */}
      <div className="relative h-full flex flex-col rounded-[24px] overflow-hidden border border-[#2dd4bf]/20 bg-[#101815]/70 backdrop-blur-md shadow-2xl transition-all duration-300 group-hover:border-[#2dd4bf]/40 group-hover:-translate-y-1">
        
        {/* Top Full-bleed Image Banner */}
        <div
          className="relative w-full aspect-[16/10] overflow-hidden rounded-t-[24px]"
          style={{ background: event.bannerGradient }}
        >
          {/* Cyber grid / decorative glow overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(45,212,191,0.2),transparent_70%)] pointer-events-none" />
          
          {/* Event Code Badge */}
          <div className="absolute top-3.5 right-3.5 px-3 py-1 text-[10px] font-mono font-bold tracking-widest uppercase rounded-full border border-white/15 bg-black/50 text-[#2dd4bf] backdrop-blur-md">
            #{event.code}
          </div>

          {/* Abstract track watermark */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-25 group-hover:opacity-45 transition-opacity duration-300">
            <span className="text-7xl font-extrabold tracking-tighter text-[#2dd4bf]">
              {event.title.substring(0, 2).toUpperCase()}
            </span>
          </div>

          {/* Dark gradient transition into card body */}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#101815] via-[#101815]/70 to-transparent pointer-events-none" />
        </div>

        {/* Bottom Card Content */}
        <div className="p-5 sm:p-6 flex flex-col gap-4 flex-1 justify-between">
          
          <div className="flex gap-4 items-start">
            {/* Left Column: Big Date Block with vertical divider line */}
            <div className="flex flex-col items-center justify-center pr-4 border-r border-[#2dd4bf]/20 shrink-0 min-w-[54px]">
              <span className="text-xs font-bold uppercase tracking-wider text-[#2dd4bf]">
                {month || 'SEP'}
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold text-[#f1f1eb] leading-tight">
                {day || '26'}
              </span>
            </div>

            {/* Right Column: Location, Title & Description */}
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              {/* Location / Track row */}
              <div className="flex items-center gap-1.5 text-xs text-[#2dd4bf] font-medium truncate">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span className="truncate">{event.location} · {event.badgeText}</span>
              </div>

              {/* Event Title */}
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#e2e8f0] group-hover:text-[#2dd4bf] transition-colors duration-200 truncate">
                {event.title}
              </h3>

              {/* One-line Description */}
              <p className="text-xs sm:text-sm text-[#94a3b8] line-clamp-2 leading-relaxed">
                {event.description}
              </p>
            </div>
          </div>

          {/* Bottom Fee & Action Row */}
          <div className="pt-3.5 border-t border-white/10 flex items-center justify-between gap-3 mt-auto">
            <div className="flex items-center gap-1.5 text-xs text-[#94a3b8]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <span>Starts from <strong className="text-sm sm:text-base font-bold text-[#e2e8f0]">₹{event.fee}</strong></span>
            </div>

            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2dd4bf] group-hover:translate-x-1 transition-transform duration-200">
              <span>View & Register</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </span>
          </div>

        </div>

      </div>
    </article>
  );
};

export default EventCard;
