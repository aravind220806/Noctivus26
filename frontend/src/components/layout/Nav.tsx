"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

const NAV_LINKS = [
  { label: "Home", href: "#home" },
  { label: "About", href: "#about" },
  { label: "Events", href: "#events" },
  { label: "Schedule", href: "#schedule" },
  { label: "Experience", href: "#experience" },
  { label: "FAQ", href: "#faq" },
  { label: "Contact", href: "#contact" },
] as const;

export function Nav() {
  const [activeSection, setActiveSection] = useState<string>("home");
  const [scrolled, setScrolled] = useState(false);
  const [visible, setVisible] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrollDirection, setScrollDirection] = useState<"up" | "down">("down");

  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const isPastHero = currentScrollY > 90;

      setScrolled(isPastHero);

      if (currentScrollY > lastScrollY.current + 5) {
        setScrollDirection("down");
        if (currentScrollY > 140) {
          setVisible(false);
        }
      } else if (currentScrollY < lastScrollY.current - 5) {
        setScrollDirection("up");
        setVisible(true);
      } else if (currentScrollY <= 90) {
        setVisible(true);
      }

      lastScrollY.current = currentScrollY;
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const sectionIds = NAV_LINKS.map((link) => link.href.substring(1));
    const observerOptions = {
      root: null,
      rootMargin: "-35% 0px -35% 0px",
      threshold: 0,
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    sectionIds.forEach((id) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    return () => {
      sectionIds.forEach((id) => {
        const element = document.getElementById(id);
        if (element) observer.unobserve(element);
      });
    };
  }, []);

  const showMobileNav = visible || scrollDirection === "up" || !scrolled;

  return (
    <>
      <header
        className={`fixed left-0 w-full z-50 px-4 sm:px-8 lg:px-12 transition-all duration-300 ease-out ${
          scrolled ? "top-2.5 sm:top-3.5" : "top-4 sm:top-5"
        }`}
        style={{
          transform: visible ? "translateY(0)" : "translateY(-135%)",
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? "auto" : "none",
          transitionProperty: "transform, opacity, top, padding",
          transitionDuration: "280ms",
          transitionTimingFunction: "cubic-bezier(0.25, 1, 0.5, 1)",
        }}
      >
        <div className="max-w-[1440px] mx-auto">
          <div
            className={`flex items-center justify-between border shadow-sm transition-all duration-300 ease-out ${
              scrolled
                ? "h-[58px] sm:h-[68px] px-3.5 sm:px-5 lg:px-8 rounded-[16px] sm:rounded-[18px] backdrop-blur-md"
                : "h-[66px] sm:h-[78px] px-4 sm:px-6 lg:px-10 rounded-[18px] sm:rounded-[22px]"
            }`}
            style={{
              backgroundColor: "var(--color-white-value, rgba(16, 24, 21, 0.75))",
              borderColor: "var(--border-color, rgba(45, 212, 191, 0.18))",
              boxShadow: "var(--shadow-lg, 0 16px 40px rgba(0, 0, 0, 0.45))",
            }}
          >
            <a
              href="#home"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("home")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="flex items-center gap-1.5 sm:gap-2 group focus-visible:outline-none rounded-sm min-w-0"
              aria-label="Noctivus '26 - home"
            >
              <img
                src="/logo.png"
                alt="Noctivus '26"
                width={1466}
                height={1073}
                style={{
                  width: scrolled ? "36px" : "44px",
                  height: "auto",
                  transition: "width 300ms ease-out",
                }}
                className="object-contain transition-transform duration-200 ease-out group-hover:-translate-y-[2px] shrink-0"
              />
              <span
                className={`font-medium tracking-wide transition-all duration-300 truncate ${
                  scrolled ? "text-base sm:text-lg lg:text-2xl" : "text-lg sm:text-xl lg:text-3xl"
                }`}
                style={{
                  fontFamily: "var(--font-samarkan-custom, var(--display-font))",
                  color: "var(--text-primary, #e2e8f0)",
                }}
              >
                NOCTIVUS <span style={{ color: "var(--color-teal-value, #2dd4bf)" }}>'26</span>
              </span>
            </a>

            <nav className="hidden lg:flex items-center gap-8 lg:gap-10" aria-label="Main navigation">
              {NAV_LINKS.map(({ label, href }) => {
                const targetId = href.substring(1);
                const isActive = activeSection === targetId;

                return (
                  <a
                    key={href}
                    href={href}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className={`font-sans text-[12.5px] uppercase tracking-[0.14em] relative py-1 transition-all duration-200 ease-out hover:-translate-y-[2px] focus-visible:outline-none rounded-sm ${
                      isActive ? "font-semibold" : "font-medium"
                    }`}
                    style={{
                      color: isActive ? "var(--text-primary, #e2e8f0)" : "var(--text-secondary, #94a3b8)",
                    }}
                  >
                    {label}

                    {isActive && (
                      <motion.span
                        layoutId="navActiveIndicator"
                        className="absolute -bottom-1 left-0 right-0 h-[2px] rounded-full"
                        style={{ backgroundColor: "var(--color-teal-value, #2dd4bf)" }}
                        transition={{
                          type: "spring",
                          stiffness: 380,
                          damping: 32,
                          mass: 0.8,
                        }}
                      />
                    )}
                  </a>
                );
              })}
            </nav>

            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
              <a
                href="#events"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById("events")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg transition-colors"
                style={{
                  backgroundColor: "var(--color-teal-value, #2dd4bf)",
                  color: "#0a0f0d",
                }}
              >
                Register
              </a>
              <button
                className="lg:hidden flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl border focus-visible:outline-none transition-colors duration-200 cursor-pointer"
                style={{
                  color: "var(--text-primary, #e2e8f0)",
                  borderColor: "var(--border-color, rgba(45, 212, 191, 0.25))",
                  backgroundColor: "rgba(16, 24, 21, 0.7)",
                  backdropFilter: "blur(8px)",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)"
                }}
                onClick={() => setMenuOpen(true)}
                aria-label="Open navigation menu"
                aria-expanded={menuOpen}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-50 flex flex-col justify-between p-8 sm:p-12 transition-all duration-300"
            style={{ backgroundColor: "var(--bg, #0b0d0c)", color: "var(--text-primary, #f1f1eb)" }}
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
          >
            <div
              className="flex items-center justify-between border-b pb-6"
              style={{ borderColor: "var(--border-color, rgba(241, 241, 235, 0.14))" }}
            >
              <div className="flex items-center gap-2">
                <img
                  src="/logo.png"
                  alt="Noctivus '26"
                  width={1466}
                  height={1073}
                  style={{ width: "42px", height: "auto" }}
                  className="object-contain"
                />
                <span
                  className="text-xl sm:text-2xl font-medium"
                  style={{
                    fontFamily: "var(--font-samarkan-custom, var(--display-font))",
                    color: "var(--text-primary, #f1f1eb)",
                  }}
                >
                  NOCTIVUS <span style={{ color: "var(--color-teal-value, #8fe3cf)" }}>'26</span>
                </span>
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Close navigation menu"
                className="w-10 h-10 flex items-center justify-center rounded-full border transition-colors duration-200 cursor-pointer"
                style={{
                  color: "var(--text-primary, #f1f1eb)",
                  borderColor: "var(--border-color, rgba(241, 241, 235, 0.14))",
                }}
              >
                ✕
              </button>
            </div>

            <nav className="flex flex-col items-start justify-center gap-6 my-auto" aria-label="Mobile navigation links">
              {NAV_LINKS.map(({ label, href }, index) => {
                const targetId = href.substring(1);
                const isActive = activeSection === targetId;
                return (
                  <div key={href} className="flex items-center gap-4">
                    <span className="text-xs font-sans font-semibold" style={{ color: "var(--color-teal-value, #8fe3cf)" }}>
                      0{index + 1}
                    </span>
                    <a
                      href={href}
                      onClick={(e) => {
                        e.preventDefault();
                        setMenuOpen(false);
                        document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className={`font-sans text-2xl sm:text-3xl font-medium tracking-wide transition-colors duration-200 ${
                        isActive ? "font-semibold" : ""
                      }`}
                      style={{ color: isActive ? "var(--text-primary, #f1f1eb)" : "var(--text-secondary, #a2a7a2)" }}
                    >
                      {label}
                    </a>
                  </div>
                );
              })}
            </nav>

            <div
              className="pt-6 border-t flex flex-col gap-4"
              style={{ borderColor: "var(--border-color, rgba(241, 241, 235, 0.14))" }}
            >
              <div
                className="flex items-center justify-between text-xs font-sans tracking-wide"
                style={{ color: "var(--text-muted, #707872)" }}
              >
                <span>© {new Date().getFullYear()} NOCTIVUS '26</span>
                <span>Dept of CSE (Cyber Security)</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default Nav;
