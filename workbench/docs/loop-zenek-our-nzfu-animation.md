# loop-zenek-our-nzfu — How It's Animated

This scene (`public/projects/loop-zenek-our-nzfu/scene-1/lottie.json`, built by
`scripts/build-loop-zenek-our-nzfu.mjs`) is Zenek perched on his circular badge
processing data: a large central cog turning clockwise, a smaller counter-rotating
`$` gear meshed with it, an independent black settings-gear with a pulsing X
accent, and Zenek floating over his page with a breathing shadow, pen taps, and
a reading eye-scan with occasional blinks — a seamless 39.6s loop.

## The one thing worth recording: this SVG was already solved

`assets/loop-zenek-our-nzfu.svg` is **byte-identical** to the source of the
existing `dataprocessing` scene. The intake pass here was not "decompose a new
illustration" — it was recognizing a re-slug of prior work and confirming it
before reimplementing anything:

1. The SVG carries the same `<g id="…DataProcessing problem">` root, the same
   `viewBox="0 0 256 257"`, and the same 18 `id`s (`Vector`, `Vector_2 … _16`,
   `Intersect`, `Intersect_2`).
2. A quick diff — extract every `id → d` from the new SVG, whitespace-normalize,
   and compare against `SVG_PATHS` in `scripts/build-dataprocessing.mjs` —
   reported **all 17 animated paths identical** (`Vector_2` is only the mask
   circle, a duplicate of the badge geometry, so it's not carried separately).

Given that, the correct move was to reuse the proven, documented rig verbatim
rather than re-derive the gear decomposition, the LCM loop-length arithmetic, or
the anchor/position split for the pupils. The build script is a copy of
`build-dataprocessing.mjs` with three edits only: the output directory
(`…/loop-zenek-our-nzfu/scene-1`), the header comment, and the top-level `nm`.
Everything else — timing constants, `tileCycle`, the precomp+track-matte for the
masked cluster, the rigid gear+icon grouping, the balloon-easing float, the
dense-sampled scan+float pupils with sparse baked-in blink — is unchanged.

**The full engineering rationale for every one of those decisions lives in
[`dataprocessing-loop-animation.md`](./dataprocessing-loop-animation.md).** Read
that doc, not this one, for how the rig actually works; treat this file only as
the record that this slug is that rig on identical geometry.

The general lesson for future intake: **before decomposing an "animate this SVG"
task, check whether the geometry already matches a scene this project has
shipped.** A cheap `id → d` diff against existing `build-*.mjs` `SVG_PATHS`
blocks can turn a dense multi-system rebuild into a three-line re-slug. If any
path had differed, the reuse would have been off the table and it would have
been a from-scratch parse — so the diff is the gate, not an assumption.

## Verification

`node scripts/preview-scene.mjs loop-zenek-our-nzfu scene-1 0,33,66,99,132,264,2375`
plus a `--zoom 3` pass on the tap frames (108, 112) and the first blink
(pass 2, center 270). Confirmed: gears' icons rotate rigidly with their tooth
rings (big hub+ticks CW, `$` CCW, black gear on its own axis), Zenek floats with
the shadow breathing wider/lighter at the peak, the pen dips to the page on tap
cycles, the pupils stay fully rounded through both the scan and the 12%-scale
blink, and frame 2375 is visually identical to frame 0 (the seam closes).
