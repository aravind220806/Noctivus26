import { TickDivider } from '../ui/TickDivider/TickDivider';
import { site } from '../../data/site.js';
import './FooterSection.css';

export function FooterSection() {
  return (
    <section className="footer-section" id="footer">
      <TickDivider />

      <div className="footer-container">
        <div className="footer-content">
          {/* Venue */}
          <div className="footer-block">
            <h4 className="footer-label">VENUE</h4>
            <p className="footer-text">{site.address}</p>
          </div>

          {/* Contact */}
          <div className="footer-block">
            <h4 className="footer-label">CONTACT</h4>
            <p className="footer-text">
              <a href={`mailto:${site.contactEmail}`} className="footer-link">{site.contactEmail}</a>
              <br />
              <a href={`tel:${site.contactPhone.replace(/\s/g, '')}`} className="footer-link">{site.contactPhone}</a>
            </p>
          </div>

          {/* Brochure */}
          <div className="footer-block">
            <h4 className="footer-label">BROCHURE</h4>
            <p className="footer-text">
              <a href={site.brochure?.href || '#'} className="footer-link">Download PDF</a>
            </p>
          </div>

          {/* Social */}
          <div className="footer-block">
            <h4 className="footer-label">FOLLOW</h4>
            <div className="footer-social">
              {Object.entries(site.social).map(([name, url]) => (
                <a href={url} target="_blank" rel="noopener noreferrer" key={name} className="footer-social-link">
                  {name}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Footer bottom */}
        <div className="footer-bottom">
          <p className="footer-copyright">© 2026 Noctivus '26. Department of CSE, Velammal Engineering College. All rights reserved.</p>
          <a href="#home" className="footer-back-to-top">Back to top ↑</a>
        </div>
      </div>
    </section>
  );
}
