# Handoff: Countdown component rebuild

## Context

This is a scoped sub-task of the NOCTIVUS '26 frontend rebuild (see
`CLAUDE.md` at repo root for the full project — palette, fonts, phase
plan). You're implementing one component: the hero countdown.

A working reference implementation exists as a standalone HTML file:
`countdown-demo.html` (in this handoff, or wherever it's been placed in
the repo). Open it and interact with it — click "Trigger digit change"
and "Toggle auto-tick" — before writing any code, so you're building
toward something you've actually seen work, not just read a
description of.

The current implementation lives in
`src/components/effects/SplitFlapCountdown.jsx` (flip-clock style) with
styles in `src/styles/hero.css` (`.flap-*` classes). You're replacing
the transition behavior and visual treatment, not necessarily the whole
component structure if parts of it are reusable.

## What to build

A countdown to **26 September 2026** with two combined effects on digit
change:

1. **Glitch-decode transition**: when a digit changes, it doesn't flip —
   it rapidly cycles through 3 random digits (~45ms each, so ~135ms
   total) before landing on the real value. This should trigger
   per-digit, only on the digits that actually changed (i.e. seconds
   ticking shouldn't glitch the hours digits).
2. **Chromatic-aberration ghosting, palette-safe**: behind the real digit
   (`--text` color), render two offset "ghost" copies of the same digit
   — one in `--cyan` shifted ~2px left, one in `--lime` shifted ~2px
   right — both at reduced opacity (~0.45–0.55) and using
   `mix-blend-mode: screen` so they combine cleanly instead of muddying
   into brown/gray. This is a required detail, not optional — `screen`
   blend mode is what makes the two ghost colors read as a clean split
   instead of a smear.

## Typography — do not use Aldrich for the digits

This was decided deliberately after comparing options: Aldrich's
letterforms are architectural/rounded and don't have the blocky
digital-readout character this treatment needs. Use the existing mono
stack (`IBM Plex Mono`, `font-weight: 600`, `font-variant-numeric:
tabular-nums`) for the actual digit glyphs. Aldrich stays reserved for
headings and non-numeral display text per the main `CLAUDE.md` spec —
don't reintroduce it here even though it might seem consistent to do so.

## Structure

- Each digit lives in its own cell (`.digit-cell` in the reference) with
  `position: relative`, containing three stacked absolutely-positioned
  spans: the real digit (`z-index: 3`), the cyan ghost (`z-index: 1`),
  the lime ghost (`z-index: 2`).
- Units (days/hours/minutes/seconds) group their digit cells with a
  small uppercase label beneath (existing `.flap-unit small` pattern is
  fine to reuse).
- Wrap the whole countdown in a container with HUD corner-bracket
  decoration — reuse the corner-bracket motif already established
  elsewhere in the project (RULES.md's repeatable shape motifs), don't
  invent a new bracket style just for this component.

## Constraints

- Palette: only `--bg`, `--surface`, `--line`, `--cyan`, `--teal`,
  `--lime`, `--text`, `--muted` (per `CLAUDE.md` §2). No literal red/blue
  chromatic aberration — the whole point of this version is that it's
  achieved with on-brand colors instead.
- Mobile: the reference demo hasn't been tested at narrow widths.
  Check digit-cell sizing and gap spacing at 375px — if cells wrap
  awkwardly or overflow, reduce cell width/font-size at a breakpoint
  rather than changing the visual treatment itself.
- Performance: this fires every second in production (real countdown,
  not the demo's manual trigger). Make sure the glitch animation doesn't
  cause layout thrash — use `transform` for the jitter (already the
  approach in the reference), not properties that trigger reflow.
- Don't silently drop the glitch effect on reduced-motion preference
  without checking — if `prefers-reduced-motion: reduce` is set, the
  digit should still update, just without the scramble/jitter (snap
  straight to the new value). This is an accessibility requirement, not
  optional polish.

## Verify before reporting back

- Digits update correctly against a real countdown to 26 Sept 2026
  (not just the demo's fake state).
- Only changed digits glitch — verify by watching an hours/minutes
  rollover, not just seconds ticking (seconds always glitch every
  second; that's expected and fine).
- Ghost layers use `screen` blend mode and are visually offset, not
  overlapping into a muddy color.
- Mobile width (375px) doesn't clip or overflow.
- `prefers-reduced-motion` is respected.

## Report back

Screenshot or short screen-recording of the working countdown at both
desktop and mobile width, plus confirmation that the reduced-motion
fallback works. This is a Phase 3 component per the main `CLAUDE.md` —
don't merge/proceed to other Phase 3 work until this is reviewed.
