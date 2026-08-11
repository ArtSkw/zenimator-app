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
// LAP = THE CANVAS WIDTH. Not the field's own width — see "How far apart"
// below; a lap narrower than the canvas puts the same cloud on screen two or
// three times at once and reads as duplicated artwork, not as a sky.
const lap = W
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

### How far apart — the lap is the CANVAS width, not the field's

Spacing tiles by the artwork's own width is the intuitive choice and it is
wrong. The source sky holds a fixed number of clouds — often just two, one
high and one low. Tile them 190px apart on a 375px canvas and three copies of
the same cloud share the screen: the sky reads as duplicated artwork rather
than as the drawing that was handed over. Reported twice from the field, the
second time after this very code sample taught it.

```
lap >= W                    // no more than one copy substantially on screen
lap <= W + fieldWidth       // coverage: a gap can never open
```

The valid window is `[W, W + fieldWidth]`, and `lap = W` is the default worth
reaching for. The lower bound is what keeps the sky sparse; the upper bound is
what keeps it from emptying. Note the two bounds are per FIELD, so a wide
field and a narrow one can share `lap = W` happily.

Do NOT try to buy parallax by giving one depth layer a shorter lap — that
tiles it densely, which is the defect above. Parallax comes from SPEED
(the lap-count ratio), and both layers keep a lap of `W`.
`check-motion.mjs` fails AMBIENT TILES TOO DENSE.

Because every layer shares `lap = W` and each must cross a WHOLE number of
laps per loop, **parallax ratios are ratios of small integers** — 2:1 from
lap counts 2 and 1, 3:2 from 3 and 2. That is a real constraint, not a
limitation to design around: pick the ratio first, then the lap counts.

All four requirements hold at once, so none of them is a trap — the reference
scene runs `lap = W = 375` on both layers, 2 and 1 laps per loop (2:1
parallax), zero reverse travel, and both sets resting 0.0px from source.

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

**If the field must also close a REPEATABLE marker segment (an idle/float
loop the app replays until a trigger), the seam is the ENSEMBLE's, not any
one tile's.** Exact numeric equality of one tile's keyframe value at the
segment's start and end is neither necessary nor — for a continuously
scrolling field — possible without reintroducing a teleport. What actually
makes the loop read clean:

- Size each tile's speed so the loop span (`T - E`) crosses an exact whole
  number of laps: `speed = k * lap / (T - E)` for a small integer `k`
  (usually 1). This makes every tile's own position differ between the
  segment's start and end by exactly `k * lap` — not equal, but the tile
  that scrolled off is standing in for the one ahead of it, so the rendered
  picture is identical even though no single tile's own value matches.
- Extend the tile range to NEGATIVE indices (one-plus lap to the left of the
  native/`i=0` position), not just `0..copies-1`. Without this, a screen
  strip that only becomes covered by a tile's own leftward drift LATER in
  the timeline is simply blank EARLIER — nothing has drifted there yet at
  the segment's start, while the segment's end shows a tile sitting exactly
  there (measured: a ~440px patch missing from the start frame, found by
  pixel-diffing the segment's start and end frames and reading the diff's
  bounding box, not by eye — it reads as a small isolated defect, not an
  obviously missing cloud).
- Verify with a direct `anim.seekFrame()` pixel diff of the segment's start
  and end frames (`ck.LTRBRect`, per the player-contract gotcha), never by
  comparing individual layer keyframes — the per-tile numeric "mismatch"
  (each tile off by exactly its own lap) is expected and correct on a
  passing scene, and only a picture-level diff tells that apart from a real
  seam break. `scripts/check-loop-seam.mjs` does exactly this.

**And when the field BRAKES TO A STOP under a payoff, it must halt on a lap
boundary — its source position.** A sequence assembled from several artworks
is supposed to end on the last one; a field that stops a third of a lap out
gives the right composition with the sky in the wrong place. This is a SECOND
condition, and satisfying only the loop one is the trap — a generated scene
closed its loop perfectly and still rested 106px and 135px off source.

Let `S` be the repeatable span and `D` the brake's DISTANCE-TIME: the time
that, multiplied by the running speed, equals the total distance travelled. For
a cubic brake (velocity ∝ `(1-u)²`) starting at `decelStart` and lasting
`decelDur`, the integral gives

```
D = decelStart + decelDur / 3          // distance-time, in frames
speed = lapsPerLoop * lap / S          // closes the repeatable segment
total = speed * D = lapsPerLoop * lap * D / S
```

`total` is a whole number of laps exactly when `lapsPerLoop * D / S` is an
integer — and the clean way to guarantee that for ANY lap count is

```
D = k * S     for a small integer k
```

Note what this means: **the loop span is derived from where the sky stops, not
chosen first.** `S = D / k`. Picking `S` for the idle's own sake and then
discovering `D` lands at `1.64 * S` leaves nothing to tune — the lap count
cannot rescue a bad ratio (it multiplies both sides), and neither can the lap
distance (it cancels). Only the brake profile offers slack: velocity ∝
`(1-u)^n` integrates to `decelDur / (n+1)`, so `n` shifts `D` continuously if
the beats are otherwise fixed. `check-motion.mjs` fails AMBIENT RESTS
OFF-SOURCE.

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
