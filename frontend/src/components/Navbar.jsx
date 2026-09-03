import { useState, useEffect, useRef, useCallback } from 'react';
import './Navbar.css';

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

  // Proximity / Collision detection: check if Noctivus logo is getting close to navbar container
  const checkProximity = useCallback(() => {
    setScrolled(window.scrollY > 30);

    if (window.innerWidth <= 960) {
      setIsCollapsed(true);
      return;
    }

    if (logoRef.current && menuRef.current) {
      const logoRect = logoRef.current.getBoundingClientRect();
      const menuRect = menuRef.current.getBoundingClientRect();
      const gap = menuRect.left - logoRect.right;
      if (gap < 35) {
        setIsCollapsed(true);
      } else {
        setIsCollapsed(false);
      }
    } else {
      setIsCollapsed(window.innerWidth <= 960);
    }
  }, []);

  useEffect(() => {
    checkProximity();

    window.addEventListener('resize', checkProximity, { passive: true });
    window.addEventListener('scroll', checkProximity, { passive: true });

    let resizeObserver = null;
    if (headerRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => checkProximity());
      resizeObserver.observe(headerRef.current);
    }

    return () => {
      window.removeEventListener('resize', checkProximity);
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
    { id: 'schedule', label: 'TIMELINE', href: '#schedule' },
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

    if (item.eventId && onSelectEvent) {
      if (onNavigate) onNavigate('events');
      const target = document.querySelector('#events');
      if (target) target.scrollIntoView({ behavior: 'smooth' });
      onSelectEvent(item.eventId);
    } else if (item.category) {
      if (onNavigate) onNavigate('events', item.category);
      const target = document.querySelector('#events');
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    } else if (onNavigate && item.id && item.href && item.href !== '#') {
      onNavigate(item.id);
    } else if (item.href && item.href !== '#') {
      const target = document.querySelector(item.href);
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    }
    setMobileOpen(false);
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
                window.location.href = '/#home';
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
