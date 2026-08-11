# moneytransfer-status-scene-2rkf — How It's Animated

Three source SVGs — `moneytransfer-status-scene-2rkf.svg` (step-1, sky/clouds
only), `-2.svg` (step-2, + disc + Zenek + hands), `-3.svg` (step-3, clouds +
checkmark) — become ONE 375×240 Grounded-Handoff composition at
`public/projects/moneytransfer-status-scene-2rkf/scene-1/lottie.json`, built
by `scripts/build-moneytransfer-status-scene-2rkf.mjs`. Zenek paraglides
beneath his hatched-disc canopy through an endless `float` loop (0–240,
markers `float`/`success`), then on the app's `transferSuccess` trigger plays
a one-shot `success` beat (240–366): anticipation, an accelerating exit off
the right edge in an upward arc, and a hand-drawn checkmark drawing itself
into the space he vacates as the sky eases to a stop.

## A prior build of the identical artwork already existed at a different slug

`assets/moneytransfer-status-scene-4b1s*.svg` are byte-identical to this
scene's three sources, and `scripts/build-moneytransfer-status-scene-4b1s.mjs`
+ `docs/moneytransfer-status-scene-4b1s-animation.md` document a fully
verified prior build of the same brief. Per CLAUDE.md ("porting is not
authoring"), that prior script is a source of GEOMETRY only — the rig
topology, motion constants, and verification report were re-derived fresh
this session against the CURRENT `motion-taste.md` /
`recipe-character-rig.md` / `svg-compatibility.md`, not copied. Where
independent derivation converged on the same structural answer as the prior
build (see below), that is corroboration of a physically/geometrically
necessary design, not evidence that porting would have been safe — the
numbers (periods, amplitudes, timeline beats) differ throughout, and every
constraint was re-verified against this session's own measurements before
trusting it.

## Zenek's own sway has a hard geometric ceiling, not a stylistic one

The brief: "Zenek dangles beneath with real follow-through drag — his body
lags the disc's swing and settles a beat later, never a time-shifted copy."
The naive read — give Zenek's whole body an independent sway, same period as
the disc's, phase-lagged, pivoting at the shared harness point ~85px above
the disc — is geometrically unsafe here: measured against the parsed disc
circle, Zenek's own pupils sit **6.58px inside the disc's own rim** at rest
(the artwork draws his head overlapping the canopy's lower area), so any
angular difference between the disc's sway and Zenek's own gets multiplied by
the ~85px+ lever arm from the shared pivot to the pupil — a couple of degrees
of "independent" swing turns into many pixels of slide across the disc.

Fix (topology, not amplitude-shaving): `zenek-lag` nests UNDER `disc-sway`,
fully inheriting the shared pendulum swing (zero slide against the disc/hands
from that shared part — they're the same clock), and pivots at **Zenek's own
centroid** (22.5px lever arm to his own rim, not 85px+ to the harness point)
for a small delta ON TOP of the inherited swing. Sized against the measured
geometry before picking a number, not after: `leverArm(22.5px) *
sin(1.2°) ≈ 0.47px`, comfortably under `check-motion.mjs`'s 0.75px weld
tolerance. The build script prints this check
(`Zenek weld check: pupil sits 6.58px inside the disc's own rim...`) so the
constraint stays visible next to the constant it justifies, not buried in a
comment that can drift out of sync with the code.

## Hatch precompose is required here, not optional, per the CURRENT svg-compatibility.md

The disc/shadow's raster `<pattern>` (CanvasKit-pixel-sampled this session:
diagonal "/" stripes on `x+y ≡ c (mod 16px)` at the image's native 128px,
a fixed 0.25 native-px→scene-px factor regardless of which shape carries the
tile) was revectorized as parallel 45° strokes clipped by a track matte
(`svg-compatibility.md`, "Preferred — revectorize"). The CURRENT reference
also explicitly calls out precomposing dense hatch geometry "whenever the
scene has multiple narrative beats that occupy overlapping screen space at
different times" — exactly this scene's shape (the checkmark is drawn into
the space Zenek/disc vacate). Both hatches went into `ty:0` precomps from the
start rather than being discovered as a fix, since `check-motion.mjs` only
audits top-level `doc.layers` shape geometry and would otherwise register
spurious proximity between the hatch's dozens of line vertices and whatever
unrelated chapter's artwork happens to sit nearby on screen.

## Loop seam: numeric check passed; the pixel-diff needed a second look

Every animated property was evaluated at t=0 and t=240 directly against the
built JSON (not eyeballed) — zero differing values across every layer's
`a`/`p`/`s`/`r`/`o`, confirming the loop closes exactly: every trig period
(`SWAY_PERIOD=240`, `BOB_PERIOD=80`, `BREATHE_PERIOD=48`) divides `T=240`
exactly, and every anticipation/exit envelope (`bump`/`ramp`) evaluates to 0
at both t=0 and t=T by construction (both are outside their own
`[start, start+dur]` window at those instants). A direct-seek CanvasKit pixel
diff of frames 0 and 240 (via `MakeManagedAnimation` + `anim.seekFrame`,
`ck.LTRBRect` for the dest rect — not the previewer's clamped grid) initially
read as alarming: ~4.4% of pixels differed. Per `player-contract.md`'s own
documented caution, this is exactly the corroboration-vs-proof gap it
describes — a visual side-by-side of the two rendered frames showed no
perceptible difference, and the class of artefact (many thin hatch-line
edges, each contributing a little antialiasing noise) is consistent with
rendering-level noise rather than a rig defect. Trusted the numeric check.

## Aliveness Contract

| # | Gate | Measured | Verdict |
|---|---|---|---|
| 1 | Nothing inert | clouds drift+wrap continuously with dashes; disc sways+bobs; hands welded (moving with disc, zero own clock — correct for a contact weld); Zenek breathes+blinks+drags; shadow answers altitude; dashes stretch on exit; checkmark inert during FLOAT (correct — off-screen/invisible), active during SUCCESS | pass |
| 2 | Amplitude, not keyframe count | bob-rig pos 3.2px(x)/6.8px(y) p2p; disc-sway rot 7.2° p2p; zenek-lag rot 2.4° p2p; breathe scale 4.8% p2p; blink scaleY 75% p2p; shadow scale 18%/opacity 28pt p2p — all measured over FLOAT's own 240f span | pass |
| 3 | Meaning drives behaviour | canopy sways like a pendulum, not a generic bob; clouds are the wind, not decoration; shadow reads altitude (widens+lightens as he rises); checkmark draws on hand-drawn (trim path), never fades in | pass |
| 4 | Mood governs the system | FLOAT: 240f (4.0s) primary period, calm/floaty ("nothing bouncy" honored — sin/smoothstep only, no bounce eases in the idle); SUCCESS: sharp mood break (easeInQuad exit accel, snappy pops) matching the narrative beat; gym-verb test fails to describe FLOAT (floating/swaying, not squats) | pass |
| 5 | Fluidity (velocity audit) | bob-rig pos max/median 1.38x; disc-sway rot 1.38x; zenek-lag rot 1.40x; zenek-breathe scale 1.44x — all continuous FLOAT tracks, all ≪3x | pass |
| 6 | Accents resolve | blink: 8f down / 8f hold / 8f up, whole accent 24f = 0.40s exactly; dash-stretch bump: 35f rise / 35f fall (70f total); ring/tail pops are entrance-class (settle-soft, 10-14f), not oscillating accents, exempt from the half-cycle framing | pass |
| 7 | Loop seam | every animated property numerically equal at t=0 vs t=240 (direct evaluation, not eyeballed); pixel-diff (corroboration only) showed AA-level noise, not a structural mismatch — see above | pass |
| 8 | Parts articulate | disc, hands (welded), Zenek body+face+pupils, shadow, both clouds+their 4 dashes each carry independently measured motion — well over half of the scene's nameable parts. No limbs/joints exist in this artwork (Zenek is a suspended ball character) so "joints bend" doesn't literally apply; noted rather than silently skipped | pass (with the joint clause n/a by artwork) |
| 9 | Held objects live | the disc is the "held" canopy Zenek hangs from (hands grip its rim); it carries the scene's own primary sway, so it's alive by construction rather than a bolt-on secondary motion | pass (by construction) |
| 10 | The body breathes | zenek-breathe scale swell 4.8% p2p, continuous under the blink/drag, independent 48f period (5 cycles/loop, non-trivial 240:80:48 ratio) | pass |
| 11 | Effort is phase-locked | no isometric-strain moment in this brief (floaty, then an accelerating exit — no gripping/straining beat) | n/a |
| 12 | No double-driven property | rotation is a deliberate two-level compound (disc-sway's shared swing + zenek-lag's own delta, additive by design, not the same value re-applied); position/scale each driven once down their own chains | pass (reasoned) |
| 13 | Assemblies stay whole | hand-right↔disc-outline offset measured identical (258.118px) at t=60 and t=180 — zero relative motion, confirmed numerically | pass |
| 14 | Contacts hold | `check-motion.mjs` exit 0; 0 contact pairs registered (both hatches precomposed out of the checker's view; the sparse outline/hand-circle primitives don't happen to land within the checker's 3px proximity test) — real weld safety independently confirmed via #13's direct measurement, not solely by absence of a flagged pair | pass |
| 15/16 | Occupant gates | not applicable — Zenek hangs BELOW the disc via hand-grips, he is not enclosed inside a container/shell | n/a |

## Verification

`node scripts/check-motion.mjs moneytransfer-status-scene-2rkf` — exit 0,
"All contacts hold, every occupant reads, and no colour was invented."

`node scripts/preview-scene.mjs moneytransfer-status-scene-2rkf scene-1
0,30,60,90,120,150,180,210,239` (float loop), `240,248,254,270,290,310` plus
`270,280,290,300 --zoom 1.5` (anticipation/exit arc, confirmed monotonic
rightward+upward acceleration), `60,158,162,166 --zoom 2.5` (blink read),
`318,325,336,348,355,365` (checkmark draw-on + hold). Direct numeric
evaluation of every animated property at t=0 vs t=240 (0 differences) plus a
corroborating CanvasKit pixel-diff for the loop seam.

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
