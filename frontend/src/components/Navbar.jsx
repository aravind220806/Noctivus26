import { useState, useEffect, useCallback } from 'react';
import './Navbar.css';

export default function Navbar({ activeSection, onNavigate, onRegister, onSelectEvent }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState(
    typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '/'
  );

  const isCoordinatorsPage = currentPath.startsWith('/coordinators');

  const handleScroll = useCallback(() => {
    setScrolled(window.scrollY > 25);
  }, []);

  useEffect(() => {
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Track route/path changes
  useEffect(() => {
    const updatePath = () => {
      if (typeof window !== 'undefined') {
        setCurrentPath(window.location.pathname.toLowerCase());
      }
    };
    window.addEventListener('popstate', updatePath);
    return () => window.removeEventListener('popstate', updatePath);
  }, []);

  // Auto-close mobile drawer when window is resized to desktop width
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 960 && mobileOpen) {
        setMobileOpen(false);
      }
    };
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, [mobileOpen]);

  // Lock body scroll when mobile menu is open
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

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && mobileOpen) {
        setMobileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen]);

  // Clean nav items: HOME -> ABOUT -> EVENTS -> TIMELINE -> COORDINATORS
  const navItems = [
    { id: 'home', label: 'HOME', href: '#home' },
    { id: 'about', label: 'ABOUT', href: '#about' },
    { id: 'events', label: 'EVENTS', href: '#events' },
    { id: 'schedule', label: 'TIMELINE', href: '#schedule' },
    { id: 'coordinators', label: 'COORDINATORS', href: '#coordinators' },
  ];

  const computeIsActive = (itemId) => {
    if (isCoordinatorsPage) {
      return itemId === 'coordinators';
    }
    return (activeSection || 'home') === itemId;
  };

  const handleNavClick = (e, item) => {
    e.preventDefault();
    setMobileOpen(false);

    if (item.id === 'coordinators') {
      if (isCoordinatorsPage) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.location.href = '/coordinators';
      }
      return;
    }

    if (isCoordinatorsPage) {
      window.location.href = `/${item.href}`;
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
      const target = document.querySelector(item.href);
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    } else if (item.href && item.href !== '#') {
      const target = document.querySelector(item.href);
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className={`noctivus-navbar ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="navbar-container">
        {/* Left: Noctivus Brand Logo */}
        <div className="navbar-brand-wrap">
          <a
            className="navbar-brand"
            href="/"
            onClick={(e) => {
              e.preventDefault();
              if (isCoordinatorsPage) {
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
        <nav className="menu" aria-label="Main Navigation">
          <ul className="menu-list">
            {navItems.map((item) => {
              const isActive = computeIsActive(item.id);

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

            {/* CTA Item inside desktop menu */}
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
        </nav>

        {/* Cyberpunk Mobile Hamburger Toggle Button */}
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

      {/* Mobile Drawer Overlay */}
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
                  const isActive = computeIsActive(item.id);

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
