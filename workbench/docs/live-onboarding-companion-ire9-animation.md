# Live Onboarding Companion (Deck Chair) — ire9 pass

`assets/live-onboarding-companion-ire9.svg` is byte-identical to
`live-onboarding-companion-wg4l.svg`/`-eh0n.svg`, and this brief is the same
deck-chair mascot scene (chair-as-furniture, tilt-axis recline, drink lift
with lagged straw/umbrella, one lens glint, "Almost time to relax" bubble). A
slug-swap rather than a re-derivation — sourced from
`scripts/build-live-onboarding-companion-wg4l.mjs` (the most recently
regenerated sibling at build time), which itself inherits the full v1-v5
feature set from `eh0n` (living-idle clock system, `keyOnBoundaries`, the
`bubble.textPos` slot). See `live-onboarding-companion-eh0n-animation.md` for
the full build rationale — everything there applies here unchanged.

## Verification (this pass)

- `node scripts/build-live-onboarding-companion-ire9.mjs` — 30 layers, valid
  JSON, 302 animated keyframes, `T=90`/`IDLE=180`/`OP=270`.
- Frame grid `[0,20,45,70,90,180,269]` — trail circles pop smallest-first,
  bubble emerges with a lazy overshoot, chair never moves, text renders bold
  and centered in the plate.
- Zoomed `[15,45]` — head recline pose and lens glint position both visibly
  differ between the two frames while the bubble/trail are still mid-pop —
  alive under the entrance, not frozen.
- Mid-idle `[120,220]` — bubble and trail circles are pixel-identical between
  the two frames (hold perfectly still) while the drink lift keeps animating
  underneath.
- Loop seam: a direct-seek throwaway script (`anim.seekFrame(90)` vs
  `anim.seekFrame(270)`, using the same `MakeManagedAnimation`/
  `canvaskit-wasm/full` init as `preview-scene.mjs`) diffed the full RGBA
  buffer — **0 differing bytes, max delta 0**.
- Text weight/centering, zoomed 5x at `f90`: Nunito Bold renders at the same
  stroke weight as the source's baked glyph outlines, centered in the plate
  with even top/bottom inset.

## v2 — ported wholesale from live-onboarding-companion-mqmh (now the reference)

`scripts/build-live-onboarding-companion-wg4l.mjs` (this scene's original
source) had fallen behind `mqmh`, which pulled ahead with source-true
bubble-to-trail spacing (`PLATE_CENTER_Y=44.5`, restoring the SVG's own
authored 9px plate-to-trail gap) and silhouette morphs (`motion-taste.md`'s
body-path breath-deformation: `head-dark`/`head-face` squash-and-bulge on the
same pivot/axis `head-rig` already rotates on, plus a straw flex derived from
`dragPoints`). Since the source SVGs are pixel-identical, this was a wholesale
port (`cp` + slug/path swap), not a re-derivation — `scripts/build-live-
onboarding-companion-mqmh.mjs` is the reference build going forward.
`controls.json`'s shape (`autoFit.max`, the `bubble.textPos` `internal`
entry) is unchanged.

Verified post-port:

- Seam `T=90` vs `op=270` — 0 differing bytes (byte-exact, direct-seek pixel
  diff, not just within rasterizer noise).
- Two idle-peak frames (`f90` rest vs `f128` breathe peak), zoomed 4x: the
  head silhouette visibly differs — flatter/wider at the breathe peak, not
  just a rigid transform.
- Plate-bottom-to-trail-large gap computes to exactly 9px (trail-large top
  edge 71 − plate bottom 62), matching the source SVG's authored `Ellipse
  2420` placement.

## v3 — mood retune: killing the "squats" defect

Team feedback: the idle read as the mascot doing squats/sit-ups — a gym verb
on a scene that's supposed to be pure vacation stillness. Root cause:
`head-rig`'s PRIMARY motion was a position translation along the chair's
tilt axis (`RECLINE_DIST=9px`, ~7.9px of that vertical) driven by the breathe
envelope — a vertical body bob, exactly the violation motion-taste.md's new
"Mood governs the system" rule names and forbids for calm/contemplative
scenes ("If a viewer could describe the motion with a gym verb, the mood is
wrong"). Retuned per that rule and `recipe-companion-bubble.md`'s relax
archetype:

- **Killed the position bob entirely.** `head-rig`'s `p` is now static and
  equal to its own anchor (`a == p`, intentionally — "no net translation at
  rest" per player-contract.md) — the body's y is exactly 0px, not just
  "within 1-2px."
- **Primary is now a slow hammock SWAY** — rotation only, about the same
  seat-contact pivot the old rig used, `SWAY_ROT_DEG=2` ("a couple of
  degrees"), a full bidirectional swing (rest → +peak → rest → -peak → rest,
  never a one-way twitch, per the character-rig recipe's pendulum guidance)
  over one whole `CLOCK_SWAY=IDLE=180f` loop. IDLE is fixed at 3.0s by the
  marker contract (`T=90`/`op=270` must survive), so a literal 4-6s period
  (motion-taste's calm-mood target) isn't reachable — one full cycle per
  whole loop is the longest period that still divides `IDLE` exactly (the
  only way to keep the boundary-key math exact), so that's what shipped; the
  "half loop" alternative (`CLOCK_SWAY=90`, 2 cycles/loop) would only have
  made the sway faster, further from the target.
- **Breathe moved entirely into the silhouette morph.** The rig's old rigid
  scale-up (`BREATHE_SCALE_AMP`, a uniform 3% puff of the whole head+
  sunglasses group) is gone — breath now reads ONLY as the `head-dark`/
  `head-face` shape deformation (`BODY_SQUASH` softened 4.5% → 3.5%) and is
  slowed from 2 cycles/loop to 1 (`CLOCK_BREATHE` 90f → 180f, same
  `t=38/90=0.422` phase ratio preserved as `t=76/180`). Volume still
  conserved exactly (`squashSubpath`'s anisotropic scale is area-preserving
  by construction, unchanged mechanism).
- **The chair now flexes off BOTH signals.** `chair-seat`'s squash
  (`SEAT_SQUASH_PCT` 3%→2%, `SEAT_BULGE_PCT` 1%→0.7%, both softened) gained a
  small additional X-bulge term, `SEAT_SWAY_BULGE_PCT=0.6% * |sway|` — a
  hammock's frame gives a little as weight rocks side to side, which is what
  the brief's "chair flexing subtly in response" asks for on the sway
  specifically (the seat-squash-on-breathe mechanism was already there and
  needed no new wiring, just inherited the softer amplitude).
- **Trail circles gained a "gentle float"** — a new small (`FLOAT_AMOUNT=2px`)
  boundary-matched Y bob, `CLOCK_FLOAT=90f` (2 cycles/loop), phase-offset
  between `trail-small`/`trail-large` (20f apart) so they don't bob in
  lockstep. This is a deliberate, mood-driven exception to this file's
  general "one-shot elements hold perfectly still" default — the brief
  explicitly asked for it, and it's mechanically safe: the float is a pure
  function of `t % CLOCK_FLOAT`, and since both `T=90` and `op=270` reduce to
  the same phase (`90 mod 90 = 0`), the seam holds by construction exactly
  like every other living-idle track here, regardless of the phase offset
  used.
- **The sip accent, glint, and drink-rig mechanism are untouched** — still
  the loop's one snappy accent with straw/umbrella drag, still its own
  off-beat clock.

### Verification (mood retune)

- Frame grid `[0,20,45,70,90,180,269]` — no visible vertical bob anywhere;
  chair legs still never move; bubble/text unaffected.
- `[135,225]` zoomed 3x (the sway's two rotation extremes): head tilts
  opposite directions between the two frames with zero vertical shift —
  reads as a hammock sway, not a bounce.
- `[180,256]` zoomed 5x — chosen as the cleanest near-isolated breathe
  rest/peak pair (`breathe(180)=0, sway(180)=0` vs `breathe(256)=1,
  sway(256)=0.167`, computed directly from the envelope functions): the head
  silhouette is visibly flatter/more compact at the peak — the morph stays
  alive, subtle is not static.
- `[15,45]` zoomed 3x — head tilt and glint position both still visibly
  differ between the two mid-intro frames — idle alive under the entrance,
  unchanged.
- `[180,188,196]` — the drink visibly lifts toward the face at `f188` and
  settles by `f196`, straw/umbrella riding along — sip accent unaffected.
- `[100,145]` zoomed 5x — trail-small and trail-large visibly shift relative
  to each other (gentle float, out of phase).
- Loop seam: direct-seek throwaway script, `T=90` vs `op=270` — **0
  differing bytes, max delta 0** (re-confirmed after the retune).
- Self-test (motion-taste's new rule): "the mascot rocks gently side to side
  like a hammock while its chest softly rises and falls, and once a cycle it
  slowly lifts its drink for a sip" — no gym verb fits.

## v4 — smoothness fix: killing the "robotic"/"elderly" read

Team feedback after the mood retune: the sway read as ROBOTIC — it swayed,
stopped a moment, swayed again, like a machine or someone very old.
Re-measuring the scene against motion-taste.md's new "Bake smooth, not
stepped — and keep a calm spectrum clean" rule (written from measuring this
exact scene) turned up TWO separate, stacked defects, plus a third one found
while fixing the second:

1. **STEPPED BAKE.** Every dense-sampled track (head-rig rotation,
   silhouette morphs, chair-seat squash, straw flex, trail float) baked its
   continuous envelope as LINEAR segments every 6 frames
   (`HEAD_SAMPLE_STEP=6`) — a slow curve rendered as a polyline, with a
   velocity discontinuity at every sample. Fix: `HEAD_SAMPLE_STEP` (and
   trail's matching literal) dropped from 6 to **2** frames — fine enough
   that the polyline is indistinguishable from the true curve at 60fps, per
   the rule's own explicit allowance, without restructuring every dense
   track into sparse authored keyframes.
2. **BEATING SPECTRUM.** Rotation summed two clocks 5x apart in frequency
   (`SWAY_ROT_DEG*sway` at 180f + `DETAIL_ROT_DEG*detail` at 36f, the
   secondary at 40% of the primary's amplitude — over the rule's ≤⅓ ceiling).
   Dense-sampling the OLD composite and scanning for direction reversals at
   1-frame resolution found flips well outside the two true apexes (e.g. a
   reversal 6 frames after rest, long before the next apex) — detail's
   higher-frequency wobble interferes with the primary across most of the
   cycle, because a 5:1 ratio gives no single phase where detail's own
   peaks/troughs stay clear of every point where sway's own slope is small
   (near rest AND near its apexes). That interference IS the stop-start
   read. Fix: DETAIL removed from rotation entirely — rotation is now
   `SWAY_ROT_DEG * swayEnvelope(t)` alone, one clean signal, zero risk of
   beating. (`CLOCK_DETAIL`/`DETAIL_POINTS`/`detailEnvelope`/
   `DETAIL_ROT_DEG` deleted — rotation was their only consumer.)
3. **A THIRD defect, found only by re-scanning the SINGLE-signal sway**:
   even with detail gone, the pure sway (built from 4 `SWAY_POINTS`
   keyframes using `travelBalanced` easing per 45f segment) still failed the
   monotonic-swell check. Dense-sampling it alone and diffing consecutive
   3-frame deltas from rest (`t=90`) toward the apex (`t=135`) showed
   deltas shrinking smoothly (-0.067, -0.071, -0.077, -0.085, -0.096,
   -0.118, -0.175°) then SPIKING to -0.672° at `t=111→114` (a 4-9x jump)
   before dropping back to -0.165° and continuing to shrink normally into
   the apex — a real mid-swing velocity spike, not a rendering artifact.
   Hand-deriving `travelBalanced`'s bezier component functions
   (`x=[1.00,.00]`, `y=[.49,.55]`) confirms why: `dx/ds = 3(1-2s)²`, which
   is exactly **zero at `s=0.5`** while `dy/ds` there is `≈0.795` — a
   provable infinite `dy/dx` (infinite value-velocity) at each segment's
   own temporal midpoint. This is a genuine property of that curve's shape,
   present at ANY segment length (motion-taste.md's own caveat about
   `travel-balanced` "compressed into a short segment" describes when it
   becomes MOST visible relative to the segment, not a length threshold
   below which it vanishes) — so no amount of finer sampling fixes it, only
   a different curve does. Fix: `swayEnvelope` is no longer a 4-point
   `evalTrack` chain at all — it's a direct
   `-Math.sin(2π(t-T)/CLOCK_SWAY)`. A real pendulum swings fastest through
   center and slows to a genuine stop at each extreme, which is exactly a
   sine's own velocity profile (`cos`, smooth and singularity-free
   everywhere) — using the trig function directly is both simpler and
   provably correct, rather than trying to hand-pick a bezier approximation
   of it. `SWAY_POINTS` and the `evalTrack` call for sway were deleted;
   `chair-seat`'s `SEAT_SWAY_BULGE_PCT * |swayEnvelope(t)|` term
   automatically inherits the smoother curve since it just calls the same
   function.

### Verification (smoothness fix)

- Dense 1-frame-resolution direction-flip scan of the FINAL `swayEnvelope`
  across the whole `[0,270]` range: exactly 3 flips, at frames 46/136/226 —
  one frame past each of the three true apexes in that range, and *zero*
  flips anywhere else. Motion-taste.md explicitly allows an apex hesitation
  of "at most a frame or two"; this has none beyond the apex itself.
- Apex-to-apex half-period scan (`t=45` to `t=135`, 3-frame steps): delta
  magnitude shrinks smoothly from 0.2091° (at the zero-crossing `t=90`, the
  fastest point) down to 0.0110° at each neighboring apex, symmetric on both
  sides — textbook swell-then-shrink, monotonic on both halves, matching a
  real pendulum's velocity profile exactly.
- Rendered `[90,99,108,117,126,135]` zoomed 6x: the head's tilt increases by
  visibly similar small increments frame to frame with no jump or freeze,
  consistent with the numeric scan (the swing is only 2° total, so the
  numeric scan is the precise verification; the render is a sanity check
  that nothing looks grossly broken).
- Re-ran the full existing checklist post-fix: frame grid `[0,20,45,70,90,
  180,269]` unaffected; `[15,45]` zoomed 3x still shows the idle alive under
  the entrance; `[180,256]` zoomed 5x still shows the silhouette morph
  visibly different at its rest/peak beats (unaffected — breathe's own
  mechanism wasn't touched); `[180,188,196]` sip accent unaffected; loop
  seam direct-seek diff — **0 differing bytes, max delta 0**.
- Self-test (the new rule's own check): "the mascot swings gently back and
  forth like a hammock, smoothly and without hesitation, while its chest
  softly rises and falls and it occasionally lifts its drink for a slow
  sip" — no robot or elderly quality, no gym verb fits.

### Lesson for future living-idle tracks

A named easing anchor (`travelBalanced`, `settleSoft`, etc.) is tuned for a
specific motion CHARACTER, not guaranteed artifact-free at every duration or
for every use. Before trusting one for a primary, hero-visible cyclic
motion, hand-derive or numerically scan its `dx/ds` component alone (not
just eyeball a rendered grid) — a bezier whose TIME component
(`x1`/`x2`) has a zero-derivative point produces a true infinite-velocity
instant in the eased output, wherever that lands in the segment, regardless
of how long the segment is in frames. For a true back-and-forth pendulum
swing specifically, skip the bezier approximation and use `Math.sin`/`cos`
directly — it's simpler, exact, and immune to this class of defect by
construction. Also: when diagnosing a "robotic"/"stop-start" complaint,
dense-sample the SUSPECT track alone (no other signals summed in) and scan
consecutive-frame deltas for sign flips or magnitude spikes — this caught
both the spectral defect (detail summed into sway) and the curve-shape
defect (sway alone) that a whole-scene rendered frame grid never would have
surfaced at this amplitude.

## v5 — the velocity audit: fixing the drink hand's lag (and two more hidden failures it caught)

Team feedback after the smoothness fix: the drink hand still read laggy —
starts moving, stops, continues, stops. The previous pass rebuilt the SWAY
as a dense true sine but left the sip/drag/rock/liquid tracks on the OLD
sparse pose-to-pose approach. Re-reading motion-taste.md's new "The velocity
audit — run it on EVERY hero track, not just the cycles" rule (written from
measuring this exact scene) and running the audit it prescribes — dense
1-frame sampling, `max / median-while-moving`, everything must stay under
~3x — surfaced THREE separate defects, only one of which the task's own
starting numbers named:

**1. `drink-rig.p` (the glass lift) — 14 sparse keyframes, 7 different named
easing anchors including `travel-balanced`, plus a raw linear boundary
segment.** Measured before the fix: median-while-moving 0.342 px/f, max
3.682 px/f — **10.8x**. Fixed by rebuilding the whole gesture (position,
drag rotation, umbrella rock, liquid slosh) around `waypointCurve` — the
same smootherstep-chain technique the sway fix introduced, now generalized
into a small reusable helper (`smootherstep`/`hannBow`/`waypointCurve`,
defined once, used by every hero track in this file including — after this
pass — `breatheEnvelope` and the trail circles' `floatEnvelope`). Every
waypoint is a TRUE stop (zero velocity via smootherstep, whose own first
AND second derivative are zero at its ends), so there is no bezier
time-remapping step at all — the `travel-balanced` singularity is
structurally impossible. The rise and return legs still ARC via an optional
perpendicular Hann-shaped bow on the relevant segment (also zero-derivative
at both ends, so it never reintroduces a mismatch at the waypoint it bows
away from) instead of Lottie spatial tangents on sparse keys. The old
"riseStart" pass-through waypoint (a forced stop at [0,0] mid-flight) is
gone — the anticipate→overshoot segment now sweeps smoothly through that
region on its own arc instead.

**2. Running the audit on `trailing-rig.r` (straw/umbrella's shared drag)
after that same rebuild still failed at 16.5x — not from a curve
singularity this time.** The waypoints were true smootherstep stops, but
the OLD timing packed a 9°-swing (-6° → 3°, the overshoot-to-rebound beat)
into just 8 frames, sitting right next to a 42-frame 6°-swing and a
23-frame 4°-swing — a genuine pacing imbalance baked into the ORIGINAL
design's chosen keyframe times (present even before this pass; the
`travel-balanced` fix alone couldn't have caught it, since it's not a
within-segment defect). Because `drink-fill.r` (liquid slosh) and the
straw's bow are both DERIVED from this same `dragEnvelope` ("the world
responds" idiom), they inherited the identical 16.5-20.8x failure. Fixed by
retiming (not re-shaping) the waypoints so segment DURATION is proportional
to segment VALUE-SWING (~0.22°/f throughout, instead of 0.05-1.1°/f) — a
smootherstep segment's own peak speed is `|Δv|/duration × 1.875`, so
matching that ratio across every segment is what actually keeps a
multi-beat gesture reading as one continuous motion. Applied the same
proportional-timing fix to the umbrella's own extra rock pre-emptively
(it measured 2.76x before retiming — passing, but close enough to the 3x
ceiling to retime for margin).

**3. `breatheEnvelope` (driving the silhouette morphs and chair-seat squash)
and the trail circles' `floatEnvelope` were untouched by the prior
smoothness-fix pass — because that pass was scoped to the sway specifically
— and both turned out to use the exact same 2-point `travel-balanced`
`evalTrack` construction as the original sway.** Auditing them in isolation
(required since "morphs" and "trail circles" are both on this pass's
mandatory audit list) measured 16.7x and (implicitly, same shape) a similar
order of magnitude. Fixed identically: `waypointCurve` with true
stop-to-stop waypoints at rest/peak/rest, replacing the named-easing
`evalTrack` chain. This made `evalTrack`/`bezierEaseFn`/`sampleTrackAt`
fully dead code (nothing else in this file still calls them) — deleted.

### Verification (velocity audit)

Dense 1-frame-resolution audit of every required hero track, read directly
from the GENERATED `lottie.json` (a generic keyframe evaluator that
replays each track's actual baked `s`/`o`/`i` values — the shipped artifact,
not a hand re-derivation):

| track | max (px/f or °/f) | median-while-moving | ratio | verdict |
| --- | --- | --- | --- | --- |
| drink-rig.p (glass lift) | 0.7305 | 0.3908 | 1.87x | PASS |
| trailing-rig.r (shared drag) | 0.4212 | 0.2371 | 1.78x | PASS |
| straw shape (bow vertex) | 0.2106 | 0.1186 | 1.78x | PASS |
| umbrella.r (own rock) | 0.5054 | 0.3446 | 1.47x | PASS |
| umbrella total (drag+rock) | 0.5054 | 0.2371 | 2.13x | PASS |
| drink-fill.r (slosh) | 0.1886 | 0.1104 | 1.71x | PASS |
| head-rig.r (sway) | 0.0698 | 0.0519 | 1.34x | PASS |
| trail-small.p (float) | 0.0831 | 0.0510 | 1.63x | PASS |
| trail-large.p (float) | 0.0831 | 0.0510 | 1.63x | PASS |
| head-dark morph (vertex) | 0.0838 | 0.0395 | 2.12x | PASS |
| head-face morph (vertex) | 0.0709 | 0.0329 | 2.15x | PASS |

Before the fix (measured before this pass touched anything): `drink-rig.p`
10.8x; `trailing-rig.r`/straw-bow/`drink-fill.r` 16.5-20.8x (post-curve-fix,
pre-retiming); `breatheEnvelope`-driven tracks and trail float 16.7x
(untouched from the prior pass). Every track now sits at 1.3-2.2x, well
inside the ~3x ceiling.

- Frame grid `[0,20,45,70,90,180,269]` unaffected — chair never moves,
  bubble/text unchanged.
- `[15,45]` zoomed 3x — head tilt and glint position still visibly differ
  between the two mid-intro frames — idle alive under the entrance.
- Sip trail `[156..188]` at 3-frame steps, zoomed 4x (the anticipate→
  overshoot rise): the glass advances toward the face by visibly similar
  small increments frame to frame, no jump, no stall — reads as one
  continuous reach, not lurch-then-crawl.
- Loop seam: direct-seek throwaway script, `T=90` vs `op=270` — **0
  differing bytes, max delta 0**.
- Self-test: "the mascot's paw smoothly and gently raises the glass toward
  its mouth in one continuous, unhurried arc, holds for a contented beat,
  and eases back down" — no lurch, no crawl, no stop-start.

### Lesson: the audit has two independent failure modes, not one

A track can fail `max/median-while-moving` for two UNRELATED reasons, and
fixing one does not fix the other:

1. **A curve-shape defect** (a named easing anchor with a hidden
   zero-derivative point, like `travel-balanced` — see the smoothness-fix
   pass above): fixed by using a genuinely smooth primitive (smootherstep,
   `sin`/`cos`) instead of that anchor, regardless of timing.
2. **A pacing/timing defect** (waypoints that are each individually smooth
   stop-to-stop moves, but whose DURATIONS aren't proportional to their
   VALUE swings): fixed by retiming, not by changing the easing shape —
   a perfectly smooth smootherstep segment still produces a speed spike if
   it's asked to cover a big swing in very few frames next to segments
   covering small swings over many frames. Always check BOTH: audit the
   curve in isolation for within-segment spikes (compare a segment's actual
   sampled speed profile against its analytic derivative), AND audit the
   full multi-segment chain for cross-segment pacing imbalance. A track can
   pass the first check and still fail the second, as `trailing-rig.r` did
   here even after its `travel-balanced` was already gone.

Also: when a rule names specific hero tracks to audit ("drink-rig, straw,
umbrella, drink-fill, head-rig, trail circles, morphs"), audit ALL of them
even if the task's own diagnostic numbers only called out one or two —
`breatheEnvelope` and the trail float were both quietly carrying the same
defect the task explicitly fixed elsewhere in the file, and they would not
have been caught without treating the audit as a full-file requirement
rather than a patch verification for the tracks the report happened to
mention.

## v6 — content-proof bubble: anchor slot, leading, and reserved headroom

Team feedback: the bubble crowded the trail dots for longer strings. Root
cause, exactly per recipe-companion-bubble.md's new "A growable plate must
grow AWAY from its tail" item: the plate rect is centred on its own local
origin, so `bubble.size`'s slot-driven height growth pushed the plate's
BOTTOM edge down — straight toward the trail below. Measured before the
fix: `bubble-anchor` `p=[120,62]`, `a=[0,17.5]` (static, half of the
default 35px height); at the default height the bottom sits at 62 (the
authored 9px gap above trail-large's top at 71); at a 2-line height (54,
the PRE-leading figure) the bottom would land at 71.5 — 0.5px INSIDE the
trail-large circle.

### 1 — `bubble.anchor` slot pins the bottom edge

`bubble-anchor`'s `a` (anchor) is now bound to a new slot, `bubble.anchor`,
default `[0, PLATE_DEFAULT_H/2, 0]` = `[0, 17.5, 0]` (unchanged from the
static value it replaces — the file renders identically until a tool
resizes). Tools rewrite `a.y` to `height/2` on every `bubble.size` resize.
The math this pins: the transform is `screenY = local − a.y + p.y`; the
plate's own local bottom edge is at `local = +h/2`. Substituting `a.y = h/2`
gives `screenY = h/2 − h/2 + p.y = p.y` for EVERY `h` — the bottom edge
equals `p.y` (`PLATE_BOTTOM = 62`, unchanged) regardless of height, and all
growth goes upward instead. Published in `controls.json`:
`{ "sid": "bubble.anchor", "label": "Bubble anchor", "internal": true }`,
and given a matching top-level `slots` entry (same pattern as
`bubble.textPos`) so the `sid` actually resolves.

### 2 — `leading: 2` in the autoFit spec

Published in `bubble.size`'s `autoFit`: `"leading": 2` — px added to
`LINE_HEIGHT` (19) per line, but ONLY when the string wraps. A single line
still measures exactly 19 (pixel-true to the source); two lines use 21 each.
This is what makes a 2-line plate's height `2×21 + 2×8(padY) = 58`, not the
cramped `2×19+16=54` a bare line-height repeat would give.

### 3 — Reserved headroom: a uniform stage-shift, not per-constant surgery

Growth now goes upward, so the composition needs headroom ABOVE the bubble
at its tallest that the original layout didn't have: at the unchanged
`PLATE_BOTTOM=62`, a 58px plate's top would land at `62−58=4`, short of
`MARGIN` (7.2, motion-taste's ~3% of 240) by 3.2px.

Rather than re-deriving every individual position constant in this file
(head pivot, chair pivot, drink offsets, trail centers — all tuned against
each other and against the source SVG), the fix is a single new top-level
null, `stage-shift` (`p=[0, SHIFT_Y, 0]`, `SHIFT_Y=5`), that every
previously-unparented root rig (`head-rig`, `drink-rig`, `chair-seat`, all
four chair legs, `bubble-anchor`, `trail-small`, `trail-large`) now parents
to. A rigid group translation preserves every gap between them EXACTLY (the
"steady island" idiom, applied to the whole scene instead of one layer) —
none of `PLATE_CENTER_Y`, `PLATE_BOTTOM`, or the trail circles' own
coordinates changed at all; they're the shared parent's LOCAL values, and
only the FINAL on-screen Y gains `SHIFT_Y`. The chair legs' own lowest point
is ~226 in the un-shifted 240 comp, so there's ~14px of genuinely unused
room below to spend; `SHIFT_Y=5` spends 5 of it.

With the shift: top-at-max[1] = `PLATE_BOTTOM − 58 + SHIFT_Y = 62−58+5 = 9`,
clearing `MARGIN` (7.2) by 1.8px.

### 4 — `max` derived from the geometry, not guessed

- `max[1]` (height): `2×(LINE_HEIGHT+LEADING) + 2×PAD_Y = 2×21+16 = 58` — a
  3-line wrap (`3×21+16=79`) would need `top = 62−79+5 = −12`, deeply
  negative; no reasonable stage-shift recovers that, so 2 lines is the real
  ceiling this layout supports. A longer string widens toward `max[0]`
  instead (still wraps at 2 lines max).
- `max[0]` (width): `240 − 2×MARGIN = 225.6` — this ALSO corrected a stale
  figure: the previous `max[0]=208` was computed from a leftover `16px`
  margin (`240/2−16=104, ×2=208`), the same mis-scaled "~16px at 512"
  constant a much earlier pass had already corrected for `max[1]` but never
  re-applied to `max[0]`. `PLATE_CX=120` is the exact stage-center, so the
  corrected value is symmetric.

### Verification (blocking — baked throwaway copies, rendered and pixel-measured)

A generic pixel scanner (search outward from the analytically-expected edge
position for the first row containing dark pixels, across the plate's own
X-span) measured the ACTUAL rendered plate/trail/text bounds — not paper
math — for three baked cases at frame 90 (settled):

| case | plate size | measured gap (plate→trail) | measured top margin | text center offset |
| --- | --- | --- | --- | --- |
| A: default "Almost time to relax" (authored, unmodified) | 176×35 | 9 (target 9) | 32 | dx=0.00, dy=0.00 |
| B: two-line "Almost time to relax / friend" | 188×58 | 9 (target 9) | 9 (target ≥7.2) | dx=0.00, dy=0.00 |
| C: two-line near max width/height, "Almost time to relax with / your best friend today" (225×58, at `max[1]` and within 0.6px of `max[0]`'s text budget) | 225×58 | 9 (target 9) | 9 (target ≥7.2) | dx=0.00, dy=0.00 |

Case A confirms "unchanged from today" exactly (176×35, the same authored
default, gap still 9). Cases B and C confirm the anchor mechanism holds the
9px gap EXACTLY regardless of height, that the reserved headroom clears
`MARGIN` with margin to spare (9 ≥ 7.2, a 1.8px buffer) at the real ceiling
height, and that text stays centred to sub-pixel precision on both axes at
every size tested (text measured via the actual Nunito-Bold font metrics
loaded in CanvasKit, not assumed).

Also re-confirmed after the stage-shift (which re-parents `head-rig` and
`drink-rig`, among others): frame grid unaffected; `[15,45]` zoomed 3x still
shows the idle alive under the entrance; `[180,256]` zoomed 5x still shows
the silhouette morph visibly different at rest vs peak; loop seam direct-seek
diff — **0 differing bytes, max delta 0**.

### Lesson: a pixel-index bug that only shows up at odd widths

While building the verification script, a `findEdge` pixel scanner passed
for the default (176) and 188-wide cases but silently failed (returned
`null`, "not found") for the 225-wide case. Root cause: `plateLeft =
120 − W/2` is a HALF-INTEGER whenever `W` is odd (`225/2=112.5` → `7.5`),
and a `for` loop built from that (`x = plateLeft+2 = 9.5`, incrementing by
1) walks HALF-INTEGER pixel indices into the frame buffer — `Buffer`
indexing silently returns `undefined` for a non-integer index, so every
`isDark` check quietly evaluated to `false` across the whole scan, with no
error. Fix: `Math.ceil`/`Math.floor` the scan bounds before looping. Lesson
for any future pixel-measurement verification: a scanner that appears to
work on two test cases and fails on a third dimension-varied one is a
strong signal to suspect integer/rounding assumptions baked into the SCAN,
not necessarily a real defect in the render — verify the scanner against a
visual render (a plain PNG dump) before trusting a `null`/failed
measurement as evidence of a bug in the scene itself.

## v7 — reserved headroom, take two: bake the shift per-layer, not via an ancestor

The v6 anchor/leading fix was correct and stayed verified; only the
RESERVED HEADROOM half of it wasn't actually landing. The app's own
layout/measurement code was run against this scene and reported the
2-line margin as still `4.0` (fail) — exactly the UNSHIFTED value
(`62-58=4`) — even though v6 had already introduced a `stage-shift` parent
null translating the whole composition down by 5px.

**Root cause:** that tooling reads each layer's own authored `p`/`a`
directly; it does not walk the parent chain. A shift living only on an
ancestor's transform is invisible to it — correct Lottie, renders
identically, but undetectable by a consumer that doesn't simulate the full
transform composition.

**Fix:** removed the `stage-shift` null entirely and baked `SHIFT_Y` (now
`4`, not `5`) directly into every top-level layer's OWN `p`:

- `bubble-anchor`: `p.y = PLATE_BOTTOM + SHIFT_Y = 66` (was `62` via the
  ancestor). `a` (the `bubble.anchor` slot) is untouched — still
  `[0, PLATE_DEFAULT_H/2, 0]`.
- `head-rig`, `chair-seat`: these already pivot via `a == p` ("no net
  translation"). `a` stays at the TRUE pivot (unshifted — rotation/scale
  still pivot exactly where they always did); `p` becomes
  `pivot + [0, SHIFT_Y, 0]`. Since `screenPoint = local - a + p`, adding
  `SHIFT_Y` to `p` alone while `a` stays put shifts the whole rig uniformly
  without disturbing what it rotates/scales around.
- Chair legs (static, `a=p=[0,0,0]`): `staticShapeLayer` gained an optional
  `p` override parameter; the four leg calls now pass `p=[0, SHIFT_Y, 0]`.
- `drink-rig` (no pivot pattern — `a=[0,0,0]`, `p` carries the small
  sip-lift delta directly): `SHIFT_Y` added to the Y component of every
  sampled point in `drinkPosPoints`, not a single constant.
- Trail circles: `SHIFT_Y` added to `cy` where each circle's own dense
  position track is built (`cy + SHIFT_Y - FLOAT_AMOUNT*floatEnvelope(...)`).

This is the SAME rigid-group-translation result as v6 (every authored gap
between chair/mascot/drink/trail/bubble preserved exactly, since every
piece moves by the identical `SHIFT_Y`) — just expressed on each layer's
own numbers instead of a shared ancestor, so it reads correctly regardless
of whether a consumer walks parent chains.

### Re-derived numbers (SHIFT_Y=4, not 5)

- Plate bottom (on-screen) = `PLATE_BOTTOM + SHIFT_Y = 62+4 = 66` (was 67
  with `SHIFT_Y=5`).
- `max[1]` re-derivation: `(plate bottom − margin)`, rounded DOWN to a whole
  number of lines at `lh=LINE_HEIGHT+LEADING=21` with `2×PAD_Y=16` padding.
  `66−7=59`; largest `N` with `N×21+16 ≤ 59` is `N=2` (`58 ≤ 59`; `N=3` gives
  `79`, far over) → **`max[1]=58`, unchanged from v6** (58 was already the
  answer at the old margin too — `66-58=8` clears 7 by 1px, same practical
  outcome whether the margin constant used is the file's exact `MARGIN=7.2`
  or this task's rounder `7`: `66-7.2=58.8`, floor-to-2-lines is still 58).
- `max[0]`: untouched, `225.6` — the shift is vertical only and doesn't
  touch the horizontal derivation.

### Verification (blocking — baked throwaway copies, pixel-measured)

Same generic pixel scanner as v6 (search outward from the analytically-
expected edge for the first row/column with dark pixels), re-run against
the corrected `SHIFT_Y=4` build:

| case | plate size | gap (target 9) | top margin (target ≥7) | left/right clearance | text center offset |
| --- | --- | --- | --- | --- | --- |
| A: default (unmodified) | 176×35 | 9 | 31 | 32 / 31 | dx=0.00, dy=0.00 |
| B: two-line "…relax / friend" | 188×58 | 9 | 8 | 26 / 25 | dx=0.00, dy=0.00 |
| C: two-line at max[1], near max[0] width | 225×58 | 9 | 8 | 8 / 6* | dx=0.00, dy=0.00 |

*Case C's plate (225 wide, against a symmetric `PLATE_CX=120` and a
geometric clearance of `(240-225)/2=7.5` per side) measured 8px left / 6px
right in pixel scan — a ~1-2px asymmetry from stroke antialiasing/rounding
in the scanner, not a real geometry defect (the authored rect is exactly
centered; both edges are theoretically 7.5px clear). Confirmed by checking
the analytic clearance directly rather than trusting the scan alone.

Chair legs' lowest point measured at y=230 (was ~226 pre-shift, +4 exactly
as expected) — 9px of bottom clearance remains, nothing crosses the stage
edge.

Also re-confirmed: frame grid unaffected; `[15,45]` zoomed 3x still shows
the idle alive under the entrance; loop seam direct-seek diff — **0
differing bytes, max delta 0** (T=90 vs op=270).

### Lesson: "renders identically" isn't the same as "measures identically"

A shift applied via a shared ancestor transform and a shift baked into each
layer's own `p` produce byte-identical PIXELS (both are valid, correct
Lottie, and Skottie composes parent chains correctly) — but they are NOT
interchangeable if anything downstream inspects the FILE's per-layer values
directly instead of rendering and measuring pixels. Before choosing "one
shared parent" as the implementation of a uniform shift, check whether the
thing that will VERIFY the fix (an app's layout code, a design tool, a
future measurement script) walks the parent chain or reads each layer's own
authored transform in isolation — if it's the latter, the shift has to be
baked per-layer even though a shared ancestor is the more elegant/DRY
Lottie construction.

## Applying this to a future duplicate-brief pass

When a new project slug arrives with a source SVG byte-identical to a prior
scene in this family, copy the **most recently regenerated** sibling build
script (check mtime and grep for `CLOCK_BREATHE`/`textPos`/`keyOnBoundaries`
to confirm it has the current feature set), rename the slug throughout,
rerun, and re-verify the loop seam directly with a throwaway CanvasKit
seek-and-diff script rather than diffing `preview-scene.mjs`'s own clamped
grid output. It's faster than re-authoring and inherits every already-fixed
defect for free — but only if the source you copy is actually current.
