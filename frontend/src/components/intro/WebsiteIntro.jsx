import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HudCorners } from '../ui/HudCorners/HudCorners';
import TextType from './TextType';
import './WebsiteIntro.css';

const INIT_TEXT = [
  'SYSTEM BOOTING...',
  'INITIALIZING NEURAL NET',
  'AWAKENING CORE SEQUENCE',
  'THE DRAGON HAS BEEN AWAKENED'
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

    // Boot sequence (slow reveal):
    // 0-6s: TextType boot sequence with dragon awakening (slow typing)
    // 6s: Transition to reveal phase (fade out text, fade in GIF)
    // 6-14s: GIF fades in slowly, centered and big
    // 14s: Complete and transition to hero

    const timer1 = setTimeout(() => {
      setPhase('reveal');
    }, 6000);

    const timer2 = setTimeout(() => {
      setPhase('done');
      setIsDone(true);
    }, 14000);

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
          <div className="intro-content-container">

            {/* Boot sequence text — typing phase */}
            <motion.div
              className="intro-boot-text"
              initial={{ opacity: 1 }}
              animate={{ opacity: phase === 'typing' ? 1 : 0 }}
              transition={{ duration: 0.8 }}
            >
              {phase === 'typing' && (
                <TextType
                  text={INIT_TEXT}
                  typingSpeed={150}
                  pauseDuration={1800}
                  deletingSpeed={50}
                  loop={false}
                  showCursor={true}
                  cursorCharacter="|"
                  className="intro-text-type-large"
                />
              )}
            </motion.div>

            {/* Dragon GIF — fades in very slowly at 6s, big and centered */}
            <motion.div
              className="intro-dragon-panel"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: phase === 'reveal' || phase === 'done' ? 1 : 0, scale: phase === 'reveal' || phase === 'done' ? 1 : 0.8 }}
              transition={{ duration: 5, ease: 'easeInOut' }}
            >
              <img
                className="intro-dragon-gif"
                src="/ascii-dither-export.gif"
                alt="Noctivus Dragon Awakened"
                width="500"
                height="487"
              />
            </motion.div>

            {/* Noctivus branding — shows after GIF fades in */}
            {(phase === 'reveal' || phase === 'done') && (
              <motion.div
                className="intro-branding"
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8 }}
              >
                <h1 className="intro-title">NOCTIVUS '26</h1>
                <p className="intro-meta">26 SEPTEMBER 2026</p>
              </motion.div>
            )}

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
