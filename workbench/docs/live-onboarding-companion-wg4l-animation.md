# Live Onboarding Companion (Deck Chair) — wg4l pass

`assets/live-onboarding-companion-wg4l.svg` is byte-identical to
`live-onboarding-companion-eh0n.svg`, and this brief is the same deck-chair
mascot scene (chair-as-furniture, tilt-axis recline, drink lift with lagged
straw/umbrella, one lens glint, "Almost time to relax" bubble). Per the
z6ke pass's own note, this was a slug-swap rather than a re-derivation — but
sourced from `scripts/build-live-onboarding-companion-mqmh.mjs` (the most
recently regenerated sibling, itself a pure slug-swap of eh0n), since mqmh
carries the full v1-v5 feature set eh0n's doc describes (living-idle clock
system, `keyOnBoundaries`, the `bubble.textPos` slot) while z6ke/zkti/i0r3
were forked before those landed and don't have them. See
`live-onboarding-companion-eh0n-animation.md` for the full build rationale —
everything there applies here unchanged.

## Verification (this pass)

- `node scripts/build-live-onboarding-companion-wg4l.mjs` — 30 layers, valid
  JSON, 302 animated keyframes, `T=90`/`IDLE=180`/`OP=270`.
- Frame grid `[0,20,45,70,90,180,269]` — chair never moves, bubble pops with
  a lazy overshoot, text renders bold and centered in the plate.
- Zoomed `[15,45]` — the recline/drink idle is already progressing at
  different points between the two frames while the bubble/trail are still
  mid-pop — alive under the entrance, not frozen.
- Loop seam: a direct-seek throwaway script (`anim.seekFrame(90)` vs
  `anim.seekFrame(270)`, using the same `MakeManagedAnimation`/
  `canvaskit-wasm/full` init as `preview-scene.mjs`) diffed the full RGBA
  buffer — **0 differing bytes**.
- Mid-idle `[120,220]` — bubble and trail circles are pixel-identical
  between the two frames (hold perfectly still) while the mascot's recline
  and drink lift keep animating underneath.

## Applying this to a future duplicate-brief pass

When a new project slug arrives with a source SVG byte-identical to a prior
scene in this family, copy the **most recently regenerated** sibling build
script (check `git log`/mtime and grep for `CLOCK_BREATHE`/`textPos`/
`keyOnBoundaries` to confirm it has the current feature set — some earlier
forks in this family predate those and are stale), rename the slug
throughout, rerun, and re-verify the loop seam directly with a throwaway
CanvasKit seek-and-diff script. It's faster than re-authoring and inherits
every already-fixed defect for free — but only if the source you copy is
actually current.

## v2 port — mqmh grew past this scene again

`mqmh` picked up two more capabilities this pass ports forward wholesale
(re-copy + slug swap, same mechanism as above, still zero manual
re-derivation): source-true bubble-to-trail spacing and silhouette morphs
per `motion-taste.md`'s Living-idles bar. See
`docs/live-onboarding-companion-mqmh-animation.md` for the authoring
rationale; this section only records what changed and how it verified here.

- **Bubble/trail spacing is now source-derived, not stage-safety-derived.**
  The prior pass's `PLATE_CENTER_Y=54` was pushed low purely to satisfy a
  margin figure (16px) that was actually a 512-comp example value misapplied
  to this 240px stage — it had nothing to do with the source SVG's authored
  gaps and ended up compressing the plate-to-trail gap to ~0px. Recomputed
  the real margin (3% of 240 = 7.2px) and re-derived `PLATE_CENTER_Y=44.5`
  from the SVG's own geometry instead: plate bottom (rect `y=14,h=35`) sits
  9px above `trail-large` (`Ellipse 2420`, `cy=66,r=8`), matching the source
  file exactly. The second gap (`trail-large` to `trail-small`) can't be
  fully reproduced in the space available (would land `trail-small`'s stroke
  on the head) and stays compressed to 1.5px, same tradeoff mqmh documents.
- **The body silhouette now deforms, not just transforms.** `head-dark` and
  `head-face` are `animatedShapeLayer`s whose path track squashes/bulges
  about `headPivot` along the chair's own `axisUnit` (area-conserving:
  `scaleAlong * scalePerp = 1` exactly), driven by the same `breatheEnvelope`
  that already drove the rigid recline — so the deform reads as one motion,
  not a second unrelated wobble. The straw flexes too: resampled from a
  straight 2-vertex line to 3 vertices so the midpoint can bow, with the bow
  amount derived from the existing drag track (`sampleTrackAt(dragPoints,
  t)`) rather than a hand-authored curve — phase-locked to the sip-drag beat
  for free.

### Verification (this port)

- `node scripts/build-live-onboarding-companion-wg4l.mjs` — 30 layers, valid
  JSON, 302 animated keyframes, unchanged `T=90`/`IDLE=180`/`OP=270`.
  `controls.json` shape unchanged (`bubble.size` autoFit `max:[208,73]`,
  `bubble.textPos` still `internal:true`) — confirmed by diffing the two
  build scripts: zero lines differ in the controls-emitting section.
- Spacing check: plate bottom `y=62` (`PLATE_CENTER_Y=44.5 + 35/2`) to
  `trail-large` top `y=71` (`cy=79, r=8`) = exactly **9px**, matching the
  SVG's authored `plate-bottom(49) -> Ellipse2420-top(58)` gap.
- Silhouette check: zoomed frames `128` (breathe-envelope peak, local
  `t=38` of the 90f `CLOCK_BREATHE`) vs `180` (envelope rest) render
  **visibly different** body outlines — wider/lower into the chair at the
  peak, taller/more upright at rest — with the face patch riding the same
  deform and the straw showing a visible bow.
- Loop seam: direct-seek `anim.seekFrame(90)` vs `anim.seekFrame(270)`
  (bypassing the previewer's grid), full RGBA buffer diff — **0 differing
  bytes, max per-channel delta 0**. The shape-morph tracks are dense-sampled
  every 6 frames (a divisor of both `T=90` and `op=270`) directly off the
  exact-period `breatheEnvelope`, so the value at `T` and at `op` is the same
  function call on the same reduced phase (`t % 90 = 0`) by construction —
  no `keyOnBoundaries` needed for these tracks, and the pixel diff confirms
  it held.

## v3 port — ire9 mood retune

Ported `scripts/build-live-onboarding-companion-ire9.mjs` wholesale (slug
swap only): calm-relax archetype — body y pinned (no more position bob),
primary motion is a slow hammock sway (rotation only) about the seat pivot,
breath lives entirely in the silhouette morph, sip stays the loop's one
accent, trail circles gained a tiny gentle float — `controls.json` shape
unchanged, spacing unchanged (still the source-true 9px plate-to-trail gap),
seam re-verified at **0 differing bytes** (`T=90` vs `op=270`, full RGBA
diff), and frames 135/166/225 render visibly distinct silhouettes (opposite
sway direction at 135 vs 225, widened breathe peak at 166). See
`docs/live-onboarding-companion-ire9-animation.md` for the retune's full
rationale.

## v4 port — ire9 smoothness fix

Ported wholesale again (slug swap only): sway is now a true sine (no
`travelBalanced` bezier, which had a mid-segment velocity singularity) at a
2f bake step (was 6f), DETAIL clock removed as sway's sole consumer —
`controls.json`/spacing unchanged, seam re-verified at 0 differing bytes,
and the sway track scanned at 1-frame resolution shows exactly 2 direction
reversals in the whole idle cycle (both at the true apexes, frames 136/226),
confirming monotonic swell/shrink elsewhere. See
`docs/live-onboarding-companion-ire9-animation.md`'s v8 section.

## v5 port — ire9 velocity-audit fix

Ported wholesale again (slug swap only): the drink gesture (glass lift,
straw/umbrella drag+rock, liquid slosh) plus `breatheEnvelope`/trail-float
are now `waypointCurve`-driven (true stop-to-stop smootherstep waypoints,
retimed proportional to value-swing) instead of sparse `travel-balanced`
keys — `controls.json`/spacing unchanged, seam re-verified at 0 differing
bytes, and a dense 1-frame audit of every listed hero track (read straight
from the shipped `lottie.json`) lands at 1.34x-2.12x max/median-while-moving,
matching ire9's own reference numbers and clear of the ~3x ceiling. See
`docs/live-onboarding-companion-ire9-animation.md`'s v5 section.
