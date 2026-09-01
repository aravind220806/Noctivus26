import { useState, useEffect, useRef, useCallback } from 'react';
import './Navbar.css';

export default function Navbar({ activeSection, onNavigate, onRegister, onSelectEvent }) {
  const [scrolled, setScrolled] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
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

  // Nav items: HOME -> ABOUT -> EVENTS (with category sub-filters) -> TIMELINE -> COORDINATORS
  const navItems = [
    { id: 'home', label: 'HOME', href: '#home' },
    { id: 'about', label: 'ABOUT', href: '#about' },
    {
      id: 'events',
      label: 'EVENTS',
      href: '#events',
      children: [
        { id: 'events-all', label: 'ALL EVENTS', href: '#events', category: 'All' },
        { id: 'events-tech', label: 'TECHNICAL', href: '#events', category: 'Technical' },
        { id: 'events-nontech', label: 'NON-TECHNICAL', href: '#events', category: 'Non-technical' },
        { id: 'events-workshop', label: 'WORKSHOP', href: '#events', category: 'Workshop' },
      ],
    },
    { id: 'schedule', label: 'TIMELINE', href: '#schedule' },
    { id: 'coordinators', label: 'COORDINATORS', href: '#coordinators' },
  ];

  const handleNavClick = (e, item) => {
    e.preventDefault();
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
    setActiveDropdown(null);
    setMobileOpen(false);
  };

  const handleDropdownToggle = (id, e) => {
    e.stopPropagation();
    setActiveDropdown((prev) => (prev === id ? null : id));
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
            href="#home"
            onClick={(e) => handleNavClick(e, { id: 'home', href: '#home' })}
          >
            <span className="brand-wordmark">NOCTIVUS</span>
            <span className="brand-badge">'26</span>
          </a>
        </div>

        {/* Desktop Menu Strip */}
        <div ref={menuRef} className="menu" aria-label="Main Navigation">
          <ul className="menu-list">
            {navItems.map((item) => {
              const hasChildren = Boolean(item.children?.length);
              const isActive = activeSection === item.id;
              const isDropdownOpen = activeDropdown === item.id;

              return (
                <li
                  key={item.id}
                  className={`menu-item ${hasChildren ? 'menu-has-children' : ''} ${
                    isDropdownOpen ? 'dropdown-open' : ''
                  } ${isActive ? 'active' : ''}`}
                  onMouseEnter={() => hasChildren && setActiveDropdown(item.id)}
                  onMouseLeave={() => hasChildren && setActiveDropdown(null)}
                >
                  {hasChildren ? (
                    <span
                      className="menu-sub"
                      onClick={(e) => handleDropdownToggle(item.id, e)}
                      role="button"
                      tabIndex={0}
                      aria-expanded={isDropdownOpen}
                    >
                      <span className="menu-sub-text">{item.label}</span>
                      <svg
                        className="caret-svg"
                        width="10"
                        height="6"
                        viewBox="0 0 10 6"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  ) : (
                    <a
                      href={item.href}
                      className={isActive ? 'active' : ''}
                      onClick={(e) => handleNavClick(e, item)}
                    >
                      {item.label}
                    </a>
                  )}

                  {/* Submenu Dropdown */}
                  {hasChildren && (
                    <div className={`menu-sub-list ${isDropdownOpen ? 'is-visible' : ''}`}>
                      <ul>
                        {item.children.map((child) => (
                          <li key={child.id}>
                            <a
                              href={child.href}
                              onClick={(e) => handleNavClick(e, child)}
                            >
                              <span>{child.label}</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
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
        <div className="cyber-mobile-drawer">
          <div className="drawer-inner">
            <ul className="drawer-menu-list">
              {navItems.map((item) => {
                const hasChildren = Boolean(item.children?.length);
                const isDropdownOpen = activeDropdown === item.id;
                const isActive = activeSection === item.id;

                return (
                  <li key={item.id} className="drawer-menu-item">
                    {hasChildren ? (
                      <div className="drawer-group">
                        <div
                          className="drawer-group-header"
                          onClick={(e) => handleDropdownToggle(item.id, e)}
                        >
                          <span className={`drawer-link ${isActive ? 'active' : ''}`}>{item.label}</span>
                          <span className={`drawer-arrow ${isDropdownOpen ? 'open' : ''}`}>▼</span>
                        </div>
                        {isDropdownOpen && (
                          <ul className="drawer-sub-list">
                            {item.children.map((child) => (
                              <li key={child.id}>
                                <a
                                  href={child.href}
                                  className="drawer-sub-link"
                                  onClick={(e) => handleNavClick(e, child)}
                                >
                                  {child.label}
                                </a>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : (
                      <a
                        href={item.href}
                        className={`drawer-link ${isActive ? 'active' : ''}`}
                        onClick={(e) => handleNavClick(e, item)}
                      >
                        {item.label}
                      </a>
                    )}
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
      )}
    </header>
  );
}
