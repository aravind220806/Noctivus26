import Icon from '../Icon.jsx';
import { site } from '../../data/site.js';

const directionsUrl = 'https://www.google.com/maps/dir/?api=1&destination=Velammal+Engineering+College%2C+Surapet%2C+Chennai+600066';

export function ContactSection({ onRegister }) {
  return (
    <section className="section contact-section" id="contact">
      <div className="page-width contact-layout">
        <div data-reveal>
          <span className="kicker">CONTACT & REGISTRATION</span>
          <h2>
            Ready to
            <br />
            take part?
          </h2>
          <p>Choose your event, verify your participant details, and complete the registration through secure UPI payment.</p>
          <button className="button button-primary button-large" onClick={onRegister}>
            Register now <Icon name="arrow" />
          </button>
        </div>
        <div className="contact-card" data-reveal>
          <div>
            <span>
              <small>EMAIL</small>
              <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>
            </span>
            <Icon name="mail" />
          </div>
          <div>
            <span>
              <small>PHONE</small>
              <a href={`tel:${site.contactPhone.replace(/\s/g, '')}`}>{site.contactPhone}</a>
            </span>
            <Icon name="phone" />
          </div>
          <div>
            <span>
              <small>VENUE</small>
              <a href={directionsUrl} target="_blank" rel="noopener noreferrer">
                Velammal Engineering College
              </a>
            </span>
            <Icon name="pin" />
          </div>
          <p className="placeholder-note">
            Use the links above for registration questions, payment verification, and event-day updates.
          </p>
        </div>
      </div>
    </section>
  );
}
