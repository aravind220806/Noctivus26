import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HudCorners } from '../ui/HudCorners/HudCorners';
import TextType from './TextType';
import './WebsiteIntro.css';

const INIT_TEXT = [
  'NOCTIVUS \'26',
  'INITIALIZING SYSTEM',
  'LOADING INTERFACE...'
];

export function WebsiteIntro({ onComplete }) {
  const [phase, setPhase] = useState('typing'); // 'typing' | 'reveal' | 'done'
  const [isDone, setIsDone] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(media.matches);

    if (media.matches) {
      setPhase('done');
      setIsDone(true);
      return;
    }

    // 3-second sequence:
    // 0-1.5s: TextType typing animation
    // 1.5s: Transition to reveal phase (fade out text, show GIF)
    // 1.5-3s: Show identity reveal
    // 3s: Complete

    const timer1 = setTimeout(() => {
      setPhase('reveal');
    }, 1500);

    const timer2 = setTimeout(() => {
      setPhase('done');
      setIsDone(true);
    }, 3000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  // Handle final overlay transition end
  const handleExitComplete = () => {
    try {
      sessionStorage.setItem('intro-done', 'true');
    } catch (e) {
      console.warn('sessionStorage is not accessible:', e);
    }
    onComplete();
  };

  return (
    <AnimatePresence onExitComplete={handleExitComplete}>
      {!isDone && (
        <motion.div
          key="intro-panel"
          className="intro-overlay scanlines"
          initial={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100%' }}
          transition={{ duration: prefersReducedMotion ? 0.5 : 1.2, ease: 'easeInOut' }}
        >
          {/* Viewport corner accents */}
          <span className="intro-corner intro-corner--tl" aria-hidden="true" />
          <span className="intro-corner intro-corner--tr" aria-hidden="true" />
          <span className="intro-corner intro-corner--bl" aria-hidden="true" />
          <span className="intro-corner intro-corner--br" aria-hidden="true" />

          <div className="intro-content-container">

            {/* Center GIF visual panel — fades in at 1.5s */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: phase === 'reveal' || phase === 'done' ? 1 : 0 }}
              transition={{ duration: 0.4 }}
            >
              <HudCorners accent="cyan">
                <div className="intro-visual-panel panel">
                  <img
                    className="intro-gif"
                    src="/ascii-dither-export.gif"
                    alt="Noctivus System Logo Animation"
                    width="320"
                    height="312"
                  />
                </div>
              </HudCorners>
            </motion.div>

            {/* Terminal typing panel — fades out at 1.5s */}
            <motion.div
              className="intro-terminal-panel"
              initial={{ opacity: 1 }}
              animate={{ opacity: phase === 'typing' ? 1 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="intro-log-list">
                {/* TextType component for initialization sequence */}
                {phase === 'typing' && (
                  <TextType
                    text={INIT_TEXT}
                    typingSpeed={45}
                    pauseDuration={400}
                    deletingSpeed={25}
                    loop={false}
                    showCursor={true}
                    cursorCharacter="|"
                    className="intro-text-type"
                  />
                )}
              </div>
            </motion.div>

            {/* Reveal text identity — shows at 1.5s */}
            {(phase === 'reveal' || phase === 'done') && (
              <motion.div
                className="intro-identity-reveal"
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <h1 className="intro-title">NOCTIVUS '26</h1>
                <p className="intro-meta">26 SEPTEMBER 2026</p>
                <p className="intro-meta" style={{ color: 'var(--muted)' }}>
                  Department of CSE (Cyber Security)
                </p>
              </motion.div>
            )}

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
