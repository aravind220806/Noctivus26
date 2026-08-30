# WIREFRAME.md — NOCTIVUS '26 single-page site

Confirms two decisions before this gets built:
- **Nav = vertical sidebar** (new — replaces the current top pill nav)
- **Payment = manual UPI QR + UTR entry** (the real backend flow — NOT
  Razorpay. `WORKFLOW.md` still describes Razorpay/webhooks/Sheets sync;
  that doc is stale and should be corrected separately, but don't build
  frontend against it. Build against what `BACKEND.md` and the actual
  API describe.)

---

## Page structure — single scroll, in order

### 1. Sidebar nav (persistent, not a scroll section)
- Logo (small), anchor links: Home / About / Events / Schedule /
  Coordinators, Register CTA
- Collapses to a hamburger/drawer on mobile — a persistent vertical
  sidebar doesn't work below ~900px, needs a defined mobile behavior
  before build starts (icon-only rail? off-canvas drawer? confirm which)
- Active-section highlight as user scrolls (scrollspy), matches the
  cyan/teal accent logic already defined in RULES.md

### 2. Hero
- Logo mark, "Department of CSE (Cyber Security) presents", NOCTIVUS '26
  title, tagline
- When/Where facts
- **Countdown** — this is the "badass" ask. Current flap-digit countdown
  is a good base; push it further as the hero's signature moment per
  RULES.md's oversized-numeral treatment: bigger digits, display font
  (Chakra Petch), tick-mark/glow accents on unit change, sits inside or
  overlapping the notched hero panel from RULES.md §2B
- CTAs: Explore events, Register now

### 3. About
- Manifesto copy + stats grid (already exists — `about-grid`,
  `about-manifesto`, `stats-grid`)

### 4. Events
- Filterable grid, 8 events (`events-grid`, `event-filters`,
  `event-card`)
- Card click → **event modal**: rules, fee, team-size, register CTA
- Register CTA → **registration modal** (multi-step, config-driven per
  event per `WORKFLOW.md`'s Phase 2 note — different events may need
  different fields, keep the form config-driven, not hardcoded per
  event)
- Registration submit → **payment modal**: UPI QR code + UTR input field
  (per `payment-layout`, `qr-panel`, `payment-instructions` classes
  already in your CSS) — NOT a Razorpay checkout iframe
- Confirmation state after UTR submit: "pending verification" (manual
  organizer verification, not instant) — the UI must communicate this
  honestly, don't imply instant confirmation the backend can't deliver

### 5. Event day schedule
- Timeline (`schedule-reveal` — exists)

### 6. Coordinators
- (Maps to existing `crew-grid` / `crew-card` classes)

### 7. Footer
- Venue callout, links, socials (`footer-venue`, `footer-grid` — exist)

## Dropped from the previous inferred structure

Per your latest section order, these existing CSS blocks are candidates
to cut or fold in rather than keep as standalone sections — confirm
before removal:
- **Experience/Features** (`experience-grid`, `feature-panel`) — unclear
  what content lives here; if it's not real content, cut it. If it's
  something like "why attend" or sponsor logos, it could fold into About
  instead of being cut outright.
- **FAQ** (`faq-item`) — cut, or fold 2–3 essential questions into the
  Contact/footer area if there's real content worth keeping.
- **Contact** as a standalone section — you didn't list it; if there's a
  real contact form or contact details, consider folding into footer
  rather than a full section. If it's genuinely needed as its own
  section (e.g. a form that posts somewhere), keep it and tell the
  agent to keep it — don't let it get silently deleted if it's actually
  wired up to something.

Same rule as before: agent proposes what to cut, you confirm, before
anything gets deleted — don't let "drop the unnecessary ones" become a
blank check on content you haven't reviewed.

## Still open / not part of this wireframe

- Public check-in pass page (`/p/{token}`) — separate route, not part of
  this scroll page, unchanged from RULES.md.
- Admin panel — separate, unchanged.
- `WORKFLOW.md` itself needs a rewrite to match the real UPI/UTR flow
  (flagged back in the backend security review, item P1.7b) — worth
  doing so the next person reading the repo doesn't get misled the way
  this wireframing conversation almost did.
