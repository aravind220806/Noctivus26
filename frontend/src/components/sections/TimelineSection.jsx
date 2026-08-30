import { SectionTitle } from './SectionTitle';
import { timeline } from '../../data/site.js';

export function TimelineSection() {
  return (
    <section className="section schedule-section" id="timeline">
      <div className="page-width">
        <SectionTitle kicker="TIMELINE" title="Event-day schedule." description="The Noctivus day plan from reporting to awards." />
        <div className="timeline" data-reveal>
          {timeline.map(([time, title, description]) => (
            <div className="timeline-row" key={title}>
              <time>{time}</time>
              <span className="timeline-node" aria-hidden="true" />
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
