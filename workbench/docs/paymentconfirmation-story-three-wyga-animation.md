# paymentconfirmation-story-three-wyga — animation learnings

`scripts/build-paymentconfirmation-story-three-wyga.mjs` →
`public/projects/paymentconfirmation-story-three-wyga/scene-1/lottie.json`.
558f @ 60fps (grew from the original 488f across two edits — see below): a
342f intro (waiting → confirmation → celebration launch) handing off into a
216f endless celebration loop (`markers: intro[0,342), loop[342,558)`).

## Edit 2 (this session): the pen-finish → jump handoff read as two events

Designer note: "the mascot now waits too long — it reads as two separate
events." True of Edit 1's fix below — withholding his whole visible ascent
until 10f into the swoosh's last stretch, and syncing the spark to fire on
his LANDING instead of the pen-lift, left a genuinely empty stage between
`DRAW_END` (256, line complete) and his first visible entrance (~14f later)
— the spark, held back 46 frames to meet the landing, wasn't there to fill
that gap either. One beat (the line) visibly finished before the next beat
(the jump) had produced anything to look at.

Fixed by overlapping the two beats instead of queuing them:
- **Anticipation starts in the swoosh's own last third.** `ANTIC_START =
  DRAW_END - LAST_THIRD` (`LAST_THIRD = round(SWOOSH_DRAW_DUR/3)` = 17f) —
  the coil begins while the pen still has real distance left to draw. He's
  still fully offscreen through this (per `PARK_DY`), so there's no visual
  collision with the actively-drawing stroke — Edit 1's fix is preserved.
- **His rise takes over the instant the pen runs out.** `ANTIC_END` is
  pinned to `DRAW_END` exactly (256) — the keyframe curve's target value
  starts moving from the coiled position toward the overshoot peak on the
  SAME frame the swoosh's trim path reaches 100%. Confirmed by reading the
  shipped `mascot-root` position track directly: `t:239 → y:387` (parked),
  `t:256 → y:397` (deeper coil, `ANTIC_END`), `t:306 → y:202` (overshoot
  peak) — the ascent's target genuinely starts changing at the same frame
  the line finishes, not some frames later.
- **The spark reverts to popping at the pen-lift** (`c = DRAW_END - 2`, its
  original convention — Edit 1 had moved this to sync with the landing
  instead). Now something is already resolving on stage at the exact instant
  the stroke completes — rendered 254/256/262/270 show the spark visibly
  growing right through `DRAW_END`, with zero gap between "line complete"
  and "spark responding."
- **He lands after the spark, not with it** — `RISE_END`/`LAND_END` keep
  their own unchanged pace (50f rise + 22f land off `ANTIC_END`), so the
  landing (328) sequences AFTER the spark has already settled (270), per
  "he lands just after the spark" — the two are no longer forced to the
  same frame (Edit 1's "resolve together" reading is superseded by this
  brief's own wording).

`T` grew again to fit the now-later landing: 332 → 342 (+10f), `OP` 548 →
558. The green line's own draw timing (`RIBBON_DRAW_START`=184, `DRAW_END`
=256) and the loop's own 216f span/choreography are untouched — confirmed by
`diff`-style inspection of the unedited constants.

**Mechanical gates after this edit:**
- `node scripts/check-motion.mjs paymentconfirmation-story-three-wyga` →
  exit 0 (unchanged output — same scene clock, correlation, contact pair,
  and declared blink exception as every prior run; retiming existing tracks
  doesn't touch any of those measurements).
- `node scripts/check-loop-seam.mjs paymentconfirmation-story-three-wyga` →
  exit 0, frames **342 vs 558** pixel-identical; loop confirmed moving from
  its first beat.

**Rendered and read:** 226/239/246/254/256/262/270/280 (swoosh drawing
through its last third with the invisible coil starting at 239, the spark
visibly popping right at 254–256 as the trim path completes, no dead frame
at the handoff), 270–328 (the mascot's own rise/land arc, landing at 328
well after the spark's 270 settle — sequenced, not simultaneous), 0/72/140/
176 (beats 1–2 pixel-unchanged), 342/369/396/557 (loop reads consistently,
first beat still genuinely peaks, `op-1` matches the `T` boundary pose).

**Aliveness Contract, scoped to what changed:** no new layers or tracks were
added — this edit only retimes existing `ANTIC_START`/`ANTIC_END` (mascot
rig) and `c` (spark pop) constants, and both remain driven by the same
amplitude values as before (`JUMP_H`, `OVERSHOOT_H`, `STRETCH`/`SQUASH`,
spark's 114%→100% pop) — nothing shrank or went inert. Effort stays
phase-locked: the landing squash still lands exactly at `LAND_END`
(confirmed by rendering 328, squashed), and the spark's pop is now
phase-locked to the pen-lift (its own physically-motivated moment) rather
than to an arbitrary sync target. Held/worn parts and their assemblies are
untouched by this edit.

## Edit 1 (prior session): the mascot was covering the green swoosh mid-draw

Designer note: "the mascot arrives too early and covers the green swoosh
while it's still being drawn." True — the shipped rig computed the swoosh's
own draw window BACKWARD from the mascot's landing (`SWOOSH_DRAW_END =
LAND_END - 2`), which let his rise start at `ANTIC_END = POP_START + 10`,
well before the swoosh was even half drawn. His rising body climbed straight
over it for the back half of the stroke.

Fixed by flipping the dependency: the green line (ribbon then swoosh) now
computes its own timing FIRST, at its unchanged pace (50f swoosh, a
length-proportional ribbon ahead of it), independent of the mascot. The
mascot's visible ascent (`ANTIC_START`/`ANTIC_END`) is then derived from the
swoosh's own `DRAW_END`, timed to begin only in the swoosh's LAST STRETCH
(the final 20% of its draw, 10f) — so for the first 80% of the draw the
stage is his to leave completely empty. The jump's own internal proportions
are untouched (10f coil, 50f rise, 22f land — all "unchanged pace," per the
existing comments); only WHEN they start moved. Rendered confirmation: frames
184→256 (the full ribbon+swoosh draw) show no part of the mascot on stage at
all; he first appears at 270, mid-rise, over an already-complete, static
green line.

The spark's pop was also retimed. It used to fire at `DRAW_END - 2` ("the pen
lifts as the stroke finishes"), independent of the mascot — with his launch
now delayed, that left the spark resolved ~46 frames before he landed, an
awkward looking split. Per the brief ("so his landing and the spark resolve
together"), the spark's pop now targets `LAND_END - 16` so its scale settles
to 100% at exactly `LAND_END`. Rendered confirmation at 296/302/310/318
(zoomed): no spark at the overshoot peak (296), the spark beginning to pop
as air-flow marks appear on the descent (302), mid-pop (310), fully settled
exactly as he lands, squashed (318) — landing and spark resolve on the same
frame.

Because the badge-pop and green-line-draw timing are both computed forward
and were left numerically untouched (`RIBBON_DRAW_START` still 184,
`DRAW_END` still 256 — confirmed identical to the pre-edit build), the only
things that moved are the mascot's launch window, the spark's pop, and the
intro/loop boundary. Per the brief's own permission ("lengthen the intro if
both can't read inside its current span — the loop start moves with it"),
`T` grew from 272 to 332 (+60f) to fit the now-later landing plus its 14f
hold; `OP` grew from 488 to 548 with it. The loop's own span (216f) and
every one of its tracks (sparkle rotation, shadow, air-flow, bounce) are
byte-for-byte unchanged — only their absolute frame numbers shifted by the
same +60f `T` moved by, which the loop-seam gate (T vs OP, not literal frame
numbers) is insensitive to.

**Aliveness Contract, scoped to what changed:** held objects — N/A, nothing
newly held; the spark and green line remain declared stage-fixed decoration
per the original scene's `motionExceptions` (unchanged). Nothing left inert —
the retimed span between `DRAW_END` (256) and the mascot's arrival (270) is
now genuinely empty of him, which is the intended "empty stage," not an
inert element; the green line itself continues to carry its own ambient
breathe (`ambientBreathScale`) through that span, unchanged. Amplitude that
reads — the rise/land amplitudes (`JUMP_H`, `OVERSHOOT_H`, `STRETCH`/
`SQUASH`) are untouched, only their timing moved, so nothing shrank. Effort
phase-locked — landing squash still lands exactly at `LAND_END` (verified by
rendering 318, squashed pose), and the spark's own pop is now phase-locked to
that same instant instead of to the pen-lift, which is the point of the
requested change. `check-motion.mjs` and `check-loop-seam.mjs` both re-run
clean after the edit (below) — no contact, occupant, or seam regression from
retiming.

**Mechanical gates after the edit:**
- `node scripts/check-motion.mjs paymentconfirmation-story-three-wyga` → exit
  0 (unchanged output — same 108f scene clock, same +0.99 air-flow
  correlation, same one declared contact pair at 0.00px, same declared blink
  exception).
- `node scripts/check-loop-seam.mjs paymentconfirmation-story-three-wyga` →
  exit 0, frames **332 vs 548** pixel-identical (supersedes the 272-vs-488
  pair recorded below, which was the pre-edit build); loop confirmed moving
  from its first beat.

The "This run (original build)" section below is the historical record of
the scene's first authoring pass and is accurate for that build — its
`272`/`488`/`236`/`258` frame numbers describe the pre-edit timeline. Every
number through `DRAW_END = 256` (badge pop, ribbon draw, swoosh draw) is
still exactly correct post-edit, since that section of the timeline was left
numerically untouched; only the mascot-launch-onward numbers (new:
`ANTIC_START=236, ANTIC_END=246, RISE_END=296, LAND_END=318, T=332, OP=548`)
moved, per the Edit section above.

## This run (original build): re-verification against a word-for-word matching brief

The three source SVGs attached to this brief
(`assets/paymentconfirmation-story-three-wyga{,-2,-3}.svg`) are **byte-identical**
(md5-diffed before authoring) to `assets/paymentconfirmation-story-three-zezm{,-2,-3}.svg`,
`-h3oo{,-2,-3}.svg`, `-6v93{,-2,-3}.svg`, `-4obq{,-2,-3}.svg`, and
`-dzbr{,-2,-3}.svg`. This brief's own choreography text was compared line by
line against all five prior briefs (not assumed from the slug or file
similarity) and matches **zezm's round-3 (final, field-tested) brief, 4obq's
own brief, and dzbr's own brief specifically**:

- **Ticks are pure decals.** "They do not swell, brighten, pulse, or react to
  the hand in any way" — matches zezm round 3 / 4obq / dzbr. 6v93's brief
  explicitly asked the pass-accent back; this brief does not, so
  `badge-ticks` carries no per-tick swell here either.
- **Air-flow marks trail the descent only**, on both the loop bounces and the
  beat-3 entrance: "nothing during the rise... they show only as he drops
  from the overshoot into his landing... Same rule on his entrance." Matches
  zezm/4obq/dzbr. 6v93's brief asked for visibility through the whole
  airborne arc — inapplicable here.
- **Eyes keep their exact drawn shape, counter-scaled against the body**:
  "they never squash, stretch, or squint... their own scale has to cancel
  the body's out." This is zezm's/4obq's/dzbr's `eyeCounterScale()`
  verbatim. h3oo's and 6v93's briefs asked for a landing *squint* instead —
  inapplicable here.
- **Timeline seconds match exactly**: waiting ~1.2s, confirmation ~1.7s,
  celebration ~1.6s, loop ~216f — reproduces the shipped
  `BEAT1=72 · BEAT2=104 · BEAT3=96 → T=272, LOOP=216, OP=488` to the frame.

## Base script: 4obq, not dzbr

Built from `scripts/build-paymentconfirmation-story-three-4obq.mjs` (slug
swapped, header comments extended) rather than dzbr's script, because 4obq
is the more current, export-safe descendant in this lineage — dzbr predates
a refinement 4obq's own script picked up this session:

1. **The green line is drawn by ONE pen, in sequence, not two halves
   radiating from the join.** dzbr/h3oo/6v93 ship the earlier build where the
   ribbon trim-draws left while the swoosh wipes right on the same clock —
   defensible as "one gesture" but reads as two strokes starting together.
   4obq's script reverses the ribbon (vertices reversed, tangents swapped, so
   trim-from-start runs LEFT to RIGHT) and chains the swoosh's own draw
   directly off the ribbon's end point, with `pathLength()`-derived,
   length-proportional durations (`SWEEP_VS_SCRIBBLE = 1.4`) so the pen holds
   one speed across the corner. This is now codified in `motion-taste.md`'s
   connected-line bullet (diffed this session — the addition is exactly this
   rule), so it is the correct base to build from, not dzbr's older cut.
2. **Stale absolute-frame comments fixed** (already present in dzbr's
   inheritance from 4obq, carried through here too).
3. **The ribbon gleam is a trim-window sweep, not a Merge-Paths intersect**
   (also already present in dzbr's lineage, carried through here).

Diffed against 4obq's script directly: the only functional difference is the
`SLUG` string and the header-comment provenance note — confirmed with `diff`.

## Numeric re-derivation, not narrative re-derivation

Per "porting is not authoring," every constant was re-checked against this
brief's own text and the CURRENT skill references before shipping, not
carried on the strength of the prior scripts' git history:

- **`player-contract.md`**: the opacity-does-not-cascade-through-`parent`
  note (precomp-wrapped badge pop) and the Export Compatibility section
  (Merge Paths do not survive the HTML export) are both present in the
  tracked reference (confirmed unchanged since 4obq's run — no uncommitted
  diff on this file). The script's `precompFromLayers()` badge wrapper and
  the zero-Merge-Paths ribbon gleam both honor it.
- **`motion-taste.md` Aliveness Contract**: re-read in full this session;
  gates still number 1–19 (unchanged since 4obq's run). This file DOES carry
  an uncommitted diff this session — but it is exactly the connected-line
  sequential-pen rule 4obq's script already implements (confirmed by `git
  diff` on the reference), not a new gate. Verified fresh against this
  build's own output (table below), not inherited from any prior scene's
  recorded exit code.
- **`recipe-companion-bubble.md`**: no uncommitted diff since 4obq's run.
  This scene has NO speech bubble, tooltip, or text layer of any kind — only
  its "Intro + Loop" marker/idle-alive-from-frame-0 mechanism applies
  (section 1). The HARD CONTRACT items about a bubble text layer, `autoFit`,
  a `.textPos` slot, and the bubble-entrance HOUSE CONSTANTS are inapplicable
  by construction — declared here rather than silently skipped, same
  precedent as h3oo/6v93/4obq/dzbr.
- **`chapterization-transition-grammar.md`**: no uncommitted diff since
  4obq's run. The sequence checklist (diff the assets first, first frame =
  first artwork, last frame = last artwork, every repeatable segment closes
  on the picture) — all satisfied; there is no ambient/tiled field in this
  scene, so the STRUCTURE-based tile-lap gate is not exercised.
- **Mechanical gates**: `check-motion.mjs` and `check-loop-seam.mjs` were run
  fresh against THIS build's output — both exit 0, reported below.
- **Numeric re-derivation**: the hand's rest angle, its total sweep to the
  check's arm angle, the badge/hub/mascot pivots, and the park depth are all
  computed at build time from the parsed SVG geometry (`atan2`, `bbox`)
  exactly as before — since the source geometry is byte-identical, these
  values reproduce exactly (confirmed by the build log: `hand rest -44.7deg
  -> check arm 299.3deg, total sweep 1064.0deg`, `badge center
  128.40315999999999,128.003655`, matching 4obq's own build log exactly).

## Verification this run

- `node scripts/check-motion.mjs paymentconfirmation-story-three-wyga` →
  exit 0. Scene clock 108f (from `mascot-root`); `mascot-airflow-rig`
  correlates +0.99 to it. One contact pair checked (`ribbon-sweep` ↔
  `mascot-ribbon`, 0.00px, declared). Blink gate reads `mascot-eyes`
  bottoming at 94% — declared as a motion exception quoting the brief (the
  eyes are already-closed arcs that counter-scale to cancel the body's
  squash, not a blink or a squint).
- `node scripts/check-loop-seam.mjs paymentconfirmation-story-three-wyga` →
  exit 0, frames 272 vs 488 pixel-identical; also confirms the loop is
  moving from its first beat (opening samples differ from the boundary).
- Rendered and read (via the Read tool, as images):
  - `0/20/40/60/72/100/140/176`: badge only through beats 1–2, ticks
    identical across all frames (decals, no reaction to the hand). Frame 100
    shows the hand already collapsed into a stub; frame 140 shows the
    check's line partially drawn with nothing of the clock left; frame 176
    shows the completed check holding.
  - `108/116/120/124/132/144/164/176`: the exit cascade in detail — hand at
    108 still full-length at the accelerated angle; by 116 it has collapsed
    into a stub and the ticks are already fading; by 120 the disc is blank
    (hub about to pulse); 124 shows the hub's absorb-pulse; 132 shows the
    disc fully clear with the check's pen already down (left stub); 144/164
    show the check drawing to completion and holding. Nothing of the clock
    survives past 132, well before the check's line reaches the middle of
    the face.
  - `176/186/196/206/216/226/236/246`: badge pop-fade (opaque at 176,
    translucent by 186, essentially gone by 206) racing the green line's
    single continuous draw — pen down at the ribbon's far LEFT at 186,
    sweeping right, ribbon complete and the swoosh picking it up by ~206–216,
    spark landing at the end by ~236 — while the mascot rises into frame with
    NO air-flow marks visible through the rise and the overshoot peak (236);
    air-flow marks appear only once he is falling into the landing (246).
  - `272/285/299/313/326/353/380/487`: the loop's first beat genuinely peaks
    — frame 299 (first PEAK) reads visibly stretched-tall with no air-flow
    marks, clearly distinct from frame 272 (the shared boundary landing key,
    squashed) — not a frozen first bounce. Sparkle clusters burst in a
    staggered rotation across the scrub, never in unison. Frame 487 (≈ `op-1`)
    reads as the same rest pose as 272, matching the seam.
  - `299/313/326` at `--zoom 3`: air-flow marks absent at the peak (299),
    present mid-descent (313), absent again at the landing (326) — exactly
    the brief's "nothing during the rise... only as he drops."
  - `299` vs `326` at `--zoom 5`: eyes hold the identical "⌣⌣" arc shape and
    proportions at both the stretched peak and the squashed landing — the
    body clearly differs (taller/narrower vs shorter/wider) while the eyes
    read as the same drawn shape, confirming `eyeCounterScale()`.
- Total keyframe count across all animated tracks: 354 — in the "hundreds,
  not dozens" range the Living-idles bar asks for.

## Aliveness Contract — gate table

| # | Gate | Measured | Verdict |
|---|---|---|---|
| 1 | Nothing inert | Every element on stage carries a track: badge breathe (1.8%), hand sweep (1064° total), hub absorb+exit, ticks retract-only (no pulse — brief: "do not swell, brighten, pulse"), check trim-draw, mascot jump/lean/squash, air-flow rotation+opacity, eyes counter-scale, shadow scale+opacity, sparkle bursts, swoosh/spark carry a slow ambient breathe (100→96→100%) even while "resting" per the brief | PASS |
| 2 | Amplitude, not keyframe count | mascot-root loop Y 20px, rotation 12° peak-to-peak, scale 10–11%; shadow scale 31%, opacity 36%; air-flow rotation 20°; hand rotation 1064° total sweep — measured by dense-sampling the shipped JSON, not asserted | PASS |
| 3 | Meaning drives behaviour | Clock hand sweeps mechanically (a mechanism); ticks are inert decals that hold still (brief-literal — this scene's ticks do NOT answer the hand); check draws pen-order; mascot bounces with anticipation/overshoot/squash (a living body) | PASS |
| 4 | Mood governs the system | Beats 1–2: slow, linear, mechanical (a waiting clock). Beat 3 loop: 54f landing beats, JUMP_H=20px, snappy `expressivePop`/`exitAccelerate` accents — an energetic celebration, not a calm idle | PASS |
| 5 | Fluidity | Hand sweep (only true continuous hero track): 1.00× peak/median (linear through beat 1, per brief). Bounce tracks: high ratios expected and exempt — a landing hold + a fast mid-air arc is a named "deliberate accent" exemption, not a continuous sway | PASS |
| 6 | Accents resolve | Hub absorb-pulse half-cycle ~5f+7f; shadow/badge-pop accents span 12–30f — all ≥ the ~4f/0.4s floor | PASS |
| 17 | Blinks close | N/A — eyes never blink; the counter-scale that cancels the body's squash (holding the eyes' own drawn arcs constant) is declared in `controls.json.motionExceptions` quoting the brief, not presented as a blink | DECLARED |
| 7 | Loop seam | `check-loop-seam.mjs` exit 0, 272 vs 488 pixel-identical | PASS |
| 18 | Ink follows the pen / scale pivots on artwork | Check path reversed to left-tip pen order before trim; the ribbon is reversed to left-tip pen order and the swoosh chains off its end (ONE pen, sequential, per this session's motion-taste.md addition); every scaling layer (ticks, hub, sparkles, badge precomp, spark, swoosh, ribbon-sweep bands) pivots at its own bbox center in absolute SVG space | PASS |
| 19 | Opening frame is the brief's opening | Frame 0 renders the badge alone; mascot parked at `PARK_DY = H+6 - armsBox.minY` below frame, derived from the whole subtree's topmost geometry (air-flow marks), not just the body bbox — confirmed by direct render, no part of the assembly grazes the bottom edge | PASS |
| 8 | Parts articulate | Hand, hub, ticks, check, eyes, air-flow rig, body, belly, shadow, sparkles, ribbon, swoosh, spark each carry independent tracks relative to their parent | PASS |
| 9 | Held objects live | N/A — nothing is held; ribbon/swoosh/spark are declared stage-fixed decoration per the brief's "everything rests exactly where artwork 3 draws it" | DECLARED |
| 10 | The body breathes | Badge: continuous 1.8% breathe through beats 1–2. Mascot: continuous squash/stretch cycling through every loop beat, never resting flat | PASS |
| 11 | Effort is phase-locked | Squash lands exactly at ground contact (LANDINGS), stretch/overshoot at the airborne peak (PEAKS) — verified by rendering the extremes (299 stretched, 326 squashed) | PASS |
| 12 | No double-driven property | Each property animated once down any parent chain; badge pop/fade lives on the outer precomp only, badge breathe stays on the inner null only | PASS |
| 13 | Assemblies stay whole | Badge (disc, texture, rings, ticks, hub, hand, check) is one precomp, one root null — pops and fades as one mass, per the brief's "ONE object... never crossfaded" | PASS |
| 14 | Contacts hold | `check-motion.mjs`: 1 contact pair checked (`ribbon-sweep` ↔ `mascot-ribbon`, 0.00px), declared with a brief-quoting reason | PASS (declared) |
| 15 | Occupant reads | N/A — no character-inside-a-shell in this artwork | N/A |
| 16 | Occupant belongs to body | N/A — same reason | N/A |

`check-motion.mjs` output: scene clock 108f (`mascot-root`), air-flow
correlates +0.99 to it; blink gate reads the eye's 94% floor and is covered
by the declared exception above; the one contact pair passes with a declared
reason; exit 0. `check-loop-seam.mjs`: 272 vs 488 pixel-identical, exit 0.

## Constants independently re-derived vs. inherited (summary)

**Re-derived (computed at build time from the current SVGs, verified this
session, not hand-typed):** badge/hub/mascot pivots and bboxes, the hand's
rest angle (-44.7°) and total sweep to the check's arm angle (1064.0°, via
`atan2` + the whole-turns/tangent-continuity solve), the texture tile size,
the ribbon/swoosh geometry and their derived boxes, `PARK_DY`.

**Verified unchanged (byte-identical source geometry + word-identical
brief, so re-deriving reproduces the same numbers by construction, not by
assumption):** `BEAT1/2/3` (72/104/96), the full exit-cascade offsets,
`HANDOFF`, `CHECK_STROKE_W` (2.26667), `JUMP_H/OVERSHOOT_H/LEAN/STRETCH/
SQUASH`, shadow scale/opacity ranges, air-flow visibility windows and
amplitude, the ribbon gleam's trim-window technique, the ONE-PEN sequential
green-line technique and its `SWEEP_VS_SCRIBBLE = 1.4` pacing constant, all
`A1`/`A2`/`A3`/`SHADOW_D` path data, the SPIN_UP handoff-continuity technique.

**Corrected in this lineage (carried forward from 4obq, not from dzbr):**
the ONE-PEN sequential green-line draw (ribbon reversed to left-tip pen
order, swoosh chains off its end with length-proportional durations) — dzbr/
h3oo/6v93 ship the earlier simultaneous-radiating build.
