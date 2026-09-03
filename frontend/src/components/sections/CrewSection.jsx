import React from 'react';
import { HeadingBar } from '../ui/HeadingBar/HeadingBar';
import './CrewSection.css';

export function CrewSection() {
  const cards = [
    {
      id: 'faculty',
      title: 'Faculty\nCoordinator',
      role: 'Department of CSE (Cyber Security)',
      contact: 'hod.cyber@velammal.edu.in',
      contactType: 'email',
      href: '/coordinators#faculty',
    },
    {
      id: 'student',
      title: 'Student\nCoordinator',
      role: 'Noctivus Organizing Team',
      contact: '+91 98840 17375',
      contactType: 'phone',
      href: '/coordinators#student',
    },
    {
      id: 'registration',
      title: 'Registration\nDesk',
      role: 'Payments and confirmations',
      contact: 'noctivus26@velammal.edu.in',
      contactType: 'email',
      href: '/coordinators#registration',
    },
  ];

  return (
    <section className="crew-section" id="coordinators">
      <div className="crew-container">
        <HeadingBar level="h2" text="COORDINATORS" sectionIndex="05 / 05" />

        {/* 3 Coordinator Cards across full width */}
        <div className="crew-cards-grid">
          {cards.map((card) => (
            <article
              key={card.id}
              className="cyber-crew-card"
              onClick={() => {
                window.location.href = card.href;
              }}
              style={{ cursor: 'pointer' }}
            >
              <div className="card-corner card-corner-tl" aria-hidden="true" />
              <div className="card-corner card-corner-tr" aria-hidden="true" />
              <div className="card-corner card-corner-bl" aria-hidden="true" />
              <div className="card-corner card-corner-br" aria-hidden="true" />

              <div className="crew-card-top-info">
                <h3 className="crew-card-title">
                  {card.title.split('\n').map((line, i) => (
                    <React.Fragment key={i}>
                      {line}
                      {i === 0 && <br />}
                    </React.Fragment>
                  ))}
                </h3>
                <p className="crew-card-role">{card.role}</p>
                {card.contactType === 'email' ? (
                  <a
                    href={`mailto:${card.contact}`}
                    className="crew-card-link"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {card.contact}
                  </a>
                ) : (
                  <a
                    href={`tel:${card.contact.replace(/\s+/g, '')}`}
                    className="crew-card-link"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {card.contact}
                  </a>
                )}
              </div>

              {/* VIEW COORDINATORS Button */}
              <div className="crew-card-action">
                <a
                  href={card.href}
                  className="crew-view-btn"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="crew-btn-corner tl" aria-hidden="true" />
                  <span className="crew-btn-corner tr" aria-hidden="true" />
                  <span className="crew-btn-corner bl" aria-hidden="true" />
                  <span className="crew-btn-corner br" aria-hidden="true" />
                  <span className="crew-btn-text">VIEW COORDINATORS</span>
                  <span className="crew-btn-arrow" aria-hidden="true">→</span>
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
