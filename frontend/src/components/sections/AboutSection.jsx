import { SectionTitle } from './SectionTitle';
import { StatsSection } from './StatsSection';

export function AboutSection() {
  return (
    <section className="section about" id="about">
      <div className="page-width">
        <SectionTitle
          kicker="ABOUT NOCTIVUS"
          title={
            <>
              A student-built symposium
              <br />
              <span className="muted-title">hosted by Velammal Engineering College.</span>
            </>
          }
        />
        <div className="about-grid">
          <div className="about-copy" data-reveal>
            <p className="lead">
              Noctivus is the annual national-level symposium of the Department of CSE (Cyber Security), Velammal Engineering College.
            </p>
            <p>
              The event brings together technical contests, non-technical challenges, workshops, and campus-wide coordination for students who want to test ideas, sharpen instincts, and compete with purpose.
            </p>
            <p>
              Velammal Engineering College, Chennai, hosts Noctivus as a focused student platform for cyber security, computing, collaboration, and practical learning.
            </p>
          </div>
          <div className="about-manifesto" data-reveal>
            <span>HOST COLLEGE</span>
            <strong>Velammal Engineering College</strong>
            <strong>Department of CSE (Cyber Security)</strong>
            <strong>Chennai, Tamil Nadu</strong>
          </div>
        </div>
        <figure className="about-showcase" data-reveal>
          <div className="about-showcase__image">
            <img src="/images/noctivus-students.webp" alt="Students gathered at Noctivus" width="1400" height="1050" loading="lazy" decoding="async" />
          </div>
          <figcaption>
            <span className="kicker">THE NOCTIVUS EXPERIENCE</span>
            <strong>
              Built by students.
              <br />
              Driven by curiosity.
            </strong>
            <p>A day shaped by collaboration, competition, and the people bold enough to show up and take part.</p>
          </figcaption>
        </figure>
        <StatsSection />
      </div>
    </section>
  );
}
