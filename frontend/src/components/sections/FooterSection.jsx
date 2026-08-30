import Icon from '../Icon.jsx';
import { site } from '../../data/site.js';

export function FooterSection() {
  return (
    <footer>
      <div className="page-width">
        <div className="footer-grid">
          <a href="#top" className="footer-brand">
            NOCTIVUS<span>.</span>
            <small>'26</small>
          </a>
          <p>
            Department of CSE (Cyber Security)
            <br />
            Velammal Engineering College
          </p>
          <div className="footer-links">
            {Object.entries(site.social).map(([name, url]) => (
              <a href={url} target="_blank" rel="noopener noreferrer" key={name}>
                {name}
                <Icon name="external" size={13} />
              </a>
            ))}
          </div>
          <div className="footer-bottom">
            <span>© 2026 Noctivus. All rights reserved.</span>
            <a href="#top">Back to top ↑</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
