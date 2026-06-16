# v2.0 — Full SVG Animation Engine: Implementation Plan

> Engineering guide for the three v2.0 workstreams. Companion to the BRIEF
> roadmap. Implementation deferred to next week — this is the map, not the code.

## The central architectural fact

The grounded pipeline today is **raster, not vector.** In
`engine/lottie/core.ts`, `rasterizeLayers()` renders each SVG sub-object to a
transparent PNG; `assembleProject()` (`project.ts:175`) emits Lottie **image
layers** (`ty: 2`) and animates their **transform** (`tracksToTransform`,
`project.ts:191`: opacity `o`, rotation `r`, scale `s`, position `p`, anchor `a`).

**Consequence:** trim paths (`tm`) and path deformation (`sh` keyframes) are
*impossible on image layers* — there is no stroke and no vertex data to animate.
Both require Lottie **shape layers** (`ty: 4`). So v2.0 is not "add primitives to
the transform model"; it is "introduce a parallel vector layer path." The
existing raster path stays (it's the right tool for textured/complex fills); the
new vector path runs alongside it, chosen per-element.

This reframes the workstreams: WS1 carries the cost of standing up the vector
layer pipeline; WS2 and WS3 build on it.

---

## Workstream 1 — Trim-path draw-on (build first)

**Unlocks:** target #3 (checkbox draws L→R), #5 ("Live better" motto written
L→R). Both are stroke-only paths — the cleanest possible first vector case.

### Why first
Highest leverage (every signature / underline / progress-ring / checkmark uses
it), and stroke-only paths convert to vector with no fill/gradient complications.
It forces the vector pipeline into existence on the easiest input.

### Engine work
1. **Shape-layer types** in `core.ts`: add `ShapeLayer` (`ty: 4`) alongside
   `ImageLayer`. Shapes needed: `sh` (path, with bezier vertex data `{ i, o, v, c }`),
   `st` (stroke: color, width, line-cap/join), `tm` (trim: `s` start %, `e` end %,
   `o` offset). `LottieDoc.layers` becomes `(ImageLayer | ShapeLayer)[]`.
2. **SVG path → Lottie `sh`** converter in a new `engine/lottie/vector.ts`:
   parse `d` attributes (and `<line>`/`<polyline>` → path) into bezier vertices.
   Scope WS1 to strokes only — pull `stroke`, `stroke-width`, `stroke-linecap`
   from the element (the ZEN checkmark and motto are `stroke="#222"` / brand
   green, `stroke-linecap="round"`). Gradient strokes (the #3 checkbox uses
   `url(#paint0_linear)`) — resolve to a Lottie gradient stroke `gs`, or fall
   back to the dominant stop color in WS1 and add `gs` as a fast-follow.
3. **Trim track**: extend the `Track`/`TrackKey` model (`project.ts:50`) with a
   `trim` track (0→100 over the entry). `tracksToTransform` gains a sibling that
   appends a `tm` modifier to the shape group when a trim track is present.
4. **Project model**: a layer becomes `{ kind: 'image' | 'vector', … }`. Vector
   layers carry parsed path data instead of `dataUrl`. Assembly branches on kind.

### LLM / prompt work
- `prompts/lottie.ts` + `generateGroundedLottie.ts`: teach the model that
  stroke-only elements can be **drawn on** via a trim track, and *when* to choose
  it (entry + linear/eased 0→100, ordered by stroke direction). Gate on
  Subject=Illustration or stroke-dominant elements; keep it off by default
  elsewhere (restraint).
- Direction matters: "L→R" depends on path vertex order. Decide whether the model
  specifies trim direction or the converter normalizes start point to leftmost.
- **Spec-grounding for new primitives** (idea borrowed from diffusionstudio/lottie
  v1.0.0, whose generation reliability win was "reference integration to the
  Lottie format specification"). Feed the model a *tight, curated* schema excerpt
  for exactly the shape types we're newly emitting — `sh` (path), `st` (stroke),
  `gs` (gradient stroke), `tm` (trim) — not the whole spec. The model has never
  reliably authored these; an authoritative reference for just the new shapes is
  a cheap, high-value validity win. Applies again in WS3 for animated `sh`.

### Validation
- #3: checkbox stroke draws 0→100 L→R; clouds fade/drift in underneath; clean
  start and end (entry). Confirm in Skottie preview *and* exported JSON.
- #5: motto draws on as one continuous stroke (or grouped strokes in write order).
- Regression: existing image-layer generations unchanged.

---

## Workstream 2 — Structural understanding + per-element pivots & sequencing

**Unlocks:** the layered-loop parts of #1 (blink), #2 (cloud drift), #4 (coin
flip) — i.e. everything that *doesn't* need geometry to deform.

### Why second
No new layer type required — it works on the existing transform model. The gap is
the model reliably reading messy SVGs and composing layered loops. Real ZEN files
are deep `<g>` soup (`Group 48096319`, `Group 1000007157`) with color-group
"objects" and no semantic tags.

### Engine work
- **Per-element pivots already exist**: anchor `a` is `[cx, cy, 0]`
  (`project.ts:197`), and `cx/cy` are per-layer. The work is *correct* pivot
  assignment — compute each sub-object's geometric center (or a model-specified
  pivot) rather than inheriting the comp center. Add bbox computation in the
  layer-def stage.
- **#4 coin flip = simulated 3D**: oscillate scaleX through 0 (1 → 0 → -1 → 0…)
  with eased timing, anchored at the coin's center. No new primitive — but the
  scale track is currently uniform; confirm `scaleTrack` supports independent
  X/Y (it emits `[sx, sy, 100]` — verify non-uniform keys survive the handle
  rebuild in `project.ts:548`). The coin's two faces (front/back paths) cross-fade
  at the half-turn.
- **Layered loops**: ensure two ambient tracks on different layers (blink +
  drift) compose without fighting; verify seamless-loop invariant (first key ==
  last key, see `animed3` in `core.ts:69`).

### LLM / prompt work
- Strengthen the structural digest sent to the model: derived hints per
  sub-object (bbox, centroid, is-stroke-only, paint type, document depth) so it
  can name pivots and group color-objects. This is the BRIEF's "stronger
  grounding signal."
- Teach **secondary motion**: low-amplitude ambient tracks (blink, drift) layered
  *under* primary motion, salience-ordered so smart controls still read well.

### Validation
- #4: coin reads as spinning on its axis, smooth, continuous, loops seamlessly.
- #1 (partial): eyes blink on an independent loop; coins translate/rotate with
  correct individual pivots (fan *shape* deferred to WS3).
- #2 (partial): clouds drift L→R behind a (still-rigid) skipping Zenek.

---

## Workstream 3 — Path / shape keyframes (build last)

**Unlocks:** the deforming-geometry parts of #2 (rope bends up/down) and #1
(coins fan/unfold like a deck).

### Why last
Highest risk: the model must author *tasteful path interpolation* — vertex counts
must match across keyframes, and bad interpolation looks broken instantly.
Depends on the WS1 vector pipeline already existing and being trusted.

### Engine work
- **Animated `sh`**: the path property becomes keyframed (`a: 1`) with vertex
  arrays per key. Requires vertex-count parity and consistent ordering across
  keys — add a validator that rejects/normalizes mismatched keyframes.
- The rope (#2) is a few-vertex open path bobbing between two shapes (seamless
  loop). The coin fan (#1) is staged path/position keys per coin in a stagger.

### LLM / prompt work
- Constrain the model to author path keyframes with matching topology; prefer
  expressing deformation as a small set of named vertex offsets over raw arrays.
- This workstream most needs **real-output evaluation** (per BRIEF taste notes) —
  budget prompt-iteration time, not just engine time.

### Validation
- #2 (full): rope bends naturally up/down in sync with the jump, seamless loop.
- #1 (full): coins unfold/roll like a fan or deck, smooth and continuous.

---

---

## Parallel workstream A — Motion-principles rubric (prompt craft)

Not sequenced with WS1–3 — it improves **every** generation (including v1.5
output) the moment it lands, so it can run in parallel and ship early.

**What:** encode the **12 principles of animation** (Disney / Thomas & Johnston,
*The Illusion of Life*) into the motion-design stage as craft knowledge the model
draws on when authoring keyframes.

**Where:** `prompts/motionPlan.ts` — the "designer intent" stage where the model
decides *what moves and how*, before assembly. The principles shape the plan; the
*why* (an arc reads more alive than a straight line; a trailing element should
lag) is what raises proposal quality.

**Aesthetic steering — decided:** the rubric is the **full vocabulary**, not a
ZEN-restrained subset. The engine holds every principle; the **designer's prompt**
and the **Subject/Animation axes** set the mood and intensity. A calm default
applies only when the prompt is silent ("don't over-animate"), which is a default,
not a capability cap. Squash/stretch and exaggeration are available like any
other when the request calls for them.

**Translate, don't paste.** Each principle must be rendered into *our* domain —
what it means for keyframes, easing, tracks, and timing — so it's actionable, not
prose. Mapping:

| Principle | Lottie/Zenimator translation |
|---|---|
| Squash & stretch | non-uniform scale (X↑→Y↓) preserving volume; on impact/speed |
| Anticipation | a small counter-move keyframe before the main action |
| Staging | one dominant motion; don't animate competing elements (restraint) |
| Straight-ahead / pose-to-pose | we are pose-to-pose: author extremes, ease between |
| Follow-through / overlap | stagger child/appendage tracks to lag the parent |
| Slow in / slow out | easing — our `EASING_BEZIER` set is exactly this lever |
| Arcs | position paths should curve, not go straight — spatial bezier tangents (`ti`/`to`) on position keys |
| Secondary action | low-amplitude ambient tracks under primary (blink, drift) — ties to WS2 |
| Timing | frame counts set weight/personality; tie to fps + entry/loop length |
| Exaggeration | amplitude dialed by prompt intent, not capped |
| Solid drawing | respect the artwork's real anatomy/pivots — ties to WS2 |
| Appeal | overall: clear, pleasing motion; emergent from the above |

**Validation:** A/B real generations with vs. without the rubric on the five
acceptance targets + a few v1.5 prompts; judge whether motion reads more
intentional. This is taste work — budget evaluation time, not just authoring.

## Parallel workstream B — Richer smart controls

Today the only control is `ParamSlider` (numeric). Many properties are better
expressed as a **choice, a toggle, or a dialog** than a slider — and a layer
should surface *all* the controls that matter for it, not an arbitrary 2–3.

**Engine / model work**
- Extend `HandleMeta` (`project.ts`) with a **control kind**:
  `'slider' | 'select' | 'switch' | 'dialog'` + per-kind config (e.g. `options`
  for a select). The model authors the *right control* per property, not just a
  range.
- Drop the soft "2–4 handles" guidance: surface **the essential controls for the
  layer**, however many that is, salience-ordered. Quality of selection over count.

**UI work** (`components/controls/`, Base UI primitives already in `ui/`)
- `ParamSelect` (dropdown) — easing curve · trim direction (L→R / R→L) · loop
  style (loop / ping-pong / once).
- `ParamSwitch` (toggle) — enable secondary motion (blink) · draw-on · reverse.
- `ParamDialog` — heavier config (stroke color, multi-stop gradient) without
  cluttering the panel; the per-keyframe editor stays the deepest escape hatch.
- All re-skinned to the ZEN aesthetic; `render`-prop pattern, not `asChild`.

**Validation:** each control kind round-trips (edit → re-assemble → preview
updates live, geometry reused) and survives all four exporters.

## Cross-cutting

- **Reject embedded raster at attach.** Inputs are full SVG. `sanitizeSvg.ts` /
  `detectSvg.ts` should reject `<image>` with base64 `data:` payloads (the
  `live-better` and `jump-rope` exports that broke earlier) with a clear message.
- **Export parity.** Trim paths and shape layers must survive the JSON / HTML /
  WebM / GIF exporters unchanged — Skottie renders them, but verify each exporter.
- **Smart-controls coverage.** New primitives (trim progress, flip speed, rope
  amplitude) should surface as LLM-authored handles, consistent with v1.5.
- **Sequencing discipline.** WS1 → WS2 → WS3, gated on each target passing in
  Skottie preview *and* exported file before moving on.

## Acceptance (v2.0 done bar)

All five render well from full-SVG source: #3 #5 (WS1), #4 + partial #1/#2 (WS2),
full #1 #2 (WS3).
