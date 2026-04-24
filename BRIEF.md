# Zenimator — Project Brief

## What we're building

An internal web tool that takes a static ZEN.COM illustration or screen
and generates animated versions of it. A designer uploads an SVG
illustration or a PNG/JPG screen, picks an **animation category**
(Entrance, Ambient loop, or Rigged motion), and Zenimator uses an LLM
to semantically group the visual elements and propose tasteful
per-group animations appropriate to that category. The designer tweaks
parameters, previews the result, and exports as MP4, GIF, or an
animation spec JSON that mobile engineers can re-implement natively.

The goal is to shrink the loop between "I have a static mockup" and
"I have an animated version I can show stakeholders or hand to
engineering." Today that loop involves jumping to After Effects,
Rive, or Principle and often dies on the vine because the setup cost
isn't worth the 30-second clip at the end.

Zenimator aims for a 2-minute loop: upload → tweak → export.

**This is an internal tool for the ZEN.COM design team.** It does not
need polished onboarding, error recovery theater, or marketing-grade
empty states. It needs to do the core job fast and well for smart users
who understand the domain.

---

## User & context

**Primary user:** Artur (product designer at ZEN.COM) and the broader
ZEN.COM design team.

**Secondary user:** PMs and engineers who receive exports (video for
review, JSON spec for implementation).

**Primary use cases:**

1. Designer has just finished a new illustration for the ZEN app and
   wants to propose how it should animate on screen entry.
2. Designer has a full-screen mockup (PNG/JPG export from Figma) and
   wants to show stakeholders how the screen will feel in motion.
3. Designer is handing off to mobile engineering and needs to specify
   animation timings, easings, and stagger values in a format the
   engineer can re-implement in React Native Reanimated.

**Deployment:** run locally during development. Once stable, can be
deployed to an internal URL (Vercel with SSO, or simply a password-
protected Netlify) — but that's out of scope for v1. The app itself is
client-only, no backend. The LLM call goes directly from the browser
to the Anthropic API using a user-supplied API key stored in
localStorage (acceptable for an internal tool on a trusted network).

---

## Why LLM-driven grouping

The original v0 of this tool used heuristic SVG detection — walking
the DOM, finding `<g>` elements, classifying by bounds and aspect
ratio. It worked on cleanly-structured SVGs but failed on the vast
majority of real-world ZEN illustrations, which come out of Figma as:

- A single wrapper `<g>` containing dozens of flat `<path>` siblings
- Two-to-three levels of wrapper `<g>`s with no semantic intent
- Color groups that the eye reads as "card body" or "coin" but which
  the DOM expresses only as neighboring paths with no grouping tag

No reasonable heuristic can look at flat paths and say "these six
strokes form the coin." A vision-capable LLM can. It sees the rendered
image, reads the SVG structure, and returns a mapping of path IDs to
meaningful semantic groups — which is exactly what the animation
engine needs to do its job.

The tradeoff: every upload incurs a ~2s API call and fractions of a
cent. For an internal tool that saves a designer 30 minutes of
After Effects setup, that tradeoff is unambiguous.

---

## Scope for v1 (explicit)

**In scope:**
- **Entrance** animation category (one-shot arrival: fade, slide,
  scale, pop, stagger). This is the only fully-implemented category
  in v1.
- **Category framework** — architecture, UI selector, and
  category-aware LLM prompt plumbing for all three categories, even
  though only Entrance is active. Ambient and Rigged appear in the
  selector with a "Coming soon" tag. This preparation means v1.1/v1.2
  can ship as additive changes, not breaking refactors.
- SVG illustration upload → rasterize → Claude vision call → semantic
  groups with per-group entrance animations → rendered preview
- PNG/JPG full-screen upload → whole-image entrance animation (no LLM
  call needed; single group, fixed template options)
- Heuristic fallback grouper (for dev mode, offline, or API failure —
  not the primary path, but always available)
- Interactive parameter editing (duration, delay, easing, distance,
  stagger) on top of LLM-proposed defaults
- Live preview player
- Export: MP4 video, animated GIF, animation spec JSON (includes the
  `category` field from day one — no breaking schema change later)
- Settings drawer for Claude API key management
- LocalStorage for last-used settings, API key, and a hash-keyed cache
  of LLM responses (so re-uploading the same SVG is instant + free)

**Deferred to v1.1 — Ambient loop:**
- Continuous, looping, subtle motion (breathing, floating, parallax
  drift, celebration shimmer) on hero illustrations, empty states,
  and splash screens.
- New template family: `breathe`, `float`, `drift`, `shimmer`.
- Looping playback support in the player (`iterations: Infinity`,
  alternating direction).
- Category-specific system prompt for the LLM ("this is ambient —
  avoid entry states, propose continuous motion").

**Deferred to v1.2 — Rigged motion:**
- Character/figure animation: walk cycles, waves, idle sway.
- Multi-phase keyframes (timelines with 4–6 waypoints per part).
- Per-element custom transform-origin (joint pivots supplied by the
  LLM as viewport coordinates).
- Synchronized phase offsets across groups (left arm ↔ right leg).
- Category-specific system prompt for the LLM ("identify anatomical
  parts, propose a walk cycle rig").

**Out of scope entirely:**
- User-drawn animation regions over PNG inputs (v3)
- LLM analysis of bitmap (PNG/JPG) inputs (v1 treats them as a single
  whole-image group; semantic regions in bitmaps is a v3 concern)
- Lottie JSON export (requires animations to be defined in Lottie's
  data model from the start — too constraining for our approach)
- Production-ready CSS/Framer Motion/Reanimated code export (the JSON
  spec is the handoff format; devs implement in their native framework)
- Multi-user collaboration, accounts, cloud storage
- Complex timeline editor UI (simple per-group parameter sliders are
  enough; no full After Effects timeline)
- Shared/proxied API key (every user uses their own key; no backend
  relay to hide a shared key)
- Micro-interaction animations (tap feedback, toggle states) — those
  need real user input to preview, which is a different workflow than
  Zenimator's upload-preview-export loop.

---

## Release phasing — v1, v1.1, v1.2

Zenimator ships in three additive releases. The category framework is
landed up front so later releases are feature additions, not
architectural rewrites.

### v1 — Entrance (ship target)
The complete upload → LLM grouping → preview → export loop, running
exclusively on Entrance-category animations. Ambient and Rigged
appear in the category selector but are greyed out with "Coming
soon" badges. Every piece of the architecture — the `category` field
on `Scene`, the category-aware system prompts, the template registry
organized by category, the export JSON schema — is already in place.
Ship this to the ZEN design team and let them use it daily on real
illustrations before broadening scope.

### v1.1 — Ambient loop (post-ship)
Unlock the Ambient category in the selector. Add new template family
(`breathe`, `float`, `drift`, `shimmer`), iteration/direction
playback support in the player, and an ambient-specific system prompt
that asks the LLM to propose *continuous* motion instead of an entry
sequence. Export pipeline extends to record N seconds of a loop
(default 3–4s) and loop-seamlessly for GIFs. Relatively small work
item — 2–3 milestones — because much of the animation engine already
supports it.

### v1.2 — Rigged motion (later)
Unlock the Rigged category. The biggest addition: a different data
shape for keyframes (multi-phase timelines instead of
start-to-end), per-element custom transform-origin for joint pivots,
synchronized phase offsets across groups, and a rig-specific LLM
prompt that reasons about anatomy and motion. This is a distinct
workflow — the designer may need to correct pivot points
occasionally — so we also need a light rigging affordance in the
Controls panel. Plan for 4–6 milestones; this is the most ambitious
category.

### Non-goals for early releases
- Mixing categories in one Scene. A Scene has *one* category. If a
  designer wants entrance + ambient on the same illustration, they
  export two clips and composite externally. Keeping Scenes
  single-category preserves the mental model and the spec JSON.
- Backporting polish across releases. If v1 ships with a rough
  Ambient placeholder, v1.1 replaces it entirely — we don't patch
  the v1 stub.

---

## Visual style — ZEN Portal aesthetic

Primary reference: **my.zen.com/ui/auth/challenge** and the attached
ZEN dashboard screenshots (the main banking portal's web UI). Zenimator
should **directly inherit** the ZEN portal's visual language — same
typography (Nunito), same colors, same shape language, same button
styles. It's an internal ZEN tool and should feel like a native member
of the ZEN product family, not a sibling application with its own look.

The ZEN look is **calm, monochrome, modern-fintech** — very different
from Sword Forge's forged UI or Knight Dress-Up's illuminated manuscript.

### Core visual principles

1. **Monochrome-first.** Near-pure white backgrounds, deep near-black
   text and accents. Color is used sparingly — almost entirely
   black-and-white interface with one occasional accent for state.
2. **High contrast, low noise.** No decorative textures, no gradients
   on UI chrome. The interface recedes; the content (animation preview)
   is the focus.
3. **Rounded geometry.** ZEN uses soft rounded corners on buttons and
   cards (8-16px radius), fully-rounded pill buttons for primary
   actions, circular icon containers. This is very different from the
   sharp corners of Sword Forge — embrace the softness.
4. **Generous whitespace.** Let UI elements breathe. Compact density is
   for spreadsheets, not this tool.
5. **One friendly sans-serif.** Clean geometric sans for all text. No
   display faces, no serifs, no ornament.

### Design tokens

Create in `src/styles/tokens.ts` and mirror as CSS variables.

```ts
export const tokens = {
  color: {
    // Surfaces
    bgCanvas: '#FFFFFF',           // primary background
    bgSubtle: '#F7F7F8',           // subtle raised panels, input fills
    bgMuted: '#EFEFF1',            // hover fills, track backgrounds
    bgInverse: '#0A0A0A',          // for contrast blocks (e.g. notice banners)

    // Text
    textPrimary: '#0A0A0A',        // primary text and iconography
    textSecondary: '#5A5A60',      // labels, secondary content
    textMuted: '#9A9AA0',          // placeholder, disabled
    textInverse: '#FFFFFF',        // text on inverse backgrounds

    // Borders
    borderDefault: '#E5E5E8',      // default card/panel borders
    borderStrong: '#0A0A0A',       // for emphasis (selected states)

    // State
    accentFocus: '#0A0A0A',        // focus rings, active states (same as text)
    accentSuccess: '#16A34A',      // export success, export complete
    accentWarning: '#D97706',      // warnings (rare in internal tool)
    accentDanger:  '#DC2626',      // destructive (e.g. delete export)
  },
  shadow: {
    card: '0 2px 8px rgba(10, 10, 10, 0.04), 0 1px 2px rgba(10, 10, 10, 0.06)',
    raised: '0 8px 24px rgba(10, 10, 10, 0.08), 0 2px 4px rgba(10, 10, 10, 0.04)',
    panel: '0 16px 48px rgba(10, 10, 10, 0.10)',
  },
  radius: {
    none: '0px',
    sm: '6px',
    md: '10px',      // default for cards, inputs
    lg: '16px',      // larger containers, upload zone
    pill: '9999px',  // primary buttons, tags
  },
  font: {
    sans: '"Nunito", system-ui, -apple-system, sans-serif',
    // Nunito matches the ZEN portal exactly — rounded geometric sans
    // with a friendly-but-professional feel. Use weights 400 (regular),
    // 600 (semibold), and 700 (bold). Avoid 300/light — readability
    // suffers at UI sizes.
    mono: '"JetBrains Mono", "SF Mono", Consolas, monospace',
  },
  spacing: {
    // Use Tailwind defaults; listed here for reference
    xs: '4px', sm: '8px', md: '12px', lg: '16px',
    xl: '24px', '2xl': '32px', '3xl': '48px',
  },
} as const;
```

### Typography

- **UI & body:** Nunito at 14px default, 16px for larger content,
  24-32px for section headers. Use weights 400 (regular), 600
  (semibold), and 700 (bold). Matches the ZEN portal's type system
  exactly. Avoid weight 300 and below — readability suffers at UI
  sizes and it drifts off-brand.
- **Numeric values** (durations in ms, timing values, export sizes):
  JetBrains Mono with `font-variant-numeric: tabular-nums`. This is a
  precision tool — numbers need to line up. The mono face is a
  deliberate contrast to Nunito's roundness, and is fine to use even
  though the ZEN portal itself is Nunito-only.
- **No display faces.** No Cinzel, no IM Fell English, no serifs
  anywhere. Those were for the other projects; this is a work tool.

### Component library — shadcn/ui + shadcn.io

**Do not build UI primitives from scratch.** This project uses
**shadcn/ui** for base primitives and **shadcn.io** for composite
components. Between the two libraries, 95% of what Zenimator needs is
already built, accessible, and styled consistently. The design tokens
above re-skin them to match the ZEN portal.

**Base primitives — official shadcn/ui** (ui.shadcn.com). Install as
needed via `npx shadcn@latest add [component]`. Used for:
- `Button` — all buttons (primary, secondary, ghost, destructive variants)
- `Input`, `Textarea` — any text entry (including the API key field)
- `Select`, `DropdownMenu` — dropdowns (easing picker, template picker,
  export dropdown)
- `Slider` — duration, delay, stagger, distance sliders
- `Switch` — toggles (loop, preview-only-this-group, LLM-vs-heuristic)
- `Tabs` — if needed for secondary navigation
- `Tooltip` — hover help on controls
- `Dialog`, `Sheet`, `Drawer` — modals and the Settings drawer
- `Toast` (via `sonner`) — export-complete confirmations, LLM errors
- `Separator`, `ScrollArea`, `Card` — layout primitives
- `Popover` — for the easing curve preview and group rationale tooltips

**Composite components — shadcn.io** (shadcn.io/components). Install via
`npx shadcn@latest add https://shadcn.io/r/[component].json`. Used for:
- **Dropzone** (`forms/dropzone`) — the initial upload zone for SVG/PNG
  files. Handles drag-and-drop states out of the box.
- **Code Block** (`code/code-block`) — preview of the exported JSON spec
  with syntax highlighting, inside the export dialog
- **Spinner** (`interactive/spinner`) — loading state during LLM
  analysis and during export
- **Pill** (`media/pill`) — for group tag labels in the Layers panel
- **Kbd** (`visualization/kbd`) — keyboard shortcut hints in the
  transport bar and tooltips (Space, R, 1-8)
- **Counter** (`text/counter`) — animated number display for duration
  and delay values as they update
- **Motion Effect** (`special-effects/motion-highlight`) — gentle
  entrance animations for the panels themselves on app load
- **List** (`data/list`) — the group tree in the Layers panel

**Rules for using these libraries:**
- Always install via the CLI rather than copy-paste. Keeps dependencies
  tracked and components updatable.
- Re-theme via `globals.css` / Tailwind theme rather than editing
  component sources. Touch component source only when the theme system
  genuinely can't express what we need.
- When a shadcn component and a custom component would both work, use
  the shadcn one.

### Layout shell

A three-zone layout, always visible:

```
┌─────────────────────────────────────────────────────────────┐
│  ZENIMATOR                            [⚙]  [Export ▾]       │ ← Top bar
├───────────┬──────────────────────────────────┬──────────────┤
│           │                                  │              │
│  Layers   │                                  │  Controls    │
│  panel    │      Preview canvas              │  panel       │
│           │      (plays animation)           │              │
│  (LLM-    │                                  │  (params +   │
│   grouped │                                  │   LLM        │
│   units,  │                                  │   rationale  │
│   each    │                                  │   for        │
│   with    │                                  │   selected   │
│   anim    │                                  │   group)     │
│   tag)    │                                  │              │
│           │                                  │              │
├───────────┴──────────────────────────────────┴──────────────┤
│  ▶ Play   ⏸ Pause   ↺ Restart     Timeline scrubber         │ ← Transport bar
└─────────────────────────────────────────────────────────────┘
```

- **Top bar (56px)**: app name left, settings gear + export button right.
- **Left panel (280px)**: for SVG inputs, shows the LLM-proposed
  semantic groups as a flat list (or tree if the LLM returns
  hierarchy), each with its animation template tag and a small
  rationale tooltip on hover. For PNG inputs, shows a single
  "Whole image" entry.
- **Preview canvas (flexible center)**: plays the current animation.
  Light checkerboard background for transparent SVGs. Zoom controls in
  corner. Shows a loading spinner while the LLM call is in flight.
- **Right panel (320px)**: parameter controls for the currently
  selected group, plus the LLM's rationale ("why this animation")
  rendered as a small dismissible note above the controls.
- **Transport bar (64px)**: play/pause/restart + timeline scrubber.

On startup (no file loaded), the center shows the upload drop zone. If
no API key is set, the upload action nudges the user to open Settings
first.

---

## Architecture — data model first

**This is the most important section of the brief.** The data model
drives everything. Get it right and the rest is easy; get it wrong and
you'll rewrite half the app.

### The Scene

A Scene is what Zenimator operates on. It's an intermediate
representation that normalizes SVG and PNG inputs into the same shape.

```ts
type AnimationCategory = 'entrance' | 'ambient' | 'rigged';

type Scene = {
  id: string;
  source: SceneSource;       // SVG (possibly restructured by the grouper) or bitmap
  viewport: { width: number; height: number };
  groups: AnimatableGroup[]; // one entry per animatable unit
  category: AnimationCategory; // v1 always 'entrance'; selector wired but clamped
  background?: string;       // CSS color
};

type SceneSource =
  | { kind: 'svg'; raw: string; originalRaw: string } // restructured + original for re-analysis
  | { kind: 'bitmap'; dataUrl: string; mime: string };

type AnimatableGroup = {
  id: string;                // unique within scene, matches an id attribute in `source.raw`
  label: string;             // human-readable (from LLM or fallback)
  tag: GroupTag;             // semantic type
  bounds: Rect;              // in viewport coords
  elementRef: string | null; // CSS selector for a wrapper <g> (if wrapped)
  memberRefs?: string[];     // selectors for individual members when wrapping wasn't safe
  depth: number;             // hierarchy depth for stagger ordering
  animation: AnimationBinding | null; // LLM-proposed, user-editable
  rationale?: string;        // LLM's one-line reasoning; shown in UI
  warning?: string;          // surfaced only for unrecoverable issues
};

type GroupTag =
  | 'icon'          // small, square, standalone
  | 'illustration'  // large-ish, non-text visual
  | 'text'          // text element
  | 'list-item'     // detected as part of a repeating list
  | 'button'        // rounded rect with text inside
  | 'card'          // larger container with children
  | 'background'    // full-bleed behind content
  | 'decoration'    // subtle ornamental detail (dots, sparkles, texture)
  | 'whole-image'   // for bitmap inputs
  | 'unknown';      // couldn't classify
```

### The Animation

```ts
type AnimationBinding = {
  template: AnimationTemplateId;
  params: AnimationParams;
  timing: Timing;
  /** Present on Ambient-category animations. Unset means one-shot. */
  looping?: Looping;
  /** Per-element rotation pivot for Rigged templates (viewport coords).
   *  Unset for Entrance/Ambient. */
  pivot?: { x: number; y: number };
};

type AnimationTemplateId =
  // --- Entrance (v1) ---
  | 'fade-in'
  | 'slide-up'     | 'slide-down' | 'slide-left' | 'slide-right'
  | 'scale-in'     | 'pop-in'
  | 'draw-stroke'  // SVG only, animates stroke-dashoffset
  | 'stagger-children'
  | 'parallax-tilt' // whole-image 3D tilt (bitmap only)
  // --- Ambient (v1.1, reserved) ---
  | 'breathe' | 'float' | 'drift' | 'shimmer'
  // --- Rigged (v1.2, reserved) ---
  | 'walk-cycle' | 'wave' | 'idle-sway'
  | 'none';

type AnimationParams = {
  duration: number;          // ms, default per template
  delay: number;             // ms, default 0
  easing: EasingKey;
  distance?: number;         // slide
  scaleFrom?: number;        // scale-in / pop-in
  staggerMs?: number;        // stagger-children
  // Ambient extras (v1.1):
  amplitude?: number;        // px or deg of oscillation
  // Rigged extras (v1.2):
  phaseOffset?: number;      // 0-1, phase within the cycle
  joint?: string;            // symbolic joint name (shoulder, knee, ...)
};

type EasingKey =
  | 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'
  | 'spring-gentle' | 'spring-bouncy' | 'spring-stiff';

type Timing = {
  start: number;             // ms from scene start
};

/** Looping controls for Ambient (v1.1). Unset means one-shot. */
type Looping = {
  iterations: number | 'infinite';
  direction?: 'normal' | 'alternate';
};
```

### The pipeline

```
  upload
    │
    ▼
┌──────────────┐
│  Detector    │  pure, deterministic. Parse SVG, compute a flat
│  (structural)│  index of all id'd elements + their bounds + colors.
└──────────────┘  No semantic judgment.
    │
    ▼
┌──────────────┐
│  Rasterizer  │  render the SVG to a PNG data URL (128-256KB) for
│              │  the LLM's vision input.
└──────────────┘
    │
    ▼
┌──────────────┐
│  LLM Grouper │  single call to Claude with vision. Input: rendered
│              │  preview + structural index. Output: semantic
│              │  groups, each with a list of path IDs, a tag, a
│              │  proposed animation template + params, and a
│              │  one-line rationale.
└──────────────┘
    │
    ▼
┌──────────────┐
│ Restructurer │  injects <g id="..."> wrappers around each group's
│              │  path IDs in the live SVG DOM, preserving z-order.
│              │  Groups whose paths can't be safely wrapped
│              │  (non-contiguous, different parents) fall back to
│              │  "render-but-don't-animate" and surface a warning.
└──────────────┘
    │
    ▼
┌──────────────┐
│  Scene       │  build the final Scene object from the restructured
│  Builder     │  SVG + LLM output. Every animatable group has an
│              │  elementRef that resolves to a real DOM node.
└──────────────┘
    │
    ▼
┌──────────────┐
│  Player      │  Framer Motion animates each group's <g> wrapper
│              │  using the template + params.
└──────────────┘
```

### Why this shape

- `Scene` is framework-agnostic. Today we render with Framer Motion;
  tomorrow someone could render the same Scene with GSAP or React
  Native Reanimated.
- Separating **template** from **params** means the LLM picks template
  IDs + reasonable defaults; the user tweaks params without changing
  the underlying behavior.
- Separating the **Detector** (structural, deterministic, no AI) from
  the **LLM Grouper** keeps the AI call pure I/O — it's a boundary,
  not a core. Caching, retries, offline fallback, and future model
  swaps all live behind that single seam.
- Preserving `source.originalRaw` alongside the restructured `raw`
  lets the user re-run the LLM analysis (e.g., on a new model
  version, or after tweaking the system prompt) without re-uploading.

---

## The LLM Grouper

The single most important component in v1. Everything upstream is
deterministic plumbing; everything downstream already works. The
Grouper is where the quality of the output comes from.

### API

```ts
async function groupAndPropose(
  input: GrouperInput,
  opts: { apiKey: string; signal?: AbortSignal }
): Promise<GrouperOutput>;

type GrouperInput = {
  svgRaw: string;                      // the original SVG markup
  previewPng: string;                  // base64 PNG, 800×800 max
  index: StructuralIndex;              // from the detector
};

type StructuralIndex = {
  viewport: { width: number; height: number };
  elements: Array<{
    id: string;                        // every element gets an id,
                                       // injected by the detector if
                                       // not already present
    tag: string;                       // 'path' | 'rect' | 'g' | ...
    bounds: Rect;                      // viewport coords
    fill?: string;
    stroke?: string;
    parentId: string | null;
  }>;
};

type GrouperOutput = {
  groups: Array<{
    label: string;                     // human-readable name
    semanticTag: GroupTag;
    elementIds: string[];              // subset of StructuralIndex.elements
    animation: AnimationBinding;       // template + params + start
    rationale: string;                 // one line, shown in UI
  }>;
  sceneRationale?: string;             // overall framing, optional
};
```

### Model + call shape

- **Model:** `claude-sonnet-4-6`. Vision-capable, fast enough for a
  2s interactive loop, cheap enough to run on every upload.
- **Input:** system prompt + one user message containing the PNG
  (as an `image` block) + the structural index (as JSON text). The
  SVG raw text is **not** sent — the LLM works from the rendered
  image and the ID-indexed structure. Sending the full SVG bloats
  the context for marginal gain.
- **Output:** structured JSON matching `GrouperOutput`. Use
  Anthropic's tool-use / structured-output mode to guarantee schema
  conformance. No free-text parsing.
- **Caching:** hash `(svgRaw, model, systemPromptVersion)` → cache
  `GrouperOutput` in localStorage. Re-uploading the same file is
  instant and free.
- **Latency budget:** 3s end-to-end. If we exceed it, surface a
  "still thinking…" message but don't time out below 10s. Vision
  calls are variable.

### Category-aware system prompts

The system prompt has a shared preamble (ZEN aesthetic, grouping
rules) plus a category-specific middle section that swaps based on
`scene.category`. This is why the architecture lands up front —
swapping the prompt is trivial, but the code path around it (which
templates are valid, what params matter, how timing is resolved) has
to exist.

**Shared preamble (all categories):**
1. It's looking at a ZEN.COM product illustration or icon. Calm,
   monochrome, modern-fintech. Animations reflect that restraint.
2. Group the visual elements into **3–7 semantic units** (not 30,
   not 1). Each unit should be something a designer would describe
   in one phrase.
3. For each group, list the element IDs that belong to it. IDs must
   be drawn from the provided structural index.
4. Return one-line rationale per group explaining the animation
   choice — designer-useful, not academic.

**Entrance-specific (v1):**
- Pick one template from the entrance whitelist and set params.
- Respect the 2.5-second total duration budget.
- Stagger entry order by visual importance (focal element after
  context).
- Default to `fade-in` or `none` for decorative elements. Reserve
  `slide-up`, `pop-in`, `scale-in` for focal elements.

**Ambient-specific (v1.1, reserved):**
- Pick templates from the ambient whitelist.
- Propose *continuous*, *subtle*, *looping* motion. No entry states.
- Default iteration is `infinite`, direction `alternate`.
- Avoid anything that pulls attention or suggests urgency.

**Rigged-specific (v1.2, reserved):**
- First, identify anatomical parts in the character (head, torso,
  upper/lower arm, upper/lower leg, foot) by matching element IDs.
- For each part, supply the joint pivot in viewport coordinates.
- Pick one rigged template and populate phase offsets so opposing
  limbs animate in counterphase.
- If the character isn't segmented enough to rig, say so explicitly
  in the rationale and fall back to a single `idle-sway`.

### Restructuring — what "safe to wrap" means

The Restructurer takes `GrouperOutput.groups` and injects a
`<g id="zen-group-{i}">` wrapper around each group's elements in the
live SVG DOM. Before wrapping, it validates:

1. **Same parent:** all elements in the group share a common parent
   in the DOM.
2. **Contiguous or reorderable:** the elements are either already
   contiguous in DOM order (safe to wrap in place) or they are
   *visually* separable from interleaved elements (i.e., no element
   outside the group renders between two elements inside the group
   in a way the user would notice).

If validation fails, the group is rendered **statically** (included
in the DOM, visible in the preview) but excluded from animation, and
the Layers panel shows a small warning icon with an explanation. Don't
attempt risky z-order-altering moves automatically.

---

## SVG parsing — structural index

The Detector's only job is now to produce a flat, ID-indexed snapshot
of the SVG for the LLM. It does not attempt semantic classification;
that's the LLM's job.

### What the detector does

- Parses the SVG via the browser-native `DOMParser`.
- Walks every visible element (`<path>`, `<rect>`, `<circle>`,
  `<ellipse>`, `<polygon>`, `<polyline>`, `<line>`, `<use>`, `<text>`,
  `<image>`, and `<g>`) in DOM order.
- Skips non-visual containers (`<defs>`, `<clipPath>`, `<mask>`,
  `<symbol>`, `<filter>`, `<marker>`).
- Injects a synthetic `id` attribute on every visited element that
  doesn't have one (`zen-el-{i}`), so the LLM has a stable handle
  for every node.
- Computes `getBBox()` for each element (using a hidden off-screen
  container).
- Extracts fill and stroke colors.
- Records each element's parent ID to preserve hierarchy.
- Serializes the enriched SVG (with injected IDs) as
  `source.originalRaw`.

### What the detector does **not** do

- It does not classify elements by tag. No `icon` vs `illustration`
  vs `button` heuristics. That was the old design. The LLM decides
  now.
- It does not build groups. The groups come from the LLM.
- It does not propose animations. Also LLM.

### Heuristic fallback

When the LLM is unavailable (no API key, network failure, rate
limit), the app falls back to a minimal heuristic path:

- If the SVG has 2+ `<g>` children at any single-descent-path depth,
  use those as groups. Classify with a simple `<g>` → `illustration`
  default.
- Otherwise, one whole-SVG group with `fade-in`.

This is explicitly a degraded mode, surfaced in the UI as a yellow
banner: "LLM unavailable — using fallback grouping." The designer
can retry once the issue is resolved.

---

## Animation templates — the library

Templates live under `src/engine/animations/templates/{category}/`
— one subfolder per category. Each template exports:

- `id` — `AnimationTemplateId`
- `category` — `'entrance' | 'ambient' | 'rigged'`
- `defaultParams` — sensible defaults
- `paramSchema` — what controls to render in the right panel
- `keyframesFor(params)` — returns the WAAPI keyframe sequence
- `suitableFor` — which `GroupTag` values this template suits (used
  as a whitelist when validating LLM output)

### Entrance templates (v1) — 8 solid, not 30 shallow

1. **fade-in** — opacity 0 → 1. Default 400ms, easeOut. Targets: all.
2. **slide-up** — translateY(+24) + opacity 0 → final + opacity 1.
   Default 450ms, spring-gentle. Targets: text, list-item, card,
   illustration.
3. **slide-down / slide-left / slide-right** — variants of slide-up.
4. **scale-in** — scale(0.92) + opacity 0 → scale(1) + opacity 1.
   Default 350ms, easeOut. Targets: icon, button, illustration.
5. **pop-in** — scale(0.6) + opacity 0 → scale(1) + opacity 1 with a
   bouncy spring. Default 500ms, spring-bouncy. Targets: icon, button.
6. **draw-stroke** (SVG only) — animates `stroke-dashoffset` from
   length to 0. Default 800ms, easeInOut. Targets: illustration
   (paths with visible strokes).
7. **stagger-children** — container template that staggers child
   group animations. Default stagger 60ms.
8. **parallax-tilt** (bitmap only) — 3D CSS transform, subtle tilt.
   Targets: whole-image.

### Ambient templates (v1.1 — reserved)

1. **breathe** — subtle scale oscillation (0.98 ↔ 1.02), ~3000ms
   cycle, easeInOut, looping alternate. Targets: card, illustration
   (whole-image OK).
2. **float** — subtle vertical drift (±6px), ~4000ms cycle, looping
   alternate. Targets: icon, illustration.
3. **drift** — slow directional translation (±8px in a chosen axis),
   ~6000ms cycle, alternate. Targets: decoration, background.
4. **shimmer** — opacity ripple across a stroked path (for accent
   sparkles, celebration states), ~2500ms cycle. Targets: decoration.

All ambient templates default to `iterations: 'infinite'` and
`direction: 'alternate'`. The designer can override iterations for
export-length control.

### Rigged templates (v1.2 — reserved)

1. **walk-cycle** — coordinated hip/knee/ankle rotation across a
   character rig. Requires the LLM to identify anatomical parts and
   supply pivot coordinates. ~1000ms cycle, looping.
2. **wave** — shoulder + elbow rotation on an identified arm. One-shot
   or looping.
3. **idle-sway** — slight torso lean + weight shift. Looping.

All rigged templates use multi-phase keyframes (4–6 waypoints) and
per-element `pivot` coords. They're not a simple extension of the
entrance templates — the player's animation engine gains a
keyframe-timeline mode when v1.2 lands.

### Easing presets

- `linear` — rare, for counters and parallax
- `easeOut` — default for most entrances
- `easeInOut` — for longer, more deliberate moves
- `spring-gentle` — `{ damping: 20, stiffness: 100, mass: 1 }`
- `spring-bouncy` — `{ damping: 10, stiffness: 120, mass: 1 }`
- `spring-stiff` — `{ damping: 22, stiffness: 200, mass: 1 }`

Show the easing as both name and visual curve preview in the dropdown.

---

## Proposer

In the old architecture, the Proposer was a rule-based engine
deciding which template to apply to each group. In the new
architecture, **the LLM Grouper is the Proposer** — it returns
`AnimationBinding` directly on each group.

What's left for the Proposer to do:

1. **Validation.** Verify the LLM-proposed template exists in the
   registry and the params are within valid ranges. Clamp out-of-range
   values, substitute defaults for missing fields, drop unknown
   templates to `none`.
2. **Timing resolution.** The LLM returns relative timing hints
   ("card enters first, coin pops in after it"). The Proposer
   converts these to absolute `start` values in ms, enforcing the
   2.5s total-duration cap. If the sequence exceeds the cap,
   compress stagger gaps proportionally.
3. **Safety net.** If the LLM output is malformed or empty, fall
   back to `fade-in` for every group.

Keep the Proposer as a pure function: `proposeAnimations(llmOut,
scene) → Scene`. No network, no side effects.

---

## Player

The preview player renders a Scene with its animations applied.

- **Tech:** React + Framer Motion. Animate the injected `<g
  id="zen-group-{i}">` wrappers via Framer's `animate()` or
  `motion.g` variants.
- **For SVG:** render `source.raw` (the restructured SVG, with
  wrappers) via `dangerouslySetInnerHTML` or `react-inlinesvg`. Use
  `querySelector('#zen-group-{i}')` inside the player to find each
  animatable wrapper and drive it.
- **For bitmap:** render an `<img>` inside a `motion.div` with the
  template applied.
- **Playback control:** Zustand `playbackStore` holds `isPlaying`
  and `animationKey`. The player re-runs its animation `useEffect`
  when `animationKey` bumps (restart) or `isPlaying` toggles.
- **Loop:** off by default in v1. Can toggle in transport bar (v2).
- **Timeline scrubber:** derives total duration from the scene.
  Visual only in v1; true scrubbing (seeking to an arbitrary point
  mid-animation) is a v2 concern — Framer Motion's `animate()`
  handles it but wiring the UI is non-trivial.

---

## Controls panel

When a group is selected in the Layers panel, the right Controls
panel populates with:

**LLM context block** (top, dismissible):
- The LLM's one-line rationale for this group's animation
- A "Regenerate proposal for this group" button (calls the LLM again
  with the user's selection highlighted)

**Always-present controls:**
- Animation template dropdown (can change or set to "none")
- Duration slider (100-2000ms)
- Delay slider (0-1500ms)
- Easing dropdown (with curve preview)

**Template-specific controls:**
- Slide animations: Distance slider (8-96px), Direction
- Scale animations: Scale from (0.5-1.0)
- Stagger: Stagger delay between children (0-200ms)
- Parallax tilt: Tilt amount (0-15°), Auto-animate toggle

**Additional actions:**
- "Preview only this group" toggle
- "Reset to LLM-proposed defaults" button
- "Copy this animation to other groups" shortcut

Build using shadcn/ui primitives. Display numeric values in
JetBrains Mono tabular — animated via shadcn.io's Counter component
for a pleasant tick as the user drags.

---

## Settings drawer

Opened via the gear icon in the top bar. Contains:

- **Claude API key** — password-masked input, stored in
  localStorage under `zenimator.apiKey`. Small "Test connection"
  button that makes a trivial API call and reports success/failure.
- **Model selector** — defaults to `claude-sonnet-4-6`. Dropdown
  for future model swaps.
- **Use LLM grouping** — toggle. When off, the app uses the
  heuristic fallback regardless of API key presence. Useful for
  cost control during demos or for comparison.
- **Clear response cache** — button. Wipes the hash → `GrouperOutput`
  cache in localStorage.
- **Show LLM rationale in UI** — toggle. Default on.

No account system, no user profiles, no telemetry. This is an
internal tool.

---

## Export

Three export paths, all triggered from the top-bar Export dropdown.

### Export spec JSON

- Serializes the current Scene to a stable JSON format.
- Includes: viewport, groups with tag/bounds/label, animation
  bindings per group, easing definitions, and (optionally) the
  LLM rationale per group for context.
- Export as download (`zenimator-spec-{timestamp}.json`) and also
  copy-to-clipboard.
- Format documented in `docs/spec-format.md`.

### Export video (MP4)

- Use `MediaRecorder` API recording from a `<canvas>` that the
  player renders into.
- Render at 60fps for the scene's full duration + 500ms trailing
  rest. Cap at 5 seconds total.
- WebM is the native output. Convert to MP4 with `ffmpeg.wasm`
  as an optional toggle (bundle ~30MB; acceptable for an internal
  tool).
- Export at 2x pixel ratio for crisp output.

### Export GIF

- Use `gif.js` (actively-maintained fork). Frames from the canvas
  at 30fps, downsampled to 15-20fps.
- Warn user if output exceeds 5MB.

### Export UX

- Export dropdown shows all three options + "Export settings"
  (resolution, fps, duration overrides).
- Progress indicator during export (5-20s).
- Auto-download on complete; toast confirms.

---

## Tech stack

- **Vite + React + TypeScript** — scaffold
- **Tailwind CSS v4** — styling (tokens in CSS-first config)
- **shadcn/ui** — base UI primitives
- **shadcn.io** — composite components
- **Framer Motion** — animation engine for the player
- **@anthropic-ai/sdk** — Claude API client, browser mode with BYO
  API key. Use `dangerouslyAllowBrowser: true` flag; safe here
  because the key is the user's own, stored locally.
- **gif.js** — GIF encoding
- **ffmpeg.wasm** (optional, conditionally loaded) — MP4 conversion
- **zustand** — state (scene, selection, playback, settings)
- **lucide-react** — icons (via shadcn)
- **@fontsource/nunito** + **@fontsource/jetbrains-mono** — self-
  hosted fonts
- **sonner** — toasts (shadcn-recommended)
- **clsx** + **tailwind-merge** — class composition

No backend. No router. No auth. All persistence via localStorage.

---

## Project structure

```
zenimator/
├── public/
│   └── samples/                    # sample SVGs/PNGs for testing
├── src/
│   ├── components/
│   │   ├── shell/
│   │   │   ├── AppShell.tsx
│   │   │   ├── TopBar.tsx
│   │   │   └── TransportBar.tsx
│   │   ├── panels/
│   │   │   ├── LayersPanel.tsx
│   │   │   ├── ControlsPanel.tsx
│   │   │   └── PreviewCanvas.tsx
│   │   ├── upload/
│   │   │   └── UploadZone.tsx
│   │   ├── player/
│   │   │   ├── ScenePlayer.tsx
│   │   │   ├── SvgPlayer.tsx
│   │   │   └── BitmapPlayer.tsx
│   │   ├── settings/
│   │   │   └── SettingsDrawer.tsx  # API key, model, toggles
│   │   └── export/
│   │       ├── ExportDropdown.tsx
│   │       └── ExportProgress.tsx
│   ├── engine/
│   │   ├── detector/
│   │   │   ├── detectSvg.ts        # structural index (no classification)
│   │   │   ├── detectBitmap.ts     # whole-image group
│   │   │   └── rasterize.ts        # SVG → PNG for LLM vision input
│   │   ├── llm/
│   │   │   ├── grouper.ts          # calls Claude, returns GrouperOutput
│   │   │   ├── prompts/
│   │   │   │   ├── shared.ts       # preamble shared across categories
│   │   │   │   ├── entrance.ts     # v1 — entrance-specific prompt
│   │   │   │   ├── ambient.ts      # v1.1 — stubbed in v1
│   │   │   │   ├── rigged.ts       # v1.2 — stubbed in v1
│   │   │   │   └── index.ts        # resolves prompt by category
│   │   │   ├── schema.ts           # JSON schema for tool-use output
│   │   │   └── cache.ts            # hash-keyed (includes category) cache
│   │   ├── restructurer/
│   │   │   ├── injectWrappers.ts   # adds <g id="..."> to the SVG
│   │   │   └── validateGroup.ts    # same-parent, contiguous checks
│   │   ├── proposer/
│   │   │   └── proposeAnimations.ts # validates + resolves timing
│   │   ├── animations/
│   │   │   ├── templates/
│   │   │   │   ├── entrance/         # v1
│   │   │   │   │   ├── fadeIn.ts
│   │   │   │   │   ├── slideUp.ts
│   │   │   │   │   ├── slideDown.ts
│   │   │   │   │   ├── slideLeft.ts
│   │   │   │   │   ├── slideRight.ts
│   │   │   │   │   ├── scaleIn.ts
│   │   │   │   │   ├── popIn.ts
│   │   │   │   │   ├── drawStroke.ts
│   │   │   │   │   ├── staggerChildren.ts
│   │   │   │   │   ├── parallaxTilt.ts
│   │   │   │   │   └── index.ts
│   │   │   │   ├── ambient/          # v1.1 — placeholder in v1
│   │   │   │   │   └── index.ts      # exports empty registry in v1
│   │   │   │   ├── rigged/           # v1.2 — placeholder in v1
│   │   │   │   │   └── index.ts      # exports empty registry in v1
│   │   │   │   └── index.ts          # combined registry, category-keyed
│   │   │   ├── easings.ts
│   │   │   └── types.ts
│   │   └── scene/
│   │       ├── types.ts
│   │       └── bounds.ts
│   ├── export/
│   │   ├── exportJson.ts
│   │   ├── exportVideo.ts
│   │   ├── exportGif.ts
│   │   └── renderToCanvas.ts
│   ├── store/
│   │   ├── sceneStore.ts
│   │   ├── playbackStore.ts
│   │   ├── categoryStore.ts        # current category selector state
│   │   └── settingsStore.ts        # API key, model, toggles
│   ├── styles/
│   │   ├── tokens.ts
│   │   ├── tokens.css
│   │   └── globals.css
│   ├── App.tsx
│   └── main.tsx
├── docs/
│   └── spec-format.md
├── BRIEF.md
├── tailwind.config.ts
└── package.json
```

---

## Build order

The pivot from heuristic to LLM-driven grouping happened at
milestone 5. Milestones 1–10 are built. Milestone 11 is the
category framework — the last piece needed before v1 ships.
Milestones 12–18 round out v1. Milestones V1.1-* and V1.2-* are
reserved for the two post-v1 releases.

Pause for review at each milestone before continuing.

### Milestones 1–10 — built

1. ✅ **Scaffold + shell + shadcn setup.**
2. ✅ **SVG upload → Scene (heuristic path).** Later rewritten by
   milestone 6 to emit a structural index instead.
3. ✅ **Static SVG rendering in preview.**
4. ✅ **One animation template working end-to-end** (heuristic path).
5. ✅ **Settings drawer + API key plumbing.** Test-connection button
   live. Upload blocked if key missing + "Use LLM grouping" on.
6. ✅ **Detector refactor → structural index.** No semantic tags.
   Heuristic fallback available behind a flag.
7. ✅ **SVG rasterizer.** 800×800 max PNG data URL for vision input.
8. ✅ **LLM Grouper.** `engine/llm/grouper.ts` calling Claude
   Sonnet 4.6 with tool-use for structured output. Hash-keyed cache
   in localStorage. Acceptance test on AutoTopup.svg passed.
9. ✅ **Restructurer.** `<g id="zen-group-i">` wrappers where safe.
   `memberRefs` fallback for groups that span multiple parents or
   are non-contiguous — animated per-element in sync.
10. ✅ **Proposer (simplified) + full pipeline integration.** Pure
    validator/timer. End-to-end upload → detector → rasterize →
    LLM → restructure → propose → WAAPI-driven player.

### Milestones 11–18 — remaining for v1 ship

11. **Category framework.** The new core milestone before v1 ships.
    Add `category: AnimationCategory` to `Scene` (defaulting to
    `'entrance'`). Build a category selector UI that appears next
    to the upload zone — three tiles (Entrance / Ambient / Rigged)
    with the latter two greyed out + "Coming soon" badge. Wire
    `categoryStore`. Refactor the LLM prompt module into
    `prompts/{shared, entrance, ambient, rigged}.ts` and resolve by
    category; Ambient and Rigged are stubs that throw
    `NotImplemented` for v1. Reorganize `animations/templates/` into
    category subfolders; the combined registry is keyed by category.
    The export JSON schema includes `category` from this milestone
    forward. **Acceptance: the shipping v1 Scene, pipeline, export
    spec, and UI are all category-aware; nothing will need to break
    when v1.1 lands.**

12. **Full template library (Entrance).** All 8 entrance templates
    implemented. LLM can propose any; validator enforces the
    entrance whitelist.

13. **Controls panel.** Parameter controls render for the selected
    group. LLM rationale shown at the top. "Regenerate for this
    group" button. Live updates on slider drag.

14. **Bitmap (PNG/JPG) input path.** Whole-image Scene,
    parallax-tilt default, no LLM call.

15. **Export JSON.** Schema includes category, groups, animations,
    rationales. Copy-to-clipboard + download.

16. **Export video.** MediaRecorder pipeline. WebM first, MP4 via
    ffmpeg.wasm as opt-in.

17. **Export GIF.** gif.js pipeline. Size warning.

18. **Polish + tune on real ZEN content.** Easing curve previews.
    Keyboard shortcuts (space = play/pause, R = restart, 1–8 =
    switch template on selected group). Cache-hit indicator
    ("⚡ cached"). Error surface for LLM failures. Import 5–10 real
    ZEN SVGs and iterate the entrance system prompt until proposals
    consistently match what a human designer would pick.

**Ship v1 after milestone 18.** Put it in front of the ZEN design
team and gather usage feedback before starting v1.1.

### Milestones V1.1-* — Ambient loop

V1.1-1. **Looping playback.** Extend the WAAPI integration in
  `SvgPlayer` to support `iterations: Infinity` and
  `direction: 'alternate'`. Add loop controls to the transport bar
  (loop toggle, loop count if finite).

V1.1-2. **Ambient templates.** Implement `breathe`, `float`,
  `drift`, `shimmer`. Keyframes, defaults, param schemas.

V1.1-3. **Ambient system prompt.** Un-stub `prompts/ambient.ts`.
  Iterate on real ZEN hero illustrations and splash screens.
  Enable the Ambient tile in the selector.

V1.1-4. **Export adjustments.** Loop-aware video/GIF export (N
  iterations or fixed seconds, seamless loop start/end).

V1.1-5. **Tune Ambient.** Real content, prompt iteration.

### Milestones V1.2-* — Rigged motion

V1.2-1. **Multi-phase keyframe engine.** Extend the player to
  support N-waypoint timelines (not just start → end). Per-element
  custom `transform-origin` from `pivot` coords. Phase-offset
  synchronization across groups.

V1.2-2. **Rigged templates.** Implement `walk-cycle`, `wave`,
  `idle-sway`. Each defines a phase-keyed keyframe timeline and a
  set of required anatomical parts.

V1.2-3. **Rigged system prompt.** Un-stub `prompts/rigged.ts`. The
  LLM must identify anatomical parts, supply joint pivots, and set
  phase offsets. Acceptance: on a reasonably-segmented character
  SVG, the proposal produces a clearly-walking figure.

V1.2-4. **Rig-aware controls.** Add joint pivot editing to the
  Controls panel (drag a pivot point on the preview). No full
  rigging editor — just enough for the designer to correct a
  mis-identified shoulder.

V1.2-5. **Export adjustments.** Loop length matches rig cycle; GIF
  defaults to one full cycle.

V1.2-6. **Tune Rigged.** Character illustrations from the ZEN
  onboarding flow; prompt and pivot-inference iteration.

Expect V1.1 to take roughly a third of v1's effort. V1.2 is the
biggest, comparable to v1 itself.

---

## Taste notes

- **Restraint is the entire aesthetic.** The ZEN product is calm and
  confident. Every animation should feel that way too. Nothing should
  bounce unless there's a reason. The default output should err on
  the side of subtle. Encode this in the system prompt, not just the
  templates.

- **The LLM is the taste engine.** Its defaults are what designers
  will judge the tool by. A wrong proposal is worse than no
  proposal — designers will close the tab. Spend disproportionate
  time on the system prompt and the eval harness. The rules in this
  brief are a starting point; expect to iterate.

- **Don't animate everything.** If a group is truly background
  chrome or decorative texture, not animating it is often correct.
  Tell the LLM explicitly to prefer `none` for groups that don't
  benefit from motion.

- **Numbers are first-class content.** JetBrains Mono everywhere a
  duration, delay, or stagger value appears. Tabular figures.

- **No Loom-recording-friendly UI.** This is not a marketing tool.

- **Show the reasoning.** The LLM rationale is not a toy feature.
  Surfacing "why this animation" in the UI teaches designers to
  trust or correct the tool, and over time makes them better at
  specifying animations themselves.

- **Cache aggressively.** A designer iterating on a single upload
  should pay the LLM cost once, not on every tweak. Tweaks happen
  locally against the cached `GrouperOutput`.

---

## What this project is NOT

- Not a full animation editor. No multi-track timeline, no keyframe
  editing, no bezier authoring UI. If designers need that, they go
  to After Effects or Rive.
- Not a Lottie producer.
- Not a design-system documentation site.
- Not a CI tool.
- Not trying to analyze arbitrary bitmap UIs with the LLM — PNG/JPG
  inputs are treated as opaque wholes. Semantic region detection in
  bitmaps is out of scope.
- Not a prompt-engineering playground. The system prompt is an
  internal implementation detail, not an end-user surface. Users
  don't see or edit it.
- Not free. Every SVG upload costs a fraction of a cent in API
  fees. Cache mitigates this; the designer pays it from their own
  key.
- Not trying to mix categories in a single Scene. One Scene = one
  category. Designers wanting entrance + ambient on the same
  illustration export two clips and composite externally.

If someone wants any of the above, the answer is "great, that's a
later release — let's finish what's in front of us first."

---

## Next task

Milestones 1–10 are built. The LLM-driven Entrance pipeline works
end-to-end on real ZEN SVGs. Next up is **milestone 11: Category
framework** — add the `category` field to `Scene`, build the
selector UI with "Coming soon" tiles for Ambient and Rigged,
refactor prompts and template directories into category-keyed
subfolders, and update the export schema. The goal is for v1 to
ship with a category-aware foundation so v1.1 (Ambient) and v1.2
(Rigged) land as additive features, not breaking refactors.

Pause after milestone 11 and verify: (a) the Entrance path still
works exactly as it did before, (b) the export JSON includes
`"category": "entrance"`, and (c) the selector shows the two greyed
tiles with clear "Coming soon" affordances. Then continue to
milestone 12.
