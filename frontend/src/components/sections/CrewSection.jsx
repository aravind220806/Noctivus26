import React from 'react';
import { HeadingBar } from '../ui/HeadingBar/HeadingBar';
import './CrewSection.css';

export function CrewSection() {
  return (
    <section className="crew-section" id="coordinators">
      <div className="crew-container">
        <HeadingBar level="h2" text="COORDINATORS" sectionIndex="05 / 05" />

        {/* 3 Coordinator Cards across full width */}
        <div className="crew-cards-grid">
          {/* Faculty Coordinator */}
          <article className="cyber-crew-card">
            <div className="card-corner card-corner-tl" aria-hidden="true" />
            <div className="card-corner card-corner-tr" aria-hidden="true" />
            <div className="card-corner card-corner-bl" aria-hidden="true" />
            <div className="card-corner card-corner-br" aria-hidden="true" />
            
            <h3 className="crew-card-title">
              Faculty<br />Coordinator
            </h3>
            <p className="crew-card-role">Department of CSE (Cyber Security)</p>
            <a href="mailto:faculty@velammal.edu.in" className="crew-card-link">
              faculty@velammal.edu.in
            </a>
          </article>

          {/* Student Coordinator */}
          <article className="cyber-crew-card">
            <div className="card-corner card-corner-tl" aria-hidden="true" />
            <div className="card-corner card-corner-tr" aria-hidden="true" />
            <div className="card-corner card-corner-bl" aria-hidden="true" />
            <div className="card-corner card-corner-br" aria-hidden="true" />

            <h3 className="crew-card-title">
              Student<br />Coordinator
            </h3>
            <p className="crew-card-role">Noctivus Organizing Team</p>
            <a href="tel:+919876543210" className="crew-card-link">
              +91 98765 43210
            </a>
          </article>

          {/* Registration Desk */}
          <article className="cyber-crew-card">
            <div className="card-corner card-corner-tl" aria-hidden="true" />
            <div className="card-corner card-corner-tr" aria-hidden="true" />
            <div className="card-corner card-corner-bl" aria-hidden="true" />
            <div className="card-corner card-corner-br" aria-hidden="true" />

            <h3 className="crew-card-title">
              Registration<br />Desk
            </h3>
            <p className="crew-card-role">Payments and confirmations</p>
            <a href="mailto:noctivus26@velammal.edu.in" className="crew-card-link">
              noctivus26@velammal.edu.in
            </a>
          </article>
        </div>
      </div>
    </section>
  );
}
