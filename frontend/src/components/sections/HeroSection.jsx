import Icon from '../Icon.jsx';
import SplitFlapCountdown from '../effects/SplitFlapCountdown.jsx';
import { site } from '../../data/site.js';

export function HeroSection({ onRegister }) {
  return (
    <section className="hero" id="top">
      <div className="page-width hero__inner">
        <div className="hero__main">
          <span className="hero__eyebrow">{site.eyebrow}</span>
          <img className="hero__logo" src="/brand/noctivus-emblem.webp" alt="Noctivus emblem" width="480" height="534" fetchPriority="high" />
          <h1>NOCTIVUS <span>'26</span></h1>
          <div className="hero__facts" aria-label="Event information">
            <span><small>WHEN</small>{site.date}</span>
            <span><small>WHERE</small>Velammal Engineering College · Chennai</span>
          </div>
          <SplitFlapCountdown target={site.eventStart} />
          <div className="hero__actions">
            <a className="button button-primary button-large" href="#events">Explore events <Icon name="arrow" /></a>
            <button className="button button-ghost button-large" type="button" onClick={onRegister}>Register now</button>
          </div>
        </div>
      </div>
      <a className="hero__scroll" href="#about"><span /> Discover Noctivus</a>
    </section>
  );
}
