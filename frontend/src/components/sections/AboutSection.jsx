import React from 'react';
import { HeadingBar } from '../ui/HeadingBar/HeadingBar';
import { TickDivider } from '../ui/TickDivider/TickDivider';
import { HudCorners } from '../ui/HudCorners/HudCorners';

export function AboutSection() {
  const stats = [
    { value: '08', label: 'Events' },
    { value: '05', label: 'Technical events' },
    { value: '03', label: 'Non-technical events' },
    { value: '26 Sep', label: 'Event date' },
  ];

  return (
    <section className="about-section" id="about">
      <div className="about-container">
        
        {/* LEFT COLUMN: Heading, Manifesto, Showcase Image */}
        <div className="about-left">
          <HeadingBar level="h2" text="ABOUT NOCTIVUS" sectionIndex="02 / 05" />
          
          <p className="about-manifesto-text">
            A student-built symposium hosted by Velammal Engineering College. Noctivus is the annual national-level symposium of the Department of CSE (Cyber Security).
          </p>

          <p className="about-desc-text">
            The event brings together technical contests, non-technical challenges, workshops, and campus-wide coordination for students who want to test ideas, sharpen instincts, and compete with purpose. Velammal Engineering College, Chennai, hosts Noctivus as a focused student platform for cyber security, computing, collaboration, and practical learning.
          </p>
        </div>

        {/* RIGHT COLUMN: Host College Details & Statistics */}
        <div className="about-right">
          
          {/* Host Info Box */}
          <div className="about-host-box panel scanlines">
            <h3 className="about-host-title">HOST COLLEGE</h3>
            <p className="about-host-item">Velammal Engineering College</p>
            <p className="about-host-item" style={{ color: 'var(--muted)', fontSize: '0.95rem' }}>
              Department of CSE (Cyber Security)
            </p>
            <p className="about-host-item" style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
              Chennai, Tamil Nadu
            </p>
          </div>

          {/* Statistics Grid/List */}
          <div>
            <h3 className="about-host-title" style={{ marginBottom: '1.5rem' }}>SYMPOSIUM STATS</h3>
            
            <div className="about-stats-list">
              {stats.map((stat, idx) => (
                <div key={idx} className="about-stat-row">
                  <div className="about-stat-num">{stat.value}</div>
                  <div className="about-stat-label">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
