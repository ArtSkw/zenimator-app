# moneytransfer-status-scene-s5zh — How It's Animated

Three source SVGs — `moneytransfer-status-scene-s5zh.svg` (step-1, sky/clouds
only), `-2.svg` (step-2, + disc + Zenek + hands), `-3.svg` (step-3, clouds +
checkmark) — become ONE 375×240 Grounded-Handoff composition at
`public/projects/moneytransfer-status-scene-s5zh/scene-1/lottie.json`, built
by `scripts/build-moneytransfer-status-scene-s5zh.mjs`. Zenek leaps in under
his hatched-disc canopy (ENTRY, 0–96), floats left-of-center through an
endless `float` loop (96–246), then plays a one-shot `success` beat
(246–384): anticipation, an accelerating exit off the right edge in an
upward arc, and a hand-drawn checkmark drawing itself into the space he
vacates as the sky brakes to a dead stop on its own SOURCE position.

## A prior build of the identical artwork already exists at other slugs

`assets/moneytransfer-status-scene-2rkf*.svg` (and five other slugs) are
byte-identical to this scene's three sources. Per CLAUDE.md ("a prior build
script is a source of GEOMETRY only — never rig topology, motion constants,
or its verification report"), this build reused only the SVG-parsing and
Lottie-emission plumbing (no motion opinion in it) and independently
re-derived the rig topology, every timeline number, and every motion
constant fresh against the CURRENT `motion-taste.md` /
`recipe-character-rig.md` / `recipe-camera-scene-motion.md` /
`svg-compatibility.md`, then ran every gate itself rather than trusting a
prior run's report. Where independent derivation converged on the same
structural answer as a prior build — the null chain
`bob-rig → disc-sway → zenek-lag → zenek-breathe`, the hatch precompose, the
`lap = W` tiling, the `D = k·S` brake closure — that is corroboration of a
physically/geometrically necessary design forced by the brief and the
references, not evidence that copying would have been safe: the actual
numbers (beat frames, periods, amplitudes, pivots) were computed
independently this session and differ throughout.

## Zenek's own sway has a hard geometric ceiling, not a stylistic one

The brief: "Zenek dangles beneath with real follow-through drag — his body
lags the disc's swing and settles a beat later, never a time-shifted copy."
Measured against the parsed disc circle, Zenek's own pupils sit **6.58px
inside the disc's own rim** at rest — the artwork draws his head overlapping
the canopy's lower area. An independent sway pivoting at the shared harness
point (~78px above the disc) would multiply any extra angle by that long
lever arm and slide his features across the canopy hatch.

Fix, in topology rather than amplitude: `zenek-lag` nests UNDER `disc-sway`
(fully inheriting the shared pendulum swing — zero slide against the
disc/hands, they're literally the same clock) and pivots at **Zenek's own
centroid** (22.5px lever arm to his own rim, not ~78px+ to the harness
point) for a small delta on top. Sized against the measured geometry before
picking a number: `leverArm(22.5px) * sin(1.4°) ≈ 0.55px`, well under
`check-motion.mjs`'s 0.75px weld tolerance. The build script prints this
check (`Zenek weld check: pupil sits 6.58px inside the disc's own rim...`)
so the constraint stays visible next to the constant it justifies.

## A SUCCESS-only accent that starts before T breaks the float seam

First `check-loop-seam.mjs` run failed: 45px differing across a wide
bounding box (`x 0..366, y 71..140`) between frames 96 and 246. The cause
was `DASH_STRETCH_START = T - 6` — the dash speed-line accent was meant to
read as a SUCCESS-beat effect, so I gave it a small head start "into" the
exit for a softer ramp. But `bump()` is non-zero six frames into its own
window, so at `t = T` (the float segment's own end) the dash groups were
already slightly stretched, while at `t = 96` (the segment's start) they
were not — a real value mismatch at the loop boundary, invisible in any
single still frame and only caught by the pixel-diff.

This is exactly `motion-taste.md`'s existing "Key exactly on the loop
boundaries — never span them" rule: *"A segment that merely CROSSES T...
makes the value at T an interpolation that almost never equals the key at
op."* The fix wasn't a new rule, just correct application of the existing
one — `DASH_STRETCH_START = T`, so `bump(T, T, dur)` reads exactly 0 by the
function's own definition (`t <= start` guard), matching the float
segment's un-stretched value at both ends. Confirmed with
`check-loop-seam.mjs`: `✓ identical — the segment repeats with no visible
seam.` Worth restating for the next SUCCESS-beat accent authored near a
`float`/`loop` marker boundary: "starts a few frames early for a softer
ramp" is exactly the shape of bug this rule exists to catch — check the
accent's own start time against the marker boundary, not just its shape.

## Hatch precompose, per the CURRENT svg-compatibility.md

The disc/shadow's raster `<pattern>` was revectorized as parallel 45°
strokes clipped by a track matte (`svg-compatibility.md`, "Preferred —
revectorize"), never flattened. Both `<pattern>` defs in this source declare
their tile as a fraction of their OWN shape's bbox (0.307692 on the 104px
disc, 0.52267 on the ~61px shadow) — computed independently, both resolve to
the same 32px absolute tile against the embedded 128px-native PNG, i.e. one
physical hatch scale for this artwork (native→scene factor 0.25, so a 16px
native "/" period becomes 4.0px on stage). Both hatches are precomposed
(`ty:0`) from the start, since `check-motion.mjs` only audits top-level
`doc.layers` shape geometry and would otherwise register spurious proximity
between the hatch's dozens of line vertices and the checkmark drawn into the
same screen region at a different beat.

## Ambient scroll: derived speed, derived rest, derived loop span

Sourced directly from the current `recipe-camera-scene-motion.md` ("Ambient
Scroll"), re-derived for this scene's own beat numbers rather than copied:

- `LAP = W = 375` on both cloud depths (not the field's own ~144/129px
  width) — a shorter lap tiles the sparse two-cloud sky densely, which reads
  as duplicated art.
- Speed is `lapsPerLoop * LAP / FLOAT_SPAN` — near crosses 2 laps per float
  loop, far crosses 1 (the 2:1 ratio IS the parallax).
- The brake's distance-time (`CLOUD_DECEL_START + CLOUD_DECEL_DUR/3`) is
  fixed at exactly `2 * FLOAT_SPAN` (`286 + 14 = 300 = 2*150`) so the same
  speed that closes the float loop ALSO lands every tile back on its native
  position when the sky rests — confirmed by the build script's own log:
  `rests 0.00px from native` on both depths.
- `FLOAT_SPAN = 150` was chosen to satisfy this closure with a snappy
  ~0.65s brake (`CLOUD_DECEL_DUR = 42`) while staying inside the brief's
  2.5–3s float guidance — the span is a consequence of where the sky needs
  to stop, not picked first and then patched.

## Aliveness Contract

| # | Gate | Measured | Verdict |
|---|---|---|---|
| 1 | Nothing inert | clouds+dashes drift continuously (dashes ride their own cloud layer, plus a stretch accent on exit); disc sways+bobs+tilts; hands welded (zero own clock — correct for a grip contact, not stillness); Zenek breathes+blinks+drags; shadow answers altitude; checkmark inert during ENTRY/FLOAT (correctly offscreen/undrawn), active during SUCCESS | pass |
| 2 | Amplitude, not keyframe count | bob-rig pos (float span) 2.8px(x)/5.99px(y) p2p; disc-sway rot 6.40° p2p; zenek-lag rot 2.8° p2p; zenek-breathe scale 3.98% p2p; shadow scale 15.97% p2p (full comp); check-ring-start-dot scale 0→100% — measured by direct sampling of the built JSON, not assumed | pass |
| 3 | Meaning drives behaviour | disc sways like a pendulum with a follow-through dangler, not a generic bob; clouds are wind with parallax, braking only for the payoff; shadow reads altitude (widens+lightens as he rises, fades as he lifts off); checkmark draws on hand-drawn (trim path, pen-order corrected), never fades in | pass |
| 4 | Mood governs the system | FLOAT: single 150f (2.5s) primary period, calm amplitudes (3.2° sway, 3px bob) — "suspended and floaty, nothing bouncy" honored, no bounce eases in the idle; SUCCESS: sharp break — 44f accelerating exit (easeInQuad), 42f quadratic brake, dash speed-lines — the gym-verb test fails to describe FLOAT (floating/swaying) and correctly succeeds for SUCCESS (an accelerating launch) | pass |
| 5 | Fluidity (velocity audit) | bob-rig pos 1.31×; disc-sway rot 1.40×; zenek-lag rot 1.43×; zenek-breathe scale 1.49×; shadow-rig scale 1.37× — all measured over the float span, all ≪3× | pass |
| 6 | Accents resolve | dash-stretch bump: 60f total (~1.0s), well past the ~4f floor; ring/tail pops (`RING_START_POP`/`RING_END_POP`): 10–12f, settle-soft entrances, exempt as entrance-class rather than oscillations | pass |
| 17 | Blinks close | `zenek-pupil-a`/`-b` scaleY bottoms at 0% for the hold (2f close / 2f hold / 4f open, ~8f total), rendered frames 173–182 confirm the eye fully vanishes for a beat — `check-motion.mjs` reports no BLINK NEVER CLOSES failure | pass |
| 7 | Loop seam | `check-loop-seam.mjs moneytransfer-status-scene-s5zh` — frames 96 vs 246: "✓ identical — the segment repeats with no visible seam" (after fixing the dash-stretch bleed, see above) | pass |
| 18 | Ink follows pen / scale pivots on artwork | `check-tail`'s path reversed programmatically with a runtime assertion; `check-ring` exempt (circle sweep); pop-accent anchors verified on-geometry — `check-motion.mjs` reports no DRAW-ON AGAINST THE PEN or SCALE/POP PIVOTS OFF THE ARTWORK failures | pass |
| 19 | Opening frame is the brief's opening | frame 0 rendered: clouds only, bob-rig at `(-150, 265)` — fully outside the 375×240 stage, not parked at 0% opacity/scale; `check-motion.mjs` reports no WRAP TELEPORTS IN VIEW failure and 0% reverse travel on every cloud tile | pass |
| 8 | Parts articulate | disc (sway+tilt), zenek-body/-face/2×pupil (breathe+lag+blink independently), shadow (derived response) all carry measured motion relative to their parent; hands are the deliberate, named weld (grip contact) — no limbs/joints exist in this ball-character artwork, noted rather than silently skipped | pass (joint clause n/a by artwork) |
| 9 | Held objects live | roles are physically reversed from a typical held-prop case: the disc is the load-bearing element Zenek hangs FROM (hands grip its rim), and it carries the scene's own primary sway+exit-tilt on top of the inherited bob; Zenek is the trailing/dangling element with his own lag+breathe on top of the disc's swing | pass (by construction) |
| 10 | The body breathes | `zenek-breathe` scale swell 3.98% p2p, continuous through FLOAT (and blended in through ENTRY/SUCCESS), independent 30f period (5 cycles/loop, non-trivial 1:3:5 ratio against sway/bob) | pass |
| 11 | Effort is phase-locked | no isometric-strain beat in this brief (a floaty paraglide, then an accelerating exit — no grip/strain moment); the applicable phase-lock is the entrance recoil landing exactly at the settle and the anticipation lean landing exactly before the exit surge, both confirmed by rendering | n/a (no strain beat) |
| 12 | No double-driven property | traced the chain `bob-rig(p) → disc-sway(r) → zenek-lag(r) → zenek-breathe(s)`: each null owns exactly one property no ancestor owns; disc-sway's rotation and zenek-lag's rotation are deliberately different physical quantities (shared swing vs. own delta), composed hierarchically rather than the same value re-applied | pass |
| 13 | Assemblies stay whole | hands and disc-outline/matte/hatch all parented directly to `disc-sway` with zero own transform beyond the shared parent — offset is exactly 0px by construction, not measured-and-close | pass |
| 14 | Contacts hold | `check-motion.mjs` exit 0, "Contact pairs checked: 0" (hand circles sit ~2.7px from the disc's own stroke centerline — a hand-drawn-icon gap under the checker's 3px proximity test, not a rig defect) and "All contacts hold... no colour was invented" | pass |
| 15/16 | Occupant gates | not applicable — Zenek hangs BELOW the disc via a hand-grip, he is not enclosed inside a container/shell | n/a |

## Verification

`node scripts/check-motion.mjs moneytransfer-status-scene-s5zh` — exit 0,
"All contacts hold, every occupant reads, and no colour was invented."

`node scripts/check-loop-seam.mjs moneytransfer-status-scene-s5zh` — exit 0,
"✓ identical — the segment repeats with no visible seam" (frames 96 vs 246).

`node scripts/preview-scene.mjs moneytransfer-status-scene-s5zh scene-1
0,18,35,52` (entrance: offscreen → ballistic rise → apex overshoot),
`76,96,120,176,246` (float loop + blink read), `173,175,176,177,179,182
--zoom 4` (blink closes fully to 0%), `246,256,270,290,310,328` (anticipation
+ accelerating exit, offscreen by ~290, sky stopped by 328),
`328,338,354,362,368,383` (ring draws pen-down at its own start point, tail
draws left-to-right, end accents pop, final hold) and `330,334,340 --zoom 5`
(pen-down dot growing from the ring's own start coordinate). Amplitude and
velocity-audit numbers computed by direct sampling of the built
`lottie.json`, not eyeballed.


---

# Heritage — the rounds that produced this rig

This scene supersedes a series of earlier builds of the same three artworks
(2rkf, 4b1s, 6q7m, apzd, ijjf, ytdq, 84nq), all retired. Their build scripts
are gone; the reasoning is not, because every rule below cost a test cycle to
find and the numbers are the evidence for the gates that now enforce them.

## Post-review fixes (2026-08-10, after team test)

Three staged-sequence defects, each now also a mechanical gate or contract
clause so the next sequence build cannot repeat them:

1. **The entrance beat had been silently deleted.** The brief staged
   clouds-first with Zenek arriving after; the build opened with him already
   floating. Rebuilt: frames 0–20 are clouds alone, he leaps in from
   below-left (20–58), overshoots, and a vertical-only damped bounce (58–92)
   hands off into the float. Shadow materializes through the landing.
   → contract: "the brief's beat list is a CAST LIST"; motion-taste gate 19.
2. **Cloud drift retimed to the story.** Constant right-to-left from frame 0
   (near 2.2 px/f, far 1.1 — parallax from the ratio), braking quadratically
   across the exit (254–318) to a dead stop exactly at the ring's pen-down;
   the checkmark draws over a frozen sky. Wraps teleport only with both keys
   fully offscreen → WRAP TELEPORTS IN VIEW gate.
3. **The tick drew backwards, and the pen-down dot rendered at the canvas
   corner.** `Stroke 13` is exported from the RIGHT tip — reversed
   (vertices + swapped in/out tangents) so trim-from-start is pen order,
   left→right. The start dot's ellipse is authored at shape-space origin;
   anchor=position cancelled the transform and painted it at (0,0) — anchor
   is now [0,0] with position carrying it home, so the pop pivots its own
   center. → DRAW-ON AGAINST THE PEN + POP PIVOTS OFF THE ARTWORK gates;
   pen-order clause in recipe-loaders-icons.
Also: the 24-frame smoothstep squint replaced with the canonical 2-2-4 blink
that closes to 0% (gate 17 caught it on rebuild).

## Ambient scroll rebuilt as TILING (2026-08-10, second team test)

The team's fresh generation showed the sky "going left to right and then back,
chaotically". That is a wrap teleport being DRAWN. The old pattern kept one
cloud copy and jumped it back across the canvas between two near-coincident
keys; the jump is a real 540px value change, invisible only while every
consumer samples exactly on the frames the author assumed. Anything that
resamples or rescales time — the app's duration/speed controls, a player
running on display refresh — can land inside it and render the sweep.

Rebuilt with no teleport at all: each cloud set is emitted as N copies spaced
one lap apart, every copy on the SAME monotonic leftward translation
(`travelled(t)` = constant speed, then the integral of a quadratic brake).
Largest single step is now 4.4px versus 540px, and reverse travel is 0px —
verified stable through the app's own control bake at default, duration ±,
and halved layer speed, which is where the old pattern broke.

Gates added so this cannot ship again: AMBIENT DRIFT REVERSES (a steady field
that travels >15% against its own net direction) and WRAP IS INTERPOLATABLE
(any offscreen jump left on smooth interpolation rather than a hold key).
Both were proven red against a replica of the old pattern.

## Sky density, entrance quality, and the loop seam (2026-08-11)

Team feedback: clouds read as "doubled, tripled" and too slow; the entrance
felt "laggy and rough between frames 38 and 54".

**Sky.** The tiling lap was the field's own width (188px), so 2-3 copies sat
on a 375px canvas at once — the source sky is TWO clouds, one upper, one
lower. Lap is now the full canvas width: at most one copy of each set is
substantially on screen, and coverage is still guaranteed for any
lap < W + cloudWidth, so no gap can open.

Speed is now DERIVED rather than picked. Two closures have to hold at once:
the repeatable "float" segment must cross a whole number of laps (so a
runtime replaying it sees the same picture), and the total distance by the
time the sky brakes must also be a whole number of laps (so a tile rests on
its NATIVE position and the frozen sky under the checkmark IS the final
source artwork). Both fall out of one speed once the stop's distance-time is
exactly twice the loop span — which is what fixed CLOUD_DECEL_START/DUR at
273/45 (273 + 45/3 = 288 = 2 x 144). Near crosses 2 laps per loop, far 1;
that ratio is the parallax. Both rest 0.00px from native.

**Entrance.** The rise was easeOutCubic, which bleeds speed as a power of the
remaining distance: down to 3% of launch speed after covering 85% of the way,
so the last third crawled — exactly the flagged 38-54 window. Replaced with a
BALLISTIC rise (constant gravity, solved so the apex lands on ENTRY_APEX at
zero velocity): speed now falls linearly 19.6 -> 0, still 7.15px/f at frame
40. The settle is a damped ring-down whose form leaves the apex at zero
velocity too, so the handoff has no hitch (the old one started the bounce
with ~1px/f against a rise that had stopped). X finishes at the apex, so the
ring-down is purely vertical. The float's own bob/sway now FADE IN across the
settle instead of running at full amplitude underneath the jump. Sampling
went to step 1 on every track carrying the entrance — 2-frame linear segments
facet visibly at 9px/frame.

**Loop seam.** Moving the float marker to 96..240 (span 144) left every float
clock tuned to the OLD 0..240 window: bob period 80 divides 240 but not 144.
All float periods now divide the span (1:3:4 — sway 144, bob 48, breathe 36).
New `scripts/check-loop-seam.mjs` proves it by PIXEL-DIFFING the segment's
boundary frames: keyframe comparison is actively misleading here, because a
clean scrolling seam has every tile one whole lap along, standing in for the
one ahead of it. Tolerance is 40/255 — a passing scene shows AA jitter up to
21 on a few edge pixels, a real break measures ~200 across hundreds.

## Landing the frozen sky ON the source artwork (2026-08-11)

A generated scene closed its float loop perfectly and still rested 106px
(near) / 135px (far) from where the third source file draws the clouds — the
right composition with the sky in the wrong place.

Loop closure and source-landing are TWO conditions. Speed derived as
`lapsPerLoop * lap / S` closes the repeatable segment but says nothing about
where the field stops. The total distance is `speed * D`, where `D` is the
brake's distance-time (`decelStart + decelDur/3` for a cubic brake), so the
field halts on a lap boundary only when `lapsPerLoop * D / S` is an integer.
Guaranteeing that for any lap count means `D = k * S`.

The consequence worth internalising: **the loop span is derived from where the
sky stops, not chosen first.** Neither the lap count nor the lap distance can
fix a bad `D/S` ratio — both cancel out of the condition. Only the brake
profile has slack (`(1-u)^n` integrates to `decelDur/(n+1)`). In this scene
`D = 273 + 45/3 = 288 = 2 x 144`, so both sets rest 0.00px from native.

Gate: AMBIENT RESTS OFF-SOURCE, which infers each tiled group's lap from its
sibling spacing and only applies to fields that actually come to rest.

## The tile lap is the CANVAS width (2026-08-11, regression)

The duplicated-cloud defect came back on a fresh generation: `cloud-far` tiled
at a 139px lap on a 375px canvas — 2.7 copies of the same cloud sharing the
screen. `cloud-near` at 294px was borderline (1.3), which is why only the
upper cloud looked wrong.

Cause was mine. When this scene was rebuilt I changed it to `LAP = W` and
explained the sparseness reasoning in THIS script's comments — but the recipe's
code sample still read `const lap = fieldBbox.width + gap`. The engine followed
the recipe, exactly as it should. A rule that lives only in one build script is
not a rule; it is a coincidence that scene happens to satisfy.

Valid window is `[W, W + fieldWidth]`: the lower bound keeps the field sparse,
the upper keeps a gap from opening. Parallax must come from the whole-lap COUNT
per loop, never from a shorter lap on one depth layer — which also means
parallax ratios are ratios of small integers (2:1 here).

Gate: AMBIENT TILES TOO DENSE / AMBIENT TILING LEAVES A GAP. Verified red on
the generated scene (139px and 294px laps) and green here, where both sets run
lap = W = 375 with 2 and 1 laps per loop and rest 0.0px from source — all four
ambient requirements satisfied simultaneously, so none of them is a trap.
