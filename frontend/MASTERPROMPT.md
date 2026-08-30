# NOCTIVUS '26 — MASTER BUILD DIRECTIVE

You are the implementation agent for the NOCTIVUS '26 frontend rebuild.

Repository:
frontend/

Stack:
React + Vite

NOCTIVUS '26:
National-level technical symposium
Department of CSE (Cyber Security)
Velammal Engineering College, Chennai
26 September 2026

============================================================
0. PRIMARY OBJECTIVE
============================================================

Rebuild the PUBLIC NOCTIVUS '26 website into a distinctive
old/dusted cyberpunk technical interface.

The target visual language is:

- Blade Runner
- Akira
- Ghost in the Shell
- early Cyberpunk 2077 web/marketing composition
- technical/editorial layouts
- asymmetric visual zones
- worn industrial hardware
- analog military/HUD instrumentation

The target is NOT:

- generic dark mode
- modern SaaS
- glassmorphism
- clean sci-fi
- polished futuristic UI
- rounded cards
- neon gradients
- floating blobs
- excessive glow
- generic AI-generated cyberpunk styling

The site should feel engineered, asymmetric, raw and deliberate.

============================================================
1. SOURCE OF TRUTH
============================================================

Use these as the authoritative project references:

1. This directive
2. WIREFRAME.md
3. approved primitives-demo.html
4. existing backend/API contracts
5. existing working functionality

If sources conflict:

This directive wins for implementation/design rules.

WIREFRAME.md wins for page structure.

Backend/API implementation wins for backend behavior.

Do not invent missing requirements.

Do not silently substitute design decisions.

============================================================
2. DO NOT DESTROY WORKING FUNCTIONALITY
============================================================

The existing frontend contains working functionality.

Preserve functionality while replacing the public visual
architecture.

Important existing functionality to preserve:

- Countdown / SplitFlapCountdown
- event data
- event filtering
- EventModal
- RegistrationModal
- registration API
- UPI / UTR payment flow
- Timeline functionality
- VenueMap
- API utilities
- public pass route
- admin route
- authentication/admin functionality

The visual implementation of these components may be rewritten.

Their backend contracts must not be casually changed.

Do not rewrite working logic merely to make it stylistically cleaner.

============================================================
3. ROUTES
============================================================

The public site becomes one single-scroll page.

Public sections:

1. Hero
2. About
3. Events
4. Schedule
5. Coordinators
6. Footer

Desktop navigation:

Home
About
Events
Schedule
Coordinators
Register

Desktop navigation is a persistent vertical sidebar.

Mobile navigation:

- sidebar disappears
- hamburger button appears
- navigation opens as an off-canvas drawer
- drawer overlays the page
- drawer must not cause horizontal overflow

Separate routes remain separate:

- /p/{token} → public pass/check-in page
- /admin → admin application
- /login → admin authentication if currently required

Do not merge these into the marketing page.

============================================================
4. EVENT DATA
============================================================

NOCTIVUS has exactly 8 real event entries.

The existing source may contain an additional/demo/workshop entry.

Do NOT treat that as a ninth public event.

Do not fabricate replacement event data.

Before removing existing data, determine whether it is referenced
by functionality elsewhere.

============================================================
5. COLOR SYSTEM — ABSOLUTELY LOCKED
============================================================

Use ONLY:

--bg:      #060504
--surface: #0C0A09
--line:    rgba(0, 210, 230, 0.12)
--cyan:    #00C8E0
--teal:    #00D4A8
--lime:    #A7FF18
--text:    #E8EDE8
--muted:   #506058
--error:   #FF786A

No other visual colors.

No:
- yellow
- orange
- magenta
- violet
- purple
- pink
- blue variants
- amber
- coral

Error red may ONLY be used for genuine form validation errors.

Lime is a signal color.

Maximum simultaneous lime usage:
2 meaningful UI elements.

Do not use lime as decoration.

Every hardcoded color introduced into the public frontend must
trace to the approved palette.

============================================================
6. TYPOGRAPHY — LOCKED
============================================================

Three approved font roles:

ALDRICH
Primary structural/display typeface.

Use for:
- hero title
- section headings
- major event names
- large display text
- important visual labels

Weight:
400 only.

Never synthesize bold.

SAMARKAN
Secondary expressive display typeface.

Use sparingly for:
- special identity moments
- selected decorative/display words
- occasional hero/section treatment

Do not use it for body copy.

JETBRAINS MONO
Technical/data typeface.

Use for:
- body
- navigation metadata
- labels
- event metadata
- timestamps
- technical UI
- countdown
- supporting information

No fourth font family.

Use local font files when available.

Do NOT replace these fonts with:
- Chakra Petch
- Rajdhani
- Orbitron
- Inter
- Roboto
- Arial
- system-ui

============================================================
7. GEOMETRY
============================================================

Border radius:

0px by default.

Maximum 2px only when technically necessary.

Never use:
- pill UI
- rounded cards
- soft rounded containers

Use:

- clip-path polygons
- chamfers
- notches
- diagonal cuts
- stepped edges
- interrupted borders
- angular brackets

The approved primitives-demo.html is the visual reference.

Do not casually alter its geometry.

============================================================
8. APPROVED UI PRIMITIVES
============================================================

Create reusable React primitives:

src/components/ui/

HudPanel
HudCorners
NotchedButton
HeadingBar
TickDivider
AsymSection

These components form the shared visual language.

Do NOT recreate these patterns independently inside sections.

If a visual pattern is needed repeatedly, turn it into a
reusable primitive.

============================================================
9. HUD PANEL
============================================================

HudPanel is the standard angular surface.

Characteristics:

- --surface background
- polygon geometry
- structural accent border
- subtle diffuse accent glow
- subtle grain overlay
- optional scanlines
- responsive simplified geometry

Supported accent colors:

cyan
teal
lime

Do not allow arbitrary colors.

============================================================
10. HUD CORNERS
============================================================

HudCorners:

- four L-shaped corner brackets
- small
- technical
- subtle
- cyan by default
- reusable on panels/cards/modals

Use the existing countdown implementation as the behavioral
reference where applicable.

============================================================
11. NOTCHED BUTTON
============================================================

Primary:

- cyan surface
- dark text
- angular notch geometry

Ghost:

- transparent/surface background
- cyan structural border
- cyan text

Primary hover may use the approved brief skew glitch.

Do not create smooth glossy button animations.

============================================================
12. HEADING BAR
============================================================

Headings use:

Aldrich

HeadingBar sits underneath the heading.

Hierarchy:

H1 → cyan
H2 → teal
H3 → muted

Do not create hierarchy through random font families.

============================================================
13. TICK DIVIDER
============================================================

TickDivider replaces ordinary <hr> styling.

Characteristics:

- thin structural line
- repeated ticks
- mostly muted
- occasional cyan structural ticks
- subtle
- full-width where appropriate

Ticks are decorative.

Do not attach fake system labels to decorative elements.

============================================================
14. ASYM SECTION
============================================================

AsymSection is the major compositional layout primitive.

Preferred ratios:

70/30
65/35
60/40

Large visual block + smaller information block.

The dividing boundary should be angular/asymmetric.

Desktop:
large side-by-side composition.

Mobile:
stack vertically.

Do NOT remove asymmetry on mobile.

Simplify the polygon instead.

============================================================
15. SURFACE TEXTURE
============================================================

Dark surfaces may use:

- extremely subtle CSS grain
- subtle scanlines

Texture must remain atmospheric.

Do not use:
- particle fields
- starfields
- snow
- floating symbols
- decorative asterisks
- excessive animated noise

============================================================
16. GLOW
============================================================

Glow is structural/atmospheric.

Use diffuse glow.

Typical:

0 0 8px -4px accent
0 0 16px -4px accent

Do not make every element glow.

Avoid:
- huge neon bloom
- sharp neon outlines everywhere
- excessive shadows

============================================================
17. HERO
============================================================

Hero is the signature visual section.

Must contain:

- NOCTIVUS identity/logo
- department credit
- NOCTIVUS '26
- tagline
- date
- venue
- countdown
- primary CTA
- secondary CTA

Use the approved AsymSection / hero geometry.

The existing CountdownTracker/SplitFlapCountdown is reused.

Do not rewrite countdown logic unless necessary.

Countdown remains technical/monospace.

The countdown should feel like physical instrumentation.

============================================================
18. ABOUT
============================================================

About section contains:

- manifesto/about copy
- real statistics

Use asymmetric/editorial composition.

Do not turn the entire section into identical cards.

============================================================
19. EVENTS
============================================================

Exactly 8 real events.

Provide:

- event filtering
- event cards
- event details modal
- registration CTA

Event details:

- rules
- fee
- team size
- registration action

Reuse existing event data and functionality.

============================================================
20. REGISTRATION
============================================================

Registration must remain configuration-driven.

Flow:

Event
→ Event Details
→ Registration
→ Payment
→ UTR submission
→ Pending Verification

Payment is:

UPI QR + UTR entry.

NOT Razorpay.

Do not build a Razorpay iframe.

Do not claim instant confirmation.

The UI must explicitly communicate:

Pending verification / manual verification.

============================================================
21. SCHEDULE
============================================================

Reuse the existing Timeline functionality.

Desktop:

Gantt/timeline presentation.

Mobile:

agenda/list presentation.

Do not throw away the existing row-packing logic without reason.

============================================================
22. COORDINATORS
============================================================

Use real coordinator data.

Use the new visual system.

Avoid generic profile-card styling.

============================================================
23. FOOTER
============================================================

Footer contains:

- venue
- useful links
- social links
- relevant contact information

Do not create a separate Contact section unless the existing
implementation contains real functionality that requires it.

============================================================
24. RESPONSIVE RULES
============================================================

Mobile-first CSS.

Base styles = mobile.

Desktop enhancements use:

@media (min-width: ...)

Never put desktop grid declarations in base CSS and override them
with max-width rules.

At <=700px:

- simplify polygon cuts
- reduce chamfer depth
- stack major asymmetric sections
- preserve visual identity
- eliminate horizontal overflow

At <=900px:

- desktop sidebar becomes hamburger + off-canvas drawer

Never solve layout problems using:

- overflow-x hacks
- arbitrary negative margins
- nowrap
- tiny unreadable text

Fix the underlying layout.

Required validation widths:

375px
768px
1440px

============================================================
25. CONTENT DISCIPLINE
============================================================

Never fabricate:

- event names
- statistics
- dates
- people
- venue information
- sponsor information
- system status
- fake HUD telemetry

Do not add fake labels such as:

SYSTEM ONLINE
SYS-01
STATUS: ACTIVE

unless that text represents real information.

Decorative geometry may exist without fake telemetry.

============================================================
26. OLD COMPONENTS
============================================================

Do not mass-delete the existing component tree.

Use this strategy:

1. preserve working functionality
2. create the new component architecture
3. migrate the public page
4. verify behavior
5. identify genuinely unused files
6. propose deletion
7. delete only after confirmation

Admin/pass functionality must remain intact.

============================================================
27. IMPLEMENTATION ARCHITECTURE
============================================================

Target architecture:

src/
├── components/
│   ├── ui/
│   │   ├── HudPanel/
│   │   ├── HudCorners/
│   │   ├── NotchedButton/
│   │   ├── HeadingBar/
│   │   ├── TickDivider/
│   │   └── AsymSection/
│   │
│   ├── navigation/
│   │   ├── Sidebar.jsx
│   │   └── MobileDrawer.jsx
│   │
│   ├── countdown/
│   │   └── CountdownTracker.jsx
│   │
│   └── ...
│
├── sections/
│   ├── Hero/
│   ├── About/
│   ├── Events/
│   ├── Schedule/
│   ├── Coordinators/
│   └── Footer/
│
├── pages/
│   └── ...
│
└── styles/
