import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import './WebsiteIntro.css';

const TARGET_TEXT = 'NOCTIVUS';
const RANDOM_CHARS = '0123456789XYZA#%&$@!';

export function WebsiteIntro({ onComplete }) {
  const [phase, setPhase] = useState(0); // 0: ticking, 1: locked NOCTIVUS, 2: meta, 3: scroll/ready
  const [tickerTime, setTickerTime] = useState('00:03.00');
  const [titleDisplay, setTitleDisplay] = useState('00:00:00');
  const [isLocked, setIsLocked] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const handleFinish = useCallback(() => {
    if (isExiting) return;
    setIsExiting(true);
    try {
      sessionStorage.setItem('intro-done', 'true');
    } catch (e) {
      console.warn('sessionStorage is not accessible:', e);
    }
    setTimeout(() => {
      onComplete?.();
    }, 700);
  }, [isExiting, onComplete]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(media.matches);

    if (media.matches) {
      setTitleDisplay(TARGET_TEXT);
      setIsLocked(true);
      setPhase(3);
      return;
    }

    // Ticking countdown effect (2.8 seconds ticking):
    const startTime = Date.now();
    const duration = 2800;

    const tickInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, duration - elapsed);
      
      const secFormatted = String(Math.floor(remaining / 1000)).padStart(2, '0');
      const msFormatted = String(Math.floor((remaining % 1000) / 10)).padStart(2, '0');
      setTickerTime(`00:${secFormatted}.${msFormatted}`);

      if (remaining > 0) {
        // Scramble title text like a digital bomb lock sequence
        const progress = elapsed / duration;
        const revealCount = Math.floor(progress * TARGET_TEXT.length);
        
        let scrambled = '';
        for (let i = 0; i < TARGET_TEXT.length; i++) {
          if (i < revealCount) {
            scrambled += TARGET_TEXT[i];
          } else {
            scrambled += RANDOM_CHARS[Math.floor(Math.random() * RANDOM_CHARS.length)];
          }
        }
        setTitleDisplay(scrambled);
      } else {
        clearInterval(tickInterval);
        setTitleDisplay(TARGET_TEXT);
        setTickerTime('00:00.00');
        setIsLocked(true);
        setPhase(1);
      }
    }, 45);

    const t2 = setTimeout(() => setPhase(2), 3400);
    const t3 = setTimeout(() => setPhase(3), 4400);
    const t4 = setTimeout(() => handleFinish(), 7000);

    return () => {
      clearInterval(tickInterval);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [handleFinish]);

  // Dismiss intro on user interaction (scroll, tap, click, keypress)
  useEffect(() => {
    const handleDismiss = () => {
      handleFinish();
    };

    window.addEventListener('wheel', handleDismiss, { passive: true });
    window.addEventListener('touchmove', handleDismiss, { passive: true });
    window.addEventListener('click', handleDismiss);
    const handleKeyDown = (e) => {
      if (['Space', 'Enter', 'ArrowDown', 'Escape'].includes(e.code)) {
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('wheel', handleDismiss);
      window.removeEventListener('touchmove', handleDismiss);
      window.removeEventListener('click', handleDismiss);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleFinish]);

  return (
    <AnimatePresence>
      {!isExiting && (
        <motion.div
          className="rebellion-intro-overlay"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: 'easeInOut' }}
          role="region"
          aria-label="System Intro"
        >
          {/* Viewport Corner Registration Marks */}
          <div className="v-mark v-mark-tl" aria-hidden="true" />
          <div className="v-mark v-mark-tr" aria-hidden="true" />
          <div className="v-mark v-mark-bl" aria-hidden="true" />
          <div className="v-mark v-mark-br" aria-hidden="true" />

          {/* Viewport Left Pointer Glyph */}
          <span className="v-pointer-tl" aria-hidden="true">&gt;</span>

          {/* Viewport Edge Center Ticks */}
          <div className="v-tick v-tick-top" aria-hidden="true" />
          <div className="v-tick v-tick-bottom" aria-hidden="true" />
          <div className="v-tick v-tick-left" aria-hidden="true" />
          <div className="v-tick v-tick-right" aria-hidden="true" />

          {/* Main Centered Bounding Container */}
          <div className="rebellion-container">

            {/* Inner Bounding Box Top Corner Dots */}
            <motion.span
              className="inner-dot dot-tl"
              initial={{ opacity: 0 }}
              animate={{ opacity: phase >= 2 || prefersReducedMotion ? 1 : 0 }}
              transition={{ duration: 0.4 }}
            />
            <motion.span
              className="inner-dot dot-tr"
              initial={{ opacity: 0 }}
              animate={{ opacity: phase >= 2 || prefersReducedMotion ? 1 : 0 }}
              transition={{ duration: 0.4 }}
            />

            {/* Bomb Ticker Header */}
            <div className="rebellion-bomb-ticker">
              <span className="ticker-label">INITIATING SEQUENCE</span>
              <span className={`ticker-timer ${isLocked ? 'locked' : 'ticking'}`}>
                [{tickerTime}]
              </span>
            </div>

            {/* Main Title: NOCTIVUS */}
            <div className="rebellion-title-mask">
              <h1 className={`rebellion-title ${isLocked ? 'locked-title' : 'ticking-title'}`}>
                {titleDisplay}
              </h1>
            </div>

            {/* Inner Bounding Box Bottom Corner Dots */}
            <motion.span
              className="inner-dot dot-bl"
              initial={{ opacity: 0 }}
              animate={{ opacity: phase >= 2 || prefersReducedMotion ? 1 : 0 }}
              transition={{ duration: 0.4 }}
            />
            <motion.span
              className="inner-dot dot-br"
              initial={{ opacity: 0 }}
              animate={{ opacity: phase >= 2 || prefersReducedMotion ? 1 : 0 }}
              transition={{ duration: 0.4 }}
            />

            {/* Lower Information Row / Metadata */}
            <motion.div
              className="rebellion-metadata-row"
              initial={{ opacity: 0 }}
              animate={{ opacity: phase >= 2 || prefersReducedMotion ? 1 : 0 }}
              transition={{ duration: 0.7 }}
            >
              <span className="meta-item">SYS.TD RR-7712</span>
              <span className="meta-sep">||</span>
              <span className="meta-item">CORE: V3.3.1</span>
              <span className="meta-item">UNIT: CORE-01</span>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
