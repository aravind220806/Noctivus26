import { HeadingBar } from '../ui/HeadingBar/HeadingBar';
import { HudPanel } from '../ui/HudPanel/HudPanel';
import { TickDivider } from '../ui/TickDivider/TickDivider';
import { crew } from '../../data/site.js';
import './CrewSection.css';

export function CrewSection() {
  return (
    <section className="crew-section" id="coordinators">
      <div className="crew-container">
        <HeadingBar level="h2" text="COORDINATORS" sectionIndex="05 / 05" />

        <div className="crew-grid" data-reveal>
          {crew.map(([role, description, contact]) => {
            const isEmail = contact.includes('@');
            const contactLink = isEmail ? `mailto:${contact}` : `tel:${contact.replace(/\s/g, '')}`;

            return (
              <article key={role} className="crew-card panel scanlines">
                <h3 className="crew-role">{role}</h3>
                <p className="crew-description">{description}</p>
                <a href={contactLink} className="crew-contact">
                  {contact}
                </a>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
