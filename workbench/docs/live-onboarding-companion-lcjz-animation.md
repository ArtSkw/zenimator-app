# Live Onboarding Companion (Double-Bicep Flex, lcjz) — How It's Animated

`assets/live-onboarding-companion-lcjz.svg` is **byte-identical** to
`assets/live-onboarding-companion-i8ek.svg` — same rig, same pose, same
"Making great progress" bubble brief. This scene reuses
`scripts/build-live-onboarding-companion-i8ek.mjs` (mechanical slug
substitution `i8ek` → `lcjz` throughout) since that script is the current,
fully-corrected version of the rig, carrying every team-feedback fix:
motion-craft (elbow/wrist articulation), phase-timing (effort accents keyed
to true contraction, not the numeric "hold" waypoint), entrance-timing
(house-constant bubble/trail arrival), and living-idles (trail float, body
breathe). See `docs/live-onboarding-companion-i8ek-animation.md` for the
full technique writeup — nothing in this scene deviates from it.

## Entrance-timing regression — root cause

**Symptom**: the scene as first generated had the bubble scale-in running
frames 16→44 (28f/467ms) with 118% overshoot, intro marker `T=54` — roughly
half the house-approved 900ms duration.

**Cause**: the first build of this scene was ported via mechanical slug
substitution from `scripts/build-live-onboarding-companion-ti6w.mjs`, not
from `i8ek.mjs`. `ti6w.mjs` was itself forked from an *earlier* snapshot of
`i8ek.mjs` — one that already had the motion-craft and phase-timing fixes,
but predated two LATER passes that landed in `i8ek.mjs`: the
entrance-timing fix (house-constant bubble/trail arrival, `T` resized to
90) and the living-idles pass (trail float, body breathe). Porting `ti6w`'s
structure was fine, but it silently inherited `ti6w`'s own frozen
`BUBBLE_POP`/`BUBBLE_OPACITY`/trail-timing constants and never received the
two later passes at all — a diff of the two build scripts (`i8ek.mjs` vs the
`ti6w`-derived script this scene started from) showed exactly these four
areas differing and nothing else.

**Lesson**: reusing a sibling script for structure is fine and encouraged
(the rig, parser, and paint order are all correctly reusable), but it is not
a substitute for re-deriving every PUBLISHED CONSTANT against the CURRENT
reference implementation and the current house docs. "Same SVG, same brief"
guarantees the geometry is reusable; it says nothing about which revision of
a sibling script was reused, and sibling scripts drift as fixes land in only
some of them. The generation contract now calls this out explicitly; going
forward, always diff against the newest sibling (or the file the docs cite
as the reference) before shipping, not just the most recently-modified one.

## Fix

Ported the two missing passes from the current `i8ek.mjs` into this scene's
script:

1. **Entrance-timing fix** — `T` moved from 54 to 90 (house-constant bubble
   settle at 82 + an 8f buffer, same margin as reference scene `ire9`);
   `BUBBLE_POP`/`BUBBLE_OPACITY` and both trail circles' pop-in points
   updated to the house table exactly (see table below). `OP = T + IDLE`
   still holds, so the loop segment is unchanged (144f, one arm-pump cycle).
2. **Living-idles pass** — added `CLOCK_TRAIL_LARGE=72`, `CLOCK_TRAIL_SMALL=48`,
   `CLOCK_BREATHE=72` (all divisors of `IDLE=144`) driving a continuous
   sin/cos position float on each trail circle and an always-running
   `breatheScaleAt` multiplied into the body/face silhouette morph, so
   nothing sits frozen between the pump's own ~16f effort window.

No re-timing of the idle itself: `IDLE=144` is unchanged, so the arm-pump,
tremble, and all effort-phase accents are byte-identical to before this fix.

## (a) Entrance-timing table — measured vs house

| element | starts | scale-in | opacity | overshoot | house value | match |
| --- | --- | --- | --- | --- | --- | --- |
| trail-small | 0 | 20f (333ms) | 10f | 112% | 0 / 20f / 10f / ~112% | ✅ |
| trail-large | +8 | 24f (400ms) | 12f | 114% | +8 / 24f / 12f / ~114% | ✅ |
| bubble plate+text | +28 | 54f (900ms) | 16f | 112% | +28 / 54f / 16f / ~112% | ✅ |

(Prior/regressed values: trail-small 0/16f/8f/112%, trail-large +4/18f/12f/114%,
bubble +16/28f(467ms)/10f/118% — durations were compressed to fit the
too-short `T=54` window; only the bubble's overshoot and the trails' start
offsets were also off, not their overshoot magnitudes.)

## (b) New timeline — proof every idle clock divides the loop span exactly

`T=90`, `IDLE=144`, `OP = T + IDLE = 234`. Loop span `OP - T = 144`.

| clock | period | `144 % period` |
| --- | --- | --- |
| arm-pump (`squeezeEnvelope`, pure fn of `t % IDLE`) | 144 | 0 |
| `CLOCK_TRAIL_LARGE` | 72 | 0 |
| `CLOCK_TRAIL_SMALL` | 48 | 0 |
| `CLOCK_BREATHE` | 72 | 0 |

Every clock period divides the loop span exactly, so `value(T) === value(T +
144) === value(OP)` for each by construction — no boundary special-casing
needed (proved, not just tested).

## (c) Bubble motionless from T onward

Pixel-diff restricted to the bubble's bounding box (`0,0` to `240,70`)
between frame `T=90` and frames `110`, `162`, `234`: **0/67200 differing
samples** at all three, vs a 34-layer scene where the arm/fist pose visibly
differs at each (confirmed by full-frame diffs of 6000+ samples between the
same frame pairs) — the bubble is pixel-identical/motionless while the
mascot stays alive, exactly the "alive idle, motionless furniture" contract.

## (d) Seam pixel-diff, frame T vs frame op

Direct `anim.seekFrame(90)` vs `anim.seekFrame(234)` (CanvasKit raw RGBA
buffer, bypassing the previewer's op-1 clamp): **51/230400 differing
samples, max delta 21**. Cross-checked against the stored JSON: all 27
animated tracks' STORED keyframe values at `t=90` and `t=234` are
bit-for-bit identical (programmatic check, zero mismatches) — including the
new trail-float and body-breathe tracks. Since the authored values match
exactly, the pixel delta is rasterizer antialiasing noise on this pose's
rotated elbow/wrist edges (a different point of the squeeze-release curve
than the old `T=54` sampled), not a logical seam break. This figure matches
`i8ek`'s own measurement at the same `T=90`/`OP=234` exactly, corroborating
both.

Sanity checks (confirm the diff tool discriminates): frame 0 vs frame 90 —
15482/230400 differing, max delta 255.

Markers: `{"markers":[{"cm":"intro","tm":0,"dr":90},{"cm":"loop","tm":90,"dr":144}]}`.

## (e) Audit of every published constant

| constant | verified against | outcome |
| --- | --- | --- |
| `T` (intro length) | recipe-companion-bubble.md house table | **CHANGED** 54 → 90 |
| `BUBBLE_POP` / `BUBBLE_OPACITY` | house table | **CHANGED** to +28/54f/112%, opacity 16f |
| trail-small / trail-large pop points | house table | **CHANGED** start/duration; overshoot magnitudes (112%/114%) were already correct |
| trail position float | motion-taste "Living idles" (satellites must live) | **ADDED** — was entirely absent (dead/frozen after pop-in) |
| body/face breathe | motion-taste "the body always breathes" | **ADDED** — silhouette previously only moved during the ~16f contraction dip |
| `FONT_SIZE`/`LINE_HEIGHT`/`PAD_X`/`PAD_Y`/`LEADING` | ZEN tooltip spec (Nunito Bold 15/19, 16/8 padding) | verified unchanged, correct |
| `autoFit` min/max/leading | recipe-companion-bubble.md derivation (`max[1]` from stage margin/line height) | verified unchanged, formula-derived, correct |
| `bubble.textPos` (`BASELINE_LOCAL=5.41`) / `bubble.anchor` slots | player-contract Native Text vertical-centering contract | verified unchanged, pixel-checked in prior passes |
| tremble (`QUIVER_LO/HI=5..35`, 3 cycles, 1.4px) | motion-taste "Accents must be readable" (≥4f half-cycle, ≤8Hz) | verified unchanged — half-cycle 5f = 6Hz, within band; already phase-locked to true contraction (local t=20) |
| elbow flex / bicep bulge / fist lag+tighten / eye handle-scale / shadow narrow / chest puff | motion-taste "Phase-lock effort", "Dead tracks don't count" | verified unchanged — all still driven by `contractionEnvelope`, all previously confirmed non-dead (vertex+handle amplitude measured in `i8ek`'s own audit) |
| no dead tracks (all 27 animated tracks) | motion-taste "measure amplitude, not keyframes" | verified — every track (including the two newly-added float/breathe families) has non-zero authored amplitude over its active span by construction (sin/cos with nonzero amplitude, or the pre-existing measured squeeze/contraction-driven tracks) |

No further stale values found; the two areas above (entrance timing,
living-idles satellites) were the only ones out of date, both because this
scene's first build ported from a sibling (`ti6w`) that predated those two
fixes rather than from the current `i8ek.mjs`.
