# Motion Taste

Use this reference when choosing pacing, easings, staging, or animation style.

## Contents

- Principles
- Timing Defaults
- Easing Anchors
- Fluidity — The Character-Animation Bar (incl. Living idles: articulation,
  held objects, worn assemblies, breathing bodies, amplitude audits,
  phase-locked effort)
- Choreography
- Reveal Grammar
- Chapterization And Transition Grammar
- Motion Economy
- Typography Choreography
- Data And Figure Motion
- Camera, Parallax, And Scene Motion
- Path Reveals And Loops
- Loop And Generative Motion
- Style Presets
- Render-Aware Motion
- The Aliveness Contract ← the completion gate; run it before finishing
- Final Motion Review
- Checks

## Principles

- Stage motion in readable beats: anticipation, action/reveal, settle.
- Elements whose artwork forms ONE continuous line are ONE gesture. Read the
  source's connectivity before staging entrances: endpoints that touch (a
  ribbon's head on a scribble's start, a scribble's tail running into its
  spark) are a single drawn stroke — one technique family, never a fade-in
  beside a draw-on, which reads as two unrelated events (field-tested, twice).
  **And a hand draws such a line SEQUENTIALLY along its own length, not
  simultaneously outward from the join.** Chain the pen order — reverse
  whichever piece needs it so each half ENDS where the next one BEGINS, and
  run them back-to-back with no gap and no overlap. Give each half a duration
  proportional to its own arc length — measure it, don't eyeball it (the
  `pathLength()` sampler in `build-paymentconfirmation-story-three-4obq.mjs`
  is the reference implementation); a long smooth sweep may run somewhat
  hotter than a tight scribble, ~1.4× on the one scene where it was measured,
  so treat that as a data point rather than a ceiling. The pen never changes gear
  mid-stroke; ease both halves the same way, and the small slowdown where
  they meet reads as the hand rounding a corner. Simultaneous radiating from
  a midpoint is right only for a genuine burst (sparks, confetti) — for
  anything that reads as drawn, it looks like two pens starting at once.
- Give the primary subject the clearest timing. Secondary elements should support
  it, not compete.
- Match easing to intent. Functional UI needs speed and clarity; brand motion can
  hold longer; playful effects can overshoot more.
- Avoid linear interpolation unless mechanical motion is the intent.
- **A speed-up out of a linear segment must be velocity-continuous.** When a
  constant-rate motion (a sweeping hand, a scanner, a scrolling field) hands
  into an eased acceleration, a stock accelerate curve STARTS at near-zero
  slope — the element visibly stalls before speeding up. Solve the eased
  segment's departure tangent from the incoming rate: for a cubic-bezier ease
  the normalized start slope is `y1/x1`, so set `y1 = x1 · (v_in / v_avg)`.
  And add travel (whole extra turns, extra laps) until the eased segment's
  AVERAGE rate genuinely exceeds the linear one's — "it accelerates" must be
  true of the geometry, not just of the easing's name. (Field-tested: a clock
  hand at 7.5°/f handed 164° to exit-accelerate and stalled dead at the
  boundary; +360° of travel and a solved tangent made it whip.)
- Avoid generic easing where every property shares the same timing by default.
  Use locked timing for rigid/UI-stable motion, and offset opacity, position,
  scale, or trim timing only when it improves choreography.

## Timing Defaults

- UI microinteractions: 12-30 frames at 60 fps.
- State feedback icons: 30-75 frames, usually with a short hold.
- Logo marks: 45-120 frames depending on complexity.
- Lower thirds: 45-90 frames in, optional 30-60 frames out.
- Typography reveals: 45-150 frames depending on text length.
- Product/social promos: 90-180 frames for one clear message.
- Loaders/icons: loop cleanly over 60-120 frames.

## Easing Anchors

Known-good defaults to **derive from**, not a closed preset list. Anchors
describe motion **behavior** (entering, settling, traveling, exiting, looping,
cut companion), not layer type: a logo, hero, title, card, or accent each picks
by what it is doing this beat. Bezier is `x1,y1,x2,y2`.

| anchor | behavior | cubic-bezier | feel |
| --- | --- | --- | --- |
| `entrance-sharp` | entering, mask-wipe decel | `.20,.75,.34,.94` | fast in, soft land |
| `settle-soft` | settling, count-up landing, logo lockup | `.00,.65,.51,.99` | deep ease-out, no bounce |
| `kinetic-ui` | expressive small state move (toggle, accent) | `.85,.46,.14,.53` | lively — not every UI move |
| `expressive-pop` | active kinetic word, brand flourish | `.94,.75,.34,.94` | fast-out + soft settle (overshoot opt-in) |
| `travel-balanced` | object travel, camera, state-to-state | `1.00,.49,.00,.55` | S-curve ease-in-out |
| `exit-accelerate` | exiting, hard-cut companion | `1.00,.02,.54,.42` | slow start, fast end |
| `travel-cut` | only interrupted / masked / cut-before-settle | `.15,.85,.95,.05` | fast-slow-fast, never settles |

- Derive, don't invent: start from the nearest anchor and adjust one quality —
  acceleration, coast, landing softness, exit speed, overshoot. Reach for a new
  curve only when no anchor fits.
- Per-property orchestration: choose *how* properties coordinate, not just which
  easing each uses — match the method to the motion character. *Locked*
  (start/end together) for UI, panels, buttons, mechanical/synced state.
  *Lead/follow* (one property leads a few frames, another follows) for
  logo/hero/organic, where position, scale, rotation, opacity, masks, trim, or
  number changes may use different curves, start/end frames, or durations.
  *Primary/secondary* (one property carries the motion, others support subtly).
  *Early-opacity/late-settle* (opacity resolves fast while position/scale keeps
  settling, for readability). *Single-property overshoot* (only scale or
  rotation overshoots, position stays controlled).
- Hierarchy: only the focal element gets the strongest personality
  (`expressive-pop`, overshoot, snap); support uses quieter anchors
  (`settle-soft`, `travel-balanced`).
- Distance/duration: large travel → smoother acceleration and more time (don't
  snap); tiny UI → short, not theatrical; camera → calmer than the objects in it.
- Asymmetric per-phase easing: for a rise-then-fall, away-then-return, or
  push-off-then-settle, ease **out** on the up/away phase and **in** on the
  down/return phase — weight pushes off fast, hangs at the apex, then falls
  faster than it rose. A symmetric (mirrored) split, or the up-curve simply
  reversed for the down, reads mechanical — a hover, not a step, a bounce, or a
  balloon settling. Choose the split deliberately for the character wanted.
- Typography: support `settle-soft`; active word `expressive-pop`/`entrance-sharp`.
  Count-up: near-linear digits, `settle-soft` landing. Mask-wipe: `entrance-sharp`,
  revealed content `settle-soft`.
- Hard cut / jump cut / chapter transition: outgoing `exit-accelerate` (or
  `travel-cut` for long travel), cut before it settles; pair with a motion-masked
  swap when continuity matters — see Chapterization And Transition Grammar.
- Loop reset: match first/last velocity; use a visible reset only via
  `exit-accelerate`+cut.
- Overshoot: small, premium-off by default. Prefer a settle-back keyframe (past
  the target, then ease back — Skottie-safe); end `i.y` ~1.08 to 1.2 is the
  compact alternative.
- Also useful: anticipate (pull slightly opposite before a fast reveal),
  steps/holds (typewriter, counters, scans, technical beats), and continuous
  linear (rotations, scanners, progress loops, mechanical seams).
- Accent monochrome line art with MOTION, never with brightness: on dark
  strokes over a light ground, "brighten" walks toward the ground colour and
  reads as the element blinking out (field-tested: a tick "lit" toward white
  on a white dial face simply vanished). A pass accent — if the brief asks
  for one at all — is a small scale/position pulse on the element's own
  pivot. Dial furniture (ticks, numerals, hatches) is DECAL by default:
  perfectly still unless the brief explicitly animates it.
- Speed lines TRAIL the move that just happened — they are the air the
  subject just passed through, never a preview of where it is going: absent
  at rest, absent at the apex, streaming in partway into the fast phase
  (typically the descent), gone by the impact. Marks that lead the motion or
  ride at rest read as antennae stuck to the character, not as air.
- **A completed gesture gets punctuation.** When something draws itself on —
  a checkmark, a stroke, a written word — the pen lifting is a beat, not a
  stop: give the finished mark a small stamp-settle (2-3% overshoot on its
  own pivot over a few frames) so the completion clicks physically. Trace
  the beat's punctuation chain to find the gap — a scene that pulses the
  hand-off and pops the exit but lets the actual payoff mark just stop has
  punctuated everything except the moment that matters. (recipe-loaders-icons'
  `check-complete` preset says "draw plus short settle" — this rule is why,
  and it applies wherever a drawn mark completes, whatever recipe routed.)
- `travel-balanced`'s asymmetric control points (`1.00,.49,.00,.55`) are
  tuned for longer travel — compressed into a short segment (under ~10
  frames) genuinely bounded by a stop on BOTH ends (an overshoot extremum,
  a hold, a settle), they front-load into a visible mid-segment speed spike
  instead of a smooth single hump. For that specific case (short, stop-to-
  stop), derive a symmetric slow-start/slow-end curve instead (e.g.
  `.42,0,.58,1`) — verify with the spacing check below if in doubt.
- **`travel-balanced` has a genuine, length-independent mid-segment velocity
  singularity, not just a "short segment" risk.** Its time-component
  control points (`x1=1.00, x2=.00`) give `dx/ds = 3(1-2s)²`, which is
  exactly zero at `s=0.5`, while the value-component's derivative there is
  non-zero (`dy/ds≈0.795` for its stock `y1=.49,y2=.55`) — an infinite
  `dy/dx` at that single instant, wherever it lands in the segment,
  independent of how many frames the segment spans (found by dense-sampling
  a 45-frame `travel-balanced` segment and measuring a 4-9x per-frame delta
  spike right at its temporal midpoint — a real property of the curve, not
  a sampling artifact, so no amount of finer sampling removes it). Any two
  keyframes using this ease where the motion must read as ONE continuous
  sweep — a pendulum-style back-and-forth being the clearest case — will
  bake in a hitch at the segment's own halfway point. For a genuine
  back-and-forth SWAY/pendulum specifically, skip bezier-approximating it
  altogether and drive the envelope with a real `sin`/`cos` call — a true
  sine has no such singularity anywhere and is simpler to author besides.
  Before trusting ANY named anchor for a primary, hero-visible cyclic
  motion, hand-derive or numerically scan its `dx/ds` component (not just
  eyeball a rendered grid) for a zero-crossing — that is what a hidden
  spike looks like in the math, and a whole-scene frame grid at small
  amplitude will not show it.

## Fluidity — The Character-Animation Bar

When anything reads as a being or a held object — mascots, limbs, paws,
props, faces — the bar is feature-animation fluidity: motion that never
stutters, pops, or detaches. Four rules make it mechanical, and one check
makes it verifiable:

- **Velocity is continuous through poses.** A keyframe an element passes
  THROUGH must not zero its speed: ease-out into the pose plus ease-in out of
  it makes motion die at every keyframe — the "keyframey" stutter. Shape the
  handles so speed flows through intermediate keys (outgoing handle continues
  the incoming direction), and reserve genuine stops for moments that ARE
  stops. Prefer fewer, well-shaped keyframes over many nearly-flat ones.
- **Organic motion travels in arcs.** A paw raising a glass, a head turning,
  a prop being carried — none of these move in straight lines. Author
  position with spatial tangents (`to`/`ti`) so the PATH curves; a straight
  segment between two poses on a character reads robotic even with perfect
  easing. Straight lines belong to UI panels and mechanical slides.
- **Overlap is drag, never delay.** The single most common clunk: giving a
  follower (straw, umbrella, ear, held object) the parent's keyframes shifted
  a few frames later. That is a copy lagging behind — it reads as detached,
  laggy, broken. A follower shares the parent's PHASE of motion but with its
  own softened curve: it starts moving while the parent is still moving,
  bends further at the peak (more amplitude at the tip, less at the root),
  and settles a beat later with its own overshoot. Drive it as reduced-and-
  rotated amplitude on the same timing, or its own curve overlapping the
  parent's — never a time-shifted duplicate.
- **Anticipation and settle bracket every accent.** A snappy action (sip,
  squeeze, glint, blink) gets a small counter-move before (2–4 frames, a few
  px opposite) and never lands on its final value dead — it overshoots
  slightly and eases back. Mass never starts or stops instantly.

- **A pure sine is compliant but restless.** A raw `sin2pi`-style baked driver
  (breathing, idle sway, any continuous cyclical squash/morph) always scores
  max/median ≈ 1.41 on the Fluidity check — comfortably under the 3× gate,
  but its angular speed is constant, so the element moves FASTEST at the
  exact midpoint and never dwells at its own extremes. When that reads as
  restless rather than alive, reshape the driver instead of just shrinking
  its amplitude: pass a raised cosine through a smoothstep — `u = (1 -
  cos θ)/2, drive = 2·smoothstep(u) - 1` (θ = the same `2π·t/period +
  phase` angle the raw sine used) — same ±1 range, same period, same phase,
  so any lag between dependent tracks (e.g. a body morph quarter-cycle
  behind its shell) carries over unchanged; only the speed profile changes,
  hanging at the extremes and moving faster through the crossing. Pushes
  max/median toward ~2.8 — still under the 3× ceiling, now with real settle.

**The spacing check (blocking for hero moves):** render a moving element at
every 2–3 frames across its move and READ the trail like an animator flipping
pages. The positions must form a smooth arc whose spacing grows and shrinks
gradually — spacing IS speed. Equal spacing means linear (dead) motion;
spacing that collapses to zero at an intermediate pose means the motion
stalls there; a sudden spacing jump is a velocity pop. Fix the curves until
the trail itself looks drawn by hand.

### Living idles — the Rive-grade bar

A character idle that reads as ALIVE (the way Rive rigs do) is not sparse
pose-to-pose keyframes with nice easing — it is a small **motion system**.
Four properties separate a living idle from a placed one:

- **Motion is a function; keyframes are its samples.** Author each element's
  cycle as an eased point track — `[{t, v, ease}, …]` closing back on its
  start value — and TILE that cycle across the timeline. Coupled and derived
  motion then comes from *evaluating the track at arbitrary t* (through real
  cubic-bezier easing), not from copying keyframes. A generator makes dense
  keyframes free: a living loop lands in the hundreds of keyframes where a
  placed one has a few dozen, and that density is exactly the hand-drawn
  texture the eye reads as fluid.
- **A few shared clocks, non-trivial ratios.** Give the scene 3–5 periods
  whose ratios aren't 1:2:4 (e.g. 132/216/297 frames), each dividing the
  loop length exactly. Every element binds to a clock; details peak at
  different beats, so the loop never reads as one metronome.
- **Key exactly on the loop boundaries — never span them.** Every animated
  track must carry an explicit keyframe AT the loop start T and AT op, with
  equal values. A segment that merely CROSSES T (e.g. an intro-echo junction
  running 84→96) makes the value at T an interpolation that almost never
  equals the key at op — a seam leak invisible to endpoint checks and to
  eyeballs, caught only by pixel-diffing rendered frames T and op. Tile
  cycles FROM T, land the echo's last point ON T, and verify the seam by
  comparing pixels, not keyframes.
- **The world responds.** For every primary motion, at least one OTHER
  element visibly answers it, derived from the same track: the shadow
  widens and lightens as the body floats up; the seat compresses on the
  down-beat; liquid sloshes when the glass moves; paper rocks when the pen
  taps. Response is what makes motion read as weight in a world instead of
  layers wiggling independently.
  **The response boundary — GROUND answers, BACKDROP does not.** Which other
  elements answer is decided by physical relationship, not proximity:
  anything sharing the subject's contact surface (the shadow, the seat, a
  floor prop, the thing he lands on or touches) answers every impact with a
  low-amplitude derived response (`amplitude × the body's own driver`, a
  frame or two behind, rest == source by construction — never an own clock).
  Backdrop DECORATION — ribbons, glows, halos, decorative strokes floating
  BEHIND the subject — stays serene: its aliveness is its own quiet accent
  (a gleam, a slow breath), and a sympathetic jolt on it reads as jitter,
  not weight. What this bans is the IMPACT-KEYED jolt, not derived motion in
  general: a smooth parallax counter-move on a distant backdrop is still
  right (see "Distant backdrops hold still"), because slow drift derived
  from travel reads as depth where a flinch derived from a landing reads as
  a twitch. Field-tested in BOTH directions on one scene: the
  ground shadow answering every landing sold the weight, while a derived
  dip on the floating greens behind him read as "sudden moves on a delicate
  background element" and was reverted by the designer. When unsure whether
  an element is ground or backdrop, ask what he would disturb by landing —
  air doesn't flinch.
  - **A derived response's rest value must equal the source pose, the same
    "rest == source" discipline the primary track already follows.** The
    tempting shortcut is to write the response as `amplitude * (1 -
    primaryDriver(t))` when the response should be strongest while the
    primary is idle/relaxed (a counter-phase read) — but if `primaryDriver`
    is itself 0 at true rest (as an idle-from-frame-0 track should be, per
    "key exactly on the loop boundaries"), that formula evaluates to
    `amplitude * 1`, not 0, at rest: frame 0 (and every flat inter-cycle
    gap) silently renders the response shape ALREADY offset from the
    unmodified source silhouette, not matching it as the neutral pose
    should (character-rig recipe's "the neutral pose matches the source"
    check). Caught by comparing a rendered frame 0 against the source SVG
    pixel-by-pixel, not by eyeballing — the offset is often too small to
    spot by eye but is a real, keyed value, not a rendering glitch. Fix:
    write the response as `amplitude * primaryDriver(t)` (or `-amplitude *
    primaryDriver(t)` for the opposite sign), so it is exactly 0 whenever
    the driver is 0, and flip which extreme of the driver's range gets the
    positive/negative sign instead of wrapping the whole driver in `1 -`.
- **Amplitude that reads at arm's length.** A primary idle motion moves at
  least ~1.5% of the composition's min dimension (≈8px at 512) or ~3% of
  scale; a secondary at least half that. Motion below ~0.5% is invisible —
  either raise it until it reads or cut it; imperceptible keyframes are dead
  weight, not subtlety. Restraint means few THINGS moving, never movements
  too small to see.
- **Mood governs the system.** The clock periods, amplitudes, easing
  sharpness and accent count are FUNCTIONS of the scene's emotional register,
  read from the prompt AND the artwork's posture — never one house default.
  Calm/contemplative scenes (relaxing, lounging, floating, sleeping —
  a reclined or seated pose is itself a mood signal): long periods (4–6s+),
  amplitudes AT the aliveness floor rather than above it, and motion shaped
  as DRIFT and SWAY — slow rotation about the support point, breath carried
  by the silhouette morph — with ONE soft accent per loop. Energetic scenes
  (victory, dancing, working out): short periods, amplitudes well above the
  floor, snappy accents. The classic mood violation, named so it never ships
  again: a VERTICAL position oscillation on a seated or reclined character
  reads as squats / sit-ups / exercise regardless of easing — restfulness
  lives in rotational sway and chest-breath morphing, and the body's y
  stays within ~1–2px. If a viewer could describe the motion with a gym
  verb, the mood is wrong.
- **Bake smooth, not stepped — and keep a calm spectrum clean.** Two ways a
  correct motion system still ships robotic motion, both measured in the
  field: (1) SAMPLING — baking a cycle as linear segments every ~6 frames
  turns a slow sine into a polyline; velocity jumps at every sample and the
  character moves like a robot. Emit the authored cycle points with their
  TRUE easing handles (the evalTrack/tileCycle way), or bake at 1–2-frame
  steps where the polyline is indistinguishable from the curve at 60fps —
  never coarse linear resampling. (2) SPECTRUM — summing two near-equal
  frequencies makes the composite beat: it plateaus and micro-reverses
  mid-swing, which reads as hesitant, elderly sway-stop-sway. A calm
  primary is ONE clean low-frequency sine; secondaries sit at ≤⅓ its
  amplitude and a clearly different period. Verify on the rendered trail:
  between apexes the spacing must swell and shrink MONOTONICALLY — a
  mid-swing spacing collapse or direction flicker is this defect. An apex
  hesitation is natural for at most a frame or two; anything longer is a
  stop.
- **The velocity audit — run it on EVERY hero track, not just the cycles.**
  Fixing the primary cycle and leaving the accents (a sip, a wave, a
  reach — one-shot moves that still repeat every loop) on sparse
  pose-to-pose keys with mixed named anchors is how a scene keeps its
  robotic feel after the "smoothness fix": measured in the field, a sway
  rebuilt as a dense sine sat next to a 14-key drink move whose per-frame
  speed spiked **10.8×** over its own median — the hand lurched, then
  crawled, and the whole scene still read as laggy. The audit is
  mechanical, so do it every time: dense-sample each hero track at
  1-frame steps, compute per-frame speed, and take `max / median-while-
  moving`. A move that should read as one continuous gesture stays under
  ~3×; anything past that is a lurch a viewer WILL feel, no matter how
  correct the poses are. **Scope the threshold to CONTINUOUS motion** —
  idles, sways, breathing, carried props, travel. A one-shot ENTRANCE or a
  deliberate snap accent (a bubble popping in, a glint sweeping, a
  bounce landing) is *supposed* to spike: high peak-over-median is what
  "snappy" means, and flattening those to satisfy the number is a
  regression that drains the scene of life. Audit every track, then judge
  each flagged one by its job: continuous → fix it; entrance/accent →
  confirm the snap is intended and move on. Fix by driving the gesture from a continuous
  envelope (sine/smoothstep over its own duration) baked at 1–2-frame
  steps — one coherent acceleration profile — instead of stitching named
  anchors between sparse poses. Never leave `travel-balanced` on a track
  that must read as a single sweep (see its singularity note above), and
  never leave a raw linear segment (`0,0,1,1`) inside an organic gesture.
  **A named anchor tuned for a dramatic entrance/exit can itself blow this
  ceiling at small, continuous-cycle amplitudes — the curve is smooth, the
  ceiling still fails.** `entrance-sharp`/`exit-accelerate` (and similar
  "fast start, soft land" / "slow start, fast end" anchors) have a large
  internal tangent ratio BY DESIGN — roughly 40-60× between their initial
  and final slope, appropriate for a hero move covering real distance. Used
  on a small continuous cycle (a several-px walk bounce, a few-percent
  squash) that internal ratio shows up almost unchanged in the max/median
  audit, because there's no larger motion around it to dilute the spike:
  measured 8.07× on a 6px bounce and 9.84× on a 12px steam drift, both using
  these two anchors directly, both otherwise smooth curves. Fix: derive a
  gentler sibling for continuous/cyclic tracks specifically — same
  qualitative shape (ease OUT on the away phase, ease IN on the return) at a
  shallower internal ratio (e.g. `[.40,.55,.60,.90]` / `[.45,.20,.65,.70]`
  cleared 1.3-1.9× on the same tracks) — rather than assuming a named anchor
  is safe everywhere just because it renders smoothly. Separately, keyframe
  TIMING can cause the identical symptom even with safe easing: four points
  per cycle spanning very uneven time gaps (10f / 26f / 26f / 10f) for a
  tiny total value range measured 17.29× purely from the spacing; collapsing
  to two evenly-timed points (matching the cycle's own natural contact/apex
  beats) removed it independent of the easing curve. Audit both causes
  separately before concluding a "lurch" needs a different curve.
- **The silhouette breathes — morphs, not just transforms.** Rigid
  transforms (position/rotation/scale) MOVE a character; they never make it
  read alive the way a rigged Rive mesh does, because the OUTLINE never
  changes. **A uniform scale is a ZOOM, not a breath** — this is the shape
  the defect actually takes in the field, and it survives every other gate:
  a shipped companion carried 256 dense breathe keys running 97%→103% with
  `sx === sy` to four decimals on every one of them, so the body grew and
  shrank while staying the identical circle. Contacts all measured 0.00px and
  the mechanical checker reported the scene clean, because at the time nothing
  in it could see a silhouette. The cheapest real fix is counter-phased axes
  with area conserved (`sx = 100 + a·sin`, `sy = 100 − a·sin`); the full one is
  path keyframes below. `check-motion.mjs` now fails this as SILHOUETTE STILL.
  The missing layer is shape-path keyframes: animate the actual
  bezier vertices (`{a:1}` on a shape's `ks`, same vertex count and order on
  every key) so the body squashes wide-and-low into the down-beat and draws
  tall-and-narrow at the top with area roughly conserved (±2%); a face patch
  deforms WITH the mass it sits on instead of sliding over it; props flex
  along their length (a straw bows, it doesn't hinge); eyes blink by
  morphing closed at an off-beat. Author morphs PARAMETRICALLY — a deform
  function applied to the base path's vertices (scale about the planted
  edge + bulge proportional to distance from it), evaluated on the same
  clocks as everything else — never hand-edited frames. Morph tracks obey
  every other rule here: dense samples, boundary keys at T and op, seam
  verified in pixels. Self-test: render the two extreme beats and compare
  silhouettes — if the outline is identical, the character is a puppet
  being moved, not a body that's alive.
- **Articulate the PARTS — a limb that only travels is a stick.** The
  silhouette rule covers the body's outer form; this one covers everything
  inside it. Every sub-part the artwork names — forearm, bicep, fist, paw,
  ear, tail, jaw, prop — is a part a real body moves *relative to its
  parent*, and it must get its own track. The failure mode, measured in the
  field on a flexing-mascot scene: 30 layers, 12 of them arm pieces, and the
  ONLY animated tracks were two `arm-*-rig` parents carrying position and
  rotation. The arms rose, fell and spread — but every bicep, fist, knuckle
  and highlight rode along rigidly, so the arms never actually FLEXED. A
  double-bicep flex where the forearm never approaches the bicep is not a
  flex; it is two boards being lifted.
  - **Joints bend.** Where the artwork separates the pieces, nest the pivots
    and rotate the child about the joint (forearm about the elbow, hand
    about the wrist) so the limb's ANGLE changes, not just its placement.
    Where the artwork is one merged shape, bend it with a path morph — same
    parametric approach as the silhouette rule, hinged at the joint.
  - **Extremities lead or lag their root**, never move in lockstep with it:
    the fist arrives after the bicep, the fingertip after the wrist. Rigid
    parenting alone gives lockstep, which is what reads as "stick".
  - **A lag-null's PIVOT choice decides whether it lags position or only
    spins in place.** The natural instinct is to put the delayed child null
    at the extremity's own center (e.g. a "wrist" null anchored at the
    fist's bbox center, carrying the fist). That is wrong: when a null's
    anchor and position both equal the exact point where its child already
    sits, the child's local offset from that anchor is `(0,0)` — so
    `R(rotation)·(0,0) = (0,0)` regardless of how much the null rotates, and
    the child never actually MOVES, it only spins in place around its own
    center (a subtle wobble, not a lag). To get genuine positional drag,
    pivot the lag-null at the SAME joint as its parent (e.g. the elbow), not
    at the child's own center — then the delayed rotation swings the child
    through a real arc around that shared joint, arriving on its own timing.
    Caught by animating the extremity's own accent (a scale pulse, say) with
    the same lag and finding it visually convincing while the position
    itself was silently frozen — verify a lag-null's effect by computing the
    child's WORLD position at two extremes, not just eyeballing the rotation
    value.
  - **Coverage, not decoration.** Count the artwork's identifiable moving
    parts; on a hero character at least HALF should carry motion of their
    own relative to their parent, and every part that a viewer would expect
    to move for the action being performed MUST. Applies to every scene
    where it makes sense contextually — limbs, wings, hair, cloth, held
    objects — not only to characters.
  - **The cardboard test (blocking).** Ask: could this exact animation be
    reproduced by cutting each limb out of card and moving the pieces
    rigidly? If yes, it is under-articulated — go back and bend something.
    Verify by rendering the action's extremes and comparing the limb's own
    shape, not just its position.
- **Verify the loop seam in the DATA; pixel-diff is corroboration, not proof.**
  Rendering frame `op` samples the very end of the timeline, where Skottie can
  land fractionally short of the authored state — so a perfectly closed loop
  can still show a pixel difference at `op`, and the artefact scales with how
  fast things move at the seam (measured: a scene whose every track matched
  exactly at T and op, with identical velocity across the wrap, still showed
  333 differing pixels at `op` because its trail circles were moving ~600px
  worth of change per frame there; slower scenes showed 0 and hid the same
  artefact). The authoritative check is numeric and has two halves: every
  animated track must have a keyframe AT T and AT op with equal INTERPOLATED
  values, and the velocity entering the wrap (`op-1 → op`) must equal the
  velocity leaving it (`T → T+1`). Value equality alone permits a visible
  kink. Keep the pixel-diff — it catches things the numbers don't, like a
  layer culled at `op` — but when it disagrees with a clean numeric check,
  trust the numbers and say so.
- **A held object is part of the body.** Anything a character holds, hugs,
  carries or wears — a cup, a pillow, a stone, a bag, a hat — must be
  PARENTED to the limb or rig that holds it, so it inherits every bit of the
  hold's motion, and must then carry its own secondary motion on top:
  compressing into the squeeze, settling a beat after the arms, riding the
  breath. Measured failure: a mascot hugging a stone where the stone, its
  surface detail and the heart on it were all UNPARENTED and completely
  static — the character breathed and hugged around an object pinned to the
  composition, which reads as a prop glued to the background rather than
  something being held. The test: if the holder moves and the held thing's
  pixels don't, it isn't being held.
- **Never animate the same property twice down a parent chain.** Transforms
  compound: a child scaling 112% under a parent scaling 112% renders at
  125%, so a pop authored once "by the book" on both the anchor and its text
  overshoots by half again and the child visibly outgrows the plate it sits
  in (measured: intended 112%, composite 125.4%). Decide which single node
  in the chain owns each property — the anchor owns the entrance pop, the
  children inherit — and check the COMPOSITE value by multiplying down the
  chain, never the per-layer number in isolation.
- **Nothing in frame is inert — decorative satellites live too.** Every
  element the artwork puts on stage carries at least a subtle life motion
  during the idle, not only the hero. The usual offenders are the small
  decorative companions — thought-trail circles, sparkles, stars, motes,
  bubbles — which get an entrance and then FREEZE for the rest of the loop,
  turning into stickers pinned next to a living character (measured: a
  companion scene whose trail circles had two idle keyframes with 0.00
  amplitude, beside another whose trails floated 2px and read alive). Give
  them a slow independent float on their own clock — different period from
  the hero, tiny amplitude, offset from each other so they never bob in
  unison. A satellite that only appears is decoration; one that drifts is
  part of the world. BUT partition first: a satellite is a genuinely FREE
  element. Parts of a worn or built-on assembly — a helmet ring, visor
  shine, backpack panel, chest badge — are NOT satellites however separate
  their layers look, and riding their parent already satisfies this rule
  (measured: a spacesuit scene that gave each suit piece its own float read
  as the character coming apart, not as zero gravity).
- **Worn gear is the wearer — assemblies stay whole.** Suit, helmet, armor,
  outfit: parent the whole ensemble to the SAME rig null as the body so it
  travels as one mass, then articulate inside it only where a joint or soft
  material justifies it (a strap dangles, an antenna lags, fabric ripples —
  a visor does not slide across its helmet). Audit it as a fact, not a
  feeling: render two idle frames and measure the offset between a point on
  the gear and a point on the body — constant, or a named joint explains
  why not. Floatiness comes from the ASSEMBLY's shared drift plus the
  silhouette breath riding it, never from fixed parts wandering relative to
  each other.
- **An occupant may float INSIDE its shell — the Rive two-tier read.** A
  creature inside a container (helmet, suit, cockpit, porthole) earns a
  nested drift of its own WITHIN the container — and it must READ. The
  occupant is the FACE: the shape the EYES sit on and travel with. Not the
  eyes alone (measured: an eyes-only occupant at 1.3px was invisible), and
  not the larger mass the face sits in — that mass is the character's BODY,
  welded to the shell and still. Both errors were shipped in turn: an
  eyes-only float read as glued, then a whole-body float slid under the
  helmet's outline and shaved against its strokes. When the face is drawn as
  negative space (a hole in the body path), carve it into a real layer
  (recipe-character-rig, "Occupant-inside-shell") rather than moving the mass
  that surrounds it. Clearance is per SIDE and must exceed the drift.
  - **The occupant rides the shell's FULL transform, breathe included.** (And
    that swell is a SQUASH, not a size pulse — see "The silhouette breathes".)
    It sits INSIDE the body, so it must inherit the body's scale swell and be
    nested UNDER that null — its own drift belongs inside the inherited
    scale, never beside it. Excluded from the swell, the occupant stays a
    fixed size while the shell inflates and deflates around it, and the read
    flips from "the character breathes" to "the suit grows and shrinks"
    (measured: a shell swelling 5.9% around a face swelling 0.0%). The
    tempting reasoning — "the occupant's own drift shouldn't also inherit the
    pulse" — is exactly backwards: a part that does not share its body's
    scale has visibly left that body.
  - **The occupant's drift is SINGLE-AXIS — vertical by default.** The shell
    already travels a 2D path (drift + tilt); giving the occupant its own
    ellipse inside that compounds two circles and reads as swimming, a vague
    wobble with no direction. One axis against the parent's two is what makes
    both legible: the suit drifts around, the body settles up and down inside
    it — buoyancy, which is the physical story of floating in a suit. Keep
    the phase lag (the body answers the suit late); drop the second axis. The
    same contrast principle applies to any nested secondary drift: when the
    parent moves in 2D, the child earns more by moving simply. Its relative
  travel against the shell must clear ~3px peak-to-peak or lag the shell's
  tilt by a visible phase, and it is CLIPPED by a track matte of the
  container's opening (`<host>__matte`, per the player-contract) so it never
  crosses the container's border lines. If the interior mass is baked into
  the shell's path, CARVE it: duplicate the opening path as the matte and
  build the interior as its own layer drifting behind the rim. The shell's
  own pieces stay mutually rigid throughout.
- **Contact welds — occlusion is contact.** Where the artwork shows elements
  touching, gripping, resting on, or tucked BEHIND the subject, they must
  not slide along that contact edge: parent them into the assembly they
  touch. Parenting alone is NOT a weld if the part keeps its own relative
  clock — the same period at a different PHASE is a time-shifted copy,
  i.e. relative motion (measured twice: independent clocks in one run,
  same-period-different-phase rocks in the next; both read as the character
  disassembling at every edge they crossed). Surface details ON a shell —
  seam lines, panel lines, hatches, vents, badges, tick marks — are DECALS:
  zero motion of their own; they move only because the shell moves. The
  joint/soft exception requires a visible FREE END that dangles or
  protrudes (a strap, an antenna, a cloth hem) — name the free end, or weld
  it rigid. A brief calling something a "floating prop" does not license
  breaking a visible contact. Free-prop drift belongs only to elements with
  clear air on all sides. Verify by rendering the motion extremes and
  inspecting every contact/occlusion edge for slide.
- **Distant backdrops hold still.** The moon, the sun, stars, a skyline:
  from a human viewpoint these do not visibly translate, so a self-propelled
  drift on one reads as a bug, not as depth. Give them life IN PLACE —
  twinkle on opacity in whole cycles, a slow glow — or a parallax
  counter-move DERIVED from the subject's track. Derived is mechanical, not
  a vibe: `backdrop = rest − k × subjectDrift` with k ≈ 0.2–0.5 — the same
  driver, negated and scaled. An independent clock at another frequency or
  phase is not parallax (measured: a moon at "opposite phase, half
  frequency" spent half of every cycle moving WITH the mascot).
- **The body always breathes.** Whatever the limbs are doing, the torso/mass
  keeps its own slow breath — a silhouette morph or a small scale swell —
  running independently of the action's beats. A character whose arms are
  beautifully articulated while the body holds perfectly still reads as a
  head-and-limbs puppet bolted to a board. The breath is the baseline life
  signal: it never stops, it never syncs exactly to the action, and it stays
  at the aliveness floor rather than below it.
- **Dead tracks don't count — measure AMPLITUDE, not keyframes.** A property
  with a hundred keyframes whose value never changes is not motion; it is
  the appearance of motion, and it passes a naive coverage audit while the
  picture sits still. Found in the field: a mascot body carrying 73 morph
  keyframes with a maximum vertex travel of 0.00px. Any coverage claim
  ("half the parts move") must be counted from measured amplitude over the
  loop — per-track min-to-max, or max vertex travel for morphs — and every
  track that scores zero either gets real amplitude or gets deleted.
  Measure over the track's OWN active span, not just the idle: an ENTRANCE
  track (a pop's scale, a fade's opacity) that moves 100 during `[0..T]` and
  then reads zero across the loop is CORRECT — the bubble settles and holds.
  Say TRACK, not element, and say it in that direction only: this sentence
  once read "the bubble and its trail must hold still once they arrive", and
  a build took it at its word and parked the trail circles' POSITION at a
  constant value through the whole intro, floating them only from `T`. Free
  satellites keep their own drift (recipe-companion-bubble, "Free satellites
  … get their own clocks"), and that drift runs from their arrival — see
  gate 20. The defect is a track that measures zero EVERYWHERE. Report the audit as a
  table with each track's amplitude and its active span, so contract-holds
  and dead tracks can't be confused for one another.
  **For shape morphs, measure the HANDLES too, not just the vertices.** A
  bezier arc deepens by scaling its `i`/`o` tangents with `v` untouched —
  the correct way to bend a 2-point stroked curve — so a vertex-only audit
  reports 0.00px and condemns a perfectly good track. Measured case: two eye
  arcs read 0.00px of vertex travel, 1.49px of handle travel, and isolating
  those layers and pixel-diffing rest against peak contraction showed 3,177
  changed pixels — a real squeeze the metric could not see. Amplitude for a
  morph is `max(vertex travel, handle travel)`, and when a track is about to
  be called dead, ISOLATE it and pixel-diff two beats before deleting
  anything.
- **Phase-lock effort to the moment it physically happens.** Smooth curves
  and rich articulation still read as WRONG if a motion fires at the wrong
  instant in the action — that is a logic error, not a craft one, and no
  amount of easing rescues it. Measured failure: a double-bicep flex whose
  isometric tremble peaked while the arms were EXTENDING, so the mascot
  shook when it relaxed and held perfectly still at peak contraction — the
  exact inverse of how a strained muscle behaves. Before shipping any
  limb/body motion, say in one sentence what the body is doing, then check
  each accent and secondary motion lands where physics puts it:
  - an isometric tremble/strain belongs at PEAK CONTRACTION (holding
    hardest), never during extension or release;
  - impact squash lands at ground contact, not mid-air;
  - a chest expands on the inhale, not the exhale;
  - a blink or a glance goes at a REST beat, not at the peak of effort;
  - follow-through lags its driver and anticipation precedes it — a
    follower that leads is the same class of error.
  **Verify the phase by RENDERING the extremes, never by the sign of the
  number.** A rig's rotation track can run negative toward the OPEN pose, so
  a phase check done on raw values will happily confirm a tremble sits at
  "most bent" while the picture shows the arms wide open (measured: elbow
  −14° was the extended pose, +1.4° the flexed one). Identify the peak-effort
  FRAME from a render, then confirm the accent's own peak lands within a few
  frames of it.
  **A geometrically rigorous metric can ALSO mislead if it isn't the one the
  brief actually specifies — re-derive from the literal wording, don't
  substitute a plausible-sounding proxy.** Chasing the SAME defect with a
  rotation/translation-invariant "elbow fold angle" (the angle between the
  bicep and forearm axes, computed through the full nested transform chain)
  said the rig was already correct — fold angle DID minimize at the
  intended hold, because the joint genuinely bends tightest there. But the
  brief's own words were "fists tightest, CLOSEST TO THE HEAD" — a distance,
  not a joint angle — and measuring that literal quantity (fist world
  position vs. head-center, same transform chain) showed the opposite: the
  whole arm also rises and swings outward as the elbow bends, so the fist
  ends up FARTHER from the head at the tightest fold, and closer to the head
  during a shallower-angled but higher/tucked pose. Both metrics were
  computed correctly; only one answered the question the brief was actually
  asking. When a metric's answer contradicts a rendered read, suspect the
  metric before suspecting the render — and re-check that the metric
  operationalizes the brief's own criterion, not a nearby-sounding one.
- **Accents must be readable — slow enough to resolve.** A signature micro-
  motion (an isometric tremble, a shiver, a vibration, a rapid blink) only
  works if the eye can actually see the oscillation. Measured failure: a
  flex tremble authored with a 2-frame half-cycle — 15 Hz at 60fps — which
  reads as a buzz or a rendering glitch rather than a held muscle. Give a
  readable oscillation a half-cycle of **at least ~4 frames at 60fps**
  (≤~8 Hz), 5–8 frames when the motion is meant to be *felt* rather than
  merely noticed, and let the whole accent occupy at least ~0.4 s so it
  registers as an event with a beginning and an end. Amplitude does not
  rescue frequency: a tremble too fast to resolve just looks broken,
  however far it moves.
  - **A BLINK is exempt — it is a switch, not an oscillation.** This floor
    governs motion the eye must TRACK; an eyelid is a shutter that the eye
    reads by its absence, and slowing it to clear the floor is what produces
    a drowsy squint instead of a blink (measured: a 5-frame half-width blink
    whose scaleY bottomed out at 18%, authored with the comment "clears the
    ~4-frame readable-accent floor" — the gate itself caused the defect).
- **A blink CLOSES, and it is fast.** The lid must reach zero — the eye
  disappears completely for a beat. A lid that stops at 15–20% leaves a
  visible slit, which the viewer reads as squinting, sleepiness or suspicion,
  never as a blink; the Rive-grade reference simply has no eye for a frame or
  two. Shape it asymmetrically, ~6–8 frames total at 60fps (~100–130 ms, a
  real human blink): snap closed in 2–3, hold fully closed 1–2, reopen over
  3–4 — closing faster than opening is what makes it read as a lid rather
  than a pulse. Widen the eye slightly on the way down (a few % on x) so the
  closure squashes rather than merely shrinking. This applies to any face
  with visible eyes — mascot, animal, person — and to dot eyes, drawn lids
  and pupil-in-white alike: scale the eye's own height to 0 about its own
  centre, or drive the lid shape, but never park the closure short of zero.

## Choreography

- Decide the lead element, then delay supporting elements by 2-8 frames for
  compact UI and 4-14 frames for expressive scenes.
- Stagger from the meaningful origin: first, center, last, path direction, or
  focal point.
- Let opacity often start after movement begins and finish before the settle.
- Do not animate every property on every layer. Stillness gives motion contrast.
- Scrub around the settle. The final 10-20 percent of motion should feel
  intentional, not like a numerical drift.

## Reveal Grammar

- Use build, settle, hold as the default reveal spine. The hold is where the
  message or brand registers.
- Reveal in reading or importance order. Hero/focal subject lands first;
  labels, stats, metadata, and support arrive after.
- Stagger repeated items by about 3-6 frames for compact motion or 50-80 ms for
  scene-level beats.
- Prefer mask-wipes, marker sweeps, trim-path draw-ons, and purposeful cuts over
  uniform opacity fades for premium scenes.
- One scene or beat should have one main flourish. Too many reveals in the same
  beat weakens hierarchy.

## Chapterization And Transition Grammar

- Gate: if the prompt carries more than one idea (long text, lists, multiple
  stats, timeline, before/after, problem/solution, quote+proof, walkthrough,
  recap/story, multi-language or repeating variations), split it into chapters
  instead of cramming one scene. A single-purpose beat (logo lockup, one CTA, one
  stat, legal/read-critical, calm hero that must settle) stays one beat and lands.
- Give each chapter one readable job, and let the main message get a coast or
  hold before any seam.
- Choose each transition by seam purpose — preserve continuity, create contrast,
  reset rhythm, or land a point — not at random. A transition is chapter role +
  timing + direction + cut point + masking + easing, not easing alone.
- For dense/multi-part prompts, read
  `references/chapterization-transition-grammar.md` for the full when/when-not,
  roles, structure modes, transition grammar, selection, cut-on-action mechanics,
  easing-anchor support, and guardrails.

## Motion Economy

- Motion should reinforce the same hierarchy as the final frame: focal subject
  strongest, support calmer, accents lowest priority.
- Animate fewer properties when that produces a clearer read.
- If movement makes the scene feel busy, crowded, or unfocused, simplify the
  visual structure before adding more motion.
- Effects, camera moves, and staggers should never compensate for weak layout.
  Revise the composition first.

## Typography Choreography

- Treat kinetic typography as phrase performance, not uniform text entrance.
- Assign anchor, support, and active text. Let the active word or phrase carry
  the strongest motion while support text stays calmer.
- Use semantic easing and spacing: sharp words can hit harder, soft words can
  settle gently, heavy words can land lower, and flowing words can travel
  continuously.
- Offset position, scale, mask, opacity, and layout timing so words relate to
  the phrase instead of sharing identical keyframes.
- Preserve reading order. Expressive motion should make the phrase clearer, not
  harder to parse.

## Data And Figure Motion

- Animate data by its own logic: bars grow from baseline, lines draw left to
  right, segments widen to proportion, dots populate, rings nest or emanate,
  and Sankey-like flows route from source to target.
- Count figures up with baked keyframes, tabular numerals, and an ease-out
  settle. Let labels or units arrive after the number resolves.
- Sync labels to geometry. A point label should resolve as the line reaches it;
  a bar value should count while the bar grows.
- Use mask-wipes for insight headlines and trim paths for hairlines, axes,
  connectors, rules, and chart strokes.
- Serious data needs calm ease-out and no bounce. Small pops are acceptable only
  for badges, consumer/wellness warmth, or bold social panels.

## Camera, Parallax, And Scene Motion

- Treat camera motion as the viewer's attention, not decoration.
- Use one dominant camera move: push in, pull out, pan, follow, or parallax.
- Move foreground, subject, and background at different rates only when it
  clarifies depth.
- Keep camera easing smoother than object easing. Abrupt camera stops feel cheap.
- Avoid pan/zoom that makes text unreadable or crops the hero subject.

## Path Reveals And Loops

- Path drawing should follow the natural reading or construction order.
- Keep trim-path speed visually even; short segments may need shorter durations.
- For handwriting/path reveals, the completed mark gets a stamp-settle by
  DEFAULT (2-3% overshoot on its own pivot over a few frames) — the pen
  lifting is a beat, not a stop; see "A completed gesture gets punctuation"
  in Easing Anchors. Drop it only where the register forbids a pop (serious
  data, technical traces), and say so.
- For loops, match first and last frames in position, opacity, color, and
  perceived velocity.

## Loop And Generative Motion

- Repeated fields need phase offsets by index, distance, row, or path position.
  Lockstep pulsing reads mechanical unless the prompt asks for it.
- Derive many elements' motion by sampling **one** cycle function at offset
  phases, rather than hand-authoring each element's wrapped keyframes — it stays
  coherent, is seamless by construction, and makes adding more voices trivial.
  Space copies a fraction of the period apart (e.g. half-period, so one is
  always mid-rise), and hide each reset behind an invisible fade: glide the
  property back to its start value while opacity is already 0, so the seam never
  flicks.
- Engineer loop seams with identical first/last frames, integer wave cycles,
  closed rotations, wrapped drift, or recycled emanation rings.
- **Wrapped drift with no expressions available** (an element exits one edge
  and re-enters the opposite edge, e.g. a scrolling background element):
  bake the wrap as an instant position jump placed at a moment the element is
  fully offscreen on *both* sides of the jump (verify against its own bbox
  with a safety margin). Make that jump a **held keyframe** (`h:1`), not a
  1-frame ramp. A ramp only looks instant because the player samples whole
  frames, and that stops being true the moment anything retimes the scene: the
  Duration control moves keyframes onto fractional frames, a sample lands
  between the ramp's endpoints, and the element is stranded mid-screen for one
  frame — a visible flash. A hold snaps at any scale. Pick
  a total travel distance equal to a whole number of wrap cycles so the
  element lands back on its exact starting position at the end; if two
  elements share a duration but travel different per-cycle distances (e.g. a
  "nearer" element doing more wraps than a "farther" one), dividing each
  one's distance by the same shared duration gives correctly different
  constant velocities for free — no separate speed constant needed.
- When several elements loop at different rates and must all seam at once, fix
  the loop length **T = the least common multiple (LCM) of the exact
  sub-periods**. Treat "about N frames" periods as flexible: scan T's integer
  divisors for the nearest clean fit (single-digit-percent drift is fine)
  instead of forcing a true LCM of everything, which explodes the loop length.
  Make every full rotation an exact ×360° (compute turns as T / period, then
  ×360) so nothing lands mid-cycle at the seam.
- Give ambient loops one conceptual beat: pulse, mirror, morph, inversion,
  density build, or recovery to order.
- Use one repeated primitive and one main animated property where possible.
- Rich motion is licensed when the animated abstract element carries the
  message. Keep surrounding type, UI, and support calmer.
- Morph the same objects between states instead of spawning unrelated new
  objects when continuity is important.

## Style Presets

- `premium-settle`: slower reveal, low overshoot, elegant final ease.
- `kinetic-snap`: fast stagger, strong contrast, crisp settles.
- `soft-interface`: small distances, low overshoot, short duration.
- `technical-trace`: trim paths, precise timing, minimal flourish.
- `ambient-loop`: no visible seam, constant perceived energy.
- `playful-pop`: larger scale contrast, friendly overshoot, quick recovery.
- `data-confirm`: insight headline, geometry reveal, synced count-up, calm hold.
- `phase-field`: repeated primitive with baked offsets and seamless loop.

## Render-Aware Motion

- **The stage is a stage, not a crop.** Every animated EXTREME — overshoot
  apex, squash spread, drag follower at maximum bend, and any slot-driven
  growth (a text plate at its autoFit `max`, not its default) — must stay
  inside `[0..w]×[0..h]` with at least ~3% of the min dimension to spare
  (≈16px at 512). Author the headroom into the composition (recenter the
  element or widen the stage); never rely on the default state fitting.
  Verify by RENDERING the extremes: ink kissing or crossing an edge is a
  blocking defect. Growable text is verified at a realistically long
  localized string, never only at the design string.

- Bake counters, particle offsets, orbit math, physics, and expression-like
  systems to keyframes before relying on Skottie.
- Fake velocity with offset duplicate layers instead of motion blur.
- Treat blur, bloom, glass, chrome, dither, true 3D, and displacement as
  renderer-risky. Approximate with vector shapes, stacked tonal fills, or baked
  raster assets.
- Path morphs require compatible vertex structures. If not safe, use masks,
  replacements, or crossfades.
- Cap dense fields and verify performance. Repeater-based fields cannot assume
  independent per-instance animation.

## The Aliveness Contract

The blocking bar for "is this thing actually alive?", gathered in one place.
Every rule below is stated in full elsewhere in this file — this is the gate to
RUN before finishing, not a summary to read instead of the rules. The engine's
generation prompt names this section directly, so a scene that skips it is
incomplete rather than merely unpolished.

Report the result as a table: track · amplitude · active span · verdict. Prose
claims like "everything moves" are exactly what these checks exist to falsify —
several of the rules below were written after a claim like that turned out to
be false the moment anyone measured it.

**Every scene, whatever the subject:**

| # | Gate | Threshold | How to prove it |
|---|---|---|---|
| 1 | Nothing in frame is inert | every element either moves, or its stillness is named and justified | list the artwork's elements; any without a track is called out with its reason |
| 2 | Amplitude, not keyframe count | no track measuring ~0 across its own whole active span | per-track min→max over that track's OWN span; morphs use `max(vertex, handle)` travel |
| 3 | Meaning drives behaviour | the motion is one only THIS element would have | name the element's meaning and the behaviour it earned; a generic bob fails |
| 4 | Mood governs the system | periods, amplitudes and easing derived from the brief's mood | the gym-verb test — swap the mood word and the numbers must change |
| 5 | Fluidity | `max / median-while-moving` under ~3× on every hero track | the velocity audit; entrances and deliberate accents exempt |
| 6 | Accents resolve | half-cycle ≥ ~4 frames at 60fps, whole accent ≥ ~0.4 s — BLINKS ARE EXEMPT (a shutter, not an oscillation) | count frames per half-cycle in the data, not by eye |
| 17 | Blinks close | the eye reaches zero height and is gone for a beat; ~6–8 frames total, closing faster than opening. A lid parked at 15–20% is a squint, not a blink | `check-motion.mjs` (BLINK NEVER CLOSES) reads the eye's own scale track |
| 20 | Nothing is frozen waiting for the entrance | in an intro-loop scene every element's idle runs from that element's OWN arrival, not from `T` - an element that has popped in and then holds a constant value until the loop marker is dead air the viewer sits through. Echo the loop track backwards (`value(t) = value(t + IDLE)`); the seam is untouched because the echo is the same cycle | `check-motion.mjs` (FROZEN UNTIL THE LOOP) measures each track's travel between arrival and `T` against its travel inside the loop |
| 7 | Loop seam | every clock's period DIVIDES the repeatable span (not the whole comp — a marker segment shorter than `op` has its own span), and the segment's first and last frame render as the same PICTURE | `check-loop-seam.mjs` pixel-diffs the segment's boundary frames. For a scrolling field, per-layer values differ by design at a clean seam (each tile one lap along, standing in for the next) — read pictures, not keyframes |
| 18 | Ink follows the pen, and scale pivots on its artwork | a hand-drawn tick strokes LEFT to right, pen-down to pen-up (a ring/circle sweep is exempt — no handwriting order). ANY element whose scale animates — pen marks, trail bubbles, badges, plates, a breathe — pivots on its own geometry: origin-space geometry takes anchor `[0,0]` + position home, absolute geometry takes anchor = own center. Anchor = position over origin-space shapes cancels the transform and paints the artwork at the canvas corner (observed twice: a pen-down dot, then a thought-trail bubble) | `check-motion.mjs` (DRAW-ON AGAINST THE PEN; SCALE/POP PIVOTS OFF THE ARTWORK) |
| 19 | The opening frame is the brief's opening | whoever the brief stages as arriving later is fully OFFSCREEN at frame 0 — not parked at 0% opacity or 0% scale — and enters with entrance energy (a leap, a slide, a bounce that hands off to the idle). Ambient fields the brief keeps moving (clouds, waves, traffic) run from the very first frame and stop only by the deceleration the brief names — never by omission, never mid-velocity. Wrap teleports happen fully offscreen | render frame 0 and READ it against the brief's beat 1; `check-motion.mjs` (WRAP TELEPORTS IN VIEW) guards the wraps |

**Additionally, any scene with a character, figure, creature or mascot:**

| # | Gate | Threshold | How to prove it |
|---|---|---|---|
| 8 | Parts articulate | joints bend; ≥ half the nameable parts move by measured amplitude | the cardboard test — flat card swung on pins is not a rig |
| 9 | Held objects live | parented to the holder AND carrying their own secondary motion | if the holder moves and the held thing's pixels don't, it isn't held |
| 10 | The body breathes, and the breath changes its SHAPE | continuous low-amplitude torso/mass cycle under whatever the limbs do — and the silhouette is not the same outline every frame: counter-phased scale axes (≥ ~1pp of `sx − sy`, area roughly conserved) or real path keyframes on the soft mass. A uniform `sx === sy` swell is a zoom and fails | `check-motion.mjs` (SILHOUETTE STILL), then render the two extreme breathe beats and compare outlines |
| 11 | Effort is phase-locked | strain on the contraction, never on the release | RENDER the extreme frames and look; never reason about the sign convention |
| 12 | No double-driven property | each property animated once down any parent chain | trace every animated property up through its parents |
| 13 | Assemblies stay whole | rigid worn/built-on parts keep a constant offset to their wearer; independent drift only for genuinely free elements | render two idle frames; measure a gear-point↔body-point offset — identical, or a named joint/soft part explains why |
| 14 | Contacts hold | no relative slide at any contact/occlusion edge — welded means NO own clock (same period at a different phase is relative motion); shell surface details are decals; backdrop parallax is `−k ×` the subject's own track | render the motion extremes; inspect every edge where elements touch or overlap for slide; for parallax, show the derivation from the subject's driver |
| 16 | The occupant belongs to the body | it inherits the shell's scale/breathe swell (nested UNDER that null) and drifts on a SINGLE axis inside it — a fixed-size occupant under a swelling shell reads as the suit growing; a second ellipse under a 2D shell reads as swimming | `check-motion.mjs` (SCALE DIVORCE; drift-axes report) |
| 15 | The occupant reads | inside-a-container characters drift as the visible interior mass, ≥ ~3px relative to the shell (or a visible phase lag), matte-clipped so they never cross the container's lines. The matte is the CONTAINER opening and the mass is SMALLER — same-shape matte and mass cancel exactly, rendering a measured float as a dead-still face. Applies whenever the BRIEF puts the character in/inside something — a missing interior path in the SVG is the carve case, never an exemption; an eyes-only null is not an occupant | `node scripts/check-motion.mjs <slug>` (fails on MATTE CANCELS THE FLOAT and OCCUPANT TOO STILL), then isolate shell vs occupant at the extremes: measurable relative offset, zero pixels outside the opening |

Two failure modes this gate exists to catch, both observed in shipped scenes:

- **Inherited constants.** Porting a build script from a visually similar scene
  carries that script's frozen numbers past every contract change made since.
  Re-derive published values against the current references, and state which
  ones you verified rather than assumed.
- **A metric that lies in the safe direction.** A vertex-only amplitude audit
  called two hand-authored eye morphs dead; isolating those layers and
  pixel-diffing rest against peak showed 3,177 changed pixels. When a track is
  about to be called dead, isolate it and pixel-diff before deleting anything.

## Final Motion Review

- Scrub playback. First and last frames alone are not enough to judge timing,
  stagger, readability, or settle quality.
- Inspect key beat frames: frame `0`, early reveal or first meaningful beat,
  midpoint, settle or near-final, `op - 1`, loop seam if looping, and semantic
  beats where a number resolves, word lands, logo lockup forms, chart finishes
  drawing, CTA appears, or camera move settles.
- Check beat order: the focal subject should lead, support should follow, and
  accents should not steal the read.
- Check stagger origin and spacing: repeated elements should begin from the
  meaningful source, path direction, reading order, or focal point.
- Check timing and easing: entrances should feel intentional, not uniform;
  settles should land cleanly without drift, snap-back, or accidental float.
- Check readability during motion: text, data, icons, and UI states should be
  parseable at the moments they matter.
- If motion feels busy or hides weak layout, simplify the visual structure or
  reduce animated properties before adding more choreography.
- For character/held-object moves, run the Fluidity spacing check: a rendered
  2–3-frame trail must read as a smooth hand-drawn arc — no stalls at
  intermediate poses, no velocity pops, no time-shifted-copy followers.

## Checks

- Midpoint should communicate what is happening, not only look like transition
  blur.
- The final settle should land in the strongest composition, not only stop on a
  valid frame.
- Loop start/end should be invisible unless a reset is intentional.
- Secondary motion should never distract from the requested message.
- If an animation feels generic, adjust stagger origin, easing intent, or the
  final settle before adding more effects.
- For kinetic typography, reject motion where every word uses the same entrance
  timing and property changes unless the prompt asks for a minimal reveal.
