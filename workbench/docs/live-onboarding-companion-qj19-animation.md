# Live Onboarding Companion (Hug-Pillow, qj19) — How It's Animated

`assets/live-onboarding-companion-qj19.svg` is **byte-identical** to both
`assets/companion-hug.svg` and `assets/live-onboarding-companion-s51p.svg`
(confirmed via `diff` — only attribute-order/entity-encoding differ). This
build reuses `scripts/build-live-onboarding-companion-s51p.mjs`'s rig,
entrance, and idle system wholesale — that script already re-derived every
constant against the current skill references in the same session window
this scene was built in, and this session independently re-read
`recipe-companion-bubble.md` and `motion-taste.md` in full and confirmed
every one of those constants (Bold text spec, `.textPos`/`.anchor` slots,
`autoFit.max`, house-constant entrance timing, dense Living-idles envelope)
still matches current doctrine before reusing them. See
`docs/live-onboarding-companion-s51p-animation.md` for the full worked
history (four measured defects and their fixes, the heart's two-path
authoring, the CanvasKit harness pitfall) — not repeated here.

## What actually changed from s51p, and why

| item | s51p | this scene | reason |
| --- | --- | --- | --- |
| held-object naming | `charity-stone` / `stone-rig` (s51p's brief called it a ZEN "charity stone") | `pillow` / `pillow-rig` | THIS brief explicitly and repeatedly calls it a pillow ("the mascot hugs its heart-marked pillow", "the dark rounded mass with the white heart is the pillow") — layer names are user-facing (player-contract "Layer Naming": say what the thing IS), and the source SVG's own `id="charity stone"` carries no such meaning in this brief |
| default string | `"You're off to a great start."` | same | independently confirmed against THIS brief's own default string, not assumed from the port |
| entrance timing, font, slots, autoFit, idle density | T=90/IDLE=216/OP=306, Nunito Bold 15/19, `.textPos`/`.anchor`, `autoFit.max=[221.6,35]`, dense envelope system | identical | same geometry, same stage, same brief register ("the calmest of the set") — re-verified against the current recipe/motion-taste text this session (see Verification below), not carried over blind |

## Element map

Unchanged from s51p except naming (see table above):

- "Tooltip/Compact" rect → bubble plate; baked "font" glyph path → REPLACED
  with a native `ty:5` text layer (slot `bubble.text`).
- Ellipse 2420 / 2421 → `trail-large` / `trail-small`.
- Group 1000007767 → mascot + the held pillow: `paw` (Ellipse 324, peeks from
  behind), `body`/`face`/`eye-left`/`eye-right` (closed, content arcs),
  `pillow`/`pillow-crease` (source id `"charity stone"` — renamed per this
  brief's language, see above), `heart` (the source's two-path `Union`,
  rebuilt as one clean path + a real Lottie stroke at the source's own
  5.6469 width — see s51p's "Third pass"), `arm-ring`/`arm-crease`.
- "Fill 11" (raster diagonal-hatch) → revectorized stroke hatch, track-matted
  to the true pill silhouette, parented to `shadow-rig`.

## Verification performed this session (not assumed from the port)

- `node scripts/build-live-onboarding-companion-qj19.mjs` — 21 layers, valid
  JSON, **1049 animated keyframes**, `T=90`/`IDLE=216`/`OP=306`.
- Frame grids via `preview-scene.mjs` at `[0,15,30,45,60,75,90]` (entrance),
  `[28,50,67,82,90]` (bubble close-up — overshoot visibly bigger at `t=67`
  than the settled `t=82/90`), `[90,120,163,200,250,305]` (idle), and a
  `--zoom 5` still at `t=90`: trail pops smallest-first, bubble emerges with
  ~112% overshoot and settles before `T`, text is legible Bold Nunito
  centered in the plate, the mascot/pillow/shadow visibly differ frame to
  frame through both the intro and the loop.
- **Loop seam, numeric** (own throwaway script, sampling every `a:1` prop's
  interpolated value at `T` and `op` plus velocity `T→T+1` vs
  `op-1→op`): all 15 animated properties match exactly (value delta
  `<1e-6`, velocity delta `<0.05`); boundary-key scan confirms every idle
  track carries an EXPLICIT keyframe at both `t=90` and `t=306`.
- **Loop seam, pixel** (same script, one shared `anim`/`surface`, following
  `public/canvaskit.wasm` + reused-instance discipline from s51p's harness
  writeup): **0/57600 differing pixels** at `seekFrame(90)` vs
  `seekFrame(306)` once the harness was warmed up with a throwaway
  render first — an unwarmed first call produced spurious diffs
  concentrated in thin-stroke antialiasing (the exact
  diagnostic-harness pitfall s51p's doc warned about), confirming the
  numeric check as authoritative and the eventual pixel check as clean
  corroboration.
- **Velocity audit** (own script, per-frame speed over `[T,op]`,
  `max/median-while-moving`): `body-rig` 2.73×, `hug-rig` 2.80×,
  `pillow-rig` 2.68×, `shadow-rig` 2.73×, `eye-left`/`eye-right` 2.73× — all
  under the ~3× threshold.
- **Mid-intro aliveness**: `body-rig`'s own scale sampled at `t=15..89`
  shows a smooth, continuously-changing curve settling to exact rest
  `[100,100,100]` right at `t=89/90` — the echoed release tail from the
  previous virtual cycle is still resolving across nearly the whole intro
  window, confirming the mascot is alive under the entrance, not frozen.
- **Held-object / breathing checks** (isolated-layer pixel diff, rest `t=90`
  vs mid-hold `t=169`): `body+face+eye-left+eye-right` 1285px changed,
  `arm-ring+paw+arm-crease+pillow+heart+pillow-crease` 325px changed —
  the held pillow visibly moves with the hug, not glued to the frame.
  `shadow-rig`'s own keyframed scale goes `[100,100,100]→[105,103,100]`
  between those same two times; the isolation harness mishandled the
  matte pair (`shadow__matte`+`shadow` in isolation read 0px, a harness
  limitation, not a scene defect) so shadow motion was instead confirmed
  via a full-scene diff whose bbox (`y:155–239`) spans the shadow's own
  region and changed by 2913px between the same two frames.
- **Trail satellites float, not freeze**: `trail-small`/`trail-large`
  position sampled well past their entrance settle (`t=200..306`) shows
  small (~1–2px) continuous drift, not a static hold, so the decorative
  satellites read as alive through the whole loop per motion-taste's
  "nothing in frame is inert" gate.
- `autoFit`: `max=[221.6,35]` computed fresh from this scene's own geometry
  (`MARGIN=240*0.03=7.2`, left-edge-limited by `PLATE_CX=118`); same
  single-line-only headroom constraint as s51p (`PLATE_BOTTOM=49` leaves
  only 41.8px above the margin, short of the 54px a 2-line plate needs) —
  documented rather than repositioning the plate to manufacture headroom the
  source artwork doesn't have.
- Markers: `{"markers":[{"cm":"intro","tm":0,"dr":90},{"cm":"loop","tm":90,"dr":216}]}`.

## Aliveness Contract

| track | amplitude | active span | verdict |
| --- | --- | --- | --- |
| `body-rig` scale | scaleX 100→95, scaleY 100→104 (~5%/4%) | `[0,op]`, continuous | PASS — primary breath, reads at arm's length |
| `hug-rig` scale | 100→91 (~9%) | `[0,op]`, continuous, peaks ~a few frames after body | PASS — arm tighten, drag not delay |
| `pillow-rig` scale | scaleX 100→97, scaleY 100→98 (~3%/2%) | `[0,op]`, continuous, peaks ~8f after arms | PASS — held object's own secondary compress |
| `eye-left`/`eye-right` scale | scaleY 100→84, scaleX 100→106 | `[0,op]`, continuous, same beat as body | PASS — deeper arc at the squeeze |
| `shadow-rig` scale | scaleX 100→105, scaleY 100→103 (~5%/3%) | `[0,op]`, continuous, opposite sign, same beat | PASS — "world responds," widens as body compresses |
| `arm-ring`/`paw`/`arm-crease` | static own `ks`, inherit `hug-rig` | `[0,op]` via parent | PASS — 236/228/202px isolated pixel-diff (s51p's measurement, same geometry); confirmed non-zero via this session's grouped isolation (325px combined) |
| `pillow`/`pillow-crease`/`heart` | static own `ks`, inherit `pillow-rig`→`hug-rig` | `[0,op]` via parent | PASS — held object rides the pillow's own compress, not glued to frame |
| `trail-small`/`trail-large` position | ~1.4px / ~1.9px sine float | `[T,op]` (static through intro, per entrance choreography) | PASS — satellites float once the loop begins, not frozen stickers |
| `bubble-anchor`/`bubble-plate`/`bubble-text` | full entrance pop/fade | `[start,settle]` only, then flat | PASS (justified stillness) — bubble holds perfectly still through `op` by design, per the recipe's explicit contract |

All nameable parts (head, both eyes, both arms, paw, held pillow, its crease,
the heart mark, the ground shadow, both trail satellites) carry measured
motion; only the bubble/plate/text are deliberately static post-settle, which
the recipe requires rather than forbids.
