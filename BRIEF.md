# Zenimator — Project Brief

## What we're building

An internal web tool that **generates Lottie animations from a text
description**, optionally grounded by a reference SVG. A designer describes how
something should move — "the card launches upward as the cloud appears beneath
it" — chooses how it moves (entry vs. loop, illustration vs. screen), and
Zenimator uses Claude to produce a real Lottie document. The result renders
live, can be refined in plain language, tuned with a few smart controls, and
exported as Lottie JSON, standalone HTML, WebM, or GIF.

The goal is to shrink the loop between "I have an idea (or a static mockup)" and
"I have an animated version I can show stakeholders or hand to engineering."
Today that loop involves jumping to After Effects, Rive, or Principle and often
dies on the vine because the setup cost isn't worth the few-second clip at the
end. Zenimator aims for a 2-minute loop: **describe → preview → refine → export.**

**This is an internal tool for the ZEN.COM design team.** It does not need
polished onboarding, error-recovery theatre, or marketing-grade empty states.
It needs to do the core job fast and well for smart users who understand the
domain.

---

## User & context

**Primary user:** Artur (product designer at ZEN.COM) and the broader ZEN.COM
design team.

**Secondary user:** PMs and engineers who receive exports — video/GIF for
review, Lottie JSON for native implementation (web, iOS, Android players consume
the same file).

**Primary use cases:**

1. A designer has an idea for how a UI moment should feel and wants to prototype
   it as motion without opening a heavyweight tool.
2. A designer has a finished illustration (SVG) and wants to propose how it
   should animate on screen entry, grounded in the real artwork.
3. A designer is handing off to engineering and needs a Lottie file that
   developers can drop straight into a player — no re-implementation.

**Deployment:** runs locally during development; deployed to GitHub Pages for
internal use. The app is client-only, no backend. The LLM call goes directly
from the browser to the Anthropic API using a user-supplied API key stored in
`localStorage` (acceptable for an internal tool on a trusted network).

---

## Why Lottie, and why an LLM

**Lottie is the output format because it's the handoff format.** A Lottie JSON
plays identically across web (`lottie-web`/Skottie), iOS, and Android. Generating
Lottie directly means the thing the designer previews *is* the thing engineering
ships — no translation step, no "it looked different in the prototype."

**The LLM is the motion designer.** Producing tasteful keyframes — what moves,
how far, with what easing, in what order — is a design judgement, not a
mechanical transform. A capable model can read a prompt (and, when grounded, an
SVG's structure plus a rendered preview) and propose motion that feels
intentional. Zenimator's job is to give that model the right framing, render its
output faithfully, and let the designer refine it.

The tradeoff: each generation incurs a short API call and fractions of a cent,
paid from the designer's own key. For an internal tool that replaces 30 minutes
of After Effects setup, that tradeoff is unambiguous.

---

## Current scope & capabilities (v1.5 — shipped)

The app is a single **generate lane**. There is no separate upload/grouping
surface — generation is the whole product.

**The generation model — three axes**, surfaced as an icon segmented control in
the composer:

| Axis | Options | Meaning |
|---|---|---|
| **Subject** | Illustration · Screen | What's being animated |
| **Animation** | Entry · Loop | Play-once arrival, or continuous looping motion |
| **Method** | Describe · Auto-propose | Write a prompt, or let Claude design from the SVG alone |

- **Describe** requires a prompt; an SVG attachment is optional grounding.
- **Auto-propose** requires an SVG and writes the motion design itself — a
  free-hand creative pass driven entirely by the model.

**In scope today:**

- **Text → Lottie generation.** A prompt produces a real Lottie document. With
  no SVG attached the model composes freely; this path exists but is not yet at
  the fidelity bar (see roadmap).
- **Grounded hybrid.** Attach an SVG → it's sanitised and rasterised → both the
  structure and a preview image go to Claude → motion maps onto the real layers.
  Geometry is cached, so edits re-assemble the Lottie without re-rastering.
- **Live Skottie preview.** Rendered via CanvasKit (`canvaskit-wasm`) — the same
  engine production Lottie players use, so preview fidelity matches export.
- **Conversational refine.** "Make the card slower, add a gentle float" applies
  in place against the current project; a follow-up refines, it doesn't restart.
- **Smart controls.** Claude authors a few semantic handles per layer — each
  with an illustration-specific label and a one-line hint. Handles are
  salience-ordered (dominant motion first), have bounds-relative ranges, a
  reset-to-default affordance, and an origin tick marking the AI default.
- **Per-keyframe editor.** Behind a "Keyframe details" disclosure: full control
  over tracks, frames, values, and easing for designers who want it.
- **Export suite.** Lottie JSON, standalone HTML, WebM video, animated GIF.
- **Settings.** Claude API key + model selection, stored in `localStorage`.
- **Dark mode.** Light / System / Dark, FOUC-free.

---

## Architecture — data model first

The editable unit is a **project**: per-layer geometry plus per-property motion
**tracks** of keyframes. The model lives in `engine/lottie/project.ts` and
assembles to a Lottie document on every edit (cheap — geometry is reused, no
re-raster).

- **Track** — keyframes for one animatable property (position, scale, rotation,
  opacity, …), with an optional unit *shape* so amplitude can recover from 0.
- **Handle** — a designer-facing knob *derived* from one or more tracks. Handles
  carry LLM-authored metadata (`HandleMeta = { label, hint? }`) and an origin
  (the AI-default value, snapshotted once when a result lands).
- **HandleContext** — user-space geometry (layer/comp dimensions) used to scale
  position ranges relative to the artwork rather than to absolute pixels.

```
src/
  engine/
    lottie/         # project model, assembly, render helpers (core, project, render)
    llm/            # generation + refine, prompt templates, error humanising
      prompts/      # motionPlan (designer intent), lottie (assembly), refine
    detector/       # SVG sanitise + rasterise (grounding input)
  export/           # Lottie → JSON / HTML / WebM / GIF + frame capture
  components/
    generate/       # GenerateView, GenerateControlsPanel, GenerateLayersPanel,
                    # GenerateExportMenu, SelectionOverlay
    player/         # SkottiePlayer (CanvasKit)
    controls/       # ParamSlider and friends
    settings/       # SettingsDrawer
    ui/             # Base UI primitives (Tooltip, Slider, Select, …)
  store/            # Zustand: generateStore, generatePlaybackStore, settingsStore
```

**The pipeline (grounded path):**

1. Designer attaches an SVG → sanitise (strip `<script>`, `on*`) → rasterise to PNG.
2. `generateLottie` sends prompt + structure + preview to Claude with a
   subject/kind/method-aware system prompt.
3. The model returns a motion plan → assembled into a `project` and a Lottie JSON.
4. `setResult` snapshots handle origins; the preview attaches to the Skottie player.
5. Edits (sliders, keyframes, refine) mutate the `project` → re-assemble JSON →
   the preview updates live, geometry reused.

---

## Visual style — ZEN Portal aesthetic

Zenimator inherits the ZEN portal's visual language so it feels like a native
member of the ZEN product family: **calm, monochrome, modern-fintech.**

**Core principles:**

1. **Monochrome-first.** Near-white backgrounds, deep near-black text and
   accents. Colour used sparingly, almost entirely for state.
2. **High contrast, low noise.** No decorative textures or chrome gradients. The
   interface recedes; the animation preview is the focus.
3. **Rounded geometry.** Soft corners (8–16px), pill buttons for primary
   actions, circular icon containers.
4. **Generous whitespace.** Let elements breathe.
5. **One friendly sans-serif.** Clean geometric sans for all text; no display
   faces, no serifs.

**Typography:** Nunito for UI/body (weights 400/600/700 — never ≤300). JetBrains
Mono with tabular figures everywhere a number appears (durations, frames, sizes)
— this is a precision tool and numbers must line up.

**Component library:** Base UI primitives (`@base-ui/react`), re-skinned with
Tailwind v4 to match the ZEN portal. Note the `render`-prop pattern (not
`asChild`) for composing triggers — e.g. Tooltip/Slider. Don't build primitives
from scratch; re-theme via the Tailwind theme rather than editing sources.

**Layout shell:** a three-zone layout — a top bar (brand · settings · export), a
central generate/preview canvas, and a right-hand Controls panel for the selected
layer's smart controls and keyframe details.

---

## Taste notes

- **Restraint is the entire aesthetic.** The ZEN product is calm and confident;
  every animation should feel that way. Nothing bounces unless there's a reason.
  Default output should err subtle. Encode this in the system prompt, not just
  defaults.
- **The model is the taste engine.** Its defaults are what designers judge the
  tool by. A wrong proposal is worse than no proposal — designers close the tab.
  Spend disproportionate effort on the prompts and on evaluating real output.
- **Don't animate everything.** Background chrome and decorative texture are
  often correctly left still. Prefer no motion to gratuitous motion.
- **Numbers are first-class content.** JetBrains Mono, tabular figures, wherever
  a duration/delay/frame/value appears.
- **Smart controls are the refinement surface.** For most designers, the 2–4
  LLM-authored knobs per layer should do the majority of the work; the raw
  keyframe editor is the escape hatch, tucked behind a disclosure.
- **Preview fidelity is non-negotiable.** Skottie renders what ships. If it looks
  right in preview, it is right in the exported file.

---

## What this project is NOT

- **Not a full animation editor.** No multi-track timeline scrubbing or bezier
  authoring UI. The keyframe editor is deliberately minimal; for heavy authoring,
  designers go to After Effects or Rive.
- **Not a design-system documentation site, and not a CI tool.**
- **Not a bitmap analyser.** Grounding input is SVG. Semantic region detection in
  PNG/JPG is out of scope.
- **Not a prompt-engineering playground.** The system prompt is an internal
  implementation detail; users don't see or edit it.
- **Not free.** Each generation costs a fraction of a cent, paid from the
  designer's own key.

---

## Roadmap

| Version | Scope | Status |
|---|---|---|
| **v1.0 / v1.1** | SVG-grouping entrance + ambient animations (WAAPI) | ✅ superseded |
| **v1.5** | Lottie generate lane — text→Lottie, grounded hybrid, Skottie preview, conversational refine, smart controls, Lottie export suite | ✅ shipped |
| **v2.0** | **Full SVG animation generation engine** | ◻ next |
| **v2.5** | **High-quality free-hand text→Lottie** | ◻ planned |

> v1.0/v1.1 were an SVG-grouping + Web Animations API approach, replaced wholesale
> by the Lottie generate lane (v1.5). The full SVG animation engine is the true
> v2.0 milestone. Older rows kept for history.

### v2.0 — Full SVG animation generation engine (next)

Deepen the grounded path so *any* real-world SVG animates well, not just
cleanly-structured ones. Today the engine animates **transform tracks** only
(position, scale, rotation, opacity). That covers "card launches up, cloud fades
in" but not draw-on strokes, deforming geometry, or layered ambient loops — the
motion vocabulary real ZEN illustrations demand. v2.0 closes that gap.

**Inputs are full SVG, always.** No embedded raster (base64 PNG inside `<svg>`).
A draw-on effect needs real vector stroke endpoints to animate; a bitmap has
none. Assets with embedded raster are rejected at attach time.

**Acceptance suite (five production-real ZEN targets):**

| # | Target | Kind | Exercises |
|---|---|---|---|
| 1 | Zenek juggling — coins fan/unfold, eyes blink | Loop | per-element pivots · sequencing · secondary motion |
| 2 | Zenek skipping rope — clouds drift behind | Loop | path deformation (rope) · layered ambient drift |
| 3 | Green checkbox drawn L→R · clouds float in | Entry | **trim paths** · ambient entrance |
| 4 | Coin spinning on its axis | Loop | simulated 3D (scaleX through zero) |
| 5 | "Live better" motto written L→R | Entry | **trim paths on vector strokes** |

These five collectively force exactly the capabilities below, and serve as the
v2.0 done bar: when all five render well from their full-SVG source, v2.0 ships.

**Three workstreams, sequenced by leverage and risk:**

1. **Trim paths (`tm`) — the highest-leverage gap.** Animate a stroke's
   start/end 0→100% so it draws on like a pen. Unlocks #3 and #5 immediately,
   plus every signature / underline / progress-ring / checkmark motion — a large
   fraction of fintech UI animation. New animation primitive in the project
   model + prompt; low risk. **Build first.**
2. **Structural understanding + per-element pivots & sequencing.** Real ZEN SVGs
   are deeply-nested `<g>` soup (`Group 48096319`) with color-group "objects" and
   no semantic tags. The model must assign correct transform origins to
   sub-objects and compose *layered* loops (primary motion + ambient blink +
   cloud drift) that don't fight. Unlocks the layered-loop parts of #1, #2, #4.
3. **Path / shape keyframes — geometry that deforms, not just moves.** The rope
   bending (#2) and coins fanning like a deck (#1) change the *path itself*, not
   just a layer transform. Keyframe vertex data. Highest risk — the model must
   author tasteful path interpolation — so it lands last, after the cheaper wins
   de-risk the surrounding pipeline. **Build last.**

### v2.5 — High-quality free-hand text→Lottie (planned)

Bring the **no-SVG** path to the same fidelity bar as the grounded one: a fully
creative, LLM-driven generation where the model composes shapes *and* motion from
a description alone. The grounded pipeline exists today; the free-hand pipeline
needs the model to author primitive geometry tastefully, not just motion over
supplied geometry. The end state: a designer types an idea and gets a polished,
production-ready Lottie with nothing attached.

---

## Next task

Begin **v2.0 — the full SVG animation generation engine**, working the three
workstreams above in order: **(1) trim paths**, then (2) structural understanding
+ per-element pivots/sequencing, then (3) path/shape keyframes. The five-target
acceptance suite is the done bar.

The detailed engineering guide — data-model changes, prompt changes, render-path
work, and per-target validation steps — lives in `docs/v2-plan.md`.
