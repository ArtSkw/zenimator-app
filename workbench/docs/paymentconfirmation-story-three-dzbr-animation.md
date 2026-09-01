# paymentconfirmation-story-three-dzbr — animation learnings

`scripts/build-paymentconfirmation-story-three-dzbr.mjs` →
`public/projects/paymentconfirmation-story-three-dzbr/scene-1/lottie.json`.
488f @ 60fps: a 272f intro (waiting → confirmation → celebration launch)
handing off into a 216f endless celebration loop
(`markers: intro[0,272), loop[272,488)`).

## This run: re-verification against a word-for-word matching brief

The three source SVGs attached to this brief
(`assets/paymentconfirmation-story-three-dzbr{,-2,-3}.svg`) are **byte-identical**
(md5-diffed before authoring) to `assets/paymentconfirmation-story-three-zezm{,-2,-3}.svg`,
`-h3oo{,-2,-3}.svg`, `-6v93{,-2,-3}.svg`, and `-4obq{,-2,-3}.svg`. This brief's
own choreography text was compared against the four prior briefs (not
assumed from the slug or file similarity) and matches **zezm's round-3
(final, field-tested) brief and 4obq's own brief specifically**:

- **Ticks are pure decals.** "They do not swell, brighten, pulse, or react to
  the hand in any way" — matches zezm round 3 / 4obq. 6v93's brief explicitly
  asked the pass-accent back; this brief does not, so `badge-ticks` carries
  no per-tick swell here either.
- **Air-flow marks trail the descent only**, on both the loop bounces and the
  beat-3 entrance: "nothing during the rise... they show only as he drops
  from the overshoot into his landing... Same rule on his entrance." Matches
  zezm/4obq. 6v93's brief asked for visibility through the whole airborne arc
  — inapplicable here.
- **Eyes keep their exact drawn shape, counter-scaled against the body**:
  "they never squash, stretch, or squint... their own scale has to cancel
  the body's out." This is zezm's/4obq's `eyeCounterScale()` verbatim. h3oo's
  and 6v93's briefs asked for a landing *squint* instead — inapplicable here.
- **Timeline seconds match exactly**: waiting ~1.2s, confirmation ~1.7s,
  celebration ~1.6s, loop ~216f — reproduces the shipped
  `BEAT1=72 · BEAT2=104 · BEAT3=96 → T=272, LOOP=216, OP=488` to the frame.

## Base script: 4obq, not zezm directly

Built from `scripts/build-paymentconfirmation-story-three-4obq.mjs` (slug
swapped, header comments extended) rather than zezm's script directly,
because 4obq's is the more current, export-safe descendant in this
lineage — it already carries two corrections zezm's own file never got:

1. **Stale absolute-frame comments fixed.** zezm's script has leftover
   comments (`// 252` next to a `T` that actually computes to `272`, `//
   156` next to an `ANTIC_START` that computes to `176`) from an earlier
   revision of `BEAT2` that was never updated after the formula-driven
   values shifted. The *values* were always correct (computed from
   `BEAT1+BEAT2+BEAT3`, never hand-typed); only the comments drifted. 4obq's
   script has the corrected comments; this script inherits them.
2. **The ribbon gleam is a trim-window sweep, not a Merge-Paths intersect.**
   zezm's `ribbon-sweep` used stacked white bands clipped to a flattened
   ribbon copy via `ty:'mm'` (Merge Paths) — renders correctly in this
   Skottie preview but does **not** survive the HTML export
   (`exportLottieHtml`'s lottie-web compatibility pass has no translation for
   Merge Paths, so lottie-web paints the raw clipping bands — hard-edged
   slabs, visible from frame 0 because a path track holds its first keyframe
   backwards in time). 4obq rebuilt it with **zero boolean ops**: three
   low-alpha white strokes riding the ribbon's own path, sharing one trim
   window that travels the path length (`GLEAM_IN`/`GLEAM_OUT`, 18% window,
   `travelBal` pacing). This scene ships with the same technique —
   confirmed **zero** `ty:'mm'` nodes in the built JSON. This is exactly the
   priority order `player-contract.md`'s Export Compatibility section now
   documents ("a trim window on the target's own stroke" first, before a
   track matte, before authored geometry).

Diffed against 4obq's script directly: the only functional difference is the
`SLUG` string and the header-comment provenance note — confirmed with `diff`.

## Numeric re-derivation, not narrative re-derivation

Per "porting is not authoring," every constant was re-checked against this
brief's own text and the CURRENT skill references before shipping, not
carried on the strength of the prior scripts' git history:

- **`player-contract.md`**: the opacity-does-not-cascade-through-`parent`
  note (precomp-wrapped badge pop) is present in the tracked reference; the
  script's `precompFromLayers()` badge wrapper matches it. The path-track
  first-keyframe-holds-backwards note (gating the swoosh/spark layer's own
  opacity rather than the trim/path track) is present and honored. The
  Export Compatibility section (Merge Paths do not survive the HTML export)
  is honored by construction — the scene carries none.
- **`motion-taste.md` Aliveness Contract**: re-read in full this session;
  gates still number 1–19 (unchanged since 4obq's run). Verified fresh
  against this build's own output (table below), not inherited from any
  prior scene's recorded exit code.
- **`recipe-companion-bubble.md`**: this scene has NO speech bubble, tooltip,
  or text layer of any kind — only its "Intro + Loop" marker/idle-alive-
  from-frame-0 mechanism applies (section 1). The HARD CONTRACT items about
  a bubble text layer, `autoFit`, a `.textPos` slot, and the bubble-entrance
  HOUSE CONSTANTS are inapplicable by construction — declared here rather
  than silently skipped, same precedent as h3oo/6v93/4obq.
- **`chapterization-transition-grammar.md`**: the sequence checklist (diff
  the assets first, first frame = first artwork, last frame = last artwork,
  every repeatable segment closes on the picture) — all satisfied; there is
  no ambient/tiled field in this scene, so the STRUCTURE-based tile-lap gate
  is not exercised.
- **Mechanical gates**: `check-motion.mjs` and `check-loop-seam.mjs` were run
  fresh against THIS build's output — both exit 0, reported below.
- **Numeric re-derivation**: the hand's rest angle, its total sweep to the
  check's arm angle, the badge/hub/mascot pivots, and the park depth are all
  computed at build time from the parsed SVG geometry (`atan2`, `bbox`)
  exactly as before — since the source geometry is byte-identical, these
  values reproduce exactly (confirmed by the build log: `hand rest -44.7deg
  -> check arm 299.3deg, total sweep 1064.0deg`, `badge center
  128.40316,128.003655`, matching 4obq's own build log exactly).
- **Badge pop vs. green-draw overlap, checked numerically, not just by
  eye.** The brief requires the badge to be "gone before the green stroke
  below is well underway." At `POP_END` (206, when the badge precomp's
  opacity reaches 0), the green swoosh's own pen-progress is only
  `(206-186)/(236-186) = 40%` of TIME through its draw window — but the
  draw is paced with `travelBal`'s S-curve, which is slow at the start
  (numerically sampled: `pace(0.40) ≈ 0.257`), so the actual drawn arc
  length at that frame is closer to **26%**, comfortably "not well
  underway." Verified both by this direct calculation and by rendering
  frames 176/186/196/206/216 and reading the badge-vs-green state at each.

## Verification this run

- `node scripts/check-motion.mjs paymentconfirmation-story-three-dzbr` →
  exit 0. Scene clock 108f (from `mascot-root`); `mascot-airflow-rig`
  correlates +0.99 to it. Blink gate reads `mascot-eyes` at 94% — declared
  (not a blink; the eyes' scale is the exact inverse of the body's
  squash/stretch). One contact pair checked (`ribbon-sweep` ↔
  `mascot-ribbon`, 0.00px, declared — the gleam's clip geometry shares the
  ribbon's static stage position).
- `node scripts/check-loop-seam.mjs paymentconfirmation-story-three-dzbr` →
  exit 0, frames 272 vs 488 pixel-identical.
- Rendered and read (via the Read tool, as images):
  - `0/20/40/60/72/100/140/176`: badge only through beats 1–2, ticks
    identical across all frames (decals, no reaction to the hand), bottom
    edge clean — no part of the mascot assembly grazes the frame edge.
    Frame 140 shows the exit cascade's blank-disc moment (hand/hub/ticks
    already gone, check not yet started); frame 176 shows the completed
    check holding.
  - `108/116/120/124/132/144/164/176`: the exit cascade in detail — hand
    collapsing into the pin (108→120), ticks retracting fast (114→~120,
    `entranceSharp`'s early-heavy ease), hub absorbing and pulsing out
    (120→132), the check's pen going down at 124 and drawing through
    144→164. Nothing of the clock survives past 132, well before the
    check's line reaches the middle of the face (~144).
  - `176/186/196/206/216/226/236/246`: badge pop-fade (opaque at 176,
    visibly translucent by 186, fully gone by 206) racing the green
    line's single continuous draw (ribbon growing left, swoosh drawing
    right from the same origin point) and the mascot's rise into frame —
    by 226/236 the green line is complete and the mascot is at/near the
    overshoot peak with NO air-flow marks; by 246 (into the descent) the
    two thin curved marks appear above his head.
  - `272/285/299/313/326/353/380/407`: the loop's first beat genuinely
    peaks — frame 299 (first PEAK) is visibly stretched-tall with no
    air-flow marks, clearly distinct from frame 272 (the shared boundary
    landing key, squashed) — NOT a frozen first bounce. Sparkle clusters
    burst in a staggered rotation across the scrub, never in unison.
  - `299/313/326` at `--zoom 3`: air-flow marks absent at the peak (299),
    present mid-descent (313), absent again at the landing (326) — exactly
    the brief's "nothing during the rise... only as he drops."
  - `299` vs `326` at `--zoom 5`: eyes hold the identical "⌣⌣" arc shape
    and proportions at both the stretched peak and the squashed landing —
    the body clearly differs (taller/narrower vs shorter/wider) while the
    eyes read as the same drawn shape, confirming `eyeCounterScale()`.
  - `434/461/487`: later loop beats read consistently with the first;
    frame 487 (== `op-1`, the previewer's clamp) reads as the same rest
    pose as 272, matching the seam confirmed numerically by
    `check-loop-seam.mjs`.
  - `0/72/176` at `--zoom 2`: bottom edge clean in all three — confirms
    `PARK_DY` (derived from the whole mascot subtree's topmost geometry,
    the air-flow marks, not just the body bbox) clears the frame with
    margin through both badge beats.

## Aliveness Contract — gate table

Amplitudes below are measured directly from the shipped JSON (a throwaway
node script reading `lottie.json`'s keyframe tracks), not assumed from a
sibling scene's recorded numbers.

| # | Gate | Measured | Verdict |
|---|---|---|---|
| 1 | Nothing inert | Every element on stage carries a track: badge breathe (1.8% scale), hand sweep (1064° total), hub absorb+exit (100%→118%→0%), ticks retract-only (no pulse — brief: "do not swell, brighten, pulse"), check trim-draw, mascot jump/lean/squash, air-flow rotation (20° peak-to-peak)+opacity, eyes counter-scale (22.7% amplitude, cancels the body), shadow scale (44%)+opacity (96%), sparkle bursts (112% overshoot), swoosh/spark carry a slow ambient breathe (100→96→100%) even while "resting" per the brief | PASS |
| 2 | Amplitude, not keyframe count | `mascot-root` LOOP span only: position.y 20px, rotation 12° peak-to-peak, scale 10–11%; `mascot-shadow` scale 31–44%, opacity 36–96%; `mascot-airflow-rig` rotation 20°; `badge-hand-rig` rotation 1064° total sweep — measured by component-wise min/max over each track's own active span, not the naive all-components-flattened range (which falsely inflates position amplitude by mixing x/y/z) | PASS |
| 3 | Meaning drives behaviour | Clock hand sweeps mechanically (linear, a mechanism); ticks are inert decals that hold still (brief-literal — no reaction to the hand); check draws pen-order; mascot bounces with anticipation/overshoot/squash (a living body) | PASS |
| 4 | Mood governs the system | Beats 1–2: slow, linear, mechanical (a waiting clock, 7.5°/f constant). Beat 3 loop: 54f landing beats, `JUMP_H=20px`, snappy `expressivePop`/`exitAccelerate` accents — an energetic celebration, not a calm idle | PASS |
| 5 | Fluidity | Hand sweep (only true continuous hero track): 1.00× peak/median (linear through beat 1, per brief: "linear, no easing"). Bounce tracks: high ratios expected and exempt — a landing hold + fast mid-air arc is a named "deliberate accent" exemption, not a continuous sway | PASS |
| 6 | Accents resolve | Hub absorb-pulse half-cycle ~5f (start→overshoot) + 7f (overshoot→gone); badge-pop/shadow accents span 12–30f — all ≥ the ~4f/0.4s floor | PASS |
| 17 | Blinks close | N/A by brief design — eyes never blink; the counter-scale that cancels the body's squash (holding the eyes' own drawn arcs constant, product 100%) is declared in `controls.json.motionExceptions` quoting the brief, not presented as a blink; `check-motion.mjs` confirms the 94% floor and treats it as declared | DECLARED |
| 7 | Loop seam | `check-loop-seam.mjs` exit 0, 272 vs 488 pixel-identical | PASS |
| 18 | Ink follows the pen / scale pivots on artwork | Check path reversed to left-tip pen order before trim; the swoosh is drawn pen-order (not wiped) via `tubeBuilder.at(p)`; every scaling layer (ticks, hub, sparkles, badge precomp, spark, swoosh, ribbon-gleam strokes) pivots at its own bbox center in absolute SVG space; `check-motion.mjs` raised no DRAW-ON or SCALE/POP PIVOT findings | PASS |
| 19 | Opening frame is the brief's opening | Frame 0 renders the badge alone; mascot parked at `PARK_DY = H+6 - armsBox.minY` below frame, derived from the whole subtree's topmost geometry (air-flow marks), not just the body bbox — confirmed by direct zoomed render at frames 0/72/176, no part of the assembly grazes the bottom edge | PASS |
| 8 | Parts articulate | Hand, hub, ticks, check, eyes, air-flow rig, body, belly, shadow, sparkles, ribbon, swoosh, spark each carry independent tracks relative to their parent | PASS |
| 9 | Held objects live | N/A — nothing is held; ribbon/swoosh/spark are declared stage-fixed decoration per the brief's "everything rests exactly where artwork 3 draws it" | DECLARED |
| 10 | The body breathes | Badge: continuous 1.8% breathe through beats 1–2. Mascot: continuous squash/stretch cycling through every loop beat, never resting flat | PASS |
| 11 | Effort is phase-locked | Squash lands exactly at ground contact (LANDINGS: 272/326/380/434/488), stretch/overshoot at the airborne peak (PEAKS: 299/353/407/461) — verified by rendering the extremes (299 stretched, 326 squashed) | PASS |
| 12 | No double-driven property | Each property animated once down any parent chain; badge pop/fade lives on the outer precomp only, badge breathe stays on the inner null only | PASS |
| 13 | Assemblies stay whole | Badge (disc, texture, rings, ticks, hub, hand, check) is one precomp, one root null — pops and fades as one mass, per the brief's "ONE object... never crossfaded" | PASS |
| 14 | Contacts hold | `check-motion.mjs`: 1 contact pair checked (`ribbon-sweep` ↔ `mascot-ribbon`, 0.00px), declared with a brief-quoting reason | PASS (declared) |
| 15 | Occupant reads | N/A — no character-inside-a-shell in this artwork | N/A |
| 16 | Occupant belongs to body | N/A — same reason | N/A |

## Motion exceptions declared

Same set as the zezm/4obq lineage (unchanged geometry, unchanged brief
language), each quoting this brief's own words:

- `mascot-eyes` (blink-gate exception): "His closed happy eyes keep their
  exact drawn shape and proportions throughout... they never squash,
  stretch, or squint... their own scale has to cancel the body's out."
- Seven `{a, b}` stage-fixed-decoration pairs for
  ribbon/ribbon-sweep/swoosh/spark against outline/belly/eyes/airflow:
  "Everything rests exactly where artwork 3 draws it" — these three green
  pieces arrive once with the launch and then hold their source position
  for the rest of the endless loop while the body bounces near/through
  them; not a held or worn prop.
- `swoosh` ↔ `spark` (entrance-only, brief pop artifact): the swoosh
  reveals by a static-geometry pen-draw while the spark pops around its own
  artwork centre at the draw's end (scale-pivot gate requirement), so their
  shared touching edge drifts a few px during the brief pop.
- `ribbon-sweep` (relative-motion exception): "a glint sweeping a surface
  is relative motion the aliveness contract positively requires"
  (motion-taste.md, contact-weld notes) — the travelling gleam is meant to
  move along the ribbon's surface.

## Constants independently re-derived vs. inherited (summary)

**Re-derived (computed at build time from the current SVGs, verified this
session, not hand-typed):** badge/hub/mascot pivots and bboxes, the hand's
rest angle (-44.7°) and total sweep to the check's arm angle (1064.0°, via
`atan2` + the whole-turns/tangent-continuity solve), the texture tile size,
the ribbon/swoosh geometry and their derived boxes, `PARK_DY`, the badge
pop vs. green-draw overlap timing (checked numerically this session, see
above).

**Verified unchanged (byte-identical source geometry + word-identical
brief, so re-deriving reproduces the same numbers by construction, not by
assumption):** `BEAT1/2/3` (72/104/96), the full exit-cascade offsets,
`HANDOFF`, `CHECK_STROKE_W` (2.26667, re-checked against the badge's own
ring weight), `JUMP_H/OVERSHOOT_H/LEAN/STRETCH/SQUASH`, shadow scale/opacity
ranges, air-flow visibility windows and amplitude, the ribbon gleam's
trim-window technique and `GLEAM_IN/GLEAM_OUT/GLEAM_WINDOW`, all `A1`/`A2`/
`A3`/`SHADOW_D` path data, the SPIN_UP handoff-continuity technique (a
general Skottie easing fix, not a brief-specific number).

**Corrected in this lineage (carried forward from 4obq, not from zezm
directly):** the stale `T`/`ANTIC_START` frame comments, and the ribbon
gleam's export-safe trim-window rebuild (zero Merge Paths).
