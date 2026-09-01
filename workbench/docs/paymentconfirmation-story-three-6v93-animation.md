# paymentconfirmation-story-three-6v93 — animation learnings

Same three source artworks (clock badge → checkmark → all-set mascot) and the
same narrative as the earlier `paymentconfirmation-story-three-zezm`/`-h3oo`
field tests — the source SVGs are byte-identical. This run's brief differs
from zezm's in three concrete, brief-literal ways, and each required
re-deriving behaviour rather than porting the prior script's choice:

1. **Tick pass-accent restored.** zezm round 3 cut the per-tick swell as an
   unwanted effect ("designer cut it"). THIS brief asks for it explicitly:
   "As the hand passes each tick, that tick answers with a quick swell and
   settles back." Implementation: a nested rig — one `badge-ticks-assembly`
   null (pivot at badge center, carries the shared exit retract) wrapping
   eight individual `tick-<k>-rig` nulls (each pivoting on its OWN bbox
   center, carrying that tick's own swell). The two scales compose
   multiplicatively through the parent chain, so a tick both swells at its
   own hand-crossing time and retracts with the rest of the dial — no
   conflict. Since beat 1's sweep is perfectly linear, the crossing times
   solve directly from `HAND_A0 + (SWEEP_DEG/BEAT1)*t`, no root search
   needed (unlike a `findCrossings` numeric solve, which would only be
   necessary once the rotation is no longer linear).

2. **Air-flow marks visible through the WHOLE airborne arc, not just
   descent.** zezm's build (design choice, not a defect) hid the marks at
   the entrance's rise apex and only showed them trailing the fall. This
   brief's language is different and more literal: "appearing as he leaves
   it, riding above him through the airborne part of each bounce... They
   show on his entrance rise in beat 3 for the same reason." Built a single
   reusable `airflowCycle(L, P, Lnext, leanSign)` helper — appear shortly
   after leaving the ground, hold through the peak, fade out shortly before
   the next landing — applied identically to the beat-3 entrance (treating
   `ANTIC_END`/`RISE_END`/`LAND_END` as liftoff/peak/landing) and to all four
   loop bounces. Because every cycle uses the same relative offsets, the
   seam pair (T, OP) matches by construction without a special case.

3. **Eyes squint on landing instead of counter-scaling to cancel the body's
   squash.** zezm's eyes kept a fixed drawn shape ("only the body and its
   white face morph" — a valid, differently-briefed choice). THIS brief:
   "His closed happy eyes squint a touch as he lands" — a landing-synced
   *accent*, not shape preservation. Implementation: eyes ride
   `mascot-root`'s inherited squash/stretch like any other child shape, plus
   their own local scaleY dip (100→82→100%, own bbox-center pivot) exactly
   at each landing (`EYE_LANDINGS = [LAND_END, ...LANDINGS]`, so the entrance
   settle and every loop landing get the same accent, and the seam frames T
   and OP get an identical accent by construction since both are in
   `LANDINGS`).

## Gate friction (documented so the next run doesn't re-derive it from
## scratch)

- `check-motion.mjs`'s **BLINK NEVER CLOSES** gate treats ANY eye scale dip
  that doesn't reach 0 as a "fake blink" and fails it — correctly, this
  brief's eyes are drawn already-closed (arcs, not lids over pupils), so a
  landing squint is not a blink and needs its own `{ layer: 'mascot-eyes',
  reason }` declaration in `controls.json`, distinct from the contact-pair
  `{ a, b, reason }` shape. Both shapes are read by the same gate; using the
  wrong one silently doesn't suppress the violation.
- The swoosh's pen-drawn opacity gate (`swooshDrawOpacity`) still needs the
  1-frame-early hold (`DRAW_START_F() - 1`) — a path track's first keyframe
  holds backwards in time, so without it the pen's near-zero starting dot
  sits on stage from frame 0 (same failure mode zezm documented).

## Timeline (re-derived from this brief's own beat seconds, not zezm's)

`BEAT1=72(1.2s) BEAT2=84(1.4s) BEAT3=90(1.5s) → T=246 (≈4.1s, brief: "about 4
seconds") LOOP=216 OP=462`. The beat-2 exit cascade (hand collapse → hub
absorb+pulse+exit → tick retract → check draw) was retimed to fit the
shorter 84f window while still landing a 20-frame hold after the check
finishes and before the badge pops, matching "let the finished check hold a
beat."

## Verified vs assumed

Verified fresh against the current references and this brief (not carried
from zezm/h3oo): `BEAT1/2/3`, the full exit-cascade offsets, `HANDOFF`, tick
pass-accent times and amplitude, `JUMP_H/OVERSHOOT_H/LEAN/STRETCH/SQUASH`,
shadow scale/opacity ranges, air-flow visibility windows and amplitude, eye
squint amplitude, `CHECK_STROKE_W` (still 2.26667, re-checked against the
badge's own ring weight — same value as zezm because the badge geometry is
unchanged, not because it was assumed), ribbon gleam `TARGET_PEAK` (0.34).
Reused as geometry-only (unchanged since the source SVGs are byte-identical):
all `A1`/`A2`/`A3`/`SHADOW_D` path data, the texture tile fraction
(0.0266667), the ribbon gradient endpoints/hue, the swoosh/ribbon stroke
widths, the SPIN_UP handoff-continuity technique (a general Skottie easing
fix, not a brief-specific number).
