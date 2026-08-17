# paymentconfirmation-story-three-4obq — animation learnings

`scripts/build-paymentconfirmation-story-three-4obq.mjs` →
`public/projects/paymentconfirmation-story-three-4obq/scene-1/lottie.json`.
488f @ 60fps: a 272f intro (waiting → confirmation → celebration launch)
handing off into a 216f endless celebration loop
(`markers: intro[0,272), loop[272,488)`).

## This run: re-verification against a word-for-word matching brief

The three source SVGs attached to this brief
(`assets/paymentconfirmation-story-three-4obq{,-2,-3}.svg`) are **byte-identical**
(md5-diffed before authoring) to `assets/paymentconfirmation-story-three-zezm{,-2,-3}.svg`,
`-h3oo{,-2,-3}.svg`, and `-6v93{,-2,-3}.svg`. This brief's own choreography
text was compared line by line — not assumed from the slug or file
similarity — against all three prior briefs, and it matches **zezm's round-3
(final, field-tested) brief specifically**, not h3oo's or 6v93's:

- **Ticks are pure decals.** "They do not swell, brighten, pulse, or react to
  the hand in any way" — matches zezm round 3 (which cut the pass-accent as
  an unwanted effect). 6v93's brief explicitly asked the pass-accent back;
  this brief does not, so `badge-ticks` carries no per-tick swell here either.
- **Air-flow marks trail the descent only**, on both the loop bounces and the
  beat-3 entrance: "nothing during the rise, they show only as he drops from
  the overshoot into his landing... Same rule on his entrance." Matches
  zezm's design. 6v93's brief asked for visibility through the *whole*
  airborne arc (rise and fall) — that reading does not apply here.
- **Eyes keep their exact drawn shape, counter-scaled against the body**:
  "they never squash, stretch, or squint... their own scale has to cancel
  the body's out." This is zezm's `eyeCounterScale()` verbatim. h3oo's and
  6v93's briefs asked for a landing *squint* instead (a different, also
  valid choice for a different brief) — inapplicable here.
- **Timeline seconds match exactly**: waiting ~1.2s, confirmation ~1.7s,
  celebration ~1.6s, loop ~216f — reproduces zezm's shipped
  `BEAT1=72 · BEAT2=104 · BEAT3=96 → T=272, LOOP=216, OP=488` to the frame.

Per "porting is not authoring," every constant was re-checked against this
brief's own text and the CURRENT skill references before shipping, not
carried on the strength of the prior script's git history:

- **`player-contract.md`**: the opacity-does-not-cascade-through-`parent`
  note (precomp-wrapped badge pop) is present in the tracked reference; the
  script's `precompFromLayers()` badge wrapper matches it. The path-track
  first-keyframe-holds-backwards note (gating the swoosh/spark layer's own
  opacity rather than the trim/path track) is also present and honored.
- **`motion-taste.md` Aliveness Contract**: re-read in full this session;
  gates still number 1–19 (unchanged since h3oo's run). Verified fresh
  against this build's own output (table below), not inherited from any
  prior scene's recorded exit code.
- **`recipe-companion-bubble.md`**: this scene has NO speech bubble,
  tooltip, or text layer of any kind — only its "Intro + Loop" marker/
  idle-alive-from-frame-0 mechanism applies (section 1). The HARD CONTRACT
  items about a bubble text layer, `autoFit`, a `.textPos` slot, and the
  bubble-entrance HOUSE CONSTANTS are inapplicable by construction —
  declared here rather than silently skipped, same precedent as h3oo/6v93.
- **`chapterization-transition-grammar.md`**: the sequence checklist (diff
  the assets first, first frame = first artwork, last frame = last artwork,
  every repeatable segment closes on the picture) — all satisfied; there is
  no ambient/tiled field in this scene, so the STRUCTURE-based tile-lap gate
  is not exercised.
- **Mechanical gates**: `check-motion.mjs` and `check-loop-seam.mjs` were run
  fresh against THIS build's output — both exit 0, reported below.
- **Numeric re-derivation, not narrative re-derivation**: the hand's rest
  angle, its total sweep to the check's arm angle, the badge/hub/mascot
  pivots, and the park depth are all computed at build time from the parsed
  SVG geometry (`atan2`, `bbox`) exactly as before — since the source
  geometry is byte-identical, these values reproduce exactly (confirmed by
  the build log: `hand rest -44.7deg -> check arm 299.3deg, total sweep
  1064.0deg`, `badge center 128.4,128.0`, matching zezm's own build log).

One correction made during authoring: zezm's shipped script carries several
**stale absolute-frame comments** next to `T`, `OP`, `ANTIC_START`,
`ANTIC_END`, `RISE_END`, and `LAND_END` (e.g. `// 252` next to a `T` that
actually computes to `272` — a leftover from an earlier revision of `BEAT2`
that was never updated after the formula-driven values shifted). The
*values* were always correct (computed from `BEAT1+BEAT2+BEAT3` etc, never
hand-typed), only the inline comments drifted. Fixed in this script so the
comments match what the code actually computes.

## Verification this run

- `node scripts/check-motion.mjs paymentconfirmation-story-three-4obq` →
  exit 0. Scene clock 108f (from `mascot-root`); `mascot-airflow-rig`
  correlates +0.99 to it. One contact pair checked (`mascot-eyes` ↔
  `ribbon-sweep`, 28.86px, declared). Blink gate reads `mascot-eyes`
  bottoming at 94% — declared as a motion exception quoting the brief (the
  eyes are already-closed arcs that counter-scale to cancel the body's
  squash, not a blink or a squint).
- `node scripts/check-loop-seam.mjs paymentconfirmation-story-three-4obq` →
  exit 0, frames 272 vs 488 pixel-identical.
- Rendered and read: frame 0 (badge only, mascot fully offscreen, ticks
  static — matches the brief's opening sentence), 20–112 (hand sweep, ticks
  identical throughout, badge breathing), 112–164 (exit cascade: hand
  collapses ~112–120, ticks retract ~114–128, hub absorbs+exits ~120–132,
  check draws 124–164 — nothing of the clock survives past 132, well before
  the check's line reaches the middle of the face at ~144), 176–236 (badge
  pop-fade — visibly translucent by 186, gone by ~201, well before the green
  line is far into its own 186–236 draw), 236/244/258 (beat-3 entrance:
  air-flow absent at the overshoot peak, present mid-descent, gone at the
  landing — zoomed and read directly, not inferred from a keyframe list),
  272/285/299/313/326/353/380/407/434/461/487 (full loop scrub — sparkle
  clusters burst in a staggered rotation, lean alternates L/R across peaks,
  frame 487 reads as the same rest pose as frame 272), 299 vs 326 at 5×
  zoom (eye arcs read as the same "⌣⌣" shape and proportions at both the
  stretched peak and the squashed landing — the counter-scale is doing its
  job), 308 at 5× zoom (air-flow marks clearly visible mid-descent, confirms
  they are not a rendering artifact of the sparkle burst nearby).
- Total keyframe count across all animated tracks: 356 — in the "hundreds,
  not dozens" range the Living-idles bar asks for.

## Aliveness Contract — gate table

| # | Gate | Measured | Verdict |
|---|---|---|---|
| 1 | Nothing inert | Every element on stage carries a track: badge breathe (1.8%), hand sweep (1064°), hub absorb+exit, ticks retract-only (no pulse — brief: "do not swell, brighten, pulse"), check trim-draw, mascot jump/lean/squash, air-flow rotation+opacity, eyes counter-scale, shadow scale+opacity, sparkle bursts, swoosh/spark carry a slow ambient breathe (100→96→100%) even while "resting" per the brief | PASS |
| 2 | Amplitude, not keyframe count | mascot-root loop Y 20px, rotation 12° peak-to-peak, scale 10–11%; shadow scale 31%, opacity 36%; air-flow rotation 20°; hand rotation 1064° total sweep — all measured by dense-sampling the shipped JSON, not asserted | PASS |
| 3 | Meaning drives behaviour | Clock hand sweeps mechanically (a mechanism); ticks are inert decals that hold still (brief-literal — this scene's ticks do NOT answer the hand); check draws pen-order; mascot bounces with anticipation/overshoot/squash (a living body) | PASS |
| 4 | Mood governs the system | Beats 1–2: slow, linear, mechanical (a waiting clock). Beat 3 loop: 54f landing beats, JUMP_H=20px, snappy `expressivePop`/`exitAccelerate` accents — an energetic celebration, not a calm idle | PASS |
| 5 | Fluidity | Hand sweep (only true continuous hero track): 1.00× peak/median (linear through beat 1, per brief). Bounce tracks: high ratios expected and exempt — a landing hold + a fast mid-air arc is a named "deliberate accent" exemption, not a continuous sway | PASS |
| 6 | Accents resolve | Hub absorb-pulse half-cycle ~5f+7f; shadow/badge-pop accents span 12–30f — all ≥ the ~4f/0.4s floor | PASS |
| 17 | Blinks close | N/A — eyes never blink; the counter-scale that cancels the body's squash (holding the eyes' own drawn arcs constant) is declared in `controls.json.motionExceptions` quoting the brief, not presented as a blink | DECLARED |
| 7 | Loop seam | `check-loop-seam.mjs` exit 0, 272 vs 488 pixel-identical | PASS |
| 18 | Ink follows the pen / scale pivots on artwork | Check path reversed to left-tip pen order before trim; the swoosh is drawn pen-order (not wiped) via `tubeBuilder.at(p)`; every scaling layer (ticks, hub, sparkles, badge precomp, spark, swoosh, ribbon-sweep bands) pivots at its own bbox center in absolute SVG space | PASS |
| 19 | Opening frame is the brief's opening | Frame 0 renders the badge alone; mascot parked at `PARK_DY = H+6 - armsBox.minY` below frame, derived from the whole subtree's topmost geometry (air-flow marks), not just the body bbox — confirmed by direct render, no part of the assembly grazes the bottom edge | PASS |
| 8 | Parts articulate | Hand, hub, ticks, check, eyes, air-flow rig, body, belly, shadow, sparkles, ribbon, swoosh, spark each carry independent tracks relative to their parent | PASS |
| 9 | Held objects live | N/A — nothing is held; ribbon/swoosh/spark are declared stage-fixed decoration per the brief's "everything rests exactly where artwork 3 draws it" | DECLARED |
| 10 | The body breathes | Badge: continuous 1.8% breathe through beats 1–2. Mascot: continuous squash/stretch cycling through every loop beat, never resting flat | PASS |
| 11 | Effort is phase-locked | Squash lands exactly at ground contact (LANDINGS), stretch/overshoot at the airborne peak (PEAKS) — verified by rendering the extremes (299 stretched, 326 squashed) | PASS |
| 12 | No double-driven property | Each property animated once down any parent chain; badge pop/fade lives on the outer precomp only, badge breathe stays on the inner null only | PASS |
| 13 | Assemblies stay whole | Badge (disc, texture, rings, ticks, hub, hand, check) is one precomp, one root null — pops and fades as one mass, per the brief's "ONE object... never crossfaded" | PASS |
| 14 | Contacts hold | `check-motion.mjs`: 1 contact pair checked (`mascot-eyes` ↔ `ribbon-sweep`, 28.86px), declared with a brief-quoting reason | PASS (declared) |
| 15 | Occupant reads | N/A — no character-inside-a-shell in this artwork | N/A |
| 16 | Occupant belongs to body | N/A — same reason | N/A |

`check-motion.mjs` output: scene clock 108f (`mascot-root`), air-flow
correlates +0.99 to it; blink gate reads the eye's 94% floor and is covered
by the declared exception above; the one contact pair passes with a declared
reason; exit 0. `check-loop-seam.mjs`: 272 vs 488 pixel-identical, exit 0.

## Export round (2026-08-17) — the gleam was preview-only

Two defects the designer found **only in the exported HTML**, not in the app's
Skottie canvas. One cause: the ribbon gleam was built as stacked white bands
clipped to a flattened copy of the ribbon with **Merge Paths intersect**.

- `exportLottieHtml`'s lottie-web compatibility pass (`makeLottieWebSafe`) has
  no translation for `ty:'mm'`, so lottie-web painted the raw clipping bands
  instead of the intersection — hard-edged slabs overhanging the ribbon.
- And because a path track holds its FIRST keyframe backwards in time, those
  bands were on stage **from frame 0**, sitting over the clock through both
  badge beats. (Same mechanic as the swoosh's pen-dot in the zezm round-3
  notes — a second instance of one rule, which is why it went to the skill.)

Rebuilt with no boolean ops: three white strokes on the ribbon's OWN path
(widths 0.98/0.72/0.44 of the ribbon's, alphas 10/13/16 → ~34% at the core),
sharing one trim window (18% of path length) that travels s 0→82 / e 18→100
across `[T+10%·LOOP, T+80%·LOOP]`. Inside the ribbon by construction, round
caps for soft ends, layer opacity 0 at both `T` and `OP` so the seam holds
regardless of where the window sits. The scene now contains **zero** Merge
Paths, which also makes it dotLottie/ThorVG-safe for the interactive flagship.

Promoted to `skills/text-to-lottie/references/player-contract.md` as a new
**Export Compatibility** section — the skill's `recipe-logo.md` actively
recommends the Merge-Paths clip reveal, so without the caveat every future
scene would reintroduce this.

Verified: 0 merge-path nodes in the built JSON; `check-motion.mjs` and
`check-loop-seam.mjs` exit 0; rendered and READ frames 0/60/140/272 (badge
beats clean, no bands) and 316 vs 404 at 3× (the highlight travels from the
ribbon's bright right end to its pale left tail, strictly within the stroke).
