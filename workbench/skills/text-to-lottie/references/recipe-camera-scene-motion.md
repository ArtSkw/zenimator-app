# Recipe: Camera And Scene Motion

Use for camera-following motion, pan, zoom, parallax, layered scene movement,
hero pushes, product screenshot tours, and animated scene framing.

## User-Language Aliases

- "pan across this", "zoom into the product", "camera follow"
- "parallax scene", "Ken Burns style", "move through the interface"
- "push in", "pull back", "follow the path", "scene motion"

## Defaults

- Choose one dominant camera idea: push, pull, pan, follow, or parallax.
- Keep the main subject readable throughout the move.
- Use full-frame background policy unless the result is a transparent asset.
- Treat camera motion as attention direction, not decoration.
- Use camera motion to improve attention and final-frame framing, not to hide a
  weak composition.

## Presets

- `premium-push`: slow push-in with subtle foreground/background separation.
- `guided-pan`: horizontal or vertical pan revealing steps in order.
- `focus-follow`: camera follows one hero object or path.
- `layered-parallax`: foreground/midground/background move at different rates.
- `product-tour`: screenshot/product card moves through 2-3 feature beats.

## Timing And Easing

- Compact camera move: 60-120 frames.
- Product or scene tour: 120-240 frames.
- Use smoother easing than object motion; abrupt camera stops feel cheap.
- Hold briefly after the camera arrives so the final message lands.

## Ask Only When Needed

- Ask which subject to follow if the scene has multiple heroes.
- Ask output size/platform if framing depends on aspect ratio.
- Ask whether text must remain readable throughout the move when uncertain.

## Construction Notes

- Prefer grouped/parented transforms over animating every child independently.
- Keep scale changes modest unless the move is the concept.
- Counter-animate text or labels if camera motion makes them hard to read.
- Use parallax only when layered depth exists or can be built cleanly.
- If the final frame feels like an accidental crop, revise the layout or camera
  endpoint before adding more movement.

## Ambient Scroll (clouds, waves, traffic, rain, skyline)

A field that streams steadily across frame — the single most-requested
background behaviour, and the one most often authored as something that
LOOKS like a scroll for a few seconds and then visibly breaks.

**Author it by TILING, never by teleporting.** Build N copies of the field
spaced exactly one lap apart, and give every copy the SAME single linear
translation across the whole timeline. As copy A leaves the left edge, copy B
is exactly where A began. There is no jump anywhere in the data, so nothing
downstream can interpolate one.

```js
// One lap = the field's own width + the gap that makes it read as continuous.
const lap = fieldBbox.width + gap
const copies = Math.ceil((pxPerFrame * OP) / lap) + 1   // enough to cover the run
for (let i = 0; i < copies; i++) {
  // Copy i starts one lap to the RIGHT of copy i-1 and drifts left forever.
  pushLayer({
    nm: `cloud-near-${i}`,
    shapes,
    ks: { ...baseTransform(), p: bakedProp(
      sampleDense((t) => [i * lap - pxPerFrame * travelled(t), 0, 0], 0, OP)
    ) },
  })
}
```

`travelled(t)` is the field's own distance curve: `t` while it runs, then the
brake's integral once the brief stops it. Speed lives in ONE constant per
depth layer (`pxPerFrame`); parallax is the RATIO between layers (a far layer
at half the near layer's speed), never a second unrelated clock.

Why not the wrap-teleport that looks so much simpler — drift left, then jump
back to the right between two near-coincident keyframes:

- The jump is a real value change in the data. It stays invisible only while
  every consumer samples exactly on the frames you assumed. Anything that
  RESAMPLES or RESCALES time — a duration control, a speed control, a player
  running at display refresh rather than composition frames — can land inside
  the jump and DRAW it: the field sweeps the whole canvas backwards in a blink,
  then resumes. Reported from the field twice, described as "it goes left to
  right and then back, chaotically".
- Tiling has no jump to land inside. It survives every one of those.

If a teleport is genuinely unavoidable, the pre-jump keyframe MUST be a HOLD
key (`h: 1`) so no interpolation is possible, and both keys must place the
artwork fully outside the frame. `check-motion.mjs` fails a wrap that is
visible or interpolatable.

**A steady drift never reverses.** When the brief says one direction, the
field travels that direction only, at constant speed, from the frame the brief
starts it until the beat the brief brakes it — then decelerates to a full stop
and holds. Any sustained travel against that direction is a defect, not
variety (`check-motion.mjs`: AMBIENT DRIFT REVERSES).

## Common Failure Modes

- Ambient field authored as a wrap-teleport, and the jump becomes visible.
- Ambient field oscillating back and forth instead of streaming one way.
- Camera crops the hero subject or text.
- Parallax layers move without a clear depth hierarchy.
- Motion sickness from too much scale/position change.
- Final frame feels like an accidental crop.
- Camera motion adds energy but does not improve hierarchy or framing.

## Acceptance Checks

- The viewer's eye follows the intended subject.
- Important text remains readable or resolves quickly.
- First and final frames are clean compositions.
- Camera motion enhances the message instead of hiding weak layout.
- Final camera position lands on the strongest still frame.
