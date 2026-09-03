# NOCTIVUS '26 — Work Tracker

Updated: 2026-08-31. Resume here if context resets.

---

## Phase 0 — Groundwork ✅ COMPLETE
Routes confirmed, dead CSS removed, accents remapped.

---

## Phase 1 — Palette + Display Font + Mobile-First Spacing ✅ COMPLETE

### 1a — Font fixes ✅ DONE (commit 958d7ee & 8756536)
- Local **Aldrich** font face integrated via `@font-face`
- `--display-font` set to `'Aldrich', var(--mono-font)`
- Reset `font-weight: normal` (400) on all Aldrich elements to prevent faux-bolding
- Hierarchy carried via color (`--cyan`/`--lime`), tracking, and layout structure

### 1b — Closed Palette Cleanup ✅ DONE (commit 958d7ee & 1513b09)
- Off-palette tokens removed (`--blue`, `--violet`, `--amber`, `--coral`)
- Remapped off-palette `#F5A124` / `#FF8C00` in `Navbar.jsx` & `LineSidebar.jsx` to `var(--teal)` / `var(--cyan)`
- Restored `.form-error` validation state wired to `--error: #FF786A`

### 1c — Mobile-First Spacing & Container Grid Fix ✅ DONE (commit 1513b09)
- Converted base/default CSS layout declarations across `base.css`, `sections.css`, and `events.css` to single-column flex/grid defaults
- Scoped all multi-column splits (`.about-grid`, `.section-title`, `.events-grid`, `.stats-grid`, `.crew-grid`, `.footer-grid`) inside `@media (min-width: 640px)`, `@media (min-width: 701px)`, and `@media (min-width: 981px)` media queries
- Removed hardcoded left paddings (`padding-left: 100px;`) at the base level to prevent horizontal overflow and wrapping mid-word

### 1d — Signature Components & Timeline ✅ DONE (commit 9ae5e04, 324690c & aeeab0a)
- Signature HUD Glitch Countdown component with chromatic aberration ghosting (`mix-blend-mode: screen`)
- Responsive Timeline with visual Gantt schedule grid on desktop (≥ 701px) and flat agenda list with concurrency grouping on mobile (< 701px)

---

## Phase 2 — Sidebar Nav ⬜ NEXT UP
Build mobile nav state first (drawer/icon rail), then desktop sidebar at wider breakpoint.

## Phase 3 — Hero ⬜ NOT STARTED
Mobile-first: simplified notch, countdown sized for small screen. Then full notched panel.

## Phase 4 — Remaining Sections ⬜ NOT STARTED
About, Events + modals, Timeline, Crew, Contact, Footer.

## Phase 5 — QA Pass ⬜ NOT STARTED
Cross-check both breakpoints, overflow regression, palette-trace, content discipline.
