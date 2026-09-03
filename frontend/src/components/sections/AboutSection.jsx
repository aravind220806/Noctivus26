import React from 'react';
import { HeadingBar } from '../ui/HeadingBar/HeadingBar';

export function AboutSection() {
  return (
    <section className="about-section" id="about">
      <div className="about-container">
        
        <HeadingBar level="h2" text="ABOUT NOCTIVUS" />
        
          <p className="about-manifesto-text">
              A student-built symposium hosted by Velammal Engineering College. Noctivus is the annual national-level symposium of the Department of CSE (Cyber Security).
          </p>
  
          <p className="about-desc-text">
              The event brings together technical contests, non-technical challenges, workshops, and campus-wide coordination for students who want to test ideas, sharpen instincts, and compete with purpose. Velammal Engineering College, Chennai, hosts Noctivus as a focused student platform for cyber security, computing, collaboration, and practical learning.
          </p>

      </div>
    </section>
  );
}
