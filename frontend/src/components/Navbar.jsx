import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import LineSidebar from './LineSidebar.jsx';

const navLinks = [
  { label: 'Home', href: '/#hero' },
  { label: 'About', href: '/#about' },
  { label: 'Events', href: '/#events' },
  { label: 'Timeline', href: '/#timeline' },
  { label: 'Contact', href: '/#contact' },
];

const themes = ['brand', 'light'];
const themeLabels = {
  brand: { label: 'Navy', dot: '#F5A124' },
  light: { label: 'Light', dot: '#FF8C00' },
};

function applyTheme(theme) {
  if (theme === 'brand') {
    document.documentElement.setAttribute('data-theme', 'brand');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

export default function Navbar() {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState('hero');
  const [activeSectionIsDark, setActiveSectionIsDark] = useState(true);
  const [theme, setTheme] = useState('light');

  if (pathname === '/work' || pathname?.startsWith('/work')) {
    return null;
  }

  /* ── Theme restore ── */
  useEffect(() => {
    const saved = localStorage.getItem('nk-theme');
    if (saved && themes.includes(saved)) {
      setTheme(saved);
      applyTheme(saved);
    } else {
      applyTheme('light');
    }
  }, []);

  /* ── Active section via IntersectionObserver ── */
  useEffect(() => {
    const ids = navLinks.map((l) => l.href.split('#')[1]);
    const observers = [];

    ids.forEach((id) => {
      const el = document.getElementById(id) || document.querySelector(`#${id}`) || (id === 'hero' ? document.getElementById('top') : null);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActive(id);
            setActiveSectionIsDark(el.closest('.theme-section-dark') !== null || true);
          }
        },
        { rootMargin: '-50% 0px -49% 0px' }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const close = () => setMenuOpen(false);

  const isCurrentSectionDark = activeSectionIsDark || active === '' || active === 'hero';
  const showDarkLogo = theme === 'light' && (!isCurrentSectionDark || menuOpen);
  const logoSrc = showDarkLogo ? '/brand/noctivus-emblem.webp' : '/brand/noctivus-emblem.webp';
  const isHeaderInverse = theme === 'light' && isCurrentSectionDark && !menuOpen;

  const activeIndex = navLinks.findIndex((l) => l.href.split('#')[1] === active);

  const handleNavClick = (index) => {
    const target = navLinks[index];
    if (!target) return;
    const targetId = target.href.split('#')[1];
    const el = document.getElementById(targetId) || (targetId === 'hero' ? document.getElementById('top') : null);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.location.href = target.href;
    }
  };

  return (
    <>
      {/* ── Desktop Fixed LineSidebar ── */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50 hidden md:block desktop-sidebar-wrap">
        <LineSidebar
          items={navLinks.map((l) => l.label)}
          accentColor="#F5A124"
          textColor={isCurrentSectionDark ? '#E2E8F0' : '#475569'}
          markerColor={isCurrentSectionDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(15, 23, 42, 0.35)'}
          showIndex
          showMarker
          proximityRadius={100}
          maxShift={24}
          falloff="smooth"
          markerLength={45}
          markerGap={0}
          tickScale={0.5}
          scaleTick
          itemGap={22}
          fontSize={0.9}
          smoothing={100}
          defaultActive={0}
          active={activeIndex >= 0 ? activeIndex : 0}
          onItemClick={(index) => handleNavClick(index)}
        />
      </div>

      {/* ── Mobile: top bar ─────────────────────────────────── */}
      <header className={`mbar ${isHeaderInverse ? 'vnav-inverse' : ''}`}>
        <button
          id="hamburger-btn"
          className="mbar-burger"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          <span className={`mbar-line${menuOpen ? ' mbar-line--top-open' : ''}`} />
          <span className={`mbar-line${menuOpen ? ' mbar-line--mid-open' : ''}`} />
          <span className={`mbar-line${menuOpen ? ' mbar-line--bot-open' : ''}`} />
        </button>

        <a href="/" className="flex items-center gap-5 brand-mobile-logo">
          <span className="font-inter font-bold text-2xl tracking-tighter text-fg">
            <span className="text-accent" style={{ color: '#F5A124' }}>NOCTIVUS</span> '26
          </span>
          <img
            src={logoSrc}
            alt="Noctivus Logo"
            className="w-10 h-10 object-contain"
            style={{ width: '36px', height: '36px', objectFit: 'contain' }}
          />
        </a>
      </header>

      {/* ── Mobile menu overlay ──────────────────────────────── */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="mob-overlay"
          >
            <nav className="mob-nav">
              {navLinks.map((link, i) => (
                <motion.a
                  key={link.label}
                  href={link.href}
                  onClick={(e) => {
                    e.preventDefault();
                    close();
                    handleNavClick(i);
                  }}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07, duration: 0.25 }}
                  className="mob-link"
                >
                  {link.label}
                </motion.a>
              ))}

              <motion.a
                href="#events"
                onClick={(e) => {
                  e.preventDefault();
                  close();
                  const el = document.getElementById('events');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.38 }}
                className="btn-primary mt-4 self-start"
                id="mobile-cta"
              >
                Register Now
              </motion.a>
            </nav>

            <p className="text-label text-fg-dim mt-auto mb-8 px-8">
              // Noctivus '26 — Velammal Engineering College
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
