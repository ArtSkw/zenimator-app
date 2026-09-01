# Loop Zenek — Our (pgjh) — How It's Animated

Zenek's coffee-run walk cycle, built by `scripts/build-loop-zenek-our-pgjh.mjs`
into `public/projects/loop-zenek-our-pgjh/scene-1/lottie.json`. Same source
illustration (body/fist/eye coordinates) as
`docs/everydayexpress-walkcycle-animation.md`'s scene, but that doc is
GEOMETRY provenance only — the rig, motion constants and gate list here are
re-derived from the CURRENT `skills/text-to-lottie/references` (this run:
2026-08-29), and several choices deliberately differ from the older reference
because the references have moved on since it was written. That's the point
of re-deriving rather than porting: this is exactly how a fixed defect
(the 18%-closed blink, below) would otherwise silently come back.

## What's different from the older reference, and why

- **The blink now closes to TRUE zero height**, not 18%. The current
  Aliveness Contract gate 17 ("Blinks close") is explicit that a lid parked
  at 15-20% reads as a squint, not a blink — the older build predates that
  gate. `blinkAmount()` here drives `scaleY` to exactly 0 for a beat
  (CLOSE=2, CLOSE=2, HOLD=2, OPEN=4 frames, closing faster than opening, per
  the player-contract/recipe-character-rig template), with a slight scaleX
  widen on the way down.
- **Squash/stretch is baked into the shape's own VERTICES, not a transform
  scale on the rig null.** motion-taste's "silhouette breathes — morphs, not
  just transforms" self-test is "if the outline is identical between beats,
  the character is a puppet." A coupled non-uniform *scale* transform does
  change the outline, but to make the point unambiguous (and to keep
  body/face/eyes cohesive without double-driving a property down the parent
  chain), the squash curve is evaluated once and applied as a scale-about-
  `BODY_BASE` deform directly on body/face/eyes' path vertices+handles
  (`deformSubpaths()`). `zenek-root` carries ONLY the bounce position; it has
  no scale at all.
- **The bag's pendulum sway is a real `sin()`, not bezier keyframes.**
  motion-taste flags a genuine, length-independent mid-segment velocity
  singularity in `travel-balanced` for exactly this shape of motion (a
  through-center back-and-forth), and warns that ANY named bezier anchor
  should be hand-checked for a hidden `dx/ds` zero-crossing before trusting
  it on a primary cyclic sway. Sidestepping the whole class of curves with a
  true sine (quarter-phase-offset from the bounce, zero at both contact and
  the bounce's own peak) is simpler and has no such singularity anywhere.
- **The velocity audit forced softer easing than the named anchors give.**
  `entrance-sharp`/`exit-accelerate` are motion-taste's own anchors for
  "entering, mask-wipe decel" / "exiting, hard-cut companion" — appropriate
  for dramatic moves, but their OWN internal tangent ratio (initial vs. final
  slope within a single curve) is roughly 40-60x. At this scene's small
  amplitudes (6px bounce, ~5% squash) that blew the fluidity audit's
  max/median-while-moving ceiling (~3x) by 3-6x even though the curves
  themselves are perfectly smooth — measured 8.07x on the bounce, 9.84x on
  steam position, 17.29x on a first-pass 4-point squash track. Fix: derive
  gentler custom curves (`riseOut`/`fallIn`, see the script) that keep the
  same qualitative character (ease OUT on the away phase, ease IN on the
  return) at a shallower internal ratio — measured 1.29-1.90x after the
  swap. Also fixed a second, unrelated cause of the same symptom: the first
  squash draft used 4 keyframes/step with very uneven time spans (10f then
  26f then 26f then 10f) for a tiny (~6%) total range — collapsing to 2
  points/step (matching the bounce's own contact→apex timing) removed the
  unevenness entirely, independent of which easing was used. This general
  lesson (named dramatic-entrance/exit anchors can fail the fluidity audit
  at small, continuous-cycle amplitudes; derive gentler siblings) is
  promoted into `references/motion-taste.md`.

## Rig

```
zenek-root (null)                 bounce POSITION only, ~6px, riseOut/fallIn
├── body / face / eye-left / eye-right   squash baked into their OWN vertices
│                                          (shared squashAt(t) about BODY_BASE)
│                                        eyes ALSO carry their own blink
│                                          (vertex-scale about EYE_CENTER,
│                                          composed on top of the squash)
└── bag-root (null)               sin() pendulum sway, pivot = left fist
    ├── left-fist
    ├── baguette-fill / baguette-outline
    ├── bag-body / bag-fold-lines / bag-handle
    └── baguette-scores (decal: 3 short strokes, zero motion of their own)

(NOT parented — the "steady island", brief: "the coffee cup stays steady
so it doesn't spill"; declared as a motionException, not left silently
inert — steam still animates independently):
right-fist · cup-body · cup-band · cup-lid · steam-1 · steam-2
```

Three facts about this player's parenting (confirmed again here, matching
`everydayexpress-walkcycle-animation.md`): parenting composes multiplicatively
with zero coupling code; `parent` resolves by `ind` independent of array
order; paint order is array order (`layers[0]` frontmost).

## The steady island

Right fist + all three cup shapes + steam carry NO `p`/`a`/`s`/`r` keyframes
at all — their `ks` is a bare `baseTransform()`, so they are identical across
every frame by construction, not by a passing pixel-diff. That is the
strongest form of "steady" available and matches the brief's own reasoning
(the coffee shouldn't spill). Declared explicitly in `controls.json`'s
`motionExceptions` quoting the brief, per player-contract's "the brief
outranks every gate."

Steam is NOT part of that stillness — two wisps drift up ~12px, waver
±1.3px, and fade on a 72f cycle, offset by half a period (36f) so one is
always mid-rise. The position glides back to rest only after opacity has
already hit 0 (an invisible reset), and the reset never needs to be a snap
since the whole thing is continuous.

## Contact welds

`check-motion.mjs` finds 4 real contact pairs in this geometry (cup-band↔
cup-body, and three pairs inside the bag/baguette cluster) — all report
0.00px slide, because everything on each side of a contact pair shares one
rigid parent (`bag-root`, or nothing/static for the cup). Two declared
exceptions cover the one INTENDED relative motion in the scene: the blink,
which overlaps face and body geometry but is meant to move independently of
them for its ~8-frame duration.

## Verification

- `node scripts/check-motion.mjs loop-zenek-our-pgjh` — exit 0, all 4 contact
  pairs 0.00px, no invented fill, no export-compat issues.
- `node scripts/check-loop-seam.mjs loop-zenek-our-pgjh` — no marker segment
  declared (this is a plain whole-comp loop), reports "nothing to prove."
  The build script's own seam assertion instead walks every layer's
  `p/a/s/r/o` AND every dense-sampled shape track's vertices, asserting
  `value(t=0) === value(t=T)` exactly — printed "ALL ANIMATED PROPERTIES
  SEAMLESS."
- `node scripts/check-parameters.mjs loop-zenek-our-pgjh scene-1` — exit 0
  (no gradients in this artwork; nothing to declare).
- Rendered frames 0/18/36/54/72/90/100/108/126 plus zoomed crops of the
  bounce extremes (0 vs 36) and the blink window (98-104): body/bag/steam
  all read as intended, blink snaps fully shut and reopens cleanly, bag tilt
  is visibly different frame-to-frame.
