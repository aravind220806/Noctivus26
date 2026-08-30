# NOCTIVUS '26 — FRONTEND DESIGN RULES

## 1. DESIGN INTENT

NOCTIVUS '26 is an old/dusted cyberpunk technical symposium interface.

The visual reference is:
- Blade Runner
- Akira
- Ghost in the Shell
- early Cyberpunk 2077 web/marketing layouts
- aggressive editorial / technical web composition

This is NOT:
- clean sci-fi
- generic dark mode
- glassmorphism
- futuristic SaaS
- neon gradients
- polished chrome
- rounded-card UI

Every element should feel like:
old military hardware + terminal interface + neon infrastructure.

Cold. Precise. Utilitarian. Slightly damaged.

---

## 2. COLOR — ABSOLUTELY LOCKED

Only these colors may be introduced as design tokens:

--bg:      #060504
--surface: #0C0A09
--line:    rgba(0, 210, 230, 0.12)
--cyan:    #00C8E0
--teal:    #00D4A8
--lime:    #A7FF18
--text:    #E8EDE8
--muted:   #506058
--error:   #FF786A

No yellow.
No orange.
No red except validation errors.
No magenta.
No violet.
No pink.
No blue variants.
No additional accent colors.

Lime is a signal color, not a decorative color.

Maximum simultaneous lime usage: 2 meaningful elements.

---

## 3. TYPOGRAPHY

### ALDRICH

Primary structural/display typeface.

Use for:
- hero title
- section headings
- large numerals where appropriate
- major labels
- event names
- important UI headings

Weight: 400 only.

Never synthesize bold.

### SAMAKAN

Secondary expressive display typeface.

Use sparingly for:
- selected decorative/display words
- cultural/identity moments
- special hero treatments
- occasional section accents

It must never become the default body font.

### JETBRAINS MONO

Technical/data typeface.

Use for:
- navigation metadata
- event metadata
- body/supporting text
- timestamps
- technical labels
- buttons where appropriate
- countdown
- system/status information

No fourth font family without explicit approval.

---

## 4. GEOMETRY

Border radius:
- 0px by default
- maximum 2px where technically necessary

Never use:
- pill shapes
- rounded cards
- circular UI containers unless the content itself requires a circle

Primary geometry is CSS polygon clipping.

The interface should use:
- chamfers
- notches
- diagonal cuts
- asymmetric boundaries
- stepped edges
- interrupted borders

Geometry should feel engineered rather than decorative.

---

## 5. CORE UI PRIMITIVES

The approved primitive system is:

1. HudPanel
2. HudCorners
3. NotchedButton
4. HeadingBar
5. TickDivider
6. AsymSection

These are the canonical visual building blocks.

Do not create one-off equivalents inside individual sections.

If a new visual pattern is required repeatedly, promote it to a primitive.

---

## 6. SURFACES

Panels use:

--surface

with subtle:
- grain
- scanlines where appropriate
- structural borders
- accent glow

Grain opacity should remain extremely low.

Scanlines are atmospheric, not a visual effect competing with content.

Never use:
- glassmorphism
- backdrop blur
- frosted panels
- floating translucent cards
- giant gradient blobs

---

## 7. GLOW

Glow is atmospheric.

Use diffuse glow rather than razor-sharp neon borders.

Preferred range:

0 0 8px -4px accent
0 0 16px -4px accent

Accent opacity generally stays around 15–25%.

Do not make every element glow.

The page should feel illuminated by infrastructure, not covered in neon.

---

## 8. LAYOUT PHILOSOPHY

The page is editorial and asymmetric.

Do NOT build the page as:

card
card
card
card
card

Instead alternate between:

- large visual zones
- asymmetric sections
- technical panels
- oversized typography
- open negative space
- diagrams
- data blocks
- imagery
- structural dividers

Major sections should feel like different zones of the same machine.

---

## 9. ASYMMETRY

Asymmetry is a primary design tool.

Preferred compositions:

70/30
65/35
60/40

Large visual blocks may occupy most of the viewport.

The boundary between major zones should frequently be:
- diagonal
- stepped
- jagged
- notched

Avoid centered symmetrical compositions unless there is a strong content reason.

---

## 10. HERO

Hero is the visual signature of the website.

It should contain:

- dragon/logo identity
- presentation label
- NOCTIVUS '26
- tagline
- date
- venue
- CountdownTracker
- primary CTA
- secondary CTA

Hero composition uses the AsymSection language.

CountdownTracker is existing functionality and must be reused rather than rewritten unnecessarily.

The countdown should feel like physical instrumentation.

---

## 11. NAVIGATION

Desktop:
- persistent vertical sidebar
- fixed to the edge
- anchor navigation
- active section indicator
- Register CTA

Mobile:
- sidebar disappears
- hamburger control
- off-canvas navigation drawer

No pill navigation.

No conventional horizontal navbar.

---

## 12. SECTIONS

Canonical order:

1. Hero
2. About
3. Events
4. Schedule
5. Coordinators
6. Footer

Sections should NOT all share the same layout.

### About

Large manifesto + supporting statistics.

### Events

Filterable event system.

Event cards open the existing event-detail flow.

### Schedule

Existing Timeline functionality is preserved and reskinned.

Desktop:
Gantt/timeline.

Mobile:
agenda/list.

### Coordinators

Technical crew/personnel presentation.

### Footer

Venue + relevant links + socials.

---

## 13. EVENTS / REGISTRATION

Existing backend contracts remain authoritative.

Frontend must use:

Event
→ Event Details
→ Registration
→ UPI QR
→ UTR submission
→ Pending Verification

Never implement Razorpay based on stale documentation.

Never tell the user registration is instantly confirmed when backend verification is manual.

Registration forms must remain configuration-driven.

---

## 14. EXISTING FUNCTIONALITY

Preserve working functionality unless explicitly replacing its visual implementation.

Especially preserve:

- CountdownTracker
- event data
- registration API
- payment/UTR API
- Timeline logic
- admin routes
- pass verification route
- VenueMap functionality
- API layer

Visual components may be rewritten.

Backend contracts may not be casually changed.

---

## 15. RESPONSIVE DESIGN

Mobile-first.

Base CSS targets mobile.

Desktop layouts are introduced with:

@media (min-width: ...)

Never write desktop grid/flex layouts globally and override them later for mobile.

At <=700px:
- polygon cuts become shallower
- asymmetry remains
- panels remain angular
- large compositions stack
- no horizontal scrolling

At <=900px:
- desktop sidebar becomes mobile drawer

Never solve responsive problems using:
- overflow-x hacks
- arbitrary negative margins
- nowrap
- shrinking text to unreadable sizes

Fix the actual layout constraint.

---

## 16. SPACING

Whitespace is intentional.

Do not compress sections simply to fit more content above the fold.

Major sections should have clear breathing room.

Use a consistent spacing scale rather than arbitrary values.

---

## 17. MOTION

Motion should feel mechanical.

Allowed:
- glitch
- brief skew
- decode/scramble
- restrained opacity transitions
- subtle movement
- scan effects

Avoid:
- bouncy spring animations
- excessive parallax
- floating particles
- decorative starfields
- smooth glass UI transitions

Respect:

prefers-reduced-motion

Existing CountdownTracker motion behavior is the reference.

---

## 18. FORBIDDEN VISUAL PATTERNS

Never introduce:

- rounded cards
- pill buttons
- glassmorphism
- gradient backgrounds
- gradient text
- floating blobs
- particle fields
- snow effects
- starfields
- generic neon borders everywhere
- excessive shadows
- random colors
- generic SaaS layouts
- AI-default cyberpunk fonts

---

## 19. IMPLEMENTATION PRINCIPLE

Build the visual system first.

Then build layout.

Then compose sections.

Then wire content.

Then polish responsive behavior.

Do not decorate a broken layout.

Do not fix symptoms with overrides.

Fix problems at their source.

---

## 20. CHECKPOINT RULE

One meaningful unit per checkpoint.

Each checkpoint requires:

- desktop verification
- mobile verification
- visual inspection
- no horizontal overflow
- no console errors

Only after approval should the checkpoint be committed.

---

## 21. DESIGN TEST

Before approving any component, ask:

"Would this look at home on a generic modern SaaS website?"

If yes, it probably does not belong here.

The desired result should feel:

ENGINEERED
ASYMMETRIC
AGED
TECHNICAL
RAW
CONTROLLED
CYBERPUNK
