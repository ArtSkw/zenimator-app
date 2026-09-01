# Payment Confirmation — Story (3 chapters) — h3oo — How It's Animated

`scripts/build-paymentconfirmation-story-three-h3oo.mjs` →
`public/projects/paymentconfirmation-story-three-h3oo/scene-1/lottie.json`.
468f @ 60fps: a 252f intro (waiting → confirmation → celebration launch)
handing off into a 216f endless celebration loop
(`markers: intro[0,252), loop[252,468)`).

## This run: re-verification, not re-invention

The three source SVGs attached to this brief
(`assets/paymentconfirmation-story-three-h3oo{,-2,-3}.svg`) are **byte-identical**
to `assets/paymentconfirmation-story-three-zezm{,-2,-3}.svg` (diffed before
authoring). The brief text is the same story, already built and
field-tested twice under the zezm slug — see
`docs/paymentconfirmation-story-three-zezm-animation.md` for the full build
history, the seven round-2 defects (frozen first bounce, "raised arms" vs
air-flow marks, white-brighten-on-black-vanishes, missing exit cascade, park
depth as a subtree property, the three-greens-as-one-gesture fix, and the
boundary-value discipline for the swoosh/spark settle) and their root causes.

Per "porting is not authoring," every published constant was re-checked
against the CURRENT references before shipping under this slug, not assumed
from the prior script:

- **`player-contract.md`**: the opacity-does-not-cascade-through-parent note
  (precomp-wrapped badge pop) is present in the tracked reference (confirmed
  via `git diff` — an uncommitted addition already covering exactly this
  scene's badge-pop pattern). The script's `precompFromLayers()` badge wrapper
  matches it.
- **`motion-taste.md` Aliveness Contract**: re-read in full this session; the
  gate numbering now runs 1–19 (gates 17–19 — blink-closes, ink/pivot,
  opening-frame — are newer additions since the zezm build). Re-verified the
  scene against all of them (table below), not just the subset that existed
  when zezm shipped.
- **`recipe-companion-bubble.md`**: this scene has NO speech bubble, tooltip,
  or text layer of any kind — only its "Intro + Loop" marker mechanism
  applies (section 1: markers, idle-alive-from-frame-0 discipline, seam
  verification). The HARD CONTRACT items about bubble text layers, `autoFit`,
  a `.textPos` slot, and the bubble-entrance HOUSE CONSTANTS (trail-small/
  trail-large/plate timings) are inapplicable by construction — declared here
  rather than silently skipped.
- **Mechanical gates**: `check-motion.mjs` and `check-loop-seam.mjs` were run
  fresh against THIS build's output (not inherited from zezm's last recorded
  exit code) — both exit 0, reported below.
- **Numeric re-derivation, not narrative re-derivation**: the hand's rest
  angle, its total sweep to the check's arm angle, the tick brighten
  crossings, the badge/hub/mascot pivots, and the park depth are all computed
  at build time from the parsed SVG geometry (`atan2`, `bbox`, dense numeric
  scans) exactly as before — since the source geometry is byte-identical,
  these values reproduce exactly, which is the expected (not lazy) outcome
  of a deterministic build script re-run against unchanged inputs.

Nothing needed to change: the zezm script already reflected the current
references' latest learnings (it was the run that produced several of them).
The diff between the two build scripts is exactly the slug string — verified
with `diff`.

## Verification this run

- `node scripts/check-motion.mjs paymentconfirmation-story-three-h3oo` → exit 0.
- `node scripts/check-loop-seam.mjs paymentconfirmation-story-three-h3oo` → exit 0
  (frames 252 vs 468 pixel-identical).
- A direct numeric boundary check (own throwaway script, not the previewer)
  confirmed every animated track on `mascot-root`, `mascot-airflow-rig`, and
  `mascot-shadow` evaluates to the IDENTICAL interpolated value at `t=252`
  and `t=468`.
- A velocity audit on the same tracks over one loop beat `[252,306]` shows
  peak/median ratios of 11.6–14.3× — expected and exempt, since a bounce
  landing (a hold at the ground, a fast mid-air arc) is one of the named
  "deliberate snap accent" exemptions in the fluidity gate, not a continuous
  sway that should stay under 3×. The one truly continuous, non-accent track
  (the beat-1 hand sweep) measures a clean 1.00× ratio, matching the brief's
  "linear, no easing."
- Rendered and read: frame 0 (badge only, mascot fully offscreen), 108–156
  (exit cascade: hand collapses ~112–124, ticks retract ~116–132, hub absorbs
  and exits ~124–146, check completes clean at 148, holds to 156 — no
  leftover clock geometry), 156–216 (badge pop-fade overlapping the green
  ribbon/swoosh/spark drawing as one continuous outward gesture, mascot
  rising with air-flow marks visible), 252/279/306/333/360/387/414/441/467
  (loop beats — air-flow marks present only through airborne arcs, gone at
  every landing; first beat's peak at 279 is visibly distinct from the
  resting pose, not a frozen hold).
- Total keyframe count across all animated tracks: 540 — comfortably in the
  "hundreds, not dozens" range the Living-idles bar asks for.

## Aliveness Contract — gate table

| # | Gate | Measured | Verdict |
|---|---|---|---|
| 1 | Nothing inert | Every element on stage carries a track: badge breathe (1.8%), hand sweep (540°+), tick pulses (100→128%), hub absorb+exit, check trim-draw, mascot jump/lean/squash, air-flow rotation+opacity, eye squint, shadow scale+opacity, sparkle bursts, swoosh/spark carry a slow ambient breathe (100→96→100%, `ambientBreathScale`/`sparkEntrance`'s tail) even while "resting" per the brief | PASS |
| 2 | Amplitude, not keyframe count | mascot-root position Y 20px, scale 10–11%, rotation 6°; shadow scale 31%, opacity 36%; airflow rotation 10°; hand rotation 540° — all measured by dense-sampling the shipped JSON, not asserted | PASS |
| 3 | Meaning drives behaviour | Clock hand sweeps mechanically (a mechanism); ticks answer with a scale pulse, never color (a 1-bit face); check draws pen-order; mascot bounces with anticipation/overshoot/squash (a living body, not a mechanism) | PASS |
| 4 | Mood governs the system | Beats 1–2: slow, linear, mechanical (a waiting clock). Beat 3 loop: short 54f landing beats, JUMP_H=20px well above the ~4px floor, snappy `expressivePop`/`exitAccelerate` accents — an energetic celebration, not a calm idle | PASS |
| 5 | Fluidity | Hand sweep (only true continuous hero track): 1.00× peak/median. Bounce tracks: 11.6–14.3× — exempt, bounce landings are a named exception to the <3× continuous-motion threshold | PASS |
| 6 | Accents resolve | Tick pulse: attack 5f + release 7f (half-cycles ≥4f); shadow/eyes accents span 8–16f | PASS |
| 17 | Blinks close | N/A — eyes never blink; the "squint on landing" (100→82% scaleY) is declared in `controls.json.motionExceptions` quoting the brief, not presented as a blink | DECLARED |
| 7 | Loop seam | `check-loop-seam.mjs` exit 0, 252 vs 468 pixel-identical; numeric boundary check also confirmed equal interpolated values on every sampled track | PASS |
| 18 | Ink follows the pen / scale pivots on artwork | Check path reversed to left-tip pen order before trim; every scaling layer (ticks, hub, sparkles, badge precomp, spark, swoosh, ribbon-sweep bands) pivots at its own bbox center in absolute SVG space | PASS |
| 19 | Opening frame is the brief's opening | Frame 0 renders the badge alone; mascot parked at `PARK_DY = H+6 - armsBox.minY` below frame, derived from the whole subtree's topmost geometry (air-flow marks), not just the body bbox | PASS |
| 8 | Parts articulate | Hand, hub, ticks, check, eyes, air-flow rig, body, belly, shadow, sparkles, ribbon, swoosh, spark each carry independent tracks relative to their parent | PASS |
| 9 | Held objects live | N/A — nothing is held; ribbon/swoosh/spark are declared stage-fixed decoration per the brief's "everything rests exactly where artwork 3 draws it" | DECLARED |
| 10 | The body breathes | Badge: continuous 1.8% breathe through beats 1–2. Mascot: continuous squash/stretch cycling through every loop beat, never resting flat | PASS |
| 11 | Effort is phase-locked | Squash lands exactly at ground contact (LANDINGS), stretch/overshoot at the airborne peak (PEAKS) — verified by rendering the extremes | PASS |
| 12 | No double-driven property | Each property (position/rotation/scale/opacity) is authored on exactly one node per chain; badge pop/fade lives on the outer precomp only, badge breathe stays on the inner null only | PASS |
| 13 | Assemblies stay whole | Badge (disc, texture, rings, ticks, hub, hand, check) is one precomp, one root null — pops and fades as one mass, per the brief's "ONE object... never crossfaded" | PASS |
| 14 | Contacts hold | `check-motion.mjs`: 3 contact pairs checked, all declared and honored (eyes↔ribbon-sweep 28.86px, eyes↔swoosh 29.10px, swoosh↔spark 2.83px) — each with a brief-quoting reason | PASS (declared) |
| 15 | Occupant reads | N/A — no character-inside-a-shell in this artwork | N/A |
| 16 | Occupant belongs to body | N/A — same reason | N/A |

`check-motion.mjs` output: scene clock 108f (mascot-root), air-flow
correlates +0.99 to it; blink gate reads the eye's 82% floor and is covered
by the declared exception above; all 3 contact pairs pass with declared
reasons; exit 0.
