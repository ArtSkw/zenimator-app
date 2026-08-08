# Live Onboarding Companion (Double-Bicep Flex, svmt) — How It's Animated

`assets/live-onboarding-companion-svmt.svg` is **byte-identical** to
`assets/live-onboarding-companion-lcjz.svg` and `-i8ek.svg` — same rig, same
pose, same "Making great progress" bubble brief. This scene reuses
`scripts/build-live-onboarding-companion-lcjz.mjs` (mechanical slug
substitution `lcjz` → `svmt` throughout), since `lcjz.mjs` is the newest
sibling script and is itself a verified port of `i8ek.mjs` — the family's
current, fully-corrected version, carrying every team-feedback fix:
motion-craft (elbow/wrist articulation), phase-timing (effort accents keyed
to true contraction, not the numeric "hold" waypoint), entrance-timing
(house-constant bubble/trail arrival), and living-idles (trail float, body
breathe). See `docs/live-onboarding-companion-i8ek-animation.md` and
`docs/live-onboarding-companion-lcjz-animation.md` for the full technique
writeups — nothing in this scene deviates from them.

## Porting is not authoring — the audit performed this session

Per the generation contract, every published constant was re-verified
against the CURRENT skill references before shipping, not carried over on
trust that "same SVG, same brief" implies the sibling script is current
(the exact regression `lcjz`'s own doc documents: a script forked from an
*earlier* snapshot silently missing two later fix passes).

| constant | verified against | outcome |
| --- | --- | --- |
| Entrance house table (trail-small 0/20f/10f/~112%, trail-large +8/24f/12f/~114%, plate+text +28/54f-900ms/16f/~112%) | `recipe-companion-bubble.md` house table (re-read in full this session) | unchanged, matches exactly |
| `T=90` (entrance settles at 82 + 8f buffer) | recipe's "size T to the entrance, never the reverse" | unchanged, correct |
| `IDLE=144` / one pump per cycle | brief ("one pump per cycle") | unchanged, correct |
| Living-idles clocks (`CLOCK_TRAIL_LARGE=72`, `CLOCK_TRAIL_SMALL=48`, `CLOCK_BREATHE=72`, all divisors of `IDLE=144`) | `motion-taste.md` "Living idles" seam/clock rules (re-read in full this session) | unchanged, correct |
| Phase-timing (`contractionEnvelope` peaking at the anticipation dip, not `squeezeEnvelope`'s numeric `[60,78]` hold) | `motion-taste.md` "Phase-lock effort to the moment it physically happens" — this exact rig/defect is the section's own worked example | unchanged, correct |
| `bubble.size`/`.textPos`/`.anchor` slot trio, `autoFit` max `[225.6, 58]` | recipe section 3 contract; max independently re-derived from this scene's own geometry (`MARGIN=240*0.03`, anchor-pinned plate bottom) | unchanged, re-derivation matches shipped number |
| `FONT_SIZE`/`LINE_HEIGHT`/`PAD_X`/`PAD_Y`/`LEADING` | ZEN tooltip spec (Nunito Bold 15/19, 16/8 padding) | unchanged, correct |

Since every audited value matched the current references exactly, the port
is a pure mechanical slug substitution — no constants changed.

## Verification (this pass)

- `node scripts/build-live-onboarding-companion-svmt.mjs` — 34 layers, valid
  JSON, 1484 animated keyframes, `T=90`/`IDLE=144`/`OP=234`.
- Frame grid `[0,15,30,90,110,160,233]` (`preview-scene.mjs`): trail circles
  pop smallest-first, bubble emerges from the tail with a ~112% overshoot,
  text reads legibly inside the plate, arms visibly differ in
  position/fist-scale between every loop-phase frame checked. Mid-intro
  frames `15`/`30` show the mascot's trail/arm state already differing while
  the bubble is still mid-pop — alive under the entrance, not frozen.
- Loop seam: a direct-seek throwaway script (`anim.seekFrame(90)` vs
  `anim.seekFrame(234)`, same `MakeManagedAnimation`/`canvaskit-wasm/full`
  init as `preview-scene.mjs`, bypassing its grid) diffed the full RGBA
  buffer: **51/230400 differing samples, max delta 21** — rasterizer
  antialiasing noise on the rotated elbow/wrist edges at this pose, not a
  logical seam break (isolated to 15 unique pixels along limb contours, no
  block/layer-level offset). This figure is bit-for-bit identical to
  `lcjz`'s own measurement at the same `T=90`/`OP=234`, corroborating both —
  expected, since the geometry, clocks, and envelope functions are
  unchanged and `squeezeEnvelope`/`contractionEnvelope`/the trail-float and
  breathe clocks are all pure functions of `t % period` with every period
  dividing `IDLE` exactly.
- Sanity check (confirms the diff tool discriminates): frame `0` vs frame
  `90` — 15482/230400 differing, max delta 255.
- Bubble motionless from `T` onward: pixel-diff restricted to the bubble's
  bounding box (`0,0`–`240,70`) between frame `T=90` and frames `110`,
  `162`, `234` — **0/67200 differing samples** at all three, vs 9731/230400
  differing over the full frame for the same pair (mascot visibly alive,
  bubble/trail perfectly still).
- Long-string `autoFit` bake: a ~40%-longer Polish string ("Robię naprawdę
  wielkie postępy dzisiaj") wrapped to 2 lines at `bubble.size` autoFit
  `max=[225.6,58]`, `bubble.textPos` re-derived via the recipe's "rise by
  `(lines−1)×lh/2`" rule (`5.41 − 21/2 = -5.09`, independently re-derived
  from this scene's own plate geometry, not copied). Rendered at zoom 2.5x:
  plate grew away from the tail (upward, per `bubble.anchor`), top edge
  cleared the stage margin (~0.8px to spare, matching the geometry-derived
  headroom of 58.8px for a 58px 2-line plate), both lines centered, trail
  gap below the plate unaffected.
- Markers: `{"markers":[{"cm":"intro","tm":0,"dr":90},{"cm":"loop","tm":90,"dr":144}]}`
  — exact required shape.

No new fixes were needed this pass — the port is verified bit-identical in
behavior to `lcjz`, and the constant audit above found nothing stale to
correct. Nothing new to promote to the shared skill.
