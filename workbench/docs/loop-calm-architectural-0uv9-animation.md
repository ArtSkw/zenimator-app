# loop-calm-architectural-0uv9 — calm architectural loop

Build script: `scripts/build-loop-calm-architectural-0uv9.mjs` (reads the SVG
straight from `assets/`, 25 paths, indices documented in the script).

## Rig

- 720f @60fps (12s), `loop` marker over the whole comp so
  `check-loop-seam.mjs` actually pixel-diffs 0 vs 720 (without a marker it
  exits 0 with "nothing to prove").
- Tree: `tree` null pivots at the trunk base (34.98, 229.33) on the ground
  line, θ = 2.5°·(2·smoothstep((1−sin ωt)/2)−1), period 180f. Crown adds
  θ(t+2)−θ(t) about the same pivot → crown world angle leads the trunk by 2f.
  Declared as a motionException quoting the brief.
- Birds: position = sum of whole-loop sines (start and end at source); wing
  morph rotates each wing about the body vertex (left +a, right −a in y-down
  space lifts both tips). A smoothstep wing driver multiplied by a soar
  envelope measured 6–7× max/median; a pure sine with a 0.7±0.3 envelope
  measures ~2.3×. Envelopes multiply the velocity ratio — keep them shallow.
- Hatch cloud: two tiles `hatch-cloud-0/1`, lap = W = 256, one lap per loop.
- Silhouette: scaleY 100±5 anchored on its base — base contact holds (0.41px).

## Edge headroom — asymmetric lean (revision)

The source crown sits ~1.66px from the left canvas edge, so a symmetric ±2.5°
lean about the trunk base clipped ~2.2px of crown stroke. Fixed without moving
or resizing the tree: lean range is now [−0.75°, +2.5°] — the wind pushes it
right the full amount and it springs back just past upright. Waveform
`sin x − 0.25·sin 2x` (first two sawtooth harmonics: 112f push, 68f spring
back per 180f cycle), normalised to that range and phased so frame 0 is the
source pose. Crown ink now spans x 0.49–87.5px; velocity 2.26×. Mapping a
symmetric driver piecewise (different gain each side of zero) would kink the
velocity at the crossing, where speed peaks — offset + skew the wave instead.

## check-motion notes

`bird` is in the ambient vocabulary, so a free bird's wander trips AMBIENT
DRIFT REVERSES; declare `{ layer, reason }` with the brief's wander sentence.
