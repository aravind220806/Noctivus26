import { SectionTitle } from './SectionTitle';
import { crew } from '../../data/site.js';

export function CrewSection() {
  return (
    <section className="section crew-section" id="crew">
      <div className="page-width">
        <SectionTitle
          kicker="MEET THE CREW"
          title={
            <>
              Coordinators and
              <br />
              <span className="muted-title">organizing team.</span>
            </>
          }
        />
        <div className="crew-grid" data-reveal>
          {crew.map(([role, name, contact]) => (
            <article className="crew-card" key={role}>
              <span>{role}</span>
              <h3>{name}</h3>
              <a href={contact.includes('@') ? `mailto:${contact}` : `tel:${contact.replace(/\s/g, '')}`}>{contact}</a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
