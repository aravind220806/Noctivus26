# PRODUCT REQUIREMENTS DOCUMENT — VERSION 1
## Noctivus '26 — College Symposium Website (No Admin Panel)

| | |
|---|---|
| **Status** | Final (consolidated from 3 draft PRDs + design discussion) |
| **Version** | V1 — Frontend + Backend + MongoDB, registration only, no export option (no admin UI) |
| **Team** | 1 beginner (frontend, no-code/vibe-coding) + 1 teammate (backend, can code) |
| **Scope decision** | Single scrollable page (frontend) + lightweight backend + MongoDB |

> **This is V1 — no admin panel and no export option.** The backend only accepts registrations (`POST /api/register`); there is no built-in view/export endpoint. Organizers see registration data by opening the `registrations` collection directly in MongoDB Atlas's own dashboard. See **PRD_Noctivus26_V2_WithAdminPanel.md** for the version that adds a proper in-browser admin dashboard with search, reconciliation, and export.

> **Note on this document:** Three earlier drafts existed (a generic College Symposium PRD, a Cybersecurity Symposium PRD, and a Technovision animation spec) — each proposed a different, much larger multi-page platform (Next.js SSR, PostgreSQL, NestJS, Redis, AWS S3, RBAC/2FA/audit logs, CTF arena, leaderboards, certificate verification, AI assistant). Those don't match this team's actual size or timeline. This document supersedes all three, keeping only what fits: **one scrollable page, one lightweight backend, MongoDB for data, no unnecessary infrastructure.**

---

## 1. Executive Summary

Noctivus '26 is a **single scrollable-page** symposium website. Visitors browse everything (events, schedule, speakers, sponsors) on one page and register through a form that writes directly to a **MongoDB database** via a small backend API — no Google Forms, no spreadsheets. Payment uses a **UPI deep link + QR code** (no payment gateway or merchant account needed), with manual-but-systematic reconciliation. Built mobile-first for **old, low-RAM phones (2018–2019 models)**, targeting **~300 registrations** with **~150 concurrent users**.

The visual and content reference is the previous edition at **https://symposium-eta.vercel.app/**. V1 should feel like a refined Noctivus '26 evolution of that site—retaining its dark identity, floating navigation, colorful event categories, schedule, detailed event rules, brochure, transport information, map, contacts, and social links—while replacing its heavier motion/WebGL approach and external Google Forms with a faster first-party registration flow.

---

## 2. Problem Statement

- Manual registration (Google Forms) + separate payment proof collection causes overbooking, duplicate entries, and reconciliation errors
- Last year's site needs a more styled, unique design this year — but must not sacrifice performance on the low-end phones most students will actually use
- Organizers need one place to see who registered and whether they paid, instead of cross-checking spreadsheets and screenshots

---

## 3. Goals & Success Metrics

| Goal | Metric | Target |
|---|---|---|
| Reliable registrations | Registration completion rate | ≥ 95% of started forms |
| Payment accuracy | Payment mismatch rate | < 0.1% |
| Mobile speed (old phones) | First Contentful Paint, 4G | < 2.5s |
| Mobile speed | Time to Interactive | < 3s |
| Concurrency | Handles without slowdown | 150+ concurrent users |
| Data integrity | Duplicate registrations | 0 |
| Smoothness | No jank/stutter on Moto G / iPhone SE–class devices | Verified on real device, not emulator |

---

## 4. Non-Goals (Explicitly Out of Scope)

Carried over from the larger draft PRDs but deliberately cut for this team's scope:

- Multi-page site / routing (single scrollable page only)
- User accounts, OTP/email login, "My Registrations" dashboard
- Admin RBAC, 2FA, audit logs
- CTF arena, leaderboard, gamification, XP/badges
- Certificate generation/verification
- AI assistant / chatbot
- 3D (Three.js/React Three Fiber), WebGL particle systems, GSAP cyber-gateway sequences
- AWS S3, Redis, PostgreSQL, Prisma, NestJS
- Native app, on-site QR scanning app (manual check-in list is fine for v1)

If any of these are wanted later, they're a v2 conversation — not part of this build.

---

## 5. Target Users

| Persona | Needs |
|---|---|
| **Student (Registrant)** | View events/schedule/speakers, register (solo/team), pay via UPI, get confirmation |
| **Event Coordinator / Organizer (you + teammate)** | See who registered and verify payments by viewing the MongoDB collection directly (no export tooling in V1) |
| **Faculty Coordinator** | Occasional high-level view of stats (can be a shared read view or export, not a full dashboard) |

---

## 6. Final Technology Stack

| Layer | Choice | Why |
|---|---|---|
| **Frontend** | React (via Vite) | Component-based, easier for two people to build/collaborate on in parallel; Vite output stays small and fast if kept lean (no heavy libraries); no `react-router` needed since it's one page with anchor-scroll navigation |
| **Backend** | Node.js + Express (small API) | The standard pairing with React + MongoDB (MERN stack) — same language as the frontend, simple enough for the teammate to build/maintain solo, only needs a couple of routes |
| **Database** | MongoDB (Atlas free tier) | As decided; flexible schema fits registration/team data well; free tier covers this scale easily |
| **Payments** | UPI deep link (`upi://pay?...`) + QR code fallback for desktop | No gateway, no merchant/KYC needed — fits a personal/college UPI ID |
| **Hosting (frontend)** | Vercel or Netlify | Free CDN hosting, matches last year's setup (Vercel) |
| **Hosting (backend)** | Render or Railway (free/low-cost tier) | Simple Node API hosting, no DevOps overhead |
| **Animation** | Pure CSS transitions + `IntersectionObserver` for scroll reveals | Zero/near-zero runtime cost — see §9 |

**Explicitly not used:** Next.js (SSR/routing overhead this single page doesn't need), `react-router` (no routes to manage), any heavy animation library (Framer Motion, GSAP, Three.js — see §9 for the lightweight approach instead), TypeScript-heavy backend frameworks, any ORM beyond MongoDB's native driver/Mongoose.

**Old-phone note:** switching to React does add a small JS bundle (~40-140KB) that plain HTML wouldn't have. Keep this in check by avoiding animation/UI libraries beyond what's in §9 and by code-splitting if the bundle grows — this keeps React close to vanilla-level performance on 2018/2019 devices.

---

## 7. Functional Requirements

### 7.1 Public Page (single scroll, anchor-linked sections)
- FR1: Sticky navbar — logo, anchor links, Register CTA, mobile hamburger
- FR2: Hero — event name "Noctivus '26", tagline, date, venue, countdown timer
- FR3: About — short description + stat highlights (e.g., "300+ Participants Expected")
- FR4: Events section — cards per event (technical/non-technical), name, short description
- FR5: Schedule — timeline/table view
- FR6: Speakers section (if applicable)
- FR7: Sponsors section (if applicable)
- FR7a: Gallery section — previous-year highlights or venue/teaser photos (see §16)
- FR7b: Testimonials section — short quotes from past participants/faculty (see §16)
- FR7c: FAQ section — accordion of common questions (see §16)
- FR8: Registration form — solo or team, fields: **Name, Roll No, Email, Phone, College, Department, Year, Track/Event selected, team members if applicable, privacy/terms consent, 12-digit UTR/reference number after payment**. The frontend displays the expected amount, but the backend calculates and stores the authoritative amount from event configuration.
- FR9: Duplicate-registration prevention — normalize identity fields and enforce one participant per event on the server with a transaction-safe check (or a one-document-per-participant/event model). Use database indexes wherever the final schema supports the rule safely.
- FR10: Contact/organizing committee section
- FR11: Footer — social links, copyright

### 7.2 Payments

- FR12: Dynamic UPI payment button generated with correct amount + unique transaction note, opens UPI apps directly on mobile. Link format:

  ```
  upi://pay?pa=YOURUPIID@bank&pn=Noctivus26&am=AMOUNT&cu=INR&tn=SymposiumRegistration
  ```
  - `pa` — your UPI ID
  - `pn` — payee name (shown in the payer's UPI app)
  - `am` — amount, generated dynamically based on the track/event selected
  - `tn` — transaction note, for their reference

  ```html
  <a href="upi://pay?pa=yourid@bank&pn=Noctivus26&am=500&cu=INR&tn=SymposiumFee">
    Pay ₹500
  </a>
  ```

- FR13: QR code fallback of the same UPI string for desktop users (any UPI QR generator library, e.g. the `qrcode` npm package, can encode this string) — since desktop browsers can't open the `upi://` app link directly
- FR14: Mandatory UTR/reference number field (12-digit) with format validation (`^\d{12}$`) before submission. Label it clearly as **"12-digit UTR/Reference number"** — registrants often confuse this with the on-screen transaction ID, which can differ slightly by app
- FR14a: Use one coherent public flow: **fill details → select event(s) → review server-derived fee → pay by UPI link/QR → enter UTR → submit once**. Do not create an incomplete registration before payment in V1.
- FR14b: The server must derive `expectedAmount` from trusted event configuration. It must never trust a fee or expected total sent by the browser.
- FR15: Registration status starts as **"pending — awaiting verification,"** never auto-confirmed on submit
- FR16: Manual reconciliation process:
  1. Export the bank/UPI app transaction history as CSV (actual UTRs + amounts + timestamps — the ground truth)
  2. Pull registrations (claimed UTRs + registrant info) as CSV using MongoDB Atlas's own built-in export — no export feature is built into the site itself in V1
  3. Match the two on UTR number (exact string match) — a VLOOKUP/XLOOKUP between the two sheets, or the equivalent query against MongoDB, works fine at this scale
  4. Flag for manual review (never auto-confirm): amount mismatch, UTR not found in the bank statement, or a duplicate UTR shared by two registrants
  5. Only exact matches move a registration to "confirmed" — everything else waits for manual review, since UPI apps occasionally truncate or reformat UTRs
- FR17: Confirmation email sent only after a registration is marked confirmed

### 7.3 Backend / Data (built by teammate)
- FR18: `POST /api/register` — validates and writes a registration document to MongoDB
- FR18a: `GET /api/events` — returns the public event configuration needed by the registration form (IDs, names, fees, team-size limits, capacity/deadline status). If events remain compiled into the frontend, the backend must still use its own trusted copy for fee validation.
- FR19: `PATCH /api/registrations/:id` — mark a registration confirmed/mismatch/duplicate after manual reconciliation. This route is organizer-only and must require a server-side secret that is never shipped in the React bundle. The preferred V1 workflow is a protected reconciliation script calling this route, because a direct Atlas edit cannot reliably trigger a confirmation email.
- FR20: No view/export endpoint or CSV export in V1 — organizers query the `registrations` collection directly in MongoDB Atlas when they need to see or export data
- FR21: Capacity and deadline enforcement happens on the server. Closed or full events cannot accept new registrations even if an old browser tab still shows them as open.
- FR22: Store a snapshot of selected event names, fees, and team rules with each registration so later event-config edits do not change historical records.

---

## 8. Data Model (MongoDB Collections)

```
registrations
  _id
  registrationId (human-readable unique ID, e.g. NOC26-0001)
  participant: {
    name, rollNo, email, phone, college, department, year
  }
  normalized: { email, phone, rollNo }
  eventRegistrations: [
    {
      eventId, eventName, category, feeSnapshot,
      teamSizeMin, teamSizeMax,
      teamMembers: [ { name, rollNo, email, phone, college, department, year } ]
    }
  ]
  paymentStatus: "pending" | "confirmed" | "mismatch" | "duplicate"
  utrNumber, normalizedUtr
  expectedAmount, claimedAmount
  paymentSubmittedAt
  verifiedAt, verifiedBy, verificationNotes
  consent: { privacyAccepted, rulesAccepted, acceptedAt }
  createdAt
  updatedAt

events (can also just be a static config file if the list won't change dynamically)
  eventId, name, category, description, rules, fee
  teamSizeMin, teamSizeMax, capacity
  registrationOpensAt, registrationClosesAt
  schedule, venue, coordinatorContact, status
```

No separate Users/Admins collection is needed at this scale. A single organizer secret stored as an environment variable and checked server-side is sufficient instead of a full auth system.

**Required indexes and duplicate rules:**

- Create a unique index for `registrationId`.
- Prevent the same normalized email from joining the same event twice. Because selected events are nested in an array, do not assume that a simple unique compound multikey index will model every business rule correctly; enforce this in a transaction-safe server check or store one child document per participant/event.
- Create a unique index for `normalizedUtr` unless organizers explicitly allow one payment/UTR to cover more than one separately stored registration.
- Normalize email, phone, roll number, and UTR before validation and comparison.
- Decide whether the captain is included in `teamMembers` or stored separately; use one convention everywhere.

---

## 9. Design & Animation Direction (from our earlier discussion)

**Visual identity:** A modern continuation of the Noctivus '25 site at `https://symposium-eta.vercel.app/`, not a generic redesign. Preserve its black canvas, strong white typography, glass-like floating navigation, bright category accents, spacious full-screen sections, and event-focused presentation. Update the branding to Noctivus '26 and improve hierarchy, accessibility, responsiveness, and speed.

- **Typography:** Funnel Sans, matching last year's site, with system-sans fallbacks. Self-host only the required weights or use a carefully preconnected font request.
- **Colors:** Black/deep charcoal base (`#000000` / `#0F0F14`), off-white text, restrained cyan/emerald/blue accents. Event categories may retain distinct colors, but backgrounds must not become a rainbow gradient.
- **Navigation:** Floating rounded glass dock on desktop, matching last year's recognizable navigation; compact accessible menu on mobile with About, Events, Schedule, Contact, and Register.
- **Layout:** Strong editorial hero followed by About, event categories, schedule, brochure/rules, transport, venue/map, contacts, and registration. Use asymmetric event cards where they remain readable on small screens.
- **Event detail:** Clicking an event opens an accessible dialog or expanded panel containing overview, team size, schedule, venue, rules, coordinator, fee, availability, and Register CTA. It must support keyboard focus, Escape-to-close, and browser back behavior where practical.
- **Legacy content retained:** brochure download/viewer, college transport routes, embedded venue map, coordinator information, and official social/community links.
- **Animations (CSS + React hooks, no animation libraries):**
  - Hero title: one-time React Bits–inspired Blur Text reveal, implemented locally with CSS rather than a motion library
  - Section headings: fade-up on scroll via a small `IntersectionObserver`-based hook
  - Stat numbers: React Bits–style Count Up on first scroll into view using the existing small custom hook
  - Event cards: lightweight Spotlight Card pointer glow on fine-pointer desktop devices; static border/shadow on touch devices
  - Register button: React Bits–inspired Shiny Text sweep implemented as a CSS pseudo-element, with a long pause between sweeps
  - Hero accent phrase: CSS-only Gradient Text treatment; movement stops after the entrance sequence
  - No continuous background animation, no WebGL, no particle systems, no 3D

### 9.1 React Bits Effects — Approved Performance-Safe Subset

Use React Bits as a **visual/component reference**, copying only the small component logic needed into this repository. Do not install or bundle the React Bits showcase, its full catalog, Three.js, OGL, or Motion solely for these effects. Where an official example depends on a general animation runtime for a simple effect, reproduce the appearance with local CSS and the existing hooks.

| Effect | Placement | Implementation and fallback |
|---|---|---|
| **Grid/Squares-inspired background** | Hero only | Static CSS grid made from two `linear-gradient` layers plus one radial cyan glow. No canvas and no per-frame rendering. On desktop, the glow may shift gently once during hero entrance; mobile receives the static version. |
| **Blur Text–style reveal** | `Noctivus '26` hero title only | CSS opacity/blur/translate entrance with at most one span per word. Runs once, then removes `filter`/`will-change`. Reduced-motion renders final text immediately. |
| **Gradient Text** | One short hero phrase or section keyword | CSS `background-clip: text`; at most one slow entrance pass. Never apply animated gradients to paragraphs or multiple headings simultaneously. |
| **Shiny Text–style sweep** | Primary Register CTA only | CSS pseudo-element or background-position keyframe. One sweep on load and optionally one on hover/focus; no permanent animation-frame loop. |
| **Spotlight Card** | Event cards on desktop | Small local component that writes `--mouse-x` and `--mouse-y` and renders a radial-gradient pseudo-element. Enable only for `(hover: hover) and (pointer: fine)`; touch/mobile uses the normal card. |
| **Count Up** | Participant/event statistics | Start once with `IntersectionObserver`, round values without causing layout shifts, then disconnect the observer. Reduced-motion displays the final number. |
| **Split Flap Text countdown** | Hero, counting down to 26 September 2026 | Local CSS flap treatment driven by one shared one-second timer. Only changed digits animate; `aria-label` exposes a readable countdown and reduced-motion changes values without flipping. |
| **Fade/Scroll Reveal** | Section heading and first card row | One observer shared across elements; each element animates once and is unobserved immediately afterward. |

**React Bits effects deliberately rejected for V1:** Noise, Particles, Aurora, Threads, Hyperspeed, Iridescence, Grid Distortion, Magic Bento pointer particles, Tilted Card, Pixel Trail, Letter Glitch backgrounds, and other continuously rendered canvas/WebGL or cursor-trail effects. In particular, do not use the catalog's animated Noise canvas implementation; a tiny compressed static noise texture or CSS gradient is sufficient if texture is needed.

**Runtime rules:**

- Never show more than one decorative background effect in a viewport.
- No decorative effects inside the registration/payment form, event dialog body, map, or brochure viewer.
- Decorative components must be local and individually importable; do not create a single barrel import that pulls every effect into the initial bundle.
- Pointer updates, if any are added beyond Spotlight Card, must be scheduled through one `requestAnimationFrame` and stopped when off-screen or when the document is hidden.
- Remove `will-change` after entrance animations finish; permanent `will-change` layers waste memory on low-RAM phones.
- Below-the-fold media remains lazy-loaded, and long static sections may use `content-visibility: auto` with a suitable intrinsic-size fallback.
- The complete approved effects layer should add **no more than 8KB compressed JavaScript** to the production build and must not add a general animation or 3D rendering dependency.
- Validate on a real budget Android phone with CPU slowdown testing as a secondary check. If scrolling or input latency regresses, disable the hero movement first, then the card spotlight; content and registration always take priority.

**Performance budget (adapted from the animation spec, scaled to vanilla JS):**

| Metric | Mobile Target |
|---|---|
| First Contentful Paint | < 2.5s on 4G |
| Time to Interactive | < 3s |
| Initial JS (compressed) | ≤ 100KB target; measure in the production build |
| Initial page transfer (excluding optional brochure) | ≤ 1MB target |
| Max concurrent animations | 5 active |
| Particle/WebGL effects | 0 |

**Hard-disabled regardless of device:** particle backgrounds, canvas noise loops, general cursor-follow effects, 3D tilt-on-every-card, image-trail effects, auto-rotating galleries, and WebGL hero effects. The narrowly scoped desktop Spotlight Card glow in §9.1 is the only pointer-following exception. These heavier effects are not carried over even if last year's compiled site or the React Bits catalog contains related animation/rendering code.

**Always respected:** `prefers-reduced-motion` media query disables all animation.

---

## 10. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Performance** | Mobile-first; images compressed + lazy-loaded; critical CSS inlined |
| **Reliability** | Static frontend on CDN handles concurrency trivially; backend only needs to survive registration-window traffic (150 concurrent) |
| **Security** | HTTPS only; strict schema validation and normalization; CORS allowlist; request-size limit; rate limiting on `/api/register`; organizer authentication on PATCH; safe error messages; never trust client-side validation or payment amounts |
| **Data Privacy** | Store only necessary PII; no plaintext sensitive data |
| **Browser/Device Support** | Latest Chrome/Safari/Firefox/Edge; Android + iOS mobile browsers; verified on a real 2018/2019 budget device before launch |
| **Accessibility** | Readable contrast, semantic HTML, form labels, adequate tap-target sizing |

---

## 11. High-Level User Flow

```
Landing (scroll through About → Events → Schedule → Brochure/Transport → Contact)
   → Click Register → Fill participant/team details → Select event(s)
   → Review backend-derived fee → UPI Pay button (mobile) / QR code (desktop)
   → Pay in UPI app → Enter UTR and accept privacy/rules consent → Submit once
   → Backend revalidates event status, capacity, fee, duplicates, and UTR
   → Backend saves as "pending" in MongoDB → pending confirmation shown
   → [Organizer reconciles UTRs against bank statement]
   → Protected script/API updates status to "confirmed" → confirmation email sent
```

---

## 12. Milestones

| Phase | Deliverable | Owner |
|---|---|---|
| 1 | Finalize event list, content, design direction | Both |
| 2 | Build frontend single-page site (React via Vite) | You (AI-assisted/vibe coding) |
| 3 | Build backend API + MongoDB schema | Teammate |
| 4 | Connect registration form to backend | Both |
| 5 | UPI button/QR integration + reconciliation process | Teammate + you |
| 6 | Test on real old/budget phone + load test at ~150 concurrent | Both |
| 7 | Soft launch → fix issues | Both |
| 8 | Full public launch | Both |

---

## 13. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Traffic spike at registration opening | Static frontend on CDN absorbs load; backend rate-limited and kept simple enough to scale on free tier |
| Fake/random UTR entered to skip payment | Never auto-confirm; only "confirmed" after manual match against real bank statement |
| Duplicate/reused UTR | Duplicate-UTR detection flags both registrants for manual review |
| Low performance on old phones | Keep React lean, avoid heavy animation/rendering libraries, lazy-load media, test on a real device before launch, and enforce the production-build budget in §9 |
| Scope creep back toward the bigger platform | This document is the reference — new feature asks get checked against §4 (Non-Goals) first |

---

## 14. Folder Structure

```
noctivus26-website/
│
├── frontend/                          → React (via Vite)
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   │
│   ├── public/
│   │   ├── favicon.ico
│   │   ├── og-image.jpg               → social-share preview image
│   │   └── manifest.json              → lets students "Add to Home Screen"
│   │
│   └── src/
│       ├── main.jsx                   → app entry point
│       ├── App.jsx                    → stacks all sections in order
│       ├── index.css                  → global styles, CSS variables (colors/fonts)
│       │
│       ├── components/
│       │   ├── Navbar.jsx
│       │   ├── ScrollProgressBar.jsx  → thin top bar showing scroll position
│       │   ├── effects/               → approved local React Bits–inspired effects only
│       │   │   ├── HeroGrid.jsx        → static CSS grid/glow; no canvas
│       │   │   ├── RevealText.jsx      → one-time blur/fade word reveal
│       │   │   ├── ShinyText.jsx       → CSS-only CTA shine
│       │   │   └── SpotlightCard.jsx   → desktop pointer glow + static touch fallback
│       │   ├── Hero.jsx
│       │   ├── About.jsx
│       │   ├── Events.jsx
│       │   ├── EventCard.jsx
│       │   ├── Schedule.jsx
│       │   ├── Speakers.jsx
│       │   ├── SpeakerCard.jsx
│       │   ├── Sponsors.jsx
│       │   ├── Gallery.jsx            → previous-year highlights
│       │   ├── Testimonials.jsx
│       │   ├── FAQ.jsx
│       │   ├── Register.jsx
│       │   ├── Contact.jsx
│       │   ├── ScrollToTop.jsx
│       │   └── Footer.jsx
│       │
│       ├── data/                      → content lives here, not hardcoded in JSX
│       │   ├── events.js
│       │   ├── speakers.js
│       │   ├── sponsors.js
│       │   ├── gallery.js
│       │   └── faq.js
│       │
│       ├── hooks/
│       │   ├── useCountdown.js
│       │   ├── useScrollReveal.js     → wraps IntersectionObserver
│       │   ├── useCountUp.js
│       │   └── useActiveSection.js    → drives the navbar's active-link highlight
│       │
│       └── assets/
│           ├── images/
│           └── fonts/                 → only if not using Google Fonts CDN
│
└── backend/                            → Node.js + Express + MongoDB
    ├── server.js                      → entry point
    ├── package.json
    ├── .env                            → Mongo URI, UPI ID (never committed to git)
    │
    ├── config/
    │   └── db.js                      → MongoDB connection
    │
    ├── models/
    │   └── Registration.js            → Mongoose schema (§8)
    │
    ├── routes/
    │   └── registrations.js
    │
    ├── controllers/
    │   └── registrationController.js  → handles FR18/FR19 logic
    │
    ├── middleware/
    │   ├── validateRegistration.js    → server-side field/UTR validation
    │   └── rateLimiter.js             → protects /api/register from spikes/abuse
    │
    └── utils/
        └── generateUpiLink.js         → builds the upi://pay string per FR12
```

**Why this split:** two clean folders (`frontend/`, `backend/`) that deploy independently — `frontend/` builds to a static `dist/` and goes to Vercel/Netlify, `backend/` runs on Render/Railway. Your teammate works entirely inside `backend/` without needing to touch React code, and you work entirely inside `frontend/src/` without needing to understand Express routes.

---

## 15. Extra Polish — Animation Ideas (Still Within the §9 Performance Budget)

All of these are pure CSS or a few lines of vanilla JS/React hooks — no animation libraries, no continuous canvas/WebGL rendering. They add real visual polish for a "professional" feel without threatening old-phone performance.

| Feature | What it does | Cost |
|---|---|---|
| **Scroll progress bar** | Thin colored bar at the very top of the page that fills as the visitor scrolls | One scroll listener + CSS `width` transition — negligible |
| **Active-section nav highlight** | The navbar link for the section currently in view gets an underline/glow | `IntersectionObserver` + CSS transition — cheap |
| **FAQ accordion** | Questions expand/collapse smoothly on tap | Pure CSS `max-height`/`grid-template-rows` transition — no JS animation needed |
| **Gallery hover/tap zoom** | Images scale slightly on hover/tap | CSS `transform: scale()` — GPU-accelerated, near-zero cost |
| **Sponsor logo marquee** | Sponsor logos scroll continuously in a strip | Pure CSS `@keyframes translateX` loop — despite being continuous, this is one of the cheapest possible animations (single transform, no repaint) |
| **Testimonial fade/slide** | Quotes rotate every few seconds | CSS `scroll-snap` or a simple opacity crossfade — no carousel library |
| **Button tap ripple** | Small ripple effect from the tap point on CTA buttons | Pure CSS, triggered on `:active` |
| **Page fade-in on load** | Whole page fades in once fonts/critical CSS are ready, avoiding a flash of unstyled content | One CSS class toggle on load |
| **Scroll-to-top button** | Appears after scrolling past the hero, smooth-scrolls back up | CSS `scroll-behavior: smooth` + visibility toggle on scroll |

---

## 16. Additional Professional Features (Optional but Recommended)

These round out the site so it feels like a complete event platform rather than a bare landing page — all still static content, no new backend complexity beyond what's already in §7.3.

- **FAQ section** — common questions (fees, team size, what to bring, accommodation, deadlines) in an accordion (see §15)
- **Gallery/highlights** — a small grid of photos from last year's edition (or teaser/venue photos if this is the first), builds credibility and excitement
- **Testimonials** — 2-4 short quotes from past participants, faculty, or coordinators
- **Brochure download** — a single PDF with the full event/rulebook details, linked from the Events section, for students who want offline reference
- **Community link** — a WhatsApp/Telegram group invite link for announcements and doubt-clearing, placed near Register/Contact
- **SEO & social sharing polish** — proper page `<title>`, meta description, and an Open Graph image so the link looks good when shared on WhatsApp/Instagram, not just a bare URL
- **"Add to Home Screen"** — a minimal `manifest.json` + icon so students can save the site to their phone home screen like an app (no offline/service-worker complexity needed for this alone)
- **Scroll-to-top button** — small UX touch for a long single-scroll page (see §15)

**Deliberately still excluded** (per §4 Non-Goals): live chat widgets, newsletter/email-capture systems, social media feed embeds, and anything requiring a new backend endpoint beyond registration — these add real complexity/maintenance for a one-time event site and aren't worth it at this scope.

---

## 17. Open Questions

1. Final event list and fees (technical/non-technical/workshops)?
2. Team size limits per event?
3. Who holds the UPI ID payments go to, and who does daily reconciliation?
4. Fixed registration opening date/time, or rolling open?
5. Confirmation email sender — Gmail SMTP, or a service like Resend (free tier)?
6. Do you have photos/testimonials from a previous edition for §16's Gallery/Testimonials, or is this the first year (in which case those sections get dropped or replaced with teaser content)?
7. Is a brochure/rulebook PDF being prepared separately, or does content for it still need to be written?
8. Capacity for each event, and should a full event close immediately or offer a waitlist?
9. Can one student register for multiple events, and how should schedule conflicts be handled?
10. For team events, does the captain pay for the whole team, and is one UTR expected per team?
11. What is the cancellation/refund policy, and who approves exceptions?
12. What privacy notice and data-retention period has the college approved for participant data?
13. Which Noctivus '25 content should carry forward: transport routes, venue map, social links, contacts, brochure format, and event-rule layout?
