import { useState, useEffect, useRef, useCallback } from 'react';
import './Navbar.css';

// Update --navbar-height CSS variable to the actual rendered height of the navbar.
// Called on mount, on resize, and whenever the mobile drawer opens/closes.
function updateNavbarHeightVar(headerEl) {
  if (!headerEl) return;
  const h = headerEl.offsetHeight;
  document.documentElement.style.setProperty('--navbar-height', `${h}px`);
}


export default function Navbar({ activeSection, onNavigate, onRegister, onSelectEvent }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth <= 960;
    }
    return false;
  });

  const headerRef = useRef(null);
  const logoRef = useRef(null);
  const menuRef = useRef(null);

  const checkProximity = useCallback(() => {
    setScrolled(window.scrollY > 30);
    setIsCollapsed(window.innerWidth <= 960);
  }, []);

  useEffect(() => {
    checkProximity();
    // Measure actual navbar height immediately and update CSS variable
    updateNavbarHeightVar(headerRef.current);

    const handleResize = () => {
      checkProximity();
      updateNavbarHeightVar(headerRef.current);
    };

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('scroll', checkProximity, { passive: true });

    let resizeObserver = null;
    if (headerRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        checkProximity();
        updateNavbarHeightVar(headerRef.current);
      });
      resizeObserver.observe(headerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', checkProximity);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [checkProximity]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    // Drawer open/close may change the navbar's rendered height — re-measure
    updateNavbarHeightVar(headerRef.current);
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Clean nav items: HOME -> ABOUT -> EVENTS -> TIMELINE -> COORDINATORS
  const navItems = [
    { id: 'home', label: 'HOME', href: '#home' },
    { id: 'about', label: 'ABOUT', href: '#about' },
    { id: 'events', label: 'EVENTS', href: '#events' },
    { id: 'schedule', label: 'SCHEDULE', href: '#schedule' },
    { id: 'coordinators', label: 'COORDINATORS', href: '#coordinators' },
  ];

  const handleNavClick = (e, item) => {
    e.preventDefault();
    const isCoordinatorsPage = typeof window !== 'undefined' && window.location.pathname.toLowerCase().startsWith('/coordinators');

    if (item.id === 'coordinators') {
      if (isCoordinatorsPage) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.location.href = '/coordinators';
      }
      setMobileOpen(false);
      return;
    }

    if (isCoordinatorsPage) {
      window.location.href = `/${item.href}`;
      setMobileOpen(false);
      return;
    }

    if (item.id === 'home') {
      setMobileOpen(false);
      // rAF: let drawer close + ResizeObserver update --navbar-height before scroll
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      return;
    }

    // Close drawer first, then scroll on the next frame so --navbar-height
    // reflects the closed-navbar height before scroll-padding-top is applied.
    setMobileOpen(false);
    window.requestAnimationFrame(() => {
      if (item.eventId && onSelectEvent) {
        if (onNavigate) onNavigate('events');
        const target = document.getElementById('events') || document.querySelector('#events');
        if (target) target.scrollIntoView({ behavior: 'smooth' });
        onSelectEvent(item.eventId);
      } else if (item.category) {
        if (onNavigate) onNavigate('events', item.category);
        const target = document.getElementById('events') || document.querySelector('#events');
        if (target) target.scrollIntoView({ behavior: 'smooth' });
      } else if (onNavigate && item.id && item.href && item.href !== '#') {
        onNavigate(item.id);
      } else if (item.href && item.href !== '#') {
        const target = document.getElementById(item.id) || document.querySelector(item.href);
        if (target) target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  };

  return (
    <header
      ref={headerRef}
      className={`noctivus-navbar ${scrolled ? 'is-scrolled' : ''} ${isCollapsed ? 'is-collapsed-mode' : ''}`}
    >
      <div className="navbar-container">

        {/* Left: Noctivus Brand Logo */}
        <div ref={logoRef} className="navbar-brand-wrap">
          <a
            className="navbar-brand"
            href="/"
            onClick={(e) => {
              e.preventDefault();
              if (typeof window !== 'undefined' && window.location.pathname.toLowerCase().startsWith('/coordinators')) {
                window.location.href = '/';
              } else {
                handleNavClick(e, { id: 'home', href: '#home' });
              }
            }}
          >
            <span className="brand-wordmark">NOCTIVUS</span>
            <span className="brand-badge">'26</span>
          </a>
        </div>

        {/* Desktop Menu Strip */}
        <div ref={menuRef} className="menu" aria-label="Main Navigation">
          <ul className="menu-list">
            {navItems.map((item) => {
              const isActive = activeSection === item.id;

              return (
                <li
                  key={item.id}
                  className={`menu-item ${isActive ? 'active' : ''}`}
                >
                  <a
                    href={item.href}
                    className={isActive ? 'active' : ''}
                    onClick={(e) => handleNavClick(e, item)}
                  >
                    {item.label}
                  </a>
                </li>
              );
            })}

            {/* CTA Item inside menu */}
            <li className="menu-item menu-item-buy">
              <a
                href="#register"
                onClick={(e) => {
                  e.preventDefault();
                  onRegister?.();
                }}
              >
                REGISTER NOW
              </a>
            </li>
          </ul>
        </div>

        {/* Hamburger Button */}
        <button
          type="button"
          className={`cyber-hamburger-btn ${mobileOpen ? 'is-open' : ''}`}
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-label="Toggle navigation menu"
          aria-expanded={mobileOpen}
        >
          <span className="cyber-hamburger-inner">
            <span className="bar bar-1" />
            <span className="bar bar-2" />
            <span className="bar bar-3" />
          </span>
          <span className="hamburger-label">{mobileOpen ? 'CLOSE' : 'MENU'}</span>
        </button>
      </div>

      {/* Mobile / Collapsed Drawer */}
      {mobileOpen && (
        <>
          <div
            className="cyber-drawer-backdrop"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="cyber-mobile-drawer">
            <div className="drawer-inner">
              <ul className="drawer-menu-list">
                {navItems.map((item) => {
                  const isActive = activeSection === item.id;

                  return (
                    <li key={item.id} className="drawer-menu-item">
                      <a
                        href={item.href}
                        className={`drawer-link ${isActive ? 'active' : ''}`}
                        onClick={(e) => handleNavClick(e, item)}
                      >
                        {item.label}
                      </a>
                    </li>
                  );
                })}
              </ul>

              <div className="drawer-actions">
                <button
                  type="button"
                  className="drawer-cta-btn"
                  onClick={() => {
                    setMobileOpen(false);
                    onRegister?.();
                  }}
                >
                  REGISTER NOW
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </header>
  );
}
