# three-illustrations-one-3ndo — animation learnings

`scripts/build-three-illustrations-one-3ndo.mjs` →
`public/projects/three-illustrations-one-3ndo/scene-1/lottie.json`.
488f @ 60fps: a 272f intro (waiting → confirmation → celebration launch)
handing off into a 216f endless celebration loop
(`markers: intro[0,272), loop[272,488)`).

## This run: same story, a new slug, and one inherited defect fixed

The three source SVGs (`assets/three-illustrations-one-3ndo{,-2,-3}.svg`,
named `Confirmation-Pending.svg`/`Confirmation-Checked.svg`/`AllSet.svg` in
the prompt) are the same artwork as the whole `paymentconfirmation-story-
three-*` family — diffed whitespace-normalized against `-0dot`'s and
`-4obq`'s sources before authoring: every differing digit is sub-0.01px
export noise (e.g. the east tick's endpoint reads `198.044` here vs
`198.045` there), confirmed to have no visible effect. This brief's own
choreography text is a close paraphrase of the same story (waiting →
accelerating handoff with an exit cascade → a one-pen ribbon/swoosh/spark
gesture overlapping the mascot's rise → a landing-synced first firework →
an endless bounce loop), so `-0dot`'s script (the most recently re-derived
sibling) was used as the geometry/technique reference.

**Per "porting is not authoring," geometry was not hand-copied.** Every path
`d` string in `A1`/`A2`/`A3`/`SHADOW_D` was re-extracted this run directly
from `assets/three-illustrations-one-3ndo{,-2,-3}.svg` by element id (a
one-off `grep`-by-id script, not transcribed from `-0dot`'s file), so this
build's geometry constants trace to THIS run's own source files.

### The brief's own distinguishing clauses, checked against the shipped rig

- **"The two badge artworks are NOT the same geometry — build one badge from
  the first and hold it, never crossfade."** Confirmed by reading both
  files: asset 1's badge is a double-ring, 2.26667px-stroke, 256×256 disc;
  asset 2's own badge (`Stroke 6`) is a single-ring, 1.39256px-stroke,
  257×256 disc — genuinely different geometry, exactly as the brief warns.
  Asset 2 contributes ONLY its checkmark path (`Stroke 8`) to the scene,
  reversed to pen order and brought into asset 1's own stroke-weight family
  (2.26667px) — asset 2's ring/disc/pattern are never built, and the badge
  that carries beats 1-2 is asset 1's, held and popped once, never
  crossfaded with anything.
- **"Only the body and its white face morph."** Matches the existing
  `eyeCounterScale()` design exactly: the eyes (`mascot-eyes`) are children
  of `mascot-root` but invert its squash/stretch at every one of its own
  keyframes (product 100% throughout), so their drawn arcs never distort;
  only `mascot-outline` (body) and `mascot-belly` (white face) inherit the
  parent's squash/stretch untouched.
- **"when the pen lifts, the finished check stamps home"** — motion-taste's
  "a completed gesture gets punctuation" clause, in this brief's own words.
  See the fix below.
- **"the first firework bursts the moment he lands"** — matches `-0dot`'s
  already-shipped fix: sparkle cluster A's whole 36f-period grid anchors at
  `LAND_END` (258), not `T` (272), so a burst opens on the landing frame
  itself instead of waiting for the loop marker (chapterization's "accents
  tied to an event fire AT the event").
- **"the pale ribbon left to right, straight on into the bright swoosh, the
  spark last like the pen lifting"** and **"The mascot rises into view while
  the pen is still drawing"** — matches the existing one-continuous-pen
  sequence (ribbon trim-draws first, the swoosh tube picks the line up where
  the ribbon ends, the spark pops as the pen lifts) overlapping the mascot's
  entrance, per chapterization's "an arrival must not eclipse a gesture that
  is still drawing."
- **Timeline seconds**: this brief gives no explicit per-beat second counts
  (unlike `-0dot`'s brief), only "about a turn and a half" for beat 1 and
  "~216 frames" for the loop. `BEAT1/2/3 = 72/104/96` (`T=272`) are REUSED
  from the field-tested siblings as the reasonable default for the same
  described content — checked against this brief's own pacing language
  (steady/mechanical wait, an accelerating handoff, a cascade, a launch),
  not blindly copied.

### The fix — the check never actually stamped

`-0dot`'s own header comment claimed "the punctuated check stamp" was
shipped, quoting the same motion-taste rule this brief states directly. It
was not: `checkLyr` had no `s` override at all — a flat trim-draw that
simply stopped at 100% with no settle. The comment asserted compliance the
code never delivered, exactly the trap "porting is not authoring" warns
about (an inherited claim, unverified, carried scene to scene).

Fixed here: `checkStampAnim()` gives the finished check a 2-3% overshoot
(`100% → 103% → 100%`) on its own bbox center — `CHECK_C`, computed from
`bbox([CHECK_SEG])` — keyed `CHECK_END+4` (peak) and settled by
`CHECK_END+10`, two frames clear of `POP_START` so the check's own
punctuation never competes with the badge's pop for the same frame. Because
`checkLyr` previously had no `p`/`a` override (default `[0,0,0]`, safe only
because it never animated scale), the fix also had to set
`p = a = CHECK_C` — per gate 18, an un-pivoted scale on absolute-space
geometry paints the artwork at the canvas corner; verified visually (zoomed
164/168/174: the check is measurably larger at 168, back to rest by 174, no
positional drift).

### A second inherited number that didn't hold up: the keyframe count

`-0dot`'s doc reports "1028" total keyframes. A fresh, generic scan of
`-0dot`'s own shipped `lottie.json` (every `{a:1, k:[...]}` track, summed)
returns **366**, not 1028 — the doc's figure was never re-verified against
the file it described. This build's own scan: **370** keyframes across
**37** animated tracks (366 + the new 4-keyframe check-stamp track) —
consistent with "the same rig plus one new track," and it is this run's own
freshly-measured number, not a carried-forward one.

## Verification this run

- `node scripts/check-motion.mjs three-illustrations-one-3ndo` → exit 0.
  Scene clock 108f (from `mascot-root`); `mascot-airflow-rig` correlates
  +0.99 to it. One contact pair checked (`mascot-eyes` ↔ `ribbon-sweep`,
  0.00px, declared). Blink gate reads `mascot-eyes` bottoming at 94% —
  declared as a motion exception quoting this brief ("Only the body and its
  white face morph").
- `node scripts/check-loop-seam.mjs three-illustrations-one-3ndo` → exit 0,
  frames 272 vs 488 pixel-identical, and the "moving from its first beat"
  check passes.
- Rendered and READ: frame 0 (badge alone, mascot fully offscreen, ticks
  intact — matches "Open on the clock badge"); 36/72 (hand sweeping
  linearly, ticks static); 120/128/132/148/164 (exit cascade — pin alone,
  pen down, pin gone, mid-draw, check complete); 164/168/174 zoomed 3× (the
  new check stamp — visibly larger at 168, settled by 174, no drift);
  186/206 (badge pop-fade clears while the pen is already drawing);
  190/200/210/220/230/240 zoomed 2× (the pale ribbon draws left to right
  into the brighter swoosh as ONE gesture; the mascot's silhouette first
  crosses into view at ~210, well before the stroke finishes at ~256 —
  arrival does not eclipse the still-drawing gesture); 236/258/272 (beat-3
  entrance: air-flow marks present mid-descent, a small spark already
  opening at the landing frame 258, bright through `T`); 254/258/264/272 (no
  silent-sky gap between landing and the first firework); 272-488 full loop
  scrub at 12 points (three sparkle clusters burst in a staggered rotation;
  lean alternates; shadow tracks the landing X position, visible as a faint
  hatch under the mascot — confirmed by zooming 326/380, both landings);
  frame 488 reads as the same picture as 272.
- Total keyframes: 370 across 37 animated tracks (measured this run, see
  above) — within the "hundreds, not dozens" Living-idles bar.

## Aliveness Contract — gate table

| # | Gate | Measured | Verdict |
|---|---|---|---|
| 1 | Nothing inert | Badge breathe (1.8%), hand sweep (1064° total), hub absorb+exit, ticks retract-only (decal default — brief never animates them), check trim-draw + NEW stamp-settle, mascot jump/lean/squash, air-flow rotation+opacity, eyes counter-scale, shadow scale+opacity tracking landing X, sparkle bursts (landing-anchored first burst), swoosh/spark ambient breathe (100→96→100%) at rest | PASS |
| 2 | Amplitude, not keyframe count | mascot-root loop Y 20px (198.084→218.084), rotation 12° peak-to-peak (±6°), scale 96–110%/88–106%; shadow scale 70–114%, opacity 0–96%; air-flow rotation ±10°; hand total sweep 1064°; sparkle-A scale 0→112%; check-mark stamp 100→103% — all measured by dense-sampling the shipped JSON, not assumed | PASS |
| 3 | Meaning drives behaviour | Clock hand sweeps mechanically; ticks are inert decals; check draws pen-order AND now punctuates on completion; mascot bounces with anticipation/overshoot/squash; the first firework ties to the physical landing, not to playback structure | PASS |
| 4 | Mood governs the system | Beats 1–2: slow, linear, mechanical (7.5°/f steady sweep). Beat 3/loop: 54f landing beats, JUMP_H=20px, snappy `expressivePop`/`exitAccelerate` accents — an energetic celebration | PASS |
| 5 | Fluidity | Hand sweep (hero track, beat 1): linear per brief, ~1.0× peak/median. Handoff solved for continuous velocity (7.50→13.10deg/f, start slope 0.573 — no stall). Bounce tracks: exempt one-shot/accent motion | PASS |
| 6 | Accents resolve | Hub absorb-pulse ~5f+7f; NEW check stamp 4f rise + 6f settle; shadow/badge-pop accents 12–30f — all ≥ the ~4f half-cycle floor | PASS |
| 17 | Blinks close | N/A — eyes never blink; counter-scale holding the drawn arcs constant is declared in `controls.json.motionExceptions` quoting this brief | DECLARED |
| 7 | Loop seam | `check-loop-seam.mjs` exit 0, 272 vs 488 pixel-identical | PASS |
| 18 | Ink follows the pen / scale pivots on artwork | Check path reversed to left-tip pen order; ribbon reversed to left-to-right; swoosh drawn pen-order via `tubeBuilder.at(p)`; every scaling layer (including the NEW check-mark stamp) pivots at its own bbox center in absolute SVG space | PASS |
| 19 | Opening frame is the brief's opening | Frame 0 renders the badge alone; mascot parked at `PARK_DY` derived from the whole subtree's topmost geometry (air-flow marks), confirmed by direct render | PASS |
| 8 | Parts articulate | Hand, hub, ticks, check (now with its own stamp track), eyes, air-flow rig, body, belly, shadow, sparkles, ribbon, swoosh, spark each carry independent tracks relative to their parent | PASS |
| 9 | Held objects live | N/A — nothing is held; ribbon/swoosh/spark are declared stage-fixed decoration (sequence-checklist default: rest where the source draws them) | DECLARED |
| 10 | The body breathes | Badge: continuous 1.8% breathe through beats 1–2. Mascot: continuous squash/stretch through every loop beat | PASS |
| 11 | Effort is phase-locked | Squash lands exactly at ground contact, stretch/overshoot at the airborne peak — verified by rendering the extremes (299 stretched, 326 squashed) | PASS |
| 12 | No double-driven property | Each property animated once down any parent chain; badge pop/fade on the outer precomp only, badge breathe on the inner null only; check stamp lives only on `check-mark`, not duplicated on `badge-root` | PASS |
| 13 | Assemblies stay whole | Badge (disc, texture, rings, ticks, hub, hand, check) is one precomp, one root null — pops and fades as one mass | PASS |
| 14 | Contacts hold | `check-motion.mjs`: 1 contact pair, 0.00px, declared | PASS (declared) |
| 15 | Occupant reads | N/A — no character-inside-a-shell in this artwork | N/A |
| 16 | Occupant belongs to body | N/A — same reason | N/A |

`check-motion.mjs` and `check-loop-seam.mjs` both exit 0 (output reproduced
above). `controls.json` carries the same `layerControls` as the sibling
scenes plus `motionExceptions` reworded to quote THIS brief's own text
rather than a different sibling's.
