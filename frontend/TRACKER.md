# NOCTIVUS '26 — Work Tracker

Updated: 2026-08-30. Resume here if context resets.

---

## Phase 0 — Groundwork ✅ COMPLETE
Routes confirmed, dead CSS removed, accents remapped.

---

## Phase 1 — Palette + Display Font 🔄 IN PROGRESS

### 1a — Font fixes ⬜ (in progress this session)

Issues found and being fixed:
- `--body-font: 'Inter'` → should be mono stack (IBM Plex Mono / JetBrains Mono)
- `Caveat` + `Kalam` cursive fonts in `modals.css` notebook view → third-font violation, replace with `--mono-font`
- `.hero h1 font-weight: 750` → must be `normal` (Aldrich is 400 only)
- `.section-title h2 font-weight: 630` → `normal`
- `.timeline-row h3 font-weight: 530` → `normal`
- `.event-card__body h3 font-weight: 780` → `normal`
- `.event-card__date font-weight: 700` → `normal` (uses `--display-font`)
- `.footer-brand font-weight: 740` → `normal`
- Remove Caveat/Kalam `<link>` from `index.html`

### 1b — Palette cleanup ⬜ (in progress this session)

- `--surface-2: #0E1414` — extra token not in palette → remove, remap to `--surface`
- `#071522` section backgrounds (about, schedule, crew) → `var(--surface)`
- `.hero` gradient `#071522` → `var(--surface)`
- `.contact-layout` gradient `#0A2030, #071522` → `var(--surface), var(--bg)`
- `footer background: #030607` → `var(--bg)`
- `.mob-link:hover color: #F5A124` (orange!) → `var(--teal)`
- `.button-primary:hover background: #38F27D` → `var(--teal)`
- Registration modal `rgba(93, 70, 210, .55)` (violet!) → `var(--line)`
- Registration modal stray darks `#070b13, #0d1322, #0b101a` → `var(--bg)` / `var(--surface)`
- `rgba(127, 153, 211, ...)` blueish borders in modal → `var(--line)`
- `.icon-button background: #0A2030` → `var(--surface)`
- `.hero__tagline color: #C9D9E1` → `var(--text)`
- `.about-copy .lead color: #e6ebe8` → `var(--text)`
- `.about-manifesto span color: #68716e` → `var(--muted)`
- Flap-digit backgrounds `#111513, #171c19` etc. → `var(--surface)` based
- `.event-card` gradient `rgba(10,32,48), rgba(7,21,34)` → surface-based

### 1c — Mobile-first spacing flip ⬜ (in progress this session)

`spacing.css` still uses `max-width` (desktop-first). Needs to flip to `min-width`:
- Default = mobile values (from old `max-width: 700px` block)
- `@media (min-width: 701px)` = tablet page width
- `@media (min-width: 981px)` = desktop values (from old default)
- `variables.css`: `--space-section → var(--sp-12)` (mobile), `--page` → mobile default
- `base.css`: `.page-width padding-inline` → mobile gutter as default

### 1d — Checkpoint ⬜

Take screenshots: hero, one card, timeline with Aldrich + palette applied.
Post for user confirmation before Phase 2.

---

## Phase 2 — Sidebar Nav ⬜ NOT STARTED

Build mobile nav state first (drawer/icon rail), then desktop sidebar at wider breakpoint.

## Phase 3 — Hero ⬜ NOT STARTED

Mobile-first: simplified notch, countdown sized for small screen. Then full notched panel.

## Phase 4 — Remaining Sections ⬜ NOT STARTED

About, Events + modals, Timeline, Crew, Contact, Footer.

## Phase 5 — QA Pass ⬜ NOT STARTED

Cross-check both breakpoints, overflow regression, palette-trace, content discipline.
