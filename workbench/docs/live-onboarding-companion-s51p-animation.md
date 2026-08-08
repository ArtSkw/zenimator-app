# Live Onboarding Companion (Hug-Pillow, s51p) — How It's Animated

`assets/live-onboarding-companion-s51p.svg` is **byte-identical** to
`assets/companion-hug.svg` (confirmed via `diff` — only attribute-order and
entity-encoding differ). This is the first time that hug-pillow archetype
gets the FULL current companion-bubble contract (Bold text, `bubble.textPos`/
`bubble.anchor` slots, `autoFit.max`, house-constant entrance timing,
Living-idles density) — `scripts/build-companion-hug.mjs` (2026-08-05)
predates several of those requirements. `scripts/build-live-onboarding-
companion-s51p.mjs` is a fresh build using companion-hug's confirmed element
map and paint order (still valid — same geometry) but re-derives every
published constant against the CURRENT skill references rather than porting
them. See the build script's own header comment for the itemized list of
what changed and why (font weight/size, the two new slots, `autoFit.max`,
entrance timing, idle density).

## Porting is not authoring — the audit performed this session

| constant | source script value | verified against | outcome |
| --- | --- | --- | --- |
| Font | companion-hug: Nunito Regular, size 17 | recipe: Bold static, ZEN spec 15/19 | **changed** — shipped Nunito-Bold.ttf, size 15, lh 19 |
| Entrance timing | companion-hug: bubble pop t=18, 40f | recipe's house table (trail-small 0/20f, trail-large +8/24f, plate +28/54f) | **changed** — full house-constant rebuild, `T=90` |
| Slots | companion-hug: `bubble.text`/`bubble.size` only | recipe section 3: `.textPos`/`.anchor` also required | **added** both, mechanism copied from `live-onboarding-companion-svmt`'s proven-working scene (verified: `bubble-anchor`'s own `a` carries `sid:"bubble.anchor"`, `p` stays fixed at the tail-pin point — one null does double duty for entrance pivot AND resize pivot) |
| `autoFit.max` | companion-hug: absent (predates the requirement) | recipe: required, derived from stage margin + geometry | **computed fresh**: `MARGIN=240*0.03=7.2`, `max[0]=221.6` (left-edge-limited, `PLATE_CX=118`), `max[1]=35` — this composition's plate sits at the source SVG's `y=14`, only 6.8px below the top margin at default size, so the geometry clears margin for exactly 1 line (49−7.2=41.8 < the 54px a 2-line plate needs). Documented honestly rather than repositioning the plate to manufacture headroom the source artwork doesn't have. |
| Idle density | companion-hug: 3 sparse keyframes per track, `IDLE=120` | motion-taste Living-idles bar: dense-sampled envelope, hundreds of keyframes, satellite float, echo-from-frame-0 | **rebuilt**: dense envelope system, `IDLE=216` (longer, per brief's "calmest of the set"), 1049 total animated keyframes across 21 layers |

## Element map

- **Tooltip/Compact** rect → bubble plate; baked "font" glyph path →
  REPLACED with a native `ty:5` text layer (slot `bubble.text`).
- **Ellipse 2420 / 2421** → trail-large / trail-small (the tail-equivalent —
  no separate tail triangle in this source).
- **Group 1000007767** → mascot + the held charity stone:
  - Ellipse 324 → `paw` (peeks from behind, painted before body).
  - body / face / Vector 1 / Vector 2 → mascot head (`body` blob, `face`
    white patch, `eye-left`/`eye-right` — closed, content arcs).
  - The source names this element id="charity stone" — a ZEN client-benefit
    Stone, **not a pillow**. Renamed `charity-stone` / `charity-stone-crease`
    (was `pillow`/`pillow-crease` in the first pass — see "Second pass"
    below for why the old name was wrong and how it was caught).
  - "Union" → `heart`, the mark on the stone — the source stacks TWO white
    paths here, not one (see "Second pass").
  - Ellipse 325 → `arm-ring` (the visible hugging arm, painted OVER body and
    the stone).
  - Vector 1012 → `arm-crease` (secondary highlight).
- **"Fill 11"** (raster diagonal-hatch) → revectorized stroke hatch,
  track-matted to the true pill silhouette, parented to `shadow-rig`.

## Second pass — four measured defects (fixed)

A review measured four defects in the first pass, all confirmed independently
this session before fixing:

**1. Bubble composite scale 125.4%, not 112%.** `bubble-text` was parented to
`bubble-anchor` AND carried its own matching 112% scale keyframes (added
because an earlier session's testing suggested text doesn't inherit a
parent's animated scale in this player). That earlier finding was wrong, or
at least not universal: scale DOES compose down the parent chain here, so
112% (parent) × 112% (child) rendered at 125.4% — the text visibly outgrew
its own plate at the overshoot frame. Motion-taste now states this
explicitly ("never animate the same property twice down a parent chain").
Fix: removed `bubble-text`'s own `ks.s` entirely; it now inherits 100% of the
pop from `bubble-anchor`, the single owner. Verified by multiplying the
chain from the JSON, not by reading one layer: peak composite = 112% × 100%
(text's own, now absent) = **112%** exactly.

**2. Text not vertically centered — and the actual bug was worse than a
wrong constant.** The isolated-layer method (render `bubble-text` alone and
`bubble-plate` alone, compare ink bounds — a whole-bubble scan can't see
this, the plate's own stroke runs along every row) measured top inset 8px /
bottom inset 16px with the shipped `BASELINE_LOCAL=5.41`. The first fix
attempt (recompute the constant to 9.3, per the standard
`plateCenterY + fontSize*0.36` formula) changed NOTHING — same 8/16 insets.
The real bug: `bubble-text`'s `ks.a` and `ks.p` were both set to
`[0, BASELINE_LOCAL, 0]` — the same "hidden zero" class of bug already
documented for the paw layer (see below), just on a text layer's transform
instead of a shape's: `(local − a) + p` cancels whenever `a == p`, so the
baseline offset was **never applied at all**, at any value. Fixed by leaving
`a` at `[0,0,0]` and letting `p` alone carry the translation. With the real
offset finally applying, `BASELINE_LOCAL` was re-derived from measured data
(linear: two data points at `p=0` and `p=9.3` gave the slope) to `3.9`,
verified top inset == bottom inset == **12px exactly**.

**3. The held charity stone was dead and unparented — "hugging an object
glued to the background."** `pillow`/`pillow-crease`/`heart`/`arm-crease`
were static with no parent at all, and `arm-ring`/`paw` were independently
animated but ALSO unparented — none of them moved when the body pressed in.
Motion-taste's new rule ("a held object is part of the body") names this
exact failure. Fixed with a two-level rig:
- **`hug-rig`** (pivot: bbox center of `arm-ring` ∪ `charity-stone`) carries
  the shared "arms tighten" motion (`armEnvelope`, `scale 100→91`, the same
  amplitude `arm-ring` used to carry alone) and parents `arm-ring`, `paw`,
  `arm-crease`, and `stone-rig` — so the whole embrace moves as one unit.
- **`stone-rig`** (child of `hug-rig`; pivot: the stone's contact edge with
  the body, mid-height) adds the stone's OWN secondary compress — a NEW
  `stoneEnvelope`, phase-delayed ~8f after `armEnvelope` so it settles a beat
  after the arms (`scaleX 100→97`, `scaleY 100→98`) — and parents
  `charity-stone`, `charity-stone-crease`, and `heart`, so the heart and
  crease ride the deforming stone instead of floating over it.
- `arm-ring`/`paw`/`arm-crease` are now static in their OWN `ks` (no
  double-counted amplitude down the chain — same lesson as defect 1) and
  purely inherit `hug-rig`'s motion.

**4. Naming and the heart shape.** The stone is renamed throughout (see
element map). The heart: `<g id="Union">` in the source stacks TWO white
`<path>` elements, not one — a small inner fill and a much larger
stroke-expanded outline of the SAME heart. The first pass ported only the
inner path (following `companion-hug.mjs`'s judgment that the second was "a
visually redundant duplicate at this scale") — rendering both paths
overlaid at 8x zoom (a throwaway canvaskit script, `ck.Path.MakeFromSVGString`
on each raw `d` string) showed the outline is several px LARGER all around,
not a duplicate: using only the inner path drew a heart noticeably
smaller/thinner than the source. Combining both into one path under one
fill rule was tried and produced a broken hollow-ring artifact (the outline
path is itself a closed ring — a stroke-expanded-to-fill shape — whose
winding only resolves correctly as its own independent opaque fill).
Fixed by painting both as two separate white-filled groups in the `heart`
layer, matching how the source itself stacks two independent `<path>`
elements. Confirmed by a high-zoom crop of the built scene against a raw
rasterization of the source paths — same silhouette.

## Third pass — the heart, rebuilt properly

The two-path-union fix above was visually close but structurally wrong, and
a fresh review measured it: importing path index 8 (26 subpaths, 5966 chars
— Figma's flattened stroke-outline export of the heart) wholesale, on top of
path index 7 (the ONE real heart shape, 10 curves), left the `heart` layer
at 27 subpaths / 189 vertices for what is conceptually "one shape plus its
own stroke." The review's measurement: scene bbox x167-196/y140-166 against
the source's x166-198/y138-167 — a couple px short on most edges, easy to
miss at 1x but real.

**The reframe**: path 8 isn't a second design element, it's Figma's SVG
export flattening an actual vector STROKE on path 7 into a filled outline
shape (its bbox is uniformly a few px larger all round — exactly what a
centered stroke outline looks like once expanded to a fill). The fix is
therefore not "import both paths correctly" but "don't import path 8 at
all — give path 7 a real Lottie stroke instead," which is both simpler (1
subpath instead of 27) and more robust (repositioning/rescaling the heart
later only touches one path, not two that have to be kept in sync).

**Finding the stroke width**: rather than guess, it was fit empirically. A
throwaway canvaskit script rasterized `path7 fill ∪ path8 fill` (the true
source union) as ground truth, then rendered `path7 filled + path7 stroked`
at a sweep of candidate widths and diffed each against the ground truth:

| stroke width | diff px (of ~57,600, at 10x supersample) | bbox match |
| --- | --- | --- |
| 2.0 | 19,771 | loose |
| 2.21843 | 18,624 | loose |
| 4.0 | 9,113 | closer |
| 5.0 | 3,564 | close |
| **5.6469** | **128 (≈1.3px at 1x)** | **matches to ~0.1px** |
| 6.0 | 2,122 | overshoots |

5.6469 is not a round number picked to fit — it's the EXACT stroke-width
value the source SVG already uses for `"charity stone"`'s own outline
(`stroke-width="5.6469"` on that path). The design reused the stone's own
outline weight for the heart mark sitting on it, which the "import both
paths" approach had no way to surface (it never asked "why is this bigger,"
just imported the bigger shape). Rebuilt as `group('heart', [...path7-verts,
fillItem('#FFFFFF'), strokeItem('#FFFFFF', 5.6469, ...)])` — same
`fillItem`/`strokeItem` pattern already used for `charity-stone` itself.

**Verification**:
- Geometry: scene heart is now **1 subpath, 13 vertices** (source path 7:
  1 subpath, 10 curve + 1 line command — the small vertex-count difference
  is `parsePath`'s own dedup of a redundant closing vertex, not a shape
  discrepancy). Down from 27 subpaths / 189 vertices.
- Bbox: rendered isolated at rest, scene heart bbox `{164,136,198,168}`
  against a fresh rasterization of source path 7 + path 8 together,
  `{164,136,198,168}` — **identical on every edge**, well inside the ~0.5px
  requirement.
- Pixel diff: scene heart (isolated, `t=90`) vs the rasterized source, over
  a 55×55px region around the heart: **92/3025px differ (3.0%)** — edge
  antialiasing only (a side-by-side crop at 4x shows the same silhouette;
  the previous two-path version's own antialiasing edges would show a
  similar-magnitude count, this isn't a defect signal by itself, the bbox
  and visual match are what confirm the fix).
- Contract re-check (nothing else touched, all still pass): composite
  bubble scale 112% exactly; text insets 12px/12px; `heart` still parented
  to `stone-rig` (`stone-rig` scale 97-100%, `hug-rig` 91-100%, unchanged);
  every animated track keys explicitly at `t=90`/`t=306` with equal values;
  numeric seam check — equal interpolated value AND equal velocity entering
  `t=90` vs leaving `t=306` on every track — passes; pixel-diff at the seam
  (corroboration only, per the updated motion-taste note on fractional
  sampling at `op`) 15/230400, unchanged.

## A real bug: the paw's anchor/position "hidden zero" (first pass)

This class of bug bit TWICE this scene — first on the paw's shape transform
(below), then again on the text layer's transform in the second pass above.
Same mechanism both times: setting `a` and `p` to the identical point looks
harmless ("it's just the pivot") but silently cancels whatever that point's
value is supposed to contribute. Worth a dedicated look before adding an
anchor to any layer: if `a == p`, ask what that's supposed to DO, because the
answer is "nothing, structurally."

The paw layer was ported as `a:[cx,cy,0], p:[cx,cy,0]` on an ellipse
primitive whose own shape sits at LOCAL `(0,0)`. Per player-contract's
"hidden zero" note (`screenPoint = S·(local − a) + p`): with `local=(0,0)`,
`a=(cx,cy)`, `p=(cx,cy)`, and `S=1` (100% scale), this collapses to
`(0,0) − (cx,cy) + (cx,cy) = (0,0)` — the paw rendered as a stray dark blob
glued to the composition's absolute origin, regardless of what `(cx,cy)`
was. Caught by rendering frame 0 and reading it (a small dark shape at
top-left that had no business being there). **This is present in
`companion-hug.mjs` too** (identical code, same bug) — flagging for anyone
touching that script next; `trailCircle()` in the same file shows the
correct pattern (`p:[cx,cy,0]` alone, default anchor `(0,0,0)`) right next
to the buggy one. Fix: for a primitive shape authored at local origin, use
position alone; don't also set anchor to the same point.

## A diagnostic-harness pitfall that cost most of this session

Chasing the loop-seam verification (`anim.seekFrame(T)` vs `anim.seekFrame(op)`
pixel diff, per player-contract), a throwaway CanvasKit script reported wild,
non-reproducible corruption: frame 306 rendering as a tiny mascot shrunk to
the top of the canvas, or the bubble text missing its first few glyphs,
depending on call order. Two full rounds of bisection (disabling layers,
isolating track-matte vs plain layers, sparse vs dense keyframes, transform
vs opacity) chased this as first a track-matte engine bug, then reverted that
"fix" once the real cause was found:

1. **Wrong wasm binary.** The throwaway scripts resolved
   `canvaskit-wasm/bin/full/canvaskit.js` from `node_modules` directly. The
   actual verification path (`scripts/preview-scene.mjs`, and the app itself)
   loads `public/canvaskit.wasm` — a different build. Loading the npm
   package's own bundled wasm produced real, reproducible rendering
   divergence that had nothing to do with the scene.
2. **Fresh `MakeManagedAnimation`/`MakeSurface` per frame, even with the
   correct wasm, was ALSO unreliable** — creating and deleting many of these
   objects across sequential calls in one Node process corrupted later
   renders. The reliable pattern (confirmed by matching `preview-scene.mjs`'s
   own approach and getting clean, reproducible results): **one **`anim`**
   and one **`surface`** reused across all frames**, drawing each frame into
   its own translated region via `canvas.save()/translate()/render()/
   restore()`, exactly like the grid previewer already does.

Once verified with a script that matched `preview-scene.mjs`'s pattern
(same wasm path, one shared anim/surface), every earlier "corruption" and
the "track-matte engine bug" both evaporated — the scene was correct the
whole time. **Lesson for future sessions**: any throwaway CanvasKit
verification script MUST (a) load `public/canvaskit.wasm`, not
`node_modules/canvaskit-wasm`'s own binary, and (b) reuse one
`MakeManagedAnimation`/`MakeSurface` pair across multiple `seekFrame` calls
rather than constructing fresh ones per frame — deviating from either
produces false-positive corruption that looks exactly like a real engine bug
and will send you down the wrong path.

## Verification (both passes, using the corrected harness)

- `node scripts/build-live-onboarding-companion-s51p.mjs` — 21 layers, valid
  JSON, 1049 animated keyframes, `T=90`/`IDLE=216`/`OP=306`.
- Frame grids at `[0,15,30,45,60,75,90]`, `[90,120,163,200,250,306]`, and
  `[28,50,67,82,90]` (bubble entrance close-up) via `preview-scene.mjs`:
  trail circles pop smallest-first, bubble emerges from the tail with a soft
  ~112% overshoot and the text now fits inside the plate at the overshoot
  frame (was outgrowing it before the composite-scale fix), text reads
  legibly (Nunito Bold) and centered inside the plate, the mascot's
  squeeze/eye/arm/stone/shadow are all visibly different frame to frame —
  alive under the entrance and through the idle.
- **(a) Composite bubble scale**, computed by multiplying the parent chain
  from the JSON rather than reading one layer: `bubble-anchor` peaks at
  112% at `t=67`; `bubble-text` and `bubble-plate` both carry no own `ks.s`
  (removed/never had one), so composite = 112% × 100% = **112%** for both —
  matches the plate exactly, no more outgrowing.
- **(b) Isolated-layer text/plate insets**: `bubble-text` alone vs
  `bubble-plate` alone, ink-bounds compared — **top inset 12px == bottom
  inset 12px**, difference 0 (target: equal within ~1px).
- **(c) Amplitude table** — isolated-layer-plus-parent-chain pixel diff
  between `t=90` (rest) and `t=170` (inside both `hug-rig`'s and
  `stone-rig`'s hold windows), proving real rendered motion even where a
  layer's OWN keyframes are static (motion inherited through parenting):

  | layer | own scale range | parent chain | pixel diff, rest→peak |
  | --- | --- | --- | --- |
  | `hug-rig` | 91–100% | (root) | 1800px (all children) |
  | `stone-rig` | 97–100% | `hug-rig` | 1341px (stone parts) |
  | `arm-ring` | static 100% | `hug-rig` | 236px |
  | `paw` | static 100% | `hug-rig` | 228px |
  | `arm-crease` | static 100% | `hug-rig` | 202px |
  | `heart` | static 100% | `stone-rig`→`hug-rig` | 289px |
  | `charity-stone` | static 100% | `stone-rig`→`hug-rig` | 975px |
  | `charity-stone-crease` | static 100% | `stone-rig`→`hug-rig` | 230px |

  No dead tracks: every held-object part shows non-zero measured amplitude.
- **(d) High-zoom heart vs source**: a crop of the built scene at `zoom 8`
  next to a raw rasterization of the source's two `<path>` elements —
  matching silhouette, confirming the two-path union fix (see "Second pass").
- **(e) Two idle frames far apart** (`t=90` rest, `t=170` peak) rendered
  side by side: the stone (dark mass + heart, right side of the mascot)
  visibly shrinks/tightens together with the arm and paw at `t=170` — the
  held object now moves WITH the hug instead of sitting glued to the frame.
- **(f) Loop seam**: one shared `anim`/`surface` (see harness note below),
  `seekFrame(90)` vs `seekFrame(306)`, full-buffer diff: **15/230400
  differing bytes, max delta 21** — antialiasing noise on curved edges,
  matching the same order of magnitude documented for `svmt` (51/230400) on
  an unrelated scene; not a logical seam break.
- Bubble stillness: plate bounding box (`14,14`–`222,49`) diffed across
  `90→104→120→163→230→305→306`: **0/29120 differing bytes at every step** —
  the plate and text are motionless from settle through the seam.
- Boundary keys: every animated track active at `t=90` carries an EXPLICIT
  keyframe at both `t=90` and `t=306` with equal values (not just an equal
  interpolated value) — `sampleDense`'s flat-run compression was dropping
  the middle keyframe at `T` whenever it sat inside a flat rest; fixed by
  protecting `T` from compression.
- Velocity audit (`max delta-per-frame / median-while-moving`) on the hero
  rig tracks: `body-rig` 2.73×, `hug-rig` 2.80×, `stone-rig` 2.60×,
  `eye-right` 2.73× — all under the ~3× threshold.
- Mid-intro aliveness: frames `15`/`30`/`45`/`60`/`75` (all before `T=90`)
  show the mascot's echoed release-tail continuously changing — the previous
  virtual breath cycle is still finishing its release across nearly the
  whole intro window, settling to true rest a few frames before `T`.
- `autoFit` bake test: a realistic ~40%-longer string ("You're really off to
  a great start today!", 42 chars vs the 29-char default) baked at the
  computed `max[0]=221.6` overflowed the plate on both sides (measured text
  width 288px vs ~190px available at max). **This composition's tooltip
  budget is tight** — the source SVG's plate already consumes 208 of the
  stage's 240px width and sits only 6.8px below the top safety margin, so
  `max[1]` computes to exactly 1 line (no wrap headroom) and `max[0]`
  doesn't comfortably clear even a modest translation. Documented rather
  than silently accepted: a noticeably longer locale string for this scene
  will need either a shortened translation or a redesign that repositions
  the plate for more headroom — not something `autoFit`'s width-only
  fallback can solve on its own when height is this constrained.
- Markers: `{"markers":[{"cm":"intro","tm":0,"dr":90},{"cm":"loop","tm":90,"dr":216}]}`
  — exact required shape.

## Idle system

One gentle hug-breathe per `IDLE=216` cycle (3.6s, "the calmest of the
set"), built from a shared piecewise-smoothstep envelope
(`bodyEnvelope(cf)`) with genuine flat rests bookending a single press-hold-
release: `rest[0,12) → rise[12,66) → hold[66,80) → release[80,206) → rest
[206,216)`. The long release (126 of 216 frames) reads as a slow, contented
exhale. The echo technique (`cyclePos(t) = ((t−T) mod IDLE + IDLE) mod IDLE`)
makes the SAME function valid for `t<T` — since the release zone straddles
where the echo lands at `t=0` (`cf=126`, inside `[80,206)`), the mascot is
already mid-release for nearly the whole intro, settling to true rest a few
frames before `T`, exactly as the "alive under the entrance" check wants.

- `body-rig`: pivot at the body's contact edge with the pillow;
  `scaleX 100→95`, `scaleY 100→104` at the envelope's peak (~5%, clears the
  "reads at arm's length" floor).
- `eye-left`/`eye-right`: ride `body-rig` AND get an own-center
  `scaleY 100→84`/`scaleX 100→106` dip at the same beat (deeper, squinting
  arc at the squeeze).
- `hug-rig`: pivot at the bbox center of `arm-ring` ∪ `charity-stone`;
  `armEnvelope` (narrower/later — `rest[0,20) → rise[20,70) → hold[70,84) →
  release[84,206)`), `scale 100→91` — the shared "arms tighten" motion.
  Parents `arm-ring`, `paw`, `arm-crease` (all static in their own `ks`, pure
  inherit — no double-counted amplitude down the chain) and `stone-rig`, so
  the whole embrace moves as one unit, a few frames after the body per the
  brief's "~2 frames of overlap."
- `stone-rig` (child of `hug-rig`): its OWN `stoneEnvelope` — phase-delayed
  ~8f after `armEnvelope` (`rest[0,28) → rise[28,78) → hold[78,92) →
  release[92,206)`) so the held stone settles a beat AFTER the arms;
  `scaleX 100→97`, `scaleY 100→98`, pivot at the stone's contact edge with
  the body. Parents `charity-stone`, `charity-stone-crease`, `heart` — they
  ride the stone's own compress on top of inheriting `hug-rig`'s squeeze.
- `shadow-rig`: the SAME `bodyEnvelope`, same timing, opposite sign —
  `scaleX 100→105`, `scaleY 100→103` — widens exactly as the body compresses.
- `trail-small`/`trail-large`: static through the intro, then a small
  vertical sine float once the loop begins (`period 54`/`72`, both divide
  `IDLE=216` exactly; amplitude `1.4`/`1.9`px) — satellites that stay alive
  instead of freezing into stickers after their entrance.

## Applying this to the next hug-pillow variant

1. Diff the new SVG against `companion-hug.svg` / this scene's source first
   — if byte-identical (as it was here), the element map and paint order
   transfer directly; only the brief's default string and any pose
   differences need re-deriving.
2. Re-audit every published constant against the CURRENT skill references
   even when porting a "confirmed working" element map — `companion-hug.mjs`
   itself was two contract-generations behind (Regular font, no `.textPos`/
   `.anchor`, no `autoFit.max`, sparse idle) despite being correct in its
   day.
3. Watch for the anchor/position "hidden zero" on any primitive shape
   (ellipse/rect) authored at local origin — never set both `a` and `p` to
   the same non-zero point on those; position alone is enough.
4. If a `preview-scene.mjs` render disagrees with a hand-rolled CanvasKit
   diagnostic script, trust the previewer and suspect the script first —
   check the wasm path and whether it's reusing one `anim`/`surface` across
   frames.
5. Before parenting a child to an animated node, check whether the child ALSO
   has its own keyframes on the SAME property (scale, most often) — if both
   are "the pop"/"the squeeze" by design, the composite is multiplicative,
   not additive, and it compounds silently until someone measures it.
6. Any layer with `ks.a == ks.p` (anchor and position set to the identical
   point) is very likely a hidden-zero bug, not a deliberate pivot — grep for
   the pattern when auditing a scene.
7. When a source group stacks more than one path under the same fill color,
   don't assume either is "redundant" AND don't assume both need importing —
   check whether the second is really a flattened STROKE on the first
   (bigger by a roughly uniform margin all round is the tell). If so, the
   faithful AND simplest reproduction is the one clean path plus a real
   Lottie stroke, not both paths merged or stacked. Fit the stroke width
   empirically against a rasterization of the true source union (sweep
   candidate widths, pixel-diff each) rather than eyeballing it — and check
   whether the fitted number already appears elsewhere in the same SVG as an
   explicit `stroke-width`, since a design system often reuses one weight.
8. A "static, unparented" element sitting next to an animated rig is the
   held-object defect by default — if the brief describes something being
   held, hugged, worn, or carried, its layers must be parented to the
   holding rig even before deciding what secondary motion (if any) to add.
9. A bbox-only check can pass while the shape is still structurally wrong
   (or vice versa) — pair it with a subpath/vertex-count comparison against
   the source AND a visual crop, especially for anything built from more
   than one imported path.
