# paymentconfirmation-story-three-0dot — animation learnings

`scripts/build-paymentconfirmation-story-three-0dot.mjs` →
`public/projects/paymentconfirmation-story-three-0dot/scene-1/lottie.json`.
488f @ 60fps: a 272f intro (waiting → confirmation → celebration launch)
handing off into a 216f endless celebration loop
(`markers: intro[0,272), loop[272,488)`).

## This run: re-verification against a byte-identical, word-for-word brief — and one real fix

The three source SVGs attached to this brief (`assets/paymentconfirmation-
story-three-0dot{,-2,-3}.svg`) are **byte-identical** (md5-diffed before
authoring) to `-4obq`'s, `-zezm`'s, `-h3oo`'s and `-6v93`'s. This brief's own
choreography text was compared line by line — not assumed from the slug or
file similarity — against `-4obq`'s (the most recently built, and most
recently *re-derived*, sibling): every quoted clause (ticks as pure decals,
air-flow trailing the descent only, the eyes' counter-scale, the timeline
seconds, the overlap-on-visibility clause, the landing/fireworks clause, the
check's stamp-settle) matches word for word. `-4obq`'s build script was used
as the geometry/technique reference, per "porting is not authoring": every
constant was re-checked against this run's own brief text and the CURRENT
skill references (re-read in full this session) before shipping, not carried
on the strength of the prior script's git history.

Reproducing `-4obq`'s script unmodified (slug swapped only) produced a
**byte-identical `lottie.json`** — expected, since geometry, timeline
formulas, and brief text all agree — and that reproduction is itself a form
of verification: the console log's derived numbers (`T=272`, hand rest
`-44.7deg -> check arm 299.3deg, total sweep 1064.0deg`, badge/hub/mascot
pivots) matched `-4obq`'s own build log exactly.

**But re-deriving from the CURRENT references (not trusting the prior file
unread) surfaced one genuine, inherited defect**, exactly the trap "porting
is not authoring" warns about: `chapterization-transition-grammar.md` was
edited this session to add "**Accents tied to an event fire AT the event,
never at the next marker**," naming the precise field-tested failure —
"the mascot landed, and the sky stayed empty for a dozen frames before the
first firework." `-4obq`'s shipped sparkle system had exactly this bug: all
three clusters were anchored to `T` (272), while the mascot's own landing
(`LAND_END`) falls at 258 — 14 frames earlier, in the intro's tail. Rendering
258→272 in this build (before the fix) showed a genuinely silent sky across
that whole span, confirmed by direct frame-by-frame preview, not assumed from
reading the code. The stale code comment ("landing right after LAND_END/T")
asserted compliance that the actual keyframe timing did not deliver.

### The fix — anchor cluster A's own period at the landing, not at T

Cluster A ("the first burst") now generates its whole 36f-period grid from
`LAND_END` (258) instead of `T` (272); clusters B and C are unchanged
(still `T`-anchored, still staggered +12/+24 as before — the brief only
names one first burst). Because `SPARK_PERIOD` (36) divides `LOOP` (216)
exactly six times, `T` and `OP` land on the **identical phase** of this new
anchor's cycle (`OP - LAND_END ≡ T - LAND_END, mod 36`) — concretely, `T` is
14 frames into the k=0 instance (258) and lands exactly on its `+14` hold
keyframe, while `OP` is 14 frames into the k=6 instance (474) and lands
exactly on `474+14=488`. The boundary values the loop seam needs are
therefore the periodic function's own **computed** keyframes, never a
hand-typed override (the exact discipline `player-contract.md`'s
boundary-value rule asks for) — the old `sKfs.push({t:OP,s:[0,0,100]})` /
`oKfs.push({t:OP,s:[0]})` hard overrides are gone; the array is built
instance-by-instance from the anchor and simply clipped at `t > OP`.

Verified both ways: `check-loop-seam.mjs` still exits 0 (272 vs 488
pixel-identical) after the change, and direct rendering of 254→280 shows a
small spark already opening at 258 (his landing frame), ramping to full
brightness by ~266, holding bright straight through `T=272` (so the loop's
own opening frame reads "already bursting," not just "starts bursting"),
then fading — no silent-sky span anywhere in that range.

Per "porting is not authoring," constants verified this run rather than
assumed:
- **`player-contract.md`**: opacity-does-not-cascade/precomp badge wrapper,
  the path-track-holds-its-first-keyframe-backwards gating, and the Export
  Compatibility section (no Merge Paths in this scene) all re-checked against
  the current text and the shipped script — all honored.
- **`motion-taste.md` Aliveness Contract**: re-read in full this session,
  gates 1–19 (including the two clauses added this session — "a completed
  gesture gets punctuation" and "the response boundary: ground answers,
  backdrop does not") verified fresh against this build's actual output
  below, not inherited from `-4obq`'s recorded exit code.
- **`recipe-companion-bubble.md`**: this run's own preamble asks for the
  bubble HARD CONTRACT, but the brief's actual beat text never stages a
  speech bubble, tooltip, or text layer — badge/check/mascot only. Per "the
  brief outranks every gate," the bubble text layer, `autoFit`, `.textPos`
  slot, and house entrance constants are inapplicable by construction
  (declared here, not silently skipped, same precedent as
  `-4obq`/`-h3oo`/`-6v93`). Only section 1 ("Intro + Loop" markers,
  idle-alive-from-frame-0) applies, and it does.
- **`chapterization-transition-grammar.md`**: the Grounded Handoffs
  checklist (diff-the-assets-first, first frame = first artwork, last frame
  = last artwork, every repeatable segment closes on the picture) — all
  satisfied. The two clauses added this session ("an arrival must not
  eclipse a gesture that is still drawing," verified via the swoosh
  two-thirds-drawn overlap render below, and "accents tied to an event fire
  AT the event," the fix above) were the ones that actually changed
  behavior versus `-4obq`'s file.
- **Numeric re-derivation, not narrative re-derivation**: hand rest angle,
  check arm angle, total sweep, badge/hub/mascot pivots, and park depth are
  all computed at build time from the parsed SVG geometry — since the source
  is byte-identical to `-4obq`'s, these reproduce exactly (confirmed by this
  run's own build log, printed below).

Build log this run:
```
T=272 OP=488 LANDINGS=272,326,380,434,488 PEAKS=299,353,407,461
sweep 7.50deg/f -> handoff avg 13.10deg/f (start slope 0.573), delta 524.0deg
hand rest -44.7deg -> check arm 299.3deg, total sweep 1064.0deg
sparkle A anchored at LAND_END=258 (T=272, gap 14f) — B/C stay T-anchored
badge center 128.4,128.0  hub 129.5,128.6  hand rest -44.7deg
mascot pivot 132.5,218.1  jump 20px  lean 6deg
```

## Verification this run

- `node scripts/check-motion.mjs paymentconfirmation-story-three-0dot` →
  exit 0. Scene clock 108f (from `mascot-root`); `mascot-airflow-rig`
  correlates +0.99 to it. One contact pair checked (`mascot-eyes` ↔
  `ribbon-sweep`, 0.00px), declared. Blink gate reads `mascot-eyes` bottoming
  at 94% — declared as a motion exception quoting the brief (the eyes are
  already-closed arcs that counter-scale to cancel the body's squash, not a
  blink or a squint).
- `node scripts/check-loop-seam.mjs paymentconfirmation-story-three-0dot` →
  exit 0, frames 272 vs 488 pixel-identical, and the "moving from its first
  beat" check passes (opening samples differ from the boundary).
- Rendered and READ (this run's own renders, not inherited from `-4obq`'s
  doc): frame 0 (badge only, mascot fully offscreen, ticks intact — matches
  the brief's opening sentence); 0/36/72 (hand sweeping linearly, ticks
  identical, badge breathing); 112/120/128/132/148/164 zoomed (exit cascade —
  120 pin alone, 128 pen down while pin still present, 132 pin gone check
  stub only, 148 mid-draw, 164 check complete — nothing of the clock survives
  past 132, well before the check's line reaches the middle of the face);
  164–206 zoomed (check holds, badge pop starts at 176, ribbon draws from the
  far-left tip across the fading badge's last ~22 frames as a cross-dissolve,
  badge fully gone and swoosh picking up the line exactly at 206); 190–228
  fine-stepped (mascot first crests the bottom edge around frame ~224 — the
  swoosh is only ~36% drawn at that point, well ahead of the brief's "roughly
  two-thirds" target, but the brief's own verification wording is a
  **one-sided bound** — "if the frame below the stroke is empty, he is too
  late" — being demonstrably visible earlier than the target satisfies that
  bound without eclipsing the swoosh, confirmed by checking that his body
  stays spatially below the swoosh's own vertical range in every frame
  through the rise); 239 (swoosh ≈ two-thirds drawn — mascot already fully
  in frame and rising, well past "partly," satisfying the brief's own
  rendered check); 254–264 zoomed (pen lifts into the spark at ~254–256
  while he's still airborne, lands at 258, air-flow marks fading to fully
  gone exactly by the landing frame — confirmed at 3× zoom, not eyeballed at
  thumbnail scale); 254–280 (**the fix**: a small spark already opens at his
  landing frame 258, ramps to full brightness by ~266, stays bright straight
  through `T=272` — no silent sky, and the loop's own opening frame already
  reads as bursting); 272–488 full loop scrub at 11 points (sparkle clusters
  burst in a staggered rotation, never simultaneous, never a dead sky; lean
  alternates across peaks; frame 488 reads as the same rest pose as 272);
  299 vs 326 at 5× zoom (eye arcs read as the identical "⌣⌣" shape and
  proportions at both the stretched peak and the squashed landing, and no
  air-flow marks at either extreme — confirms both the counter-scale and the
  peak/landing air-flow-absence rule); 305/308/311/314 at 4× zoom (air-flow
  marks build in gradually mid-descent between the first peak and landing —
  present, not a rendering artifact); 0/36/72/120/132/164/186/206/258/272/
  326/488 (final full-timeline sanity grid).
- Total keyframe count across all animated tracks: 1028 (24 more than
  `-4obq`'s 1004, entirely from cluster A's extra wrap-around burst instance)
  — well within the "hundreds, not dozens" range the Living-idles bar asks
  for.

## Aliveness Contract — gate table

| # | Gate | Measured | Verdict |
|---|---|---|---|
| 1 | Nothing inert | Badge breathe (1.8%), hand sweep (1064°), hub absorb+exit, ticks retract-only (brief: "do not swell, brighten, pulse"), check trim-draw + stamp-settle, mascot jump/lean/squash, air-flow rotation+opacity, eyes counter-scale, shadow scale+opacity, sparkle bursts (now including the landing-anchored first burst), swoosh/spark ambient breathe (100→96→100%) even at "rest" | PASS |
| 2 | Amplitude, not keyframe count | mascot-root loop Y 20px, rotation 12° peak-to-peak, scale 10–11%; shadow scale 31%, opacity 36%; air-flow rotation 20°; hand rotation 1064° total sweep; sparkle-A scale 0→112%→88% per burst — all measured by dense-sampling the shipped JSON | PASS |
| 3 | Meaning drives behaviour | Clock hand sweeps mechanically; ticks are inert decals; check draws pen-order with a completion stamp; mascot bounces with anticipation/overshoot/squash; the first firework is tied to the physical event of landing, not to playback structure | PASS |
| 4 | Mood governs the system | Beats 1–2: slow, linear, mechanical. Beat 3/loop: 54f landing beats, JUMP_H=20px, snappy `expressivePop`/`exitAccelerate` accents — an energetic celebration | PASS |
| 5 | Fluidity | Hand sweep (continuous hero track): 1.00× peak/median through beat 1 (linear, per brief). Bounce tracks: exempt one-shot/accent motion | PASS |
| 6 | Accents resolve | Hub absorb-pulse half-cycle ~5f+7f; check stamp-settle spans a few frames past pen-lift; shadow/badge-pop accents 12–30f — all ≥ the ~4f/0.4s floor | PASS |
| 17 | Blinks close | N/A — eyes never blink; the counter-scale holding the eyes' drawn arcs constant is declared in `controls.json.motionExceptions` quoting the brief | DECLARED |
| 7 | Loop seam | `check-loop-seam.mjs` exit 0, 272 vs 488 pixel-identical, including the rebuilt sparkle-A track whose boundary values now come from evaluating the same periodic function at both ends | PASS |
| 18 | Ink follows the pen / scale pivots on artwork | Check path reversed to left-tip pen order; ribbon reversed to left-to-right pen order; swoosh drawn pen-order via `tubeBuilder.at(p)`; every scaling layer pivots at its own bbox center in absolute SVG space | PASS |
| 19 | Opening frame is the brief's opening | Frame 0 renders the badge alone; mascot parked at `PARK_DY` derived from the whole subtree's topmost geometry (air-flow marks), not just the body bbox — confirmed by direct render | PASS |
| 8 | Parts articulate | Hand, hub, ticks, check, eyes, air-flow rig, body, belly, shadow, sparkles, ribbon, swoosh, spark each carry independent tracks relative to their parent | PASS |
| 9 | Held objects live | N/A — nothing is held; ribbon/swoosh/spark are declared stage-fixed decoration per the brief | DECLARED |
| 10 | The body breathes | Badge: continuous 1.8% breathe through beats 1–2. Mascot: continuous squash/stretch cycling through every loop beat | PASS |
| 11 | Effort is phase-locked | Squash lands exactly at ground contact, stretch/overshoot at the airborne peak — verified by rendering the extremes (299 stretched, 326 squashed) | PASS |
| 12 | No double-driven property | Each property animated once down any parent chain; badge pop/fade on the outer precomp only, badge breathe on the inner null only | PASS |
| 13 | Assemblies stay whole | Badge (disc, texture, rings, ticks, hub, hand, check) is one precomp, one root null — pops and fades as one mass | PASS |
| 14 | Contacts hold | `check-motion.mjs`: 1 contact pair, 0.00px, declared | PASS (declared) |
| 15 | Occupant reads | N/A — no character-inside-a-shell in this artwork | N/A |
| 16 | Occupant belongs to body | N/A — same reason | N/A |

`check-motion.mjs` and `check-loop-seam.mjs` both exit 0 (output reproduced
above). `controls.json` is unchanged from `-4obq`'s (the sparkle-A fix
touches only an internal keyframe generator, no published slot/control
surface).

## Craft note: a one-sided verification bound is not a target

The brief's own VERIFICATION section frames the overlap check as "render the
frame where the swoosh is about two-thirds drawn — the mascot must already
be **partly** in frame and rising. If the frame below the stroke is empty, he
is too late." That is a lower bound (not late), not an exact-match target.
This build's mascot clears the bottom edge earlier than the two-thirds point
(around 36% of the swoosh's draw) — which satisfies the bound with room to
spare rather than violating it, and was confirmed not to eclipse the swoosh
at any point in between. Worth flagging for a future round: if the designer
wants the crossing itself closer to the two-thirds mark (a later, more
compressed reveal), that is a legitimate follow-up refinement, but it is not
a defect against this brief's own stated check.
