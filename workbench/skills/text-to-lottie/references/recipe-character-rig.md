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
- Drive the GROSS motion from parent nulls so the body travels as one coherent
  mass — then articulate the parts ON TOP of it. The null carries the bounce,
  lean and squash; joints still bend, extremities still lead or lag, and the
  silhouette still changes. A rig where every part rides the null and nothing
  deforms is a cardboard cutout on pins, which is the single most common way a
  character scene fails. (Rule: *Articulate the PARTS*, `motion-taste.md`.)
- Loop seamlessly by default for idle/walk/dance.
- Keep amplitudes restrained but READABLE: physicality comes from the easing
  profile, not the size of the move — yet a motion too small to see at arm's
  length is not restraint, it is a dead track. Measure it (`motion-taste.md`,
  *Amplitude that reads* and *Dead tracks don't count*) rather than trusting
  that a keyframe implies a movement.

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
- Do NOT ask whether a held object should move: it always does. Anything held,
  hugged, carried or worn is parented to the limb that holds it and carries its
  own secondary motion on top (compressing into a squeeze, settling a beat after
  the arms, riding the breath). Ask only about its CHARACTER — a taut carry
  versus a loose swing — when the brief genuinely leaves that open.
- Ask loop vs one-shot only if ambiguous; character performances usually loop.

## Construction Notes

- Rig with parent nulls: put the primary motion (bounce/lean/squash) on one
  invisible null (`ty: 3`) and parent the body-part layers to it via
  `parent: <null ind>`. The null exists so gross motion is authored ONCE
  instead of hand-keyed into every part in world space — it does not mean the
  parts hold still. Layer per-part articulation on top of the inherited
  transform, and never re-animate a property the parent already drives
  (`motion-taste.md`, *Never animate the same property twice down a parent
  chain*).
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
- **Counter-scale keeps a child's drawn shape under a morphing parent.** When
  the brief says only the body deforms (eyes, badges, and face marks keep
  their exact drawn proportions), a child of the squash rig inherits the
  squash unless cancelled: give the child a scale track that is the exact
  inverse of the parent's at every one of the PARENT's own keyframes
  (`10000/sx, 10000/sy`), so the product is 100% throughout while position
  and lean still cascade — glued to the face, never distorted. (Between keys
  the inverse of an eased lerp is not the eased lerp of inverses; at squash
  amplitudes up to ~±6% the residual is ~0.25%, invisible.) Motion accents
  like speed lines follow motion-taste's trailing rule: absent at rest,
  streaming in on the fast phase just passed, gone by the impact.
- **Ground answers, backdrop decoration doesn't** (motion-taste's
  world-responds boundary, routed here because landing characters are where
  it bites). Elements sharing his GROUND — the shadow, floor props, whatever
  he lands on — answer every landing with a low-amplitude derived response.
  Decoration floating BEHIND him (ribbons, glows, decorative strokes) stays
  serene: no impact-keyed jolt, which reads as jitter rather than weight.
  Serene is not inert, though — it still owes gate 1 its own quiet accent (a
  travelling gleam, a slow breath), and that accent is what distinguishes it
  from the decorative satellites below, which DO carry independent
  micro-floats because they read as objects in the scene rather than as
  backdrop.
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
- Worn gear is not a satellite: suit pieces, helmet, visor shine, badges and
  packs parent into the SAME rig null as the body — the ensemble drifts as one
  mass, and rigid pieces keep a CONSTANT offset to the body across the whole
  loop (render two idle frames and measure; only a named joint or soft part —
  a strap, an antenna, fabric — may lag or swing). Never give suit parts the
  independent micro-floats decorative satellites get: relative drift between
  fixed parts reads as the character disassembling, not as floatiness
  (motion-taste, "Worn gear is the wearer").
- Occupant-inside-shell (the Rive two-tier float): when the character sits
  INSIDE a container (helmet, suit, cockpit), the occupant is the visible
  INTERIOR MASS — the head/body seen through the opening — not just the
  eyes. APPLICABILITY IS DECIDED BY MEANING, not by the SVG's path list: if
  the brief says the character is in/inside its helmet/suit/vehicle, gate 15
  applies, and the absence of a separate interior path in the source is
  precisely the carve case — never an exemption. An eyes-only null is not an
  occupant. Report the measured relative peak-to-peak AND the matte layer's
  name in the gate table.

  Canonical construction (adapt the ids; this shape is the sanctioned
  implementation, coming from this reference — using it is not porting):

  **The matte and the mass are TWO DIFFERENT SHAPES.** The matte is the
  CONTAINER's opening (the glass area); the occupant is the smaller interior
  mass that lives inside it (the face). Cutting both from the same path is a
  silent no-op: the static matte pins the visible edge and a uniform fill has
  no interior detail to reveal the shift, so a measured 8px float renders as
  a perfectly still face (observed exactly this way; `check-motion.mjs` now
  fails it as MATTE CANCELS THE FLOAT). The matte must exceed the mass by
  more than the drift amplitude in at least one axis — that slack IS the room
  to move.

  ```js
  // 1. TWO shapes: the container opening (bigger) and the interior mass.
  const containerSub = /* the glass/opening outline — the CLIP */
  const occupantSub  = /* the face/body mass INSIDE it — strictly smaller */
  // 2. Occupant mass on a null that adds readable drift over the shell's motion.
  // Single-axis by default: the shell already travels a 2D path, so a second
  // ellipse inside it reads as swimming. Vertical-only against the parent's
  // drift is what reads as the body settling inside the suit (buoyancy).
  const OCC_AMP_X = 0, OCC_AMP_Y = 3.4        // ≥3px relative — 1–2px reads glued
  const OCC_LAG = 25                          // deg behind the shell's tilt phase
  // parent = the shell's BREATHE null (the innermost transform the body
  // carries), never the rig above it: the occupant must swell with the body,
  // or the shell reads as inflating around a fixed-size face.
  const occupantRigInd = pushLayer({ nm: 'occupant-rig', ty: 3, parent: shellBreatheInd,
    ks: rigKs(pivot, occupantDriftPts /* shell period, phase − OCC_LAG */) })
  pushLayer({ nm: 'occupant-mass', shapes: [group('occupant-mass',
    [shapeFromSubpath(occupantSub, 'occupant-mass-shape'), fillItem(INTERIOR_FILL)])],
    ks: baseTransform(), parent: occupantRigInd, tt: 1 })   // tt:1 = alpha-matted BY the layer above
  // 3. Matte source: a STATIC copy of the CONTAINER riding the SHELL rig, so
  //    the clip follows the shell while the mass roams inside it.
  pushLayer({ nm: 'visor__matte', shapes: [group('visor__matte',
    [shapeFromSubpath(containerSub, 'visor__matte-shape'), fillItem('#FFFFFF')])],
    ks: baseTransform(), parent: shellRigInd, td: true })
  // Layer ORDER: …, eyes (parent occupant-rig), visor__matte, occupant-mass, shell…
  // Eyes and face details ride occupant-rig so they drift with the mass.
  ```

  **Identify the occupant by the EYES.** The occupant is the FACE — the shape
  the eyes sit on and travel with — never the larger mass that face sits in.
  In a helmet scene the dark visor mass is the character's BODY: it is welded
  to the shell and holds perfectly still, while the light face patch drifts
  across it. Getting this backwards makes the whole body slide under the
  helmet's own outline and shave against its strokes (observed; the checker
  now fails it as OCCUPANT HITS THE EDGE). A quick test before you rig: which
  shape would the eyes stay glued to if the character glanced around inside
  its suit? That shape is the occupant.

  **When the face is NEGATIVE SPACE, carve it as a real layer.** Line art
  often draws the face as a HOLE in the dark mass (a two-subpath `Subtract`:
  outer boundary + face-shaped hole) — there is no face shape to move, which
  is why grabbing the whole dark mass is so tempting. Carve instead:
  1. the dark mass = the OUTER subpath alone, filled with its authored
     colour, WELDED to the shell (no own motion),
  2. the face = the HOLE's subpath re-drawn as its own layer on top, filled
     with the colour that currently shows through it (take it from the
     artwork — the body/highlight fill behind — never a new colour),
  3. that face layer plus the eyes ride `occupant-rig`, matte-clipped by the
     dark mass's outer boundary so the face can roam without ever reaching
     the helmet's rim.
  Clearance is per SIDE: the container must exceed the face by MORE than the
  drift amplitude on every side, or the face runs into the outline.

  **Both shapes must already EXIST in the artwork.** The container is the
  region the mass visibly sits in — for a two-subpath cutout, the OUTER
  subpath is the container and the INNER one is the mass, at their authored
  sizes. Never manufacture slack: scaling the mass down, or adding a backing
  layer behind it to fill the gap, invents artwork the designer did not draw
  (observed: a run that shrank the face to 78% and slid a grey plate behind
  it, producing a halo around the face that had no story). If the only
  candidate container is the mass itself, the correct read is usually that
  you have mis-identified which shape is which — re-read the artwork, and
  remember that a dark area around a light face is typically the CHARACTER'S
  BODY seen through the opening, not the interior of the shell.

  Fidelity rule that follows: an occupant carve introduces NO new fill
  colour. Every colour in the built scene must appear in the source SVG
  (`check-motion.mjs` fails on INVENTED FILL). Re-using an existing subpath
  and its existing fill is the whole technique.

  **The container and the mass do not have to come from the SAME path.**
  "For a two-subpath cutout, the outer subpath is the container" is the
  common case, not the only one — check nearby elements too, especially a
  rim/ring drawn around the same interior. Observed case: a body silhouette
  (`Subtract`, a dark disc with its own baked-in visor-hole cutout where the
  eyes sit) sitting inside a separate ring/rim shape (`Ellipse 377`) whose
  own inner-boundary subpath was ~3.6px bigger in radius than the disc,
  already visible as a gap in the static artwork. Trying the literal
  same-path reading first — the disc's own outer subpath as container, its
  own inner/hole subpath as mass, both unscaled — technically clears the
  slack and fill checks, but fills the hole with the disc's own colour, so
  the "mass" is invisible against its own surroundings, and without a
  separate static layer for the rest of the disc the helmet renders mostly
  transparent instead of solid. The ring's own inner boundary as container
  and the WHOLE disc (both its subpaths together, unscaled) as mass
  reproduced the artwork's own appearance at rest while adding real drift.
  When the same-path pairing would make the mass the same colour as what's
  behind it, or would strand the rest of that path's shape with no layer to
  render it, look one level out for a bigger already-existing container
  instead of forcing the pairing.

  Verify like gate 15 says: isolate shell vs occupant at the extremes —
  measurable relative offset, zero occupant pixels outside the opening.
- Contact welds: anything the artwork shows touching, gripped by, resting
  on, or tucked BEHIND the character joins that assembly — with NO own
  relative clock. Same period at a different phase is a time-shifted copy,
  i.e. relative motion, and breaks the weld. Shell surface details (seam
  lines, panel lines, hatches, vents, badges, tick marks) are DECALS: they
  move only because the shell moves. The soft-part exception needs a visible
  FREE END (strap, antenna, hem) — name it, or weld rigid. Brief labels like
  "floating prop" never override a visible contact; free drift needs clear
  air on all sides. Verify with rendered extremes, edge by edge.
- The "steady island": when one element must stay put while the rig moves,
  exclude it from the rig entirely (leave it unparented at its authored
  coordinates) rather than counter-animating it. Counter-animation must cancel the
  parent exactly every frame; exclusion is stable by construction. Verify with a
  pixel diff across the motion extremes.
- Blink as an own-center scale dip: give the eyes their own layer with `p == a`
  at the eye cluster's own bounding-box centre, and dip `scaleY` **to zero** —
  the eye must vanish for a beat. "Near-closed" is the classic mistake: a lid
  parked at 15–20% is a visible slit and reads as a squint (motion-taste,
  "A blink CLOSES, and it is fast"). The eyes still inherit the body's motion
  through parenting but pivot on themselves; every independently-pulsing
  accent uses this same "anchor = own bbox centre" idiom.

  ```js
  // ~7 frames at 60fps: snap shut, hold, open a touch slower. Asymmetry is
  // what makes it a lid rather than a pulse. Sample at step 1 — a 2-frame
  // grid straddles a peak this narrow and bakes a shallower dip than authored.
  const CLOSE = 2, HOLD = 2, OPEN = 4        // frames
  function blinkAmount(t) {                   // 1 = fully closed
    let dt = (t - T - BLINK_PHASE) % BLINK_PERIOD
    if (dt >  BLINK_PERIOD / 2) dt -= BLINK_PERIOD
    if (dt < -BLINK_PERIOD / 2) dt += BLINK_PERIOD
    if (dt <= -CLOSE || dt >= HOLD + OPEN) return 0
    if (dt < 0) return 1 + dt / CLOSE         // closing
    if (dt <= HOLD) return 1                  // held shut — the eye is GONE
    return 1 - (dt - HOLD) / OPEN             // opening
  }
  const scalePts = sampleDense((t) => {
    const b = blinkAmount(t)
    return [100 + 6 * b, 100 * (1 - b), 100]  // y → 0, x widens into the squash
  }, 0, OP, 1)
  ```

  Blinks are EXEMPT from the readable-accent floor (gate 6): that floor governs
  oscillations the eye must track, and stretching a blink to satisfy it is
  exactly what produces the drowsy squint.
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

- Body parts hand-keyed in world space, UNPARENTED from the rig, drift out of
  register instead of inheriting the body's motion. (The fix is to parent them
  and articulate on top — not to stop articulating.)
- The opposite and more common failure: every part rides the parent null and
  nothing deforms, so the character travels as one rigid cutout. Run the
  cardboard test.
- A held or hugged object is left unparented and static while the character
  moves around it, reading as a prop glued to the background.
- Squash pivots at the center, so the character looks compressed by an outside
  force instead of absorbing its own weight.
- Symmetric up/down easing makes a walk read as a hover; a one-way object swing
  reads as a twitch.
- An element that genuinely must stay put (a ground shadow's contact point, a
  logo lockup) is counter-animated and jitters instead of being excluded from
  the rig. Such elements are rare and must be named with a reason — "steady"
  is a deliberate exception, never the default for anything the character
  touches.
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
- The parts articulate, not just the rig: joints bend, extremities lead or lag
  the mass they hang from, and at least half the nameable parts move by MEASURED
  amplitude. The torso/mass carries a continuous breath under whatever the limbs
  are doing.
- Any held object is parented to its holder AND measurably alive on top of the
  inherited motion. "Provably steady" is NOT a passing state — an object whose
  pixels are identical across the extremes while the holder moves reads as a prop
  glued to the background, which is exactly the defect this check exists to
  catch. Verify by isolating the object's layers and pixel-diffing two beats.
- Blink and accent pops pivot on their own centers and sit clear of the loop seam.
- Every animated property's first and last keyframe match; the loop is seamless
  with no special loop logic.
- Timing lands on shared beats; retiming from the named constants keeps everything
  in sync.
- The neutral pose matches the source; motion reads intentional and weighted at
  60 fps.
- The Aliveness Contract in `motion-taste.md` passes, reported as a table
  (track · amplitude · active span · verdict). It is the completion gate for
  every character scene, not an optional extra pass.
