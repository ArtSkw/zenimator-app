# paymentconfirmation-story-three-3soj — animation learnings

`scripts/build-paymentconfirmation-story-three-3soj.mjs` →
`public/projects/paymentconfirmation-story-three-3soj/scene-1/lottie.json`.
535f @ 60fps: a 319f intro (waiting → confirmation → celebration launch)
handing off into a 216f endless celebration loop
(`markers: intro[0,319), loop[319,535)`).

## This run: two genuinely new brief requirements, found by reading the brief and not the file

The three source SVGs (`assets/paymentconfirmation-story-three-3soj{,-2,-3}.svg`)
are **byte-identical** (md5-diffed before authoring) to the zezm/h3oo/6v93/
4obq/dzbr/wyga/4pik field tests. This brief's own choreography text matches
zezm's round-3 (final) brief and 4obq's/dzbr's/wyga's/4pik's own briefs on
every point those scenes already settled — ticks are pure decals with no
pass-accent, air-flow marks show only on the descent, eyes counter-scale to
keep their drawn shape, and the entrance-overlap wording ("Anchor this on
when he crosses into view, not on when his anticipation starts... He should
clear the bottom edge at roughly the point where the swoosh is two-thirds
drawn... Overlap them, never queue them") is 4pik's own visibility-anchored
fix, in substance. **Base script: 4pik** — the most current, field-tested
descendant carrying every fix in this lineage (4obq's ONE-PEN sequential
draw, wyga's overlap-not-queue entrance, 4pik's own visibility anchor).

Per "porting is not authoring," the brief's own text was read start to
finish against 4pik's script rather than assumed identical, and turned up
**two requirements no prior script in this lineage implements**:

1. **The check-mark STAMPS.** "When the check's pen lifts, the finished mark
   STAMPS: a small settle-pop of two to three percent on its own pivot, over
   a few frames, so the confirmation clicks physically... Then let it hold a
   beat." Every prior script (4obq through 4pik) leaves the check-mark flat
   after its trim completes — only the hub gets a pulse, only the badge gets
   a pop. New: `checkStampAnim()`, pivoting on the check's own bbox center
   (`checkBox`, same scale-pivot pattern as the hub/ticks/sparkles). It fits
   entirely inside the exit cascade's existing 12f hold (`CHECK_END=164` →
   `STAMP_PEAK=168` → `STAMP_END=172` → 4f pure hold → `POP_START=176`), so
   `BEAT1`/`BEAT2` and everything computed from `POP_START` forward are
   numerically unchanged from 4pik.
2. **The swoosh and spark answer his landings.** "The bright swoosh and its
   spark answer his landings too: on each impact they dip a couple of pixels
   and recover, a frame or two behind him, at low amplitude derived from his
   own bounce... The pale ribbon stays still." Every prior script declares
   swoosh, spark, AND ribbon fully stage-fixed (`motionExceptions`, zero
   motion of their own) — a correct reading of those briefs' weaker
   "everything rests exactly where artwork 3 draws it" language. This brief
   is explicit and unambiguous, and singles out the ribbon as the one that
   stays still. New: `landingDipPosition()` — a small (`SWOOSH_LAND_DIP =
   JUMP_H * 0.125` = 2.5px) position dip keyed directly off the shared
   `LANDINGS` array with a `SWOOSH_LAND_LAG = 2` frame offset, applied
   identically to `mascot-swoosh` and `mascot-spark` (so they stay welded to
   each other) but NOT to `mascot-ribbon` (left with no position track at
   all, exactly as before). This is the same "derived from the subject's own
   clock" technique the shadow already used — not an independent oscillator.

## Visibility-lead retuning: the naive position-only crossing test undercounts scale compression

4pik's own doc measured the entrance's first-visible-pixel frame by
dense-sampling `mascot-root`'s **position** track against the body's own
top offset, landing on `ANTIC_END + 2`. Reusing 4pik's numbers verbatim
(`VISIBILITY_LEAD = 20`, `ANTIC_END = 236`) and then actually RENDERING the
output frame by frame at `--zoom 6` (not just computing the position curve)
showed the first visible sliver at **frame 241** — about 1.7f AFTER the
swoosh's own two-thirds mark (239.3), which is "too late" per this brief's
own verification wording ("If the frame below the stroke is empty, he is too
late, however early his anticipation started").

Root cause: the position-only test ignores that `mascotScale()` is still
deep in its `ANTIC_SQUASH` compression (`sy: 88`) through the early rise —
the body's effective height above its own pivot shrinks proportionally with
`scale.y`, so the same position delta produces LESS on-screen travel than a
scale=100% assumption predicts. 4pik's own "+2" figure was never re-verified
against a render in this session (it was carried from that scene's own prior
measurement); rendering THIS build exposed the gap.

Fix: `VISIBILITY_LEAD` raised from 20 to 23 (re-measured against the actual
rendered output, not recomputed analytically) — `ANTIC_END` moves to 233,
and the first visible sliver now lands at frame 238, essentially AT the
two-thirds mark (239.3), with the swoosh clearly a third from done. This is
the only numeric change from 4pik's own values; it shifted `T` (322→319) and
`OP` (538→535) by the same 3 frames, with the loop's own 216f span and every
internal track untouched (confirmed by `check-loop-seam.mjs`, below).

## Numeric re-derivation, not narrative re-derivation

- **`player-contract.md`**: the opacity-does-not-cascade-through-`parent`
  note (precomp-wrapped badge pop) and the Export Compatibility section
  (Merge Paths do not survive the HTML export) are both present, unchanged.
  The script's `precompFromLayers()` badge wrapper and the zero-Merge-Paths
  ribbon gleam both honor it.
- **`motion-taste.md` Aliveness Contract**: re-read in full this session;
  gates still number 1–19. Verified fresh against this build's own output
  (table below), not inherited from 4pik's recorded exit code.
- **`chapterization-transition-grammar.md`**: the sequence checklist (diff
  the assets first, first frame = first artwork, last frame = last artwork,
  every repeatable segment closes on the picture) — all satisfied; no
  ambient/tiled field in this scene.
- **`recipe-companion-bubble.md`**: this scene has NO speech bubble, tooltip,
  or text layer of any kind — only its "Intro + Loop" marker/idle-alive-
  from-frame-0 mechanism applies. The HARD CONTRACT items about a bubble
  text layer, `autoFit`, a `.textPos` slot, and the bubble-entrance HOUSE
  CONSTANTS are inapplicable by construction — declared here rather than
  silently skipped, same precedent as every prior scene in this lineage.
- **Mechanical gates**: `check-motion.mjs` and `check-loop-seam.mjs` run
  fresh against THIS build's output — both exit 0, reported below.
- **Re-derived at build time from the parsed SVGs** (not hand-typed, and
  reproduce exactly since the source geometry is byte-identical): badge/hub/
  mascot/check pivots and bboxes, the hand's rest angle (-44.7°) and total
  sweep to the check's arm angle (1064.0°), the texture tile size, `PARK_DY`.
- **Verified unchanged from 4pik** (byte-identical geometry + matching brief
  text, so re-deriving reproduces the same numbers): `BEAT1/2` (72/104), the
  full exit-cascade offsets, `HANDOFF`, `CHECK_STROKE_W` (2.26667),
  `JUMP_H/OVERSHOOT_H/LEAN/STRETCH/SQUASH`, shadow scale/opacity ranges,
  air-flow visibility windows and amplitude, the ribbon gleam's trim-window
  technique, the ONE-PEN sequential green-line technique and its
  `SWEEP_VS_SCRIBBLE = 1.4` pacing constant, the SPIN_UP handoff-continuity
  technique.
- **New this session**: `checkStampAnim()`, `landingDipPosition()`, and the
  retuned `VISIBILITY_LEAD` (20 → 23).

## Verification this run

- `node scripts/check-motion.mjs paymentconfirmation-story-three-3soj` →
  exit 0. Scene clock 108f (`mascot-root`); `mascot-airflow-rig` correlates
  +0.99 to it. One contact pair checked (`ribbon-sweep` ↔ `mascot-ribbon`,
  0.00px, declared). Blink gate reads `mascot-eyes` bottoming at 94% —
  declared as a motion exception quoting the brief.
- `node scripts/check-loop-seam.mjs paymentconfirmation-story-three-3soj` →
  exit 0, frames 319 vs 535 pixel-identical; loop confirmed moving from its
  first beat.
- Rendered and read (via the Read tool, as images):
  - `0/40/72/100`: badge only, ticks identical across all frames, hand
    sweeping steadily.
  - `112/120/124/132/148/164/172/176`: the exit cascade — hand collapsed to
    a stub by 120, hub gone by 132 while the check's pen is already down,
    check complete and holding at 164, the NEW stamp visible across
    164→168→172 (own-pivot pop, small), then a clean 4f hold to the badge
    pop at 176. Nothing of the clock survives into the check's own draw.
  - `176/184/196/206`: badge pop-fade (opaque → gone by ~206) racing the
    green line's start — ribbon pen-down at the far left, sweeping right.
  - `234–241` at `--zoom 6`, frame by frame: empty through 237, first
    visible sliver at 238 — the retuned `VISIBILITY_LEAD` landing him at
    essentially the swoosh's own two-thirds mark (239.3), not a few frames
    late.
  - `231` (swoosh ≈ half drawn): mascot fully absent — confirms he never
    covers the swoosh early enough to hide its work.
  - `246/254/256/270`: mascot rising clearly behind the swoosh's last
    stretch, pen lifting into the spark at 256 while he is still visibly
    ascending (well before `RISE_END=283`), spark growing through 270.
  - `283/295/305/319`: the entrance's own peak (283, no air-flow), mid-
    descent (295, air-flow marks streaming), landing (305, air-flow gone,
    squashed), rest (319 = T).
  - `319/321/323/325/329`: direct JSON inspection (not eyeballing) confirms
    the NEW swoosh/spark landing-dip — both rest at y=146.02/146.51 at the
    landing, dip to 148.52/149.01 two frames later, recover by +8 more
    frames — while the ribbon carries no position track at all.
  - `346` vs `373` at `--zoom 5`: eyes hold the identical "⌣⌣" arc at both
    the stretched peak and the squashed landing; air-flow marks absent at
    both (peak and landing, per the brief).
  - `319/346/373/400/427/454/481/508/534`: full loop scrub — sparkle
    clusters burst in a staggered rotation, never in unison; frame 534
    (≈`op-1`) reads as the same rest pose as 319.
- Total keyframe count across all animated tracks: 386 — comfortably in the
  "hundreds, not dozens" range the Living-idles bar asks for.

## Aliveness Contract — gate table

| # | Gate | Measured | Verdict |
|---|---|---|---|
| 1 | Nothing inert | Every element on stage carries a track: badge breathe (1.8%), hand sweep (1064° total), hub absorb+exit, ticks retract-only, check trim-draw + NEW stamp-pop (2.5%), mascot jump/lean/squash, air-flow rotation+opacity, eyes counter-scale, shadow scale+opacity, sparkle bursts, swoosh/spark ambient breathe (100→96→100%) PLUS the NEW landing-dip (2.5px), ribbon stays still (declared) | PASS |
| 2 | Amplitude, not keyframe count | mascot-root loop Y 20px, rotation 12° peak-to-peak, scale ~10%; shadow scale 31%, opacity 36pp; air-flow rotation 20°; hand rotation 1064° total sweep; check stamp 2.5%; swoosh/spark landing dip 2.5px — all measured by dense-sampling the shipped JSON | PASS |
| 3 | Meaning drives behaviour | Clock hand sweeps mechanically; ticks are inert decals; check draws pen-order then physically STAMPS on completion; swoosh/spark answer the mascot's weight like ground objects would; mascot bounces with anticipation/overshoot/squash | PASS |
| 4 | Mood governs the system | Beats 1–2: slow, linear, mechanical. Beat 3/loop: 54f landing beats, JUMP_H=20px, snappy `expressivePop`/`exitAccelerate` accents — energetic celebration | PASS |
| 5 | Fluidity | Hand sweep: 1.00× peak/median (linear through beat 1); handoff tangent solved from `V_IN/V_AVG` so the sweep never stalls. Bounce tracks: high ratios expected and exempt (deliberate accent) | PASS |
| 6 | Accents resolve | Hub absorb-pulse half-cycle ~5f+7f; check stamp 4f+4f (8f total, ≥ the 4f floor); badge/shadow accents 12–30f | PASS |
| 17 | Blinks close | N/A — eyes never blink; counter-scale declared in `controls.json.motionExceptions` quoting the brief | DECLARED |
| 7 | Loop seam | `check-loop-seam.mjs` exit 0, 319 vs 535 pixel-identical | PASS |
| 18 | Ink follows the pen / scale pivots on artwork | Check reversed to left-tip pen order; ribbon reversed to left-tip pen order, swoosh chains off its end (ONE pen, sequential); every scaling layer (ticks, hub, sparkles, badge precomp, spark, swoosh, ribbon-sweep bands, and the NEW check stamp) pivots at its own bbox center in absolute SVG space | PASS |
| 19 | Opening frame is the brief's opening | Frame 0 renders the badge alone; mascot parked at `PARK_DY` below frame, derived from the whole subtree's topmost geometry — confirmed by direct render | PASS |
| 8 | Parts articulate | Hand, hub, ticks, check, eyes, air-flow rig, body, belly, shadow, sparkles, ribbon, swoosh, spark each carry independent tracks relative to their parent | PASS |
| 9 | Held objects live | N/A — nothing is held; ribbon/swoosh/spark are declared stage-fixed-or-derived decoration per the brief | DECLARED |
| 10 | The body breathes | Badge: continuous 1.8% breathe through beats 1–2. Mascot: continuous squash/stretch cycling through every loop beat | PASS |
| 11 | Effort is phase-locked | Squash lands exactly at ground contact (LANDINGS), stretch/overshoot at the airborne peak (PEAKS); the NEW swoosh/spark dip is phase-locked to each landing too — verified by rendering 346 (stretched) vs 373 (squashed) and reading the JSON's landing-dip keys directly | PASS |
| 12 | No double-driven property | Each property animated once down any parent chain; badge pop/fade lives on the outer precomp only | PASS |
| 13 | Assemblies stay whole | Badge (disc, texture, rings, ticks, hub, hand, check) is one precomp, one root null — pops and fades as one mass | PASS |
| 14 | Contacts hold | `check-motion.mjs`: 1 contact pair checked (`ribbon-sweep` ↔ `mascot-ribbon`, 0.00px), declared with a brief-quoting reason | PASS (declared) |
| 15 | Occupant reads | N/A — no character-inside-a-shell in this artwork | N/A |
| 16 | Occupant belongs to the body | N/A — same reason | N/A |

`check-motion.mjs` output: scene clock 108f (`mascot-root`), air-flow
correlates +0.99 to it; blink gate covered by the declared exception; the
one contact pair passes with a declared reason; exit 0. `check-loop-seam.mjs`:
319 vs 535 pixel-identical, exit 0.
