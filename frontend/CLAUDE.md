# CLAUDE.md — NOCTIVUS '26 Frontend

This is the single source of truth for the frontend rebuild. It
supersedes `RULES.md`, `WIREFRAME.md`, `TASKS.md`,
`PHASE1_CORRECTION.md`, and `PHASE1_ANSWERS.md` — those documents are
history now, this file is current. Read this fully before touching
code, and re-read it if you're picking this project back up after a
break.

You are working on the frontend for **NOCTIVUS '26**, a national-level
technical symposium hosted by the Department of CSE (Cyber Security) at
Velammal Engineering College, Chennai, on 26 September 2026. The site's
job is to get attendees to browse events and register — everything else
is in service of that.

---

## 1. Vision, in one paragraph

The old build was safe, generic dark-teal glassmorphism — competent but
forgettable. The rebuild commits to a **Night City / cyberpunk-terminal**
identity locked tightly to the event's own logo (a dragon rendered in
black with cyan-to-teal-to-lime linework, glowing eyes): pitch black
surfaces, hard signal-color accents instead of soft glass panels,
angular cut/notched geometry instead of rounded cards, and a single
committed display typeface with real architectural character. The
result should look like the environment the logo already lives in, not
compete with it.

---

## 2. Palette — closed set, no exceptions

```css
--bg:      #050607;   /* page background */
--surface: #0A0F0F;   /* panel/card fill */
--line:    rgba(0, 221, 242, 0.14);   /* hairline borders */
--cyan:    #00DDF2;   /* primary — CTAs, links, active states, main glow */
--teal:    #00E6B8;   /* secondary — hover, section markers, mid accents */
--lime:    #A7FF18;   /* signal only — live/success/countdown-active, used sparingly */
--text:    #EAF6F5;
--muted:   #7E9096;
--error:   #FF786A;   /* approved exception — real form validation states only */
```

No yellow, magenta, violet, amber, coral, blue, orange, or rose anywhere
outside this list. Every color declared in the codebase must trace back
to one of these tokens. If you find a stray hue (this has happened
before — dead `--violet`/`--amber`/`--coral` tokens, and event `accent`
values of `violet`/`amber`/`rose`/`orange` in `site.js`), remap it to
cyan/teal/lime rather than leaving it or inventing a new color. Event
accents cycle deterministically through cyan → teal → lime by array
index — don't hand-pick per event.

`--error` is the one sanctioned exception, for real validation states
(registration form errors, UTR entry errors) — not decoration. If you
add a use of `--error`, it must be wired to an actual validation
condition, not just present in the CSS unused.

## 3. Shape system

Two behaviors, combined, always translated through the palette above —
never through a bright flat fill color the way source references might
use:

- **Angular clip-path panels**: 1–2 corners cut at a 20–40px diagonal.
  Apply to a small, deliberate set of surfaces (hero panel, event cards,
  modal shells) — not everything on the page.
- **Notched/stepped hero panel**: the hero gets one distinctive
  treatment — chamfered top-left corner, small triangular notch top-right,
  a jagged 2–3-step notch cut into the right edge at roughly mid-height,
  and a thin bottom bar separated by a hairline containing small angular
  tick marks at irregular intervals (glitch/signal motif). This is a
  hero-only "moment" — build it once with real coordinates (mock it in a
  clip-path generator first), don't reuse the full shape elsewhere.
- **Repeatable sub-motifs** (reuse everywhere else): chamfered single
  corners on cards, the tick-mark bar as a section-divider motif, small
  L-shaped HUD corner-brackets on cards/modals.
- **Mobile rule**: if a cut/notch clips content at 375px, simplify it
  (fewer steps, smaller diagonal) rather than removing it — don't let
  mobile become a visually different product from desktop.
- **Dominance without color**: where a design reference achieves visual
  weight with a loud flat fill, translate that into a dark `--surface`
  panel with a glowing `--cyan`/`--teal` border/box-shadow instead. The
  drama comes from geometry + glow, not saturation.

## 4. Typography

- **Display** (h1–h6, oversized numerals, hero title, countdown digits,
  section-index numbers, stat metrics, timeline hours): **Aldrich**,
  provided as a local font file (not fetched from Google Fonts — confirm
  the actual path in the repo before wiring `@font-face`, don't assume
  one).
  - Aldrich ships **one weight only** (400/Regular). Never set
    `font-weight: 700` or any non-400 value on it — that triggers
    browser-synthesized faux-bold, which looks blocky and inconsistent.
    Set `font-weight: normal` explicitly everywhere Aldrich is used.
  - Carry hierarchy through **color first** (`--cyan`/`--lime` accents on
    elements that need to stand out), **letter-spacing second** (a modest
    0.02–0.05em increase reads as an intentional display treatment).
    **Do not compensate with size increases** — sizes are already tuned
    via `clamp()` against real layout math (spacing scale, hero panel
    proportions); resizing to fix a font-weight problem is how the
    earlier hero-overflow bug happened, don't repeat that pattern.
- **Body/nav/labels/data**: keep the existing mono stack (`IBM Plex
  Mono`/`JetBrains Mono`) unchanged.
- Two font roles, total. Don't introduce a third anywhere, including
  "just for this one badge."
- Numerals that get the display treatment must be real numbers that mean
  something (countdown, event index, section index, date) — never a
  fabricated numeral added purely for visual effect.
markdown
## 4. Typography

<!-- CHANGED: three font roles now, Samarkan added per amendment -->

- **Display** (h1–h6, oversized numerals, hero title, countdown digits,
  section-index numbers, stat metrics, timeline hours): **Aldrich**,
  provided as a local font file (not fetched from Google Fonts — confirm
  the actual path in the repo before wiring `@font-face`, don't assume
  one).
  - Aldrich ships **one weight only** (400/Regular). Never set
    `font-weight: 700` or any non-400 value on it — that triggers
    browser-synthesized faux-bold, which looks blocky and inconsistent.
    Set `font-weight: normal` explicitly everywhere Aldrich is used.
  - Carry hierarchy through **color first** (`--cyan`/`--lime` accents on
    elements that need to stand out), **letter-spacing second** (a modest
    0.02–0.05em increase reads as an intentional display treatment).
    **Do not compensate with size increases**.
- **Samarkan** — secondary expressive display face, approved as of
  MASTER BUILD DIRECTIVE. Use **sparingly**, for special identity
  moments only (e.g. a single hero/wordmark treatment or a selected
  decorative word) — never for body copy, never for more than one or
  two moments on the whole page. If in doubt, don't use it here — this
  is the exception role, not a second workhorse display font.
- **Body/nav/labels/data**: keep the existing mono stack (`IBM Plex
  Mono`/`JetBrains Mono`) unchanged.
- **Three font roles total, closed set.** Don't introduce a fourth
  anywhere, including "just for this one badge."
- Numerals that get the display treatment must be real numbers that mean
  something (countdown, event index, section index, date) — never a
  fabricated numeral added purely for visual effect.
markdown
## 6. Site architecture

...

- 9 items render in the events grid: 8 competitive events +
  1 non-registerable workshop (`registerable: false`), all filterable
  and stylable as cards. This is correct, not a miscount.
<!-- CHANGED: correcting the above per MASTER BUILD DIRECTIVE + confirmation — replace that bullet with: -->
markdown
- Exactly **8 real registerable events** render in the events grid.
  If the data source contains a 9th (workshop/demo) entry, it is
  **not** treated as a public event — confirm in Phase 0b/Events phase
  how it's currently flagged and exclude it from the public grid rather
  than styling it as a 9th card. This corrects the earlier Phase 0 note,
  which had this backwards.
markdown
## 9. Phases

**Phase 0b — Repo reality check** *(new, do this before Phase 2)*: ...
<!-- CHANGED: add one more bullet to the Phase 0b list, since font role now includes Samarkan -->
markdown
- Confirm exact file paths for **Aldrich, Samarkan, and JetBrains
  Mono** under `public/fonts/`. Samarkan is now an approved third font
  role (see §4) — confirm the file exists and is wired correctly, don't
  treat it as dead weight to remove. Continue to check `Space_Grotesk`
  as before — still unaccounted for, still flag for removal pending
  confirmation, not automatically approved just because Samarkan was.
## 5. Spacing

Already-established scale, unchanged by this rebuild:
`4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 / 128` px, tokenized as
`--sp-1` through `--sp-32` in `variables.css`. Container max-width
1200px, 24px desktop / 16px mobile gutters, 64px desktop / 48px mobile
section padding, 96px for hero/large sections. Don't introduce arbitrary
values outside this scale.

**This is a mobile-first build.** Base/default CSS (no media query)
targets mobile: 16px gutters, 48px section padding, single-column
layouts, the simplified/collapsed nav state. `@media (min-width: ...)`
queries then progressively enhance upward into tablet and desktop —
wider gutters, larger section padding, multi-column grids, the
expanded sidebar. If the existing `spacing.css` still has this
inverted (desktop values as the default, `max-width` queries knocking
them down for mobile — which is how it was structured before this
note), that needs to be flipped as part of Phase 1, not left as legacy
structure carried forward. Audit and report before flipping it, same
as any other structural change.

**Known failure mode, already fixed once**: any section using
`min-height: 100svh` combined with `display: flex; align-items: center`
will vertically center content that's taller than one viewport, pushing
it off both the top and bottom edges. If you add a new full-height
section, don't use that combination — flow content from the top
(`align-items: flex-start`) instead, and add a `@media (max-height:
700px)` reduction on internal gaps if needed for short viewports.

## 6. Site architecture

**Single scrollable page** for the public-facing site (`App.jsx`), with
anchor-linked sidebar nav. Two routes stay genuinely separate, resolved
via `window.location.pathname` in `main.jsx`:
- `/admin`, `/login` → `AdminApp.jsx` — staff tooling, out of scope for
  this rebuild.
- `/p/{token}` → `PassVerification.jsx` — attendee check-in desk reached
  by QR scan, out of scope for this rebuild.

**Section order — PROVISIONAL, pending Phase 0b**: Sidebar nav → Hero →
About → Events → Event day schedule (Timeline) → Coordinators (Crew) →
Contact → Footer. This was built from partial information (pasted file
contents, not the full tree) and the real tree shows components this
list doesn't account for (`BrochureSection`, `LocationMapSection`,
`SocialMediaSection`, `StatsSection`, `VenueMap`, `SiteSnow`). Treat this
order as provisional until Phase 0b reports back the actual render order
from `App.jsx` and this section gets corrected.

- Sidebar nav is a **new** vertical sidebar. Per the mobile-first
  approach in §5: design and build the mobile nav state first (drawer or
  icon rail — pick one and be able to say why) as the actual default,
  then treat the persistent desktop sidebar as the progressive
  enhancement at a wider breakpoint — not the other way around.
  Scrollspy active-state highlighting on the current section applies at
  both sizes.
- `experience-grid`/`feature-panel` and `faq-item`/`faq-layout` CSS are
  **confirmed dead** (no matching DOM/JSX, verified by direct
  inspection) — removed.
- `ContactSection` has real content (email, phone, venue directions link,
  registration CTA) — kept, positioned as the last section before the
  footer.
- Payment flow is **manual UPI QR + UTR entry**, confirmed against the
  actual backend — **not** Razorpay. `WORKFLOW.md` (a separate,
  backend-side document) still describes Razorpay/webhooks/Google
  Sheets sync; that document is stale and needs a rewrite, but is out of
  scope for frontend work — build strictly against the real UPI/UTR
  flow, never against `WORKFLOW.md`'s description. The payment modal's
  post-submit state must say "pending verification," not imply instant
  confirmation — UTR verification is manual/organizer-side.
- 9 items render in the events grid: 8 competitive events +
  1 non-registerable workshop (`registerable: false`), all filterable
  and stylable as cards. This is correct, not a miscount.
- Registration form fields should be config-driven per event (some
  events need different fields) — not hardcoded per event type.

## 7. Content discipline

Every string on screen names real information (real event names, real
dates, real venue, real department credit, real contact info) or is left
empty. No fabricated HUD copy (`// SYSTEM ONLINE`), no filler mono-caps
labels, no themed replacement of standard UI copy, no unicode-glyph
icons standing in for real iconography. Decorative elements (tick marks,
corner brackets) are fine as pure decoration — don't add fake labels
next to them to make them look functional.

## 8. How to work — execution rules

- **Phase-gated, not free-running.** Work one phase at a time (below).
  Each phase ends at a checkpoint — post a summary (and screenshots for
  anything visual) and wait for confirmation before starting the next
  phase. This has already caught two real mistakes (a font substituted
  without asking, a color exception added without flagging it) — the
  gates are load-bearing, not bureaucracy.
- **Verify against the actual DOM/JSX, not just the CSS.** CSS classes
  can exist with no matching component (this has already happened twice
  — `experience-grid`, `faq-item`). When auditing what's real, grep the
  component tree, not just the stylesheet.
- **Ask instead of guessing** on: file paths for provided assets (don't
  assume where a font file landed), any decision that requires deleting
  content you haven't confirmed is dead, and anything where two prior
  documents in this repo's history might conflict (e.g. `WORKFLOW.md` vs
  the real backend — always trust the real backend).
- **Don't scope-creep silently.** If you fix something outside the
  current phase's stated scope (this has happened once already, with an
  unscoped timeline grid fix), that's fine if it's a genuine bug, but
  explain what was wrong and why it needed fixing, separately from the
  phase's main work — so it's reviewable as its own thing.
- **Never weaken a constraint to make something easier.** If Aldrich's
  single weight makes a hierarchy problem hard, solve it with color/
  spacing per §4 — don't quietly swap in a different font, don't
  quietly add a second display face, don't quietly resize things that
  were already tuned.

## 9. Phases

**Phase 0 — Groundwork** *(complete, but reopened — see 0b below)*: route
inventory, dead-CSS audit, color-usage audit. Findings: routes confirmed
as described in §6; `experience-grid`/`feature-panel`/`faq-item`/
`faq-layout` removed; `CrewSection`'s stray `.faq-section` class renamed
to `.crew-section`; event accents remapped deterministically to
cyan/teal/lime.

**Phase 0b — Repo reality check** *(new, do this before Phase 2)*: the
original groundwork audit was done from pasted file contents, not a full
repo tree, and the tree turned out to hold more than accounted for.
Resolve all of these and report back before Phase 2 starts:
- `src/components/LineSidebar.jsx`, `PillNav.jsx`/`PillNav.css`,
  `Navbar.jsx` all exist. Determine which (if any) is currently wired
  into `App.jsx`, and whether `LineSidebar.jsx` is a genuine head start
  on Phase 2's sidebar nav or dead/unrelated code. Don't build a new
  sidebar component without first checking whether this one is usable.
- `public/fonts/` contains a full `Space_Grotesk` family (5 weights +
  variable) and `Samarkan.ttf`, neither mentioned anywhere in this
  document. Find where (if anywhere) each is referenced in the CSS/JSX
  and report it — if either is actually in use for something (e.g. a
  decorative wordmark treatment separate from body/display type), that's
  a real third font role this doc needs to account for; if neither is
  referenced anywhere, they're candidates for removal, but confirm with
  me before deleting font assets.
- `src/components/sections/` has `BrochureSection.jsx`,
  `LocationMapSection.jsx`, `SocialMediaSection.jsx`, `StatsSection.jsx`,
  and `src/components/VenueMap.jsx` / `SiteSnow.jsx` — none of these are
  in this doc's confirmed §6 section order. Check `App.jsx` for the
  actual render order and report the real, complete section list back to
  me so §6 can be corrected. Don't assume any of these are droppable
  just because they weren't in the earlier wireframe — that wireframe was
  built from a partial picture.
- `src/components/bionis/` (dashboard-content, icons, logo, navigation,
  shared, sidebar, theme-provider, topbar, trends-content) and
  `src/dashboard-layout.jsx` look like unrelated dashboard
  template/boilerplate. Check whether anything imports from `bionis/` or
  renders `dashboard-layout.jsx` anywhere in the actual app. If nothing
  does, treat this the same way Phase 0 treated `experience-grid`/
  `faq-item`: confirmed-dead, flag for removal, wait for my confirmation
  before deleting.
- `src/components/ui/sidebar.jsx` (shadcn-style) — separate from
  `LineSidebar.jsx`. Check if this is used anywhere before Phase 2, since
  having two unrelated "sidebar" components in the tree is exactly the
  kind of ambiguity that caused the font mix-up earlier — don't let
  Phase 2 build a third one without first ruling these two in or out.

**Phase 1 — Palette + display font** *(in progress)*: closed palette
applied to `variables.css`; Aldrich being wired via local file
(`@font-face`, path TBD — confirm before assuming); single-weight
hierarchy handled via color + letter-spacing per §4, not size; `.form-error`
restored (was dropped during modularization) and wired to `var(--error)`;
timeline grid column mismatch fixed (3 DOM children vs 4 CSS columns →
corrected to 3-column `120px 32px 1fr`). **Checkpoint**: screenshots of
palette + Aldrich applied across at least hero, one card, and the
timeline before moving to Phase 2.

**Phase 2 — Sidebar nav**: build the mobile nav state first (drawer or
icon rail) as the real default, then progressively enhance to the
persistent desktop sidebar at a wider breakpoint, verify it doesn't
collide with the 1200px content container's width math. **Checkpoint**:
mobile + desktop nav shown before proceeding — structural change, worth
a look before it ripples into every section's layout.

**Phase 3 — Hero**: build mobile first — simplified notch if the full
shape clips content at 375px, countdown sized for a small screen, then
scale up to the full notched panel treatment (§3) and larger countdown
at wider breakpoints. **Checkpoint**: hero at both mobile and desktop
before touching any other section.

**Phase 4 — Remaining sections**: About, Events (+ event/registration/
payment modals per §6's payment-flow rules), Timeline, Coordinators,
Contact, Footer — build mobile layouts first, then the desktop
enhancements, section by section, once Phase 3 is approved.
**Checkpoint**: full single-page scroll at mobile width, then desktop,
before Phase 5.

**Phase 5 — QA pass**: cross-check both breakpoints together (sidebar,
hero notch, all shapes, modals — especially registration/payment forms)
for consistency, overflow regression check (§5's known failure mode),
palette-trace check (every color used maps to §2), content-discipline
check (§7). **Checkpoint**: final review before calling the rebuild
done.

**Out of scope for this file**: `/p/{token}` pass page, `/admin` panel,
and rewriting `WORKFLOW.md` — each is its own separate task if/when
picked up.
