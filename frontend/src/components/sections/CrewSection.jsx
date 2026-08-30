import { HeadingBar } from '../ui/HeadingBar/HeadingBar';
import { HudPanel } from '../ui/HudPanel/HudPanel';
import { TickDivider } from '../ui/TickDivider/TickDivider';
import { crew } from '../../data/site.js';
import './CrewSection.css';

export function CrewSection() {
  return (
    <section className="crew-section" id="coordinators">
      <div className="crew-container">
        <HeadingBar>
          <h2>COORDINATORS</h2>
        </HeadingBar>
        <TickDivider />

        <div className="crew-grid" data-reveal>
          {crew.map(([role, description, contact]) => {
            const isEmail = contact.includes('@');
            const contactLink = isEmail ? `mailto:${contact}` : `tel:${contact.replace(/\s/g, '')}`;

            return (
              <HudPanel key={role} accent="teal">
                <article className="crew-card">
                  <h3 className="crew-role">{role}</h3>
                  <p className="crew-description">{description}</p>
                  <a href={contactLink} className="crew-contact">
                    {contact}
                  </a>
                </article>
              </HudPanel>
            );
          })}
        </div>
      </div>
    </section>
  );
}
