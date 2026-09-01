# Payment Confirmation — Story (3 chapters) — 4pik — How It's Animated

`scripts/build-paymentconfirmation-story-three-4pik.mjs` →
`public/projects/paymentconfirmation-story-three-4pik/scene-1/lottie.json`.
538f @ 60fps (was 558f — see Edit 1 below): a 322f intro (waiting →
confirmation → celebration launch) handing off into a 216f endless
celebration loop (`markers: intro[0,322), loop[322,538)`).

## Edit 1 (this session): anchor the mascot's entrance to visibility, not to the pen-lift

Designer note: "the mascot still reads as arriving after the green line,
because his anticipation happens below the frame where nobody sees it — he
only becomes visible at frame 256, the exact frame the pen lifts. Anchor it
on visibility instead: he should clear the bottom edge around frame 236,
while the swoosh still has a third left to draw... Shift his whole entrance
earlier by about twenty frames — landing included — keeping the landing just
after the spark. He must be visibly in frame, rising, at the moment the
swoosh is two-thirds drawn."

Measured before touching anything: the shipped rig's launch keyframe
(`ANTIC_END`) really was pinned exactly to `DRAW_END` (256, the pen-lift) —
but a direct frame-edge crossing test (dense-sampling `mascot-root`'s
position track against the mascot's own body-top offset) showed the body
didn't actually clear the visible frame edge until **`ANTIC_END + 34`**
(≈290), not at `ANTIC_END` itself. The keyframe landed on the pen-lift; the
easing between it and the overshoot peak (`exitAccelerate`, a near-zero
start slope) kept nearly all of the vertical travel parked in the back half
of the 50f rise, so the pen-lift and the mascot's actual appearance read as
two separate beats ~34 frames apart — exactly the designer's complaint.

Two changes, both minimal:
1. **`VISIBILITY_LEAD = 20`**: `ANTIC_END` is now `DRAW_END - VISIBILITY_LEAD`
   (236) instead of `DRAW_END` — the whole entrance chain (`ANTIC_START`,
   `ANTIC_END`, `RISE_END`, `LAND_END`, and therefore `T`/`OP`) is DERIVED
   from this one constant, so it all shifts ~20f earlier together, per
   "shift his whole entrance earlier by about twenty frames — landing
   included." Nothing else in the timeline (badge pop, ribbon/swoosh draw,
   spark pop) moved — those are all computed forward, independent of the
   mascot, same as before.
2. **The `ANTIC_END → RISE_END` launch segment's ease swaps `exitAccelerate`
   → `settleSoft`** on the position track (rotation's small counter-twist on
   this segment was left untouched — it doesn't affect frame-edge crossing
   and the ask didn't call for it). `mascotScaleKfs()` already used
   `settleSoft` here, so this brings position into line with what scale was
   already doing, rather than introducing a new easing family. A fast
   liftoff that decelerates into the overshoot peak (gravity slowing the
   ballistic rise) is also the more physically correct read for a jump's
   takeoff than a slow-building rocket start.

Re-measuring the same frame-edge crossing test after the change: the body
now clears the visible edge at `ANTIC_END + 2` (238), which — with the 20f-
earlier anchor — lands a couple of frames before the swoosh's own last third
begins (`DRAW_END - LAST_THIRD` = 239) and well before the swoosh finishes
(256). Rendered confirmation below.

`T` moved 342 → 322 (−20f) and `OP` 558 → 538 (−20f) with it; the loop's own
216f span and every one of its internal tracks (sparkle rotation, shadow,
air-flow, bounce amplitudes) are byte-for-byte unchanged, only shifted by
the same −20f `T` moved by — confirmed by re-running `check-motion.mjs` and
`check-loop-seam.mjs` (below) and by the total keyframe count staying at
354 (no tracks added or removed, only retimed/re-eased).

**Rendered and read this edit:**
- `219/226/232/236/239/246/254/256`: no mascot through 234, a first sliver
  of the head breaking the bottom edge at 238 (`--zoom 2` confirms: nothing
  at 234/236, visible at 238, clearly visible and rising by 240/242/244) —
  while the swoosh is still mid-last-third (finishes at 256). At 256 itself
  (the pen-lift, previously the frame he first became visible), he now reads
  clearly mid-rise, already in frame — the fix's core claim, confirmed.
- `231` (swoosh ≈ half drawn, unaffected by this edit): mascot still fully
  absent — the "never cover the swoosh while it's still drawing" contract
  from the original brief holds; the entrance shift only pulled him earlier
  into the swoosh's LAST third, not into its first half.
- `0/72/140/176/206`: beats 1–2 and the badge pop/exit cascade pixel-
  unchanged (these don't depend on the mascot's timeline at all).
- `300/308/322/349/376/403/430/537`: the rise/land arc and full loop read
  consistently at the new, earlier frame numbers — landing at 322 (=new T),
  loop bounces and staggered sparkle rotation scrub cleanly, 537 (≈op-1)
  matches the T rest pose.
- `349/363/376` at `--zoom 3` (new loop's first peak/mid-descent/landing):
  air-flow marks absent at the stretched peak (349), present mid-descent
  (363), absent again at the squashed landing (376) — unchanged from before
  the edit, since none of the loop's own tracks were touched. Eyes hold the
  identical arc shape at all three.

**Mechanical gates after this edit:**
- `node scripts/check-motion.mjs paymentconfirmation-story-three-4pik` →
  exit 0 (unchanged output — same 108f scene clock, same +0.99 air-flow
  correlation, same one declared contact pair at 0.00px, same declared
  blink exception — retiming/re-easing the entrance doesn't touch any of
  those measurements).
- `node scripts/check-loop-seam.mjs paymentconfirmation-story-three-4pik` →
  exit 0, frames **322 vs 538** pixel-identical.

**Aliveness Contract, scoped to what changed:** no tracks were added or
removed (354 keyframes before and after) — only `ANTIC_END`'s formula and
one easing reference changed. Amplitude is untouched (`PARK_DY`,
`OVERSHOOT_H`, `JUMP_H`, `STRETCH`/`SQUASH` all unchanged), so nothing
shrank. Effort stays phase-locked: the landing squash still lands exactly
at `LAND_END` and the overshoot stretch still lands at `RISE_END` (both
just retimed together, not decoupled). Held/worn parts and the badge/
mascot assemblies are untouched by this edit — this was a pure retime +
one easing swap on the mascot-root position track, scoped exactly to the
entrance the designer flagged.

## This run (original build): re-verification, not re-invention

The section below is the historical record of the scene's first authoring
pass, accurate for that build — its `T=342`/`OP=558` and every frame number
built off them describe the pre-Edit-1 timeline. Every number up through
`DRAW_END=256` (badge pop, ribbon draw, swoosh draw) is still exactly
correct post-edit, since Edit 1 only touched the mascot-launch-onward
constants (`ANTIC_END` onward); see Edit 1 above for the current numbers
(`T=322`, `OP=538`).

The three source SVGs attached to this brief
(`assets/paymentconfirmation-story-three-4pik{,-2,-3}.svg`) are
**byte-identical** (md5-diffed before authoring) to the
zezm/h3oo/6v93/4obq/dzbr/wyga field tests. The brief text is the same story,
already built and field-tested six times — compared line by line against the
prompt (not assumed from slug/file similarity) and it matches zezm's
round-3 (final) brief and wyga's/4obq's/dzbr's own briefs specifically:
ticks are pure decals with no pass-accent, air-flow marks show only on the
descent (never the rise, on both the loop bounces and the beat-3 entrance),
eyes keep their exact drawn shape via counter-scale, and — the detail that
matters most for THIS lineage — the entrance/gesture-overlap wording
("Overlap them, never queue them... no frame where the stroke has finished
and the next action has not begun") is wyga's own brief language verbatim,
the exact text that drove wyga's two rounds of edits.

**Base script: wyga, not 4obq/dzbr/h3oo/6v93/zezm directly.** wyga is the
most current, twice-edited descendant in this lineage:
- 4obq established the ONE-PEN sequential-draw fix (ribbon reversed to
  left-tip pen order, chained directly into the swoosh with
  length-proportional durations) — promoted into `motion-taste.md`'s
  connected-line bullet.
- wyga's own **Edit 1** fixed the mascot's rise starting too early and
  climbing straight over the still-drawing swoosh — the green line's timing
  is now computed forward, independent of the mascot, and the mascot's
  anticipation is derived FROM the swoosh's `DRAW_END` instead of the other
  way around.
- wyga's own **Edit 2** fixed the pen-finish → jump handoff reading as two
  separate events instead of one overlapping phrase — anticipation now
  starts in the swoosh's own last third (`ANTIC_START = DRAW_END -
  LAST_THIRD`), and the rise's target curve starts changing on the exact
  frame the pen runs out (`ANTIC_END = DRAW_END`), with the spark popping at
  the same handoff so something is always resolving on stage.

This brief's own wording bakes in both fixes explicitly ("his anticipation
begins while the pen is still drawing the swoosh's final third," "Overlap
them, never queue them"), which is exactly what wyga's corrected rig
implements — dzbr/h3oo/6v93/zezm predate one or both fixes and are not the
right base for a brief phrased this way.

Diffed against wyga's script directly: the only functional differences are
the `SLUG` string and the header-comment provenance notes — confirmed with
`diff`.

## Numeric re-derivation, not narrative re-derivation

Per "porting is not authoring," every constant was re-checked against this
brief's own text and the CURRENT skill references before shipping:

- **`player-contract.md`**: the opacity-does-not-cascade-through-`parent`
  note (precomp-wrapped badge pop) and the Export Compatibility section
  (Merge Paths do not survive the HTML export) are both present, unchanged
  since wyga's run. The script's `precompFromLayers()` badge wrapper and the
  zero-Merge-Paths ribbon gleam both honor it.
- **`motion-taste.md` Aliveness Contract**: re-read in full this session;
  gates still number 1–19, unchanged since wyga's run — no uncommitted diff
  on this file. Verified fresh against this build's own output (table
  below), not inherited from wyga's recorded exit code.
- **`chapterization-transition-grammar.md`**: carries an uncommitted diff
  this session, but it is exactly the "arrival must not eclipse a gesture" /
  "overlap, never queue" clause that wyga's Edit 2 already implements
  (confirmed via `git diff` — the addition documents the fix wyga's session
  produced, not a new requirement). The sequence checklist (diff the assets
  first, first frame = first artwork, last frame = last artwork) is
  satisfied; no ambient/tiled field in this scene.
- **`recipe-companion-bubble.md`**: no uncommitted diff. This scene has NO
  speech bubble, tooltip, or text layer of any kind — only its "Intro +
  Loop" marker/idle-alive-from-frame-0 mechanism applies. The HARD CONTRACT
  items about a bubble text layer, `autoFit`, a `.textPos` slot, and the
  bubble-entrance HOUSE CONSTANTS are inapplicable by construction —
  declared here rather than silently skipped, same precedent as
  h3oo/6v93/4obq/dzbr/wyga.
- **Mechanical gates**: `check-motion.mjs` and `check-loop-seam.mjs` were run
  fresh against THIS build's output — both exit 0, reported below.
- **Numeric re-derivation**: the hand's rest angle, its total sweep to the
  check's arm angle, the badge/hub/mascot pivots, and the park depth are all
  computed at build time from the parsed SVG geometry (`atan2`, `bbox`)
  exactly as before — since the source geometry is byte-identical, these
  values reproduce exactly (confirmed by the build log: `hand rest -44.7deg
  -> check arm 299.3deg, total sweep 1064.0deg`, `badge center
  128.40315999999999,128.003655`, `T=342 OP=558`, matching wyga's own build
  log exactly).

## Verification this run

- `node scripts/check-motion.mjs paymentconfirmation-story-three-4pik` →
  exit 0. Scene clock 108f (`mascot-root`); `mascot-airflow-rig` correlates
  +0.99 to it. One contact pair checked (`ribbon-sweep` ↔ `mascot-ribbon`,
  0.00px, declared). Blink gate reads `mascot-eyes` bottoming at 94% —
  declared as a motion exception quoting the brief.
- `node scripts/check-loop-seam.mjs paymentconfirmation-story-three-4pik` →
  exit 0, frames 342 vs 558 pixel-identical; loop confirmed moving from its
  first beat.
- Rendered and read (via the Read tool, as images):
  - `0/20/40/60/72/100/140/176`: badge only through beats 1–2, ticks
    identical across all frames. Frame 100 shows the hand already collapsed
    into a stub; frame 140 shows the check's line partially drawn with
    nothing of the clock left; frame 176 shows the completed check holding.
  - `108/116/120/124/132/144/164/176`: the exit cascade in detail — hand at
    108 still full-length at the accelerated angle; by 116 it has collapsed
    into a stub with the ticks fading; by 120 the disc is blank (hub about
    to pulse); 124 shows the hub's absorb-pulse; 132 shows the disc fully
    clear with the check's pen already down (left stub); 144/164 show the
    check drawing to completion and holding. Nothing of the clock survives
    past 132, well before the check's line reaches the middle of the face.
  - `176/186/196/206/216/226/236/246`: badge pop-fade (opaque at 176,
    translucent by 186, essentially gone by 226) racing the green line's
    single continuous draw — pen down at the ribbon's far LEFT at 186,
    sweeping right, ribbon complete and the swoosh picking it up by
    ~206–216, spark landing at the end by ~254–256.
  - `231` (swoosh ≈ half drawn): confirmed the mascot is NOT on stage — the
    stroke is fully legible on an empty canvas.
  - `226/239/246/254/256/262/270/280`: the swoosh's last third drawing
    through the pen-lift and spark pop, with no part of the mascot visible
    yet (he is still below frame at 280 — his rise only starts changing at
    `ANTIC_END=256`, and the low overshoot amplitude keeps him below the
    visible frame for the first ~30 frames of the rise, per wyga's own
    verified timeline).
  - `270/285/299/313/326/342`: the mascot's rise/land arc — first visible
    around 299 (mid-rise, air-flow marks present), overshoot peak-adjacent
    at 313 with air-flow marks streaming, landing settle at 326 with no
    air-flow marks, resting at 342 (=T).
  - `342/369/396/423/450/477/504/557`: the loop's first beat genuinely peaks
    — sparkle clusters burst in a staggered rotation across the scrub, never
    in unison. Frame 557 (≈ `op-1`) reads as the same rest pose as 342,
    matching the seam.
  - `299/313/326` at `--zoom 3`: air-flow marks absent at the stretched peak
    (299), present mid-descent (313), absent again at the squashed landing
    (326) — exactly the brief's "nothing during the rise... only as he drops."
    The eyes hold the identical "⌣⌣" arc shape and proportions at both
    extremes while the body clearly differs (taller/narrower vs
    shorter/wider), confirming `eyeCounterScale()`.
  - `0` (badge alone, zoomed): no part of the mascot assembly, including the
    air-flow marks, grazes the bottom edge — `PARK_DY` derived from the
    whole subtree's topmost geometry holds.
- Total keyframe count across all animated tracks: 354 — matches wyga
  exactly (identical geometry, identical timing), comfortably in the
  "hundreds, not dozens" range the Living-idles bar asks for.

## Aliveness Contract — gate table

| # | Gate | Measured | Verdict |
|---|---|---|---|
| 1 | Nothing inert | Every element on stage carries a track: badge breathe (1.8%), hand sweep (1064° total), hub absorb+exit, ticks retract-only (no pulse — brief: "do not swell, brighten, pulse"), check trim-draw, mascot jump/lean/squash, air-flow rotation+opacity, eyes counter-scale, shadow scale+opacity, sparkle bursts, swoosh/spark carry a slow ambient breathe (100→96→100%) even while "resting" per the brief | PASS |
| 2 | Amplitude, not keyframe count | mascot-root loop Y 20px, rotation 12° peak-to-peak, scale 10–11%; shadow scale 31%, opacity 36%; air-flow rotation 20°; hand rotation 1064° total sweep — measured by dense-sampling the shipped JSON | PASS |
| 3 | Meaning drives behaviour | Clock hand sweeps mechanically (a mechanism); ticks are inert decals that hold still (brief-literal); check draws pen-order; mascot bounces with anticipation/overshoot/squash (a living body) | PASS |
| 4 | Mood governs the system | Beats 1–2: slow, linear, mechanical (a waiting clock). Beat 3 loop: 54f landing beats, JUMP_H=20px, snappy `expressivePop`/`exitAccelerate` accents — an energetic celebration | PASS |
| 5 | Fluidity | Hand sweep (only true continuous hero track): 1.00× peak/median (linear through beat 1). Bounce tracks: high ratios expected and exempt — a landing hold + a fast mid-air arc is a named "deliberate accent" exemption | PASS |
| 6 | Accents resolve | Hub absorb-pulse half-cycle ~5f+7f; shadow/badge-pop accents span 12–30f — all ≥ the ~4f/0.4s floor | PASS |
| 17 | Blinks close | N/A — eyes never blink; the counter-scale that cancels the body's squash is declared in `controls.json.motionExceptions` quoting the brief | DECLARED |
| 7 | Loop seam | `check-loop-seam.mjs` exit 0, 342 vs 558 pixel-identical | PASS |
| 18 | Ink follows the pen / scale pivots on artwork | Check path reversed to left-tip pen order before trim; the ribbon is reversed to left-tip pen order and the swoosh chains off its end (ONE pen, sequential); every scaling layer pivots at its own bbox center in absolute SVG space | PASS |
| 19 | Opening frame is the brief's opening | Frame 0 renders the badge alone; mascot parked at `PARK_DY = H+6 - armsBox.minY` below frame, derived from the whole subtree's topmost geometry (air-flow marks) — confirmed by direct render, no part of the assembly grazes the bottom edge | PASS |
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
reason; exit 0. `check-loop-seam.mjs`: 342 vs 558 pixel-identical, exit 0.

## Constants independently re-derived vs. inherited (summary)

**Re-derived (computed at build time from the current SVGs, verified this
session, not hand-typed):** badge/hub/mascot pivots and bboxes, the hand's
rest angle (-44.7°) and total sweep to the check's arm angle (1064.0°),
the texture tile size, the ribbon/swoosh geometry and their derived boxes,
`PARK_DY`.

**Verified unchanged (byte-identical source geometry + word-identical brief,
so re-deriving reproduces the same numbers by construction, not by
assumption):** `BEAT1/2` (72/104), the full exit-cascade offsets, `HANDOFF`,
`CHECK_STROKE_W` (2.26667), `JUMP_H/OVERSHOOT_H/LEAN/STRETCH/SQUASH`, shadow
scale/opacity ranges, air-flow visibility windows and amplitude, the ribbon
gleam's trim-window technique, the ONE-PEN sequential green-line technique
and its `SWEEP_VS_SCRIBBLE = 1.4` pacing constant, the anticipation-in-the-
last-third / rise-takes-over-at-DRAW_END handoff (wyga's Edit 2), all
`A1`/`A2`/`A3`/`SHADOW_D` path data, the SPIN_UP handoff-continuity
technique. Beat 3's own length (`T=342`, `OP=558`) is DERIVED from these
timings, not hand-picked — it reproduces wyga's post-edit value exactly
because every input to the derivation is unchanged.

**Base lineage:** wyga (not 4obq/dzbr/h3oo/6v93/zezm directly) — the only
descendant in this family carrying both the ONE-PEN sequential-draw fix
(4obq) AND the overlap-not-eclipse entrance timing fix (wyga's own Edit 1 +
Edit 2), which this brief's wording specifically calls for.
