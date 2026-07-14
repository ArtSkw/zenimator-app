# loop-zenek-our-wn6g — How It's Animated

This scene (`public/projects/loop-zenek-our-wn6g/scene-1/lottie.json`, built by
`scripts/build-loop-zenek-our-wn6g.mjs`) is Zenek perched on his circular badge
processing data: a large central cog turning clockwise, a smaller counter-rotating
`$` gear meshed with it, an independent black settings-gear with a pulsing X
accent, and Zenek floating over his page with a breathing shadow, pen taps, and
a reading eye-scan with occasional blinks — a seamless 39.6s loop @ 60fps.

## The one thing worth recording: this SVG was already solved (twice)

`assets/loop-zenek-our-wn6g.svg` is **byte-identical** to the source of both the
`dataprocessing` scene and the `loop-zenek-our-nzfu` re-slug. The intake pass was
not "decompose a new illustration" — it was applying the intake gate documented in
[`loop-zenek-our-nzfu-animation.md`](./loop-zenek-our-nzfu-animation.md): before
decomposing an "animate this SVG" task, diff its geometry against scenes this
project has already shipped.

The gate here: extract every `id → d` from `loop-zenek-our-wn6g.svg`,
whitespace-normalize, and compare against the `SVG_PATHS` block in
`scripts/build-loop-zenek-our-nzfu.mjs`. Result: **all 17 animated paths
identical** (`Vector_2` is only the mask circle, a duplicate of the badge
geometry, so it's not carried separately). Same `<g id="…DataProcessing problem">`
root, same `viewBox="0 0 256 257"`, same 18 ids.

Given that, the correct move was to reuse the proven, documented rig verbatim
rather than re-derive the gear decomposition, the LCM loop-length arithmetic, or
the anchor/position split for the pupils. The build script is a copy of
`build-loop-zenek-our-nzfu.mjs` with three edits only: the output directory
(`…/loop-zenek-our-wn6g/scene-1`), the header comment, and the top-level `nm`.
Everything else — the 2376f LCM loop, `tileCycle`, the precomp + track-matte for
the badge-clipped gear cluster, the rigid gear+icon grouping, the balloon-easing
float with breathing shadow, the dense-sampled scan+float pupils with sparse
baked-in blink, the pen tap every other float cycle — is unchanged.

**The full engineering rationale for every one of those decisions lives in
[`dataprocessing-loop-animation.md`](./dataprocessing-loop-animation.md).** Read
that for how the rig actually works; treat this file (like the nzfu doc) only as
the record that this slug is that rig on identical geometry.

The brief text differs in wording between the three slugs but describes the same
motion system, so no rig change was warranted. The general lesson stands: a cheap
`id → d` diff against existing `build-*.mjs` `SVG_PATHS` blocks is the gate that
turns a dense multi-system rebuild into a three-line re-slug. If any path had
differed, reuse would have been off the table.

## Verification

`node scripts/preview-scene.mjs loop-zenek-our-wn6g scene-1 0,30,66,90,132,264,2375`
plus a `--zoom 3` pass on the tap frames (96, 104, 112) and the first blink
(pass 2, center 270). Confirmed: the gears' icons rotate rigidly with their tooth
rings (big hub+ticks CW, `$` CCW, black gear on its own axis), Zenek floats with
the shadow breathing wider/lighter at the peak, the pen dips to the page on tap
cycles with its little noting flick, the pupils stay fully rounded through both
the scan and the ~12%-scale blink, and frame 2375 is visually identical to frame
0 (the seam closes).
