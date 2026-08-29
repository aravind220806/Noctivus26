import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import './PillNav.css';

export default function PillNav({
  logo,
  logoAlt = 'Noctivus emblem',
  items = [],
  activeHref,
  className = '',
  ease = 'power3.easeOut',
  baseColor = '#101427',
  pillColor = 'rgba(255, 255, 255, 0.08)',
  hoveredPillTextColor = '#ffffff',
  pillTextColor,
  onMobileMenuClick,
  initialLoadAnimation = true,
  ctaLabel,
  onCtaClick
}) {
  const resolvedPillTextColor = pillTextColor ?? baseColor;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const circleRefs = useRef([]);
  const timelines = useRef([]);
  const activeTweens = useRef([]);
  const logoRef = useRef(null);
  const logoImageRef = useRef(null);
  const menuButtonRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const navItemsRef = useRef(null);

  useEffect(() => {
    const context = gsap.context(() => {
      const layout = () => {
        circleRefs.current.forEach((circle, index) => {
          if (!circle?.parentElement) return;
          const pill = circle.parentElement;
          const { width, height } = pill.getBoundingClientRect();
          if (!width || !height) return;

          const radius = ((width * width) / 4 + height * height) / (2 * height);
          const diameter = Math.ceil(2 * radius) + 2;
          const delta = Math.ceil(radius - Math.sqrt(Math.max(0, radius * radius - (width * width) / 4))) + 1;
          const label = pill.querySelector('.pill-nav__label');
          const hoverLabel = pill.querySelector('.pill-nav__label--hover');

          gsap.set(circle, { width: diameter, height: diameter, bottom: -delta, xPercent: -50, scale: 0, transformOrigin: `50% ${diameter - delta}px` });
          gsap.set(label, { y: 0 });
          gsap.set(hoverLabel, { y: height + 12, opacity: 0 });
          timelines.current[index]?.kill();
          timelines.current[index] = gsap.timeline({ paused: true })
            .to(circle, { scale: 1.18, duration: 1.4, ease, overwrite: 'auto' }, 0)
            .to(label, { y: -(height + 8), duration: 1.4, ease, overwrite: 'auto' }, 0)
            .to(hoverLabel, { y: 0, opacity: 1, duration: 1.4, ease, overwrite: 'auto' }, 0);
        });
      };

      layout();
      window.addEventListener('resize', layout);
      document.fonts?.ready?.then(layout).catch(() => {});
      gsap.set(mobileMenuRef.current, { autoAlpha: 0, y: 10 });

      if (initialLoadAnimation) {
        if (logoRef.current) gsap.fromTo(logoRef.current, { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.55, ease });
        gsap.fromTo(navItemsRef.current, { y: -10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, delay: 0.12, ease });
      }

      return () => window.removeEventListener('resize', layout);
    });
    return () => context.revert();
  }, [items, ease, initialLoadAnimation]);

  const play = (index, direction) => {
    const timeline = timelines.current[index];
    if (!timeline) return;
    activeTweens.current[index]?.kill();
    activeTweens.current[index] = timeline.tweenTo(direction ? timeline.duration() : 0, { duration: direction ? 0.3 : 0.2, ease, overwrite: 'auto' });
  };

  const toggleMobileMenu = () => {
    const open = !isMobileMenuOpen;
    setIsMobileMenuOpen(open);
    const lines = menuButtonRef.current?.querySelectorAll('.pill-nav__hamburger-line');
    if (lines) {
      gsap.to(lines[0], { rotation: open ? 45 : 0, y: open ? 7 : 0, duration: 0.25, ease });
      gsap.to(lines[1], { opacity: open ? 0 : 1, duration: 0.18, ease });
      gsap.to(lines[2], { rotation: open ? -45 : 0, y: open ? -7 : 0, duration: 0.25, ease });
    }
    gsap.to(mobileMenuRef.current, { autoAlpha: open ? 1 : 0, y: open ? 0 : 10, duration: open ? 0.28 : 0.18, ease, overwrite: 'auto' });
    onMobileMenuClick?.();
  };

  const closeMobileMenu = () => {
    if (isMobileMenuOpen) toggleMobileMenu();
  };

  const cssVars = { '--base': baseColor, '--pill-bg': pillColor, '--hover-text': hoveredPillTextColor, '--pill-text': resolvedPillTextColor };

  return (
    <header className={`pill-nav-container ${className}`} style={cssVars}>
      <nav className="pill-nav" aria-label="Primary navigation">
        {logo && <a className="pill-nav__logo" href="#top" aria-label="Noctivus home" ref={logoRef} onMouseEnter={() => gsap.to(logoImageRef.current, { rotate: '+=360', duration: 0.35, ease, overwrite: 'auto' })}>
          <img src={logo} alt={logoAlt} ref={logoImageRef} />
        </a>}

        <div className="pill-nav__items desktop-only" ref={navItemsRef}>
          <ul className="pill-nav__list">
            {items.map((item, index) => <li key={item.href}>
              <a href={item.href} className={`pill-nav__pill${activeHref === item.href ? ' is-active' : ''}`} aria-label={item.ariaLabel || item.label} aria-current={activeHref === item.href ? 'page' : undefined} onMouseEnter={() => play(index, true)} onMouseLeave={() => play(index, false)}>
                <span className="pill-nav__circle" aria-hidden="true" ref={(element) => { circleRefs.current[index] = element; }} />
                <span className="pill-nav__label-stack"><span className="pill-nav__label">{item.label}</span><span className="pill-nav__label pill-nav__label--hover" aria-hidden="true">{item.label}</span></span>
              </a>
            </li>)}
          </ul>
        </div>

        {ctaLabel && <button className="pill-nav__cta desktop-only" type="button" onClick={onCtaClick}>{ctaLabel}<span aria-hidden="true">↗</span></button>}
        <button className="pill-nav__menu mobile-only" type="button" aria-label="Toggle navigation menu" aria-expanded={isMobileMenuOpen} onClick={toggleMobileMenu} ref={menuButtonRef}><span className="pill-nav__hamburger-line" /><span className="pill-nav__hamburger-line" /><span className="pill-nav__hamburger-line" /></button>
      </nav>

      <div className="pill-nav__mobile-menu mobile-only" ref={mobileMenuRef}>
        <ul>{items.map((item) => <li key={item.href}><a href={item.href} className={activeHref === item.href ? 'is-active' : ''} onClick={closeMobileMenu}>{item.label}</a></li>)}</ul>
        {ctaLabel && <button type="button" onClick={() => { closeMobileMenu(); onCtaClick?.(); }}>{ctaLabel} <span aria-hidden="true">↗</span></button>}
      </div>
    </header>
  );
}
