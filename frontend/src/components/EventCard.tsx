import React from 'react';
import { EventItem } from '../data/events';

interface EventCardProps {
  event: EventItem;
  onSelect: (event: EventItem) => void;
  index: number;
}

export const EventCard: React.FC<EventCardProps> = ({ event, onSelect, index }) => {
  const isFeatured = event.featured;

  return (
    <article
      className={`relative group cursor-pointer transition-all duration-300 ${
        isFeatured ? 'md:col-span-2' : ''
      }`}
      data-reveal
      style={{ '--reveal-order': index } as React.CSSProperties}
      onClick={() => onSelect(event)}
    >
      {/* Background teal glow-blob */}
      <div
        className="absolute -inset-4 rounded-3xl bg-[#2dd4bf]/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        aria-hidden="true"
      />

      {/* Main glass card container */}
      <div className="relative h-full flex flex-col rounded-2xl overflow-hidden border border-[#2dd4bf]/15 bg-[#101815]/60 backdrop-blur-md shadow-xl transition-all duration-300 group-hover:border-[#2dd4bf]/35 group-hover:translate-y-[-2px]">
        
        {/* Top full-bleed image / banner */}
        <div className="relative w-full h-44 sm:h-52 overflow-hidden rounded-t-2xl" style={{ background: event.bannerGradient }}>
          {/* Cyber grid / decorative accent lines */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(45,212,191,0.15),transparent_70%)] pointer-events-none" />
          <div className="absolute top-4 right-4 px-3 py-1 text-[10px] font-mono font-bold tracking-widest uppercase rounded-full border border-white/10 bg-black/40 text-[#2dd4bf] backdrop-blur-sm">
            #{event.code}
          </div>

          {/* Abstract track graphic emblem */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30 group-hover:opacity-50 transition-opacity duration-300">
            <span className="text-6xl font-bold tracking-tighter text-[#2dd4bf]/40">
              {event.title.substring(0, 2).toUpperCase()}
            </span>
          </div>

          {/* Dark gradient overlay at bottom edge where it meets card body */}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#101815] via-[#101815]/60 to-transparent pointer-events-none" />
        </div>

        {/* Card Body */}
        <div className="flex-1 p-5 sm:p-6 flex flex-col justify-between gap-4">
          
          <div className="flex flex-col gap-3">
            {/* Small eyebrow row: date block + track badge side by side */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold tracking-wider uppercase rounded-md border border-[#2dd4bf]/25 bg-[#2dd4bf]/10 text-[#2dd4bf]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                {event.date}
              </span>
              <span className="px-2.5 py-1 text-[11px] font-medium tracking-wider uppercase rounded-md border border-white/10 bg-white/5 text-[#94a3b8]">
                {event.badgeText}
              </span>
            </div>

            {/* Event Title — bold clean sans */}
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#e2e8f0] group-hover:text-[#2dd4bf] transition-colors duration-200">
              {event.title}
            </h3>

            {/* One-line muted description */}
            <p className="text-sm text-[#94a3b8] line-clamp-2 leading-relaxed">
              {event.description}
            </p>
          </div>

          {/* Bottom row: Starts from fee + View Details button */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-3 mt-auto">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-widest text-[#94a3b8]">Starts from</span>
              <span className="text-xl font-bold text-[#e2e8f0]">₹{event.fee}</span>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(event);
              }}
              className="inline-flex items-center gap-2 bg-[#2dd4bf] hover:bg-[#8fe3cf] text-[#0a0f0d] font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all duration-200 group-hover:shadow-[0_0_20px_rgba(45,212,191,0.3)]"
            >
              <span>View Details</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>

        </div>

      </div>
    </article>
  );
};

export default EventCard;
