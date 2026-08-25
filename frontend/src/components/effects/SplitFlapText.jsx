import { useEffect, useMemo, useRef, useState } from 'react';
import './SplitFlapText.css';

const DEFAULT_WORDS = ['LAUNCH READY', 'SYNC ONLINE', 'SIGNAL LIVE'];
const CHARSETS = {
  alpha: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  numeric: '0123456789',
};

const toCssUnit = (value) => (typeof value === 'number' ? `${value}px` : value);
const resolveCharset = (charset) => CHARSETS[charset] || (typeof charset === 'string' && charset ? charset : CHARSETS.alphanumeric);
const normalizePhrase = (phrase, width) => String(phrase ?? '').padEnd(width, ' ').slice(0, width);
const createTiles = (phrase) => phrase.split('').map((char) => ({ current: char, next: char, flipping: false, tick: 0 }));
const sampleChar = (charset) => charset.charAt(Math.floor(Math.random() * charset.length)) || ' ';
const buildSequence = (target, flips, charset) => [...Array(flips)].map(() => sampleChar(charset)).concat(target);

function usePrefersReducedMotion() {
  const [prefersReduced, setPrefersReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return prefersReduced;
}

export default function SplitFlapText({
  words = DEFAULT_WORDS,
  text,
  flipDuration = 0.12,
  stagger = 0.06,
  cycleDelay = 2400,
  charset = 'alphanumeric',
  flipsPerChar = 8,
  tileColor = '#111827',
  textColor = '#f8fafc',
  tileRadius = 8,
  gap = 6,
  fontSize = 52,
  loop = true,
  padTo = 12,
  className = '',
  style = {},
  ...props
}) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const rafRef = useRef(null);
  const cycleTimerRef = useRef(null);
  const currentTextRef = useRef('');
  const sourceWords = Array.isArray(words) && words.length ? words : DEFAULT_WORDS;
  const phrasesKey = typeof text === 'string' ? text : sourceWords.map((word) => String(word ?? '')).join('\u001f');
  const phrases = useMemo(() => phrasesKey.split('\u001f'), [phrasesKey]);
  const width = useMemo(() => {
    const longest = phrases.reduce((max, phrase) => Math.max(max, phrase.length), 1);
    return Math.max(1, Math.ceil(Number(padTo) || 0), longest);
  }, [padTo, phrases]);
  const normalizedPhrases = useMemo(() => phrases.map((phrase) => normalizePhrase(phrase, width)), [phrases, width]);
  const [tiles, setTiles] = useState(() => createTiles(normalizedPhrases[0] || ''));

  useEffect(() => {
    const clearAnimation = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current);
      rafRef.current = null;
      cycleTimerRef.current = null;
    };
    clearAnimation();
    const firstPhrase = normalizedPhrases[0] || '';
    currentTextRef.current = firstPhrase;
    setTiles(createTiles(firstPhrase));
    if (normalizedPhrases.length <= 1 || typeof window === 'undefined') return clearAnimation;

    let phraseIndex = 0;
    let cancelled = false;
    const flipMs = Math.max(40, (Number(flipDuration) || 0.12) * 1000);
    const staggerMs = Math.max(0, (Number(stagger) || 0) * 1000);
    const delayMs = Math.max(400, Number(cycleDelay) || 2400);
    const flipCount = Math.max(0, Math.floor(Number(flipsPerChar) || 0));
    const activeCharset = resolveCharset(charset);

    const animateTo = (targetPhrase) => {
      if (prefersReducedMotion) {
        currentTextRef.current = targetPhrase;
        setTiles(createTiles(targetPhrase));
        return 0;
      }
      const fromPhrase = normalizePhrase(currentTextRef.current, width);
      const plans = targetPhrase.split('').map((target, index) => {
        const from = fromPhrase[index] || ' ';
        return from === target ? null : {
          index, from, target, sequence: buildSequence(target, flipCount, activeCharset), start: index * staggerMs, step: -1, done: false,
        };
      }).filter(Boolean);
      if (!plans.length) return 0;
      const totalDuration = plans.reduce((max, plan) => Math.max(max, plan.start + plan.sequence.length * flipMs), 0);
      const startedAt = performance.now();
      const tick = (now) => {
        if (cancelled) return;
        const elapsed = now - startedAt;
        const updates = [];
        let shouldContinue = false;
        plans.forEach((plan) => {
          const localElapsed = elapsed - plan.start;
          if (localElapsed < 0) { shouldContinue = true; return; }
          const step = Math.floor(localElapsed / flipMs);
          if (step < plan.sequence.length) {
            shouldContinue = true;
            if (step !== plan.step) {
              plan.step = step;
              updates.push({ index: plan.index, current: step === 0 ? plan.from : plan.sequence[step - 1], next: plan.sequence[step], done: false });
            }
          } else if (!plan.done) {
            plan.done = true;
            updates.push({ index: plan.index, current: plan.target, next: plan.target, done: true });
          }
        });
        if (updates.length) {
          setTiles((previous) => {
            const next = [...previous];
            updates.forEach((update) => {
              const tile = next[update.index];
              if (tile) next[update.index] = { current: update.current, next: update.next, flipping: !update.done, tick: tile.tick + 1 };
            });
            return next;
          });
        }
        if (shouldContinue) rafRef.current = requestAnimationFrame(tick);
        else { currentTextRef.current = targetPhrase; rafRef.current = null; }
      };
      rafRef.current = requestAnimationFrame(tick);
      return totalDuration;
    };

    const scheduleNext = (delay) => {
      cycleTimerRef.current = window.setTimeout(() => {
        if (cancelled) return;
        const nextIndex = phraseIndex + 1;
        if (nextIndex >= normalizedPhrases.length && !loop) return;
        phraseIndex = nextIndex % normalizedPhrases.length;
        scheduleNext(delayMs + animateTo(normalizedPhrases[phraseIndex]));
      }, delay);
    };
    scheduleNext(delayMs);
    return () => { cancelled = true; clearAnimation(); };
  }, [normalizedPhrases, width, loop, cycleDelay, flipDuration, stagger, flipsPerChar, charset, prefersReducedMotion]);

  const settledText = tiles.map((tile) => tile.current).join('').trimEnd();
  const componentStyle = {
    '--split-flap-tile-color': tileColor,
    '--split-flap-text-color': textColor,
    '--split-flap-radius': toCssUnit(tileRadius),
    '--split-flap-gap': toCssUnit(gap),
    '--split-flap-font-size': toCssUnit(fontSize),
    '--split-flap-flip-duration': `${Math.max(0.04, Number(flipDuration) || 0.12)}s`,
    ...style,
  };

  return (
    <div className={`split-flap-text ${className}`.trim()} style={componentStyle} role="text" aria-label={settledText || undefined} {...props}>
      {tiles.map((tile, index) => (
        <span className="split-flap-text__tile" aria-hidden="true" key={`${index}-${tiles.length}`}>
          <span className="split-flap-text__half split-flap-text__half--top"><span className="split-flap-text__char">{tile.current === ' ' ? '\u00a0' : tile.current}</span></span>
          <span className="split-flap-text__half split-flap-text__half--bottom"><span className="split-flap-text__char">{tile.flipping ? tile.next : tile.current}</span></span>
          {tile.flipping && <>
            <span className="split-flap-text__flap split-flap-text__flap--front" key={`front-${index}-${tile.tick}`}><span className="split-flap-text__char">{tile.current === ' ' ? '\u00a0' : tile.current}</span></span>
            <span className="split-flap-text__flap split-flap-text__flap--back" key={`back-${index}-${tile.tick}`}><span className="split-flap-text__char">{tile.next === ' ' ? '\u00a0' : tile.next}</span></span>
          </>}
        </span>
      ))}
    </div>
  );
}
