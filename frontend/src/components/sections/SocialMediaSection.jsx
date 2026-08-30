import Icon from '../Icon.jsx';
import { SectionTitle } from './SectionTitle';
import { site } from '../../data/site.js';

export function SocialMediaSection() {
  return (
    <section className="section social-section" id="social">
      <div className="page-width">
        <SectionTitle
          kicker="SOCIAL MEDIA"
          title="Follow official updates."
          description="Announcements, schedule changes, and event-day media will be shared through the official channels."
        />
        <div className="social-link-grid" data-reveal>
          {Object.entries(site.social).map(([name, url]) => (
            <a href={url} target="_blank" rel="noopener noreferrer" key={name}>
              <span>{name}</span>
              <Icon name="external" />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
