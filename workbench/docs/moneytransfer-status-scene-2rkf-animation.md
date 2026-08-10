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
