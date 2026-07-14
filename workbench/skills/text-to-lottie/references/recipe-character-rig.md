# Recipe: Character Rig

Use for animating a character, figure, creature, avatar, or illustrated subject
that should move as one coherent body: walk cycles, idle bobs, bounces, jumps,
dances, celebratory loops, and "make this character/illustration come alive"
briefs. Covers figures that hold or carry an object and figures with expressive
faces (blink, eyes).

Read `svg-compatibility.md` with this recipe when the character arrives as an
SVG. This recipe assumes a looping performance; hold the seamless-loop contract
below.

## User-Language Aliases

- "animate this character", "make this figure move", "bring this illustration to life"
- "walk cycle", "idle animation", "make it bob", "breathing idle", "bounce loop"
- "make it jump", "spring up", "celebration bounce", "dance loop", "happy bounce"
- "character holding a thing", "make the figure carry/hold/wave", "make it react"

## Defaults

- Transparent background unless the character sits in a full-frame scene.
- Preserve the source composition and viewBox; the neutral pose matches the
  source illustration.
- Move the character as one rigged body driven by parent nulls, not by animating
  each body-part shape independently.
- Loop seamlessly by default for idle/walk/dance.
- Keep amplitudes small and let easing carry the weight. Physicality comes from
  the easing profile, not the size of the move.

## Presets

- `idle-bob`: gentle vertical bounce plus volume-preserving squash on one rig
  null, looped.
- `walk-cycle`: two footfall steps per loop; asymmetric ease with coupled squash
  at contact.
- `spring-jump`: real vertical lift on top of the base rotation; squash at the
  landing, stretch airborne.
- `celebrate-bounce`: rhythmic bob plus alternating side lean on a beat clock,
  with accent bursts.
- `dance-loop`: multi-beat lean/bounce/squash choreography, all landing on shared
  beats.
- `pendulum-carry`: a held or hanging object trails the body on a nested rig for
  secondary motion.

## Timing And Easing

- Idle/breathing loop: 90-180 frames, low amplitude.
- Walk cycle: two steps per loop; keep the vertical lift to a few pixels and sell
  the step with asymmetric easing, not amplitude.
- Jump/dance: build on a beat grid; pick FPS times beat-seconds so every beat
  boundary lands on a whole frame.
- Bounce up on ease-out, fall on ease-in; neutral shape at the velocity-zero apex.
- Squash recovers snappily with a sharp ease-out: impact sudden, recovery quick.
- Blinks and accent pops are fast (a few frames) and placed clear of the loop seam.

## Ask Only When Needed

- Ask the performance (idle / walk / jump / dance / celebrate) only if the brief
  just says "animate this character".
- Ask whether a held object should sway with the body or stay steady if the brief
  implies one but not the other.
- Ask loop vs one-shot only if ambiguous; character performances usually loop.

## Construction Notes

- Rig with parent nulls: put the primary motion (bounce/lean/squash) on one
  invisible null (`ty: 3`) and parent the body-part layers to it via
  `parent: <null ind>`. Move the character as one rig, not part by part.
- Three confirmed player facts the rig relies on: `parent` resolves by `ind`
  independent of array order (nulls can sit anywhere; push them last since they
  are invisible); paint order is array order (`layers[0]` frontmost, `ind` never
  affects stacking); parenting composes multiplicatively, so a child applies its
  own transform inside the parent's transformed space with no coupling code.
- Pivot at the character's own visual base: set the rig null's anchor `a` equal
  to its position `p`, both at the base in native SVG coordinates (bounding-box
  bottom-center is a good default). The anchor renders exactly at `p`, so the body
  rotates and scales around its base; and because the mass sits above that low
  pivot, a *pure rotation* swings the head sideways through the lever arm, giving
  a side-to-side arc for free with no horizontal position keyframes. This is the
  single most reusable idea here.
- Non-zero anchor plus animated position/scale/rotation is fully supported in
  this player: anchor at a meaningful pivot (base, hand, eye cluster) and animate
  freely; never bake motion into vertices just to keep the anchor at the origin.
  If a layer looks stuck right after an edit, suspect stale server/render state
  before suspecting the JSON.
- Volume-preserving squash and stretch, anchored at the base: at contact reduce
  one axis and widen the other so area stays roughly constant (short/wide
  alternating with tall/narrow), stretch the opposite way during fast motion, and
  go neutral at the apex. Anchoring the scale at the base makes squash read as
  weight landing on the ground, not symmetric compression toward the center;
  widening the counter-axis is the difference between "scaled" and "squashed."
- Weighted bounce/walk needs asymmetric easing: push off fast (ease-out up),
  hang, then fall faster (ease-in down), neutral at the velocity-zero apex. Keep
  the lift small; the physicality comes from the two eases, not the amplitude.
- For a real jump, add vertical lift on top of the rotation (the lever-arm arc
  alone only bobs) and keep the squash anchored at the base so the landing
  compression and the spring do not fight. Use smooth ease-in-out for a premium
  jump; reserve a ballistic bounce ease for a deliberately hard impact.
- Secondary motion via a nested pendulum: a held or hanging object pivots at its
  attach point. Use a second null anchored at the hand, rotation swinging *both*
  ways with eased turnarounds (through center; a one-way swing reads as a twitch),
  nested under the main rig so it inherits the primary motion. Parent the whole
  carried assembly (object plus the hand holding it) to this one null so it swings
  as a rigid unit.
- The "steady island": when one element must stay put while the rig moves,
  exclude it from the rig entirely (leave it unparented at its authored
  coordinates) rather than counter-animating it. Counter-animation must cancel the
  parent exactly every frame; exclusion is stable by construction. Verify with a
  pixel diff across the motion extremes.
- Blink and eyes as an own-center scale dip: give the eyes their own layer with
  `p == a` at the eye cluster's own bounding-box center, and a fast `scaleY` dip
  (near-closed over a few frames), widening `scaleX` slightly at the closed pose
  for a smiling squint. The eyes still inherit the body's motion through
  parenting but pivot on themselves. Every independently-pulsing accent (blink,
  pop, pulse) uses this same "anchor = own bbox center" idiom.
- Beat-clock choreography: derive all dependent timing from a few named stage
  constants (FPS, a step/beat length, total frames, and small arrays of the beat
  frames), and have the independent property functions (rotation, position,
  scale) all read the same arrays so lean, bounce, and squash always land
  together. Retiming is then one edit (change the beat length); re-choreographing
  is another (swap which beats carry the dip versus the peak to flip the physical
  read).
- Close the loop by construction: every animated property's first keyframe at
  frame 0 and last at the final frame with an identical value; that is the entire
  loop mechanism, no loop flag. Assert it programmatically, since a single drifted
  endpoint is invisible in a still and only shows as a once-per-loop hitch.
- Keep generated/staggered accent keyframes sorted: a property whose `t` values
  end up descending silently stops animating in this player, with no error. Drop
  any generated round that would run past the final frame rather than clipping it,
  and confirm every emitted property's `t` values increase monotonically.
- Expose slots for accent color and, when full-frame, background; keep the neutral
  pose aligned to the source illustration.

## Common Failure Modes

- Body parts animated individually drift out of register instead of moving as one
  rigged body.
- Squash pivots at the center, so the character looks compressed by an outside
  force instead of absorbing its own weight.
- Symmetric up/down easing makes a walk read as a hover; a one-way object swing
  reads as a twitch.
- A "steady" element is counter-animated and jitters instead of being excluded
  from the rig.
- Amplitude is cranked up to fake weight instead of fixing the easing.
- A staggered accent silently stalls because its generated keyframes ended out of
  order.
- The loop seam hitches because one property's first and final values differ, or
  a blink lands on the seam.
- The neutral/apex pose no longer matches the source illustration.

## Acceptance Checks

- The character moves as one coherent body around a base pivot; the side-to-side
  arc comes from rotation, not hand-keyed position.
- Squash and stretch preserve volume and are anchored at the base.
- Any held object either swings as a nested pendulum or is provably steady
  (pixel-identical across extremes), per the brief.
- Blink and accent pops pivot on their own centers and sit clear of the loop seam.
- Every animated property's first and last keyframe match; the loop is seamless
  with no special loop logic.
- Timing lands on shared beats; retiming from the named constants keeps everything
  in sync.
- The neutral pose matches the source; motion reads intentional and weighted at
  60 fps.
