import React from 'react';
import { HeadingBar } from '../ui/HeadingBar/HeadingBar';

export function AboutSection() {
  return (
    <section className="about-section" id="about">
      <div className="about-container">
        
        {/* LEFT COLUMN: Heading, Manifesto */}
        <div className="about-left">
          <HeadingBar level="h2" text="ABOUT NOCTIVUS" sectionIndex="02 / 05" />
          
          <p className="about-manifesto-text">
            A student-built symposium hosted by Velammal Engineering College. Noctivus is the annual national-level symposium of the Department of CSE (Cyber Security).
          </p>

          <p className="about-desc-text">
            The event brings together technical contests, non-technical challenges, workshops, and campus-wide coordination for students who want to test ideas, sharpen instincts, and compete with purpose. Velammal Engineering College, Chennai, hosts Noctivus as a focused student platform for cyber security, computing, collaboration, and practical learning.
          </p>
        </div>

        {/* RIGHT COLUMN: Host College Details */}
        <div className="about-right">
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
        </div>

      </div>
    </section>
  );
}
