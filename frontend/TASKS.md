# TASKS.md — Frontend rebuild, in order

Do these in order. Each phase has a checkpoint — don't start the next
phase until the checkpoint is cleared. References: `RULES.md` (palette,
shapes, fonts), `WIREFRAME.md` (section order, nav, payment UI),
`OVERFLOW_FIX.md` (still needs to land if it hasn't already).

---

## Phase 0 — Cleanup / groundwork

- [ ] Land the `OVERFLOW_FIX.md` fix (hero + any other `100svh` +
      centered-flex sections) if not already applied — verify no section
      overflows at common desktop and short-viewport heights.
- [ ] Inventory every current route/page file in the repo. Post the list.
- [ ] Inventory `experience-grid`/`feature-panel`, `faq-item`, and any
      Contact section content — report what's actually in each (real
      content vs empty/placeholder) so cut/keep/fold decisions (per
      `WIREFRAME.md`) can be made with real information, not guesses.
- [ ] Audit `variables.css` for `--violet` / `--amber` / `--coral` usages
      — list every place they're used before touching palette.

**Checkpoint:** show the route inventory + content audit + color-usage
audit. Wait for cut/keep/fold decisions before Phase 1.

---

## Phase 1 — Foundation: palette + fonts

- [ ] Update `variables.css` to the RULES.md §1 palette. Replace
      `--violet`/`--amber`/`--coral` usages per the Phase 0 audit
      (semantic red for real form errors only, everything else →
      cyan/teal/lime).
- [ ] Add Chakra Petch as the display font (h1/h2, oversized numerals).
      Keep mono stack for body/nav/labels/data. Confirm three font roles
      total, no creep.
- [ ] Do NOT touch layout, spacing tokens, or shapes yet — this phase is
      color + type only, so the diff is reviewable in isolation.

**Checkpoint:** show the `variables.css` diff and a couple of screenshots
(any section, doesn't need to be final) with new colors/fonts applied
before continuing.

---

## Phase 2 — Sidebar nav

- [ ] Convert current top pill nav to persistent vertical sidebar
      (desktop). Logo, anchor links (Home/About/Events/Schedule/
      Coordinators), Register CTA, scrollspy active-state highlighting.
- [ ] Define and build mobile behavior — drawer or icon rail (pick one,
      state which and why) — since a persistent sidebar doesn't survive
      narrow viewports as-is.
- [ ] Verify sidebar doesn't collide with the `--page` max-width
      container math from the spacing system — main content area needs
      its own effective width once sidebar takes up permanent horizontal
      space on desktop.

**Checkpoint:** show desktop + mobile nav before proceeding — this is a
structural change, not a style tweak, worth a look before it ripples
into every section's layout.

---

## Phase 3 — Hero

- [ ] Build the notched hero panel shape (RULES.md §2B) — chamfered
      corner, jagged step-notch, bottom tick-mark bar.
- [ ] Rebuild countdown as the hero's signature moment: bigger digits,
      Chakra Petch, glow/tick accent on unit change, positioned in/around
      the notched panel.
- [ ] Confirm hero still contains: eyebrow, title, tagline, when/where,
      countdown, CTAs — same content as now, new shape/type treatment
      only.
- [ ] Mobile pass: simplify the notch if it clips content at 375px.

**Checkpoint:** hero alone, desktop + mobile, before touching any other
section — this is the highest-visibility piece and the template for
every other panel.

---

## Phase 4 — Remaining sections (single pass, once hero is approved)

- [ ] About — chamfered-corner cards/stats per approved motif.
- [ ] Events — grid + filters + event cards with the repeatable shape
      motifs (chamfer, corner brackets), event numerals in display font.
- [ ] Event modal, registration modal (config-driven fields per event,
      per `WORKFLOW.md` Phase 2 intent even though the rest of that doc
      is stale), payment modal — **UPI QR + UTR entry, not Razorpay
      checkout** — with an honest "pending verification" state after
      submit, not an instant-success state.
- [ ] Event day schedule/timeline.
- [ ] Coordinators (crew grid).
- [ ] Footer — venue callout, links, tick-mark divider motif.
- [ ] Apply Phase 0's cut/keep/fold decisions for Experience/FAQ/Contact.

**Checkpoint:** full single-page scroll, desktop, before mobile pass.

---

## Phase 5 — Mobile + QA pass

- [ ] Full page at mobile width: sidebar behavior, hero notch, all
      section shapes, modals (registration/payment especially — these
      have real forms and can't afford broken input layouts).
- [ ] Confirm no `100svh`-centered-flex overflow reintroduced anywhere
      (recheck per `OVERFLOW_FIX.md`'s method).
- [ ] Confirm every color traces to the RULES.md palette — no stray
      hues left over from before.
- [ ] Confirm no fabricated/filler copy was added anywhere (RULES.md §5).

**Checkpoint:** final review before calling this done.

---

## Not in scope for this task list

- Public check-in pass page (`/p/{token}`) and admin panel — separate
  surfaces, separate task list if/when needed.
- Rewriting `WORKFLOW.md` to match the real UPI/UTR flow — worth doing,
  but it's a docs task, not a frontend build task; do it separately so
  it doesn't block this list.
