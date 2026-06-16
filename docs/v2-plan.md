# v2.0 — Full SVG Animation Engine: Execution Spec

> **Hand-off document for the implementing engineer.** This is buildable: phases
> in dependency order, each with explicit exit criteria; exact files, types, and
> signatures to add or change; validation checklists tied to the five acceptance
> targets; and open decisions called out where a choice must be made before code.
>
> Strategy, rationale, and the five-target acceptance suite live in the PRD
> ([`BRIEF.md`](../BRIEF.md)). This document does not re-argue *why* — only *how*.
> Implementation begins next week; this is the map.

---

## 0. The central architectural fact (read first)

The grounded pipeline today is **raster, not vector.**

- `rasterizeLayers()` ([`core.ts:88`](../src/engine/lottie/core.ts#L88)) renders
  each set of SVG element ids to a transparent PNG.
- `assembleProject()` ([`project.ts:175`](../src/engine/lottie/project.ts#L175))
  emits Lottie **image layers** (`ty: 2`) whose only animation is the
  **transform** (`tracksToTransform`: opacity `o`, rotation `r`, scale `s`,
  position `p`, anchor `a`).

**Consequence:** trim paths (`tm`) and path deformation (keyframed `sh`) are
*impossible on image layers* — there is no stroke and no vertex data on a PNG.
Both require Lottie **shape layers** (`ty: 4`). So v2.0 is **not** "add tracks to
the transform model"; it is **"introduce a parallel vector layer path"** in the
grounded project, chosen per-element. The raster path stays (correct for
textured/gradient fills); the vector path runs alongside it.

**Important asymmetry to exploit.** The *non-grounded* path
([`generateLottie.ts`](../src/engine/llm/generateLottie.ts) +
[`prompts/lottie.ts`](../src/engine/llm/prompts/lottie.ts)) **already** has the
model author `ty: 4` shape layers with `sh`/`st`/`gr` — but as a free-form,
untyped object passed straight through `validateLottie()`. It is *not* layer-
editable (`project: null`). v2.0's vector work is about bringing **typed,
editable** vector layers, built from the *real* SVG geometry, into the **grounded**
project model — not about teaching the model to draw (it can already emit shapes).

This reframes the phases: **Phase 1 carries the cost of the vector pipeline;
Phases 2–3 build on it.**

---

## Phase ordering & dependency graph

```
P1 Vector pipeline + trim paths ─┬─► P3 Path/shape deformation
P2 Structure + pivots + sequencing ┘   (needs P1 vector layers + trusted converter)
        │
A  Motion-principles rubric  ── parallel, ships independently, improves everything
B  Richer smart controls     ── parallel, depends on nothing in P1–P3
X  Cross-cutting (raster reject, export parity) ── fold into P1
```

Hard rule: **P1 → P2 → P3, gated.** A phase is not "done" until its targets pass
in **both** the Skottie preview **and** the exported Lottie JSON. A/B and B are
unblocked from day one.

---

## Phase 1 — Vector pipeline + trim-path draw-on (build first)

**Targets unlocked:** #3 (checkbox draws L→R + clouds float in), #5 ("Live
better" motto written L→R). Both are stroke-only — the cleanest first vector case.

### 1.1 — `core.ts`: shape-layer types

Add alongside `ImageLayer`. Bodymovin shape shapes are nested: a `gr` group's
`it` array holds the primitives and **must end with a `tr` transform**.

```ts
// core.ts — new types
export type Vec2Key = { i: EaseHandle; o: EaseHandle; t: number; s: number[] }   // for keyframed shapes (P3)
export type ShapeProp =                                       // a path "sh"
  | { a: 0; k: { i: number[][]; o: number[][]; v: number[][]; c: boolean } }      // static path
  | { a: 1; k: Array<{ t: number; s: [{ i: number[][]; o: number[][]; v: number[][]; c: boolean }] }> } // P3

export type ShPath   = { ty: 'sh'; ks: ShapeProp; nm?: string }
export type StStroke = { ty: 'st'; c: Prop; o: Prop; w: Prop; lc: 1|2|3; lj: 1|2|3 } // color/opacity/width/cap/join
export type GsStroke = { ty: 'gs'; /* gradient stroke — see 1.3 open decision */ }
export type TmTrim   = { ty: 'tm'; s: Prop; e: Prop; o: Prop; m: 1 }                 // start%, end%, offset
export type TrGroup  = { ty: 'tr'; o: Prop; r: Prop; p: Prop; a: Prop; s: Prop }
export type GrGroup  = { ty: 'gr'; it: Array<ShPath | StStroke | GsStroke | TmTrim | TrGroup> }

export type ShapeLayer = {
  ddd: 0; ind: number; ty: 4; nm: string
  sr: 1; ks: Transform; ao: 0; ip: number; op: number; st: 0; bm: 0
  shapes: GrGroup[]
}

// widen the doc
export type LottieDoc = {
  v: string; fr: number; ip: 0; op: number; w: number; h: number
  assets: ImageAsset[]; layers: (ImageLayer | ShapeLayer)[]   // ← was ImageLayer[]
}
```

Add a `staticShape(path)` and (P3) a keyframed shape builder next to
`animedKeys`. Keep `tm` builders here too: `staticNum`/`animedKeys` already cover
`s`/`e`/`o`.

### 1.2 — new `engine/lottie/vector.ts`: SVG path → Lottie `sh`

```ts
// vector.ts
export type SubPath = { i: number[][]; o: number[][]; v: number[][]; c: boolean }
/** Parse an element's geometry into Lottie bezier sub-paths in USER space.
 *  Handles <path d>, and synthesises d for <line>/<polyline>/<polygon>/<rect>/<circle>. */
export function elementToPath(el: Element): SubPath[]
/** Pull stroke styling off an element (resolving inherited attrs + style=""). */
export function strokeStyle(el: Element): {
  color: [number, number, number]; opacity: number; width: number
  cap: 1|2|3; join: 1|2|3; gradient?: GradientStops        // gradient → see 1.3
}
```

Scope Phase 1 to **strokes only** (the checkmark and motto are `stroke="…"`,
`stroke-linecap="round"`). Reuse the path `d` parser already implied by the
detector if one exists — check `engine/detector/` before writing a new one.

### 1.3 — `project.ts`: vector layers + trim track

1. **Widen `TrackKey`** ([`project.ts:~50`](../src/engine/lottie/project.ts#L50)):
   add `'trim'` to `TRACK_KEYS`. Add its `TrackMeta` entry (kind `'amount'`,
   min 0, max 100, step 1, unit `'%'`, rest 100, add 100).
2. **`ProjectLayer` gains a kind.** Today it's implicitly an image layer
   (`dataUrl`, `bounds`, `cx/cy`). Add:
   ```ts
   type VectorGeometry = { path: SubPath[]; stroke: ReturnType<typeof strokeStyle> }
   type ProjectLayer = {
     kind?: 'image' | 'vector'        // default 'image' (back-compat)
     vector?: VectorGeometry           // present iff kind==='vector'
     // …existing fields (dataUrl optional when vector)…
   }
   ```
3. **`assembleProject()` branches on kind** at the emit site
   ([`project.ts:182`](../src/engine/lottie/project.ts#L182)):
   - `kind==='image'` → existing `ty: 2` path, unchanged.
   - `kind==='vector'` → emit `ty: 4` with `shapes: [{ ty:'gr', it: [ shPath, stStroke, (tmTrim?), tr ] }]`.
     The `ks` transform comes from the **same** `tracksToTransform(tracks, cx, cy, scale)`
     — vector and image layers share the transform model.
4. **Trim emission.** When `tracks.trim` is present, insert a `TmTrim` into the
   group's `it` (before `tr`) built from the trim track's keyframes via
   `animedKeys`. A trim track with no keys ⇒ no `tm` node.

### 1.4 — `generateGroundedLottie.ts`: route stroke elements to vector

The plan tool currently only groups elements + authors transform keyframes. Add:

- In `prepareLayers()`, after layer assignment, classify each layer: if **all**
  its leaf elements are stroke-only (no fill, has stroke) → build it as a
  **vector** layer (call `elementToPath`/`strokeStyle`, skip `rasterizeLayers`
  for it). Mixed/fill layers stay raster.
- Extend `PLAN_TOOL` ([`generateGroundedLottie.ts:58`](../src/engine/llm/generateGroundedLottie.ts#L58))
  with a `trim` keyframe list (same `SCALAR_KEYS` shape, v = percent 0–100) and a
  `drawOn: boolean` per layer. `planToTracks` maps `trim` like the other scalars.
- The model decides *when* to draw on (entry + stroke-dominant). Default off
  elsewhere (restraint lives in the prompt, see A).

### 1.5 — prompt work

- `prompts/motionPlan.ts`: teach that stroke-only elements can **draw on** via a
  trim track (0→100 over the entry, eased), and when to choose it.
- **Spec-grounding** (from diffusionstudio/lottie v1.0.0): prepend a *tight,
  curated* schema excerpt for **only** the newly-emitted shapes — `sh`, `st`,
  `gs`, `tm` — to the system prompt. Not the whole spec. The model has never
  reliably authored these; an authoritative mini-reference is a cheap validity
  win. Reused in P3 for animated `sh`.

### Open decisions — Phase 1
- **D1. Trim direction.** "L→R" depends on path vertex order. *Either* the model
  specifies a `drawOn` direction and the converter reverses the path when needed,
  *or* the converter normalises every stroke to start at its leftmost point.
  **Recommendation:** converter-normalises to leftmost-start by default; expose
  direction later as a `ParamSelect` (Workstream B). Decide before 1.2.
- **D2. Gradient stroke (`gs`).** The #3 checkbox uses `url(#paint0_linear)`.
  *Either* resolve the gradient to a full Lottie `gs`, *or* fall back to the
  dominant stop color (`st`) for P1 and add `gs` as a fast-follow.
  **Recommendation:** dominant-stop fallback in P1; `gs` fast-follow.

### Exit criteria — Phase 1
- [ ] `ShapeLayer` types compile; `LottieDoc.layers` widened; existing image-only
      generations still assemble byte-identically (snapshot test).
- [ ] **#3:** checkbox stroke draws 0→100 L→R; clouds fade/drift in underneath;
      clean entry start/end. Verified in Skottie preview **and** exported JSON.
- [ ] **#5:** motto draws on as one continuous stroke (or grouped strokes in
      write order), L→R.
- [ ] Trim progress surfaces as an LLM-authored smart-control handle (label +
      hint), consistent with v1.5.
- [ ] Embedded-raster inputs rejected at attach (see Cross-cutting X1).
- [ ] All four exporters round-trip a trimmed vector layer (X2).

---

## Phase 2 — Structure + per-element pivots & sequencing (build second)

**Targets unlocked:** layered-loop parts of #1 (blink), #2 (cloud drift), #4
(coin flip) — everything that does **not** need geometry to deform. No new layer
type; works on the existing transform model.

### 2.1 — correct pivot assignment
Anchor `a` is already `[cx, cy, 0]` ([`project.ts:~197`](../src/engine/lottie/project.ts#L197))
and `cx/cy` are per-layer (computed by `unionBox` in
[`generateGroundedLottie.ts:497`](../src/engine/llm/generateGroundedLottie.ts#L497)).
The work is *correct* pivot assignment per sub-object — its own geometric centre
(or a model-specified pivot), not the comp centre. `unionBox` already does this
per layer; the gap is letting the model **name a pivot** distinct from the bbox
centre (e.g. a rotating hand pivots at the wrist, not its bbox middle).

- Add optional `pivot?: [number, number]` (user space) to the plan layer schema;
  when present it overrides `cx/cy` in the `ProjectLayer`.

### 2.2 — #4 coin flip = simulated 3D
Oscillate **scaleX** through 0 (`100 → 0 → 100`, or `… → -100 …` with a face
swap) anchored at the coin centre. **Verify non-uniform scale survives**: the
scale track today is authored uniform; confirm `scaleTrack`/`tracksToTransform`
emit `[sx, sy, 100]` with independent X and that the handle rebuild
([`project.ts:~548`](../src/engine/lottie/project.ts#L548)) doesn't re-uniformise
it. If it does, split scale into `scaleX`/`scaleY` tracks or carry a 2-component
scale value. **This is a code spike — do it first in P2.**
- Two faces (front/back paths) cross-fade opacity at the half-turn.

### 2.3 — layered loops without fighting
Two ambient tracks on different layers (blink + drift) must compose and keep the
seamless-loop invariant (first key == last key; see `animed3`,
[`core.ts:69`](../src/engine/lottie/core.ts#L69)). Add a loop-seam validator that
warns when a looping track's first/last values differ.

### 2.4 — prompt work
- Strengthen the structural digest in `slimIndex()`
  ([`generateGroundedLottie.ts:528`](../src/engine/llm/generateGroundedLottie.ts#L528)):
  per sub-object add bbox, centroid, is-stroke-only, paint type, document depth —
  so the model can name pivots and group colour-objects out of the `<g>` soup.
- Teach **secondary motion**: low-amplitude ambient tracks (blink, drift) layered
  *under* primary motion, salience-ordered so smart controls still lead well.

### Open decisions — Phase 2
- **D3. Scale representation.** If 2.2's spike shows uniform-scale lock-in: split
  into `scaleX`/`scaleY` tracks (cleaner handles, more tracks) vs. a 2-vector
  scale value on one track (fewer tracks, custom handle). Decide after the spike.

### Exit criteria — Phase 2
- [ ] **#4:** coin reads as spinning on its axis — smooth, continuous, seamless
      loop; faces swap cleanly at the half-turn.
- [ ] **#1 (partial):** eyes blink on an independent loop; coins translate/rotate
      with correct individual pivots (fan *shape* deferred to P3).
- [ ] **#2 (partial):** clouds drift behind a (still-rigid) skipping Zenek.
- [ ] Model-specified pivots round-trip through edit → re-assemble → preview.
- [ ] Loop-seam validator flags any non-seamless looping track.

---

## Phase 3 — Path / shape deformation (build last)

**Targets unlocked:** deforming parts of #2 (rope bends up/down) and #1 (coins
fan/unfold like a deck). **Highest risk** — bad path interpolation looks broken
instantly. Depends on the P1 vector pipeline being trusted.

### 3.1 — animated `sh`
Promote the shape path to keyframed (`a: 1`) with a vertex array per key
(`ShapeProp` `a:1` variant from 1.1). Requires **vertex-count parity and
consistent vertex ordering** across keys — add a validator in `vector.ts` that
rejects or normalises mismatched keyframes (resampling to a common vertex count).

- The rope (#2): a few-vertex open path bobbing between two shapes, seamless loop.
- The coin fan (#1): staged path/position keys per coin in a stagger.

### 3.2 — prompt work
- Constrain the model to author path keyframes with **matching topology**; prefer
  expressing deformation as a small set of named vertex offsets over raw arrays.
- Reuse the P1 spec-grounding excerpt, extended for animated `sh`.
- This phase most needs **real-output evaluation** — budget prompt-iteration
  time, not just engine time.

### Open decisions — Phase 3
- **D4. Authoring surface for deformation.** Raw per-vertex keyframes (maximally
  expressive, hard for the model) vs. a constrained "bend/offset N control points"
  abstraction the converter expands into full vertex arrays (safer, less general).
  **Recommendation:** the constrained abstraction; revisit if it can't express #1.

### Exit criteria — Phase 3
- [ ] **#2 (full):** rope bends naturally up/down in sync with the jump, seamless.
- [ ] **#1 (full):** coins unfold/roll like a fan or deck, smooth and continuous.
- [ ] Vertex-parity validator prevents any topology-mismatched keyframe from
      reaching the player.

---

## Parallel Workstream A — Motion-principles rubric (ships independently)

Improves **every** generation the moment it lands (including v1.5 output), so it
runs in parallel and can ship before P1 completes.

**What:** encode the **12 principles of animation** (Disney / Thomas & Johnston)
as craft knowledge in the motion-design stage.

**Where:** `prompts/motionPlan.ts` — the stage where the model decides *what
moves and how*, before assembly.

**Aesthetic steering — decided:** the rubric is the **full vocabulary**, not a
ZEN-restrained subset. The engine holds every principle; the **designer's prompt**
and the **Subject/Animation axes** set mood and intensity. A calm default applies
only when the prompt is silent — a default, not a capability cap. Squash/stretch
and exaggeration are available like anything else when asked for.

**Translate, don't paste** — render each principle into our domain:

| Principle | Lottie/Zenimator translation |
|---|---|
| Squash & stretch | non-uniform scale (X↑→Y↓) preserving volume; on impact/speed |
| Anticipation | a small counter-move keyframe before the main action |
| Staging | one dominant motion; don't animate competing elements |
| Straight-ahead / pose-to-pose | we are pose-to-pose: author extremes, ease between |
| Follow-through / overlap | stagger child/appendage tracks to lag the parent |
| Slow in / slow out | easing — `EASING_BEZIER` ([`core.ts:31`](../src/engine/lottie/core.ts#L31)) is exactly this lever |
| Arcs | position paths curve, not straight — spatial bezier tangents (`ti`/`to`) on position keys |
| Secondary action | low-amplitude ambient tracks under primary (blink, drift) — ties to P2 |
| Timing | frame counts set weight/personality; tie to fps + entry/loop length |
| Exaggeration | amplitude dialed by prompt intent, not capped |
| Solid drawing | respect the artwork's real anatomy/pivots — ties to P2 |
| Appeal | overall: clear, pleasing motion; emergent from the above |

> **Arcs note:** `ti`/`to` (spatial tangents on position keyframes) are **not**
> emitted today — `animedKeys` only sets temporal handles. Adding arced position
> requires extending the position keyframe to carry `ti`/`to`. Small engine task;
> flag it if the rubric promises arcs the engine can't yet render.

**Validation:** A/B real generations with vs. without the rubric across the five
targets + a few v1.5 prompts; judge whether motion reads more intentional. Taste
work — budget evaluation time.

---

## Parallel Workstream B — Richer smart controls (depends on nothing in P1–P3)

Today the only control is `ParamSlider` (numeric,
[`controls/ParamSlider.tsx`](../src/components/controls/ParamSlider.tsx)),
rendered in `GenerateControlsPanel`
([`GenerateControlsPanel.tsx:106`](../src/components/generate/GenerateControlsPanel.tsx#L106)).
Many properties are better as a **choice, toggle, or dialog**, and a layer should
surface *all* the controls that matter, not an arbitrary 2–4.

### B.1 — engine / model
- Extend `HandleMeta` ([`project.ts`](../src/engine/lottie/project.ts)) with a
  **control kind** and per-kind config:
  ```ts
  type HandleMeta = {
    label: string; hint?: string
    control?: 'slider' | 'select' | 'switch' | 'dialog'   // default 'slider'
    options?: { value: string; label: string }[]          // for 'select'
  }
  ```
- `LayerHandle` (the derived knob) carries `control`/`options` through
  `deriveHandle`/`deriveLayerHandles`. `applyHandle` learns to apply a
  select/switch value (e.g. switch → amplitude 0 vs origin; select → easing key
  or trim direction).
- `controlsToMeta` ([`generateGroundedLottie.ts:340`](../src/engine/llm/generateGroundedLottie.ts#L340))
  validates the new fields. Drop the soft "2–4 handles" prompt guidance: surface
  the essential controls, salience-ordered. Quality over count.

### B.2 — UI (`components/controls/`)
Primitives present in `ui/`: **`select`, `dialog`, `dropdown-menu`, `slider`** ✅.
`switch` isn't pulled in yet — add it from the shadcn registry
(`npx shadcn add switch`, the project is shadcn `base-nova` on Base UI per
`components.json`), don't hand-build it. **All UI pieces come from shadcn**; the
ZEN skin then applies via the Tailwind theme as with the existing primitives.

- `ParamSelect` — easing curve · **trim direction (L→R / R→L)** (ties to D1) ·
  loop style (loop / ping-pong / once).
- `ParamSwitch` — enable secondary motion (blink) · draw-on · reverse.
- `ParamDialog` — heavier config (stroke colour, multi-stop gradient → ties to
  D2) without cluttering the panel; the per-keyframe editor stays the deepest
  escape hatch.
- All ZEN-skinned, `render`-prop pattern (not `asChild`). Render-switch in
  `LayerEditor` ([`GenerateControlsPanel.tsx:106`](../src/components/generate/GenerateControlsPanel.tsx#L106))
  on `h.control`.

### Exit criteria — Workstream B
- [ ] `switch` pulled from the shadcn registry (not hand-built).
- [ ] Each control kind round-trips: edit → re-assemble → preview updates live,
      geometry reused.
- [ ] Each control kind survives all four exporters.
- [ ] A layer can surface >4 controls when warranted, salience-ordered.

---

## Cross-cutting (fold into Phase 1)

- **X1. Reject embedded raster at attach.** Inputs are full SVG, always.
  `sanitizeSvg.ts` / `detectSvg.ts` should reject `<image>` with base64 `data:`
  payloads (the `live-better` / `jump-rope` exports that blew up token count)
  with a clear, designer-facing message. A draw-on needs real vector endpoints; a
  bitmap has none.
- **X2. Export parity.** Trim paths and shape layers must survive the JSON / HTML
  / WebM / GIF exporters unchanged. Skottie renders them; verify each exporter
  (the WebM/GIF paths capture frames, so they inherit Skottie correctness, but
  confirm the JSON/HTML paths emit the new layer types verbatim).
- **X3. Smart-controls coverage.** New primitives (trim progress, flip speed,
  rope amplitude) surface as LLM-authored handles, consistent with v1.5.

---

## Acceptance (v2.0 done bar)

All five targets render well **from full-SVG source**, each verified in Skottie
preview **and** exported Lottie JSON:

| Target | Lands in | Exercises |
|---|---|---|
| #3 checkbox draws L→R + clouds | P1 | trim paths · ambient entrance |
| #5 "Live better" written L→R | P1 | trim paths on vector strokes |
| #4 coin spins on its axis | P2 | simulated 3D (scaleX through zero) |
| #1 Zenek juggling (blink, pivots) | P2 partial → P3 full | pivots · sequencing · path deform |
| #2 skipping rope + cloud drift | P2 partial → P3 full | ambient drift · rope path deform |
