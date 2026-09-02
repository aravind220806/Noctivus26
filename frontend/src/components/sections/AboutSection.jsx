import React from 'react';
import { HeadingBar } from '../ui/HeadingBar/HeadingBar';

export function AboutSection() {
  return (
    <section className="about-section" id="about">
      <div className="about-container">
        
        <HeadingBar level="h2" text="ABOUT NOCTIVUS" />
        
        <p className="about-desc-text">
          Built by students, for students. Noctivus brings together technical contests, non-technical challenges, and workshops — a space to test ideas, sharpen instincts, and compete with purpose.
        </p>

      </div>
    </section>
  );
}
