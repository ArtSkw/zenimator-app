# loop-zenek-our-kwze — How It's Animated

This scene (`public/projects/loop-zenek-our-kwze/scene-1/lottie.json`, built by
`scripts/build-loop-zenek-our-kwze.mjs`) is Zenek perched on his circular badge
processing data: a large central cog turning clockwise, a smaller counter-rotating
`$` gear meshed with it, an independent black settings-gear with a pulsing `×`
accent, and Zenek floating over his page with a breathing shadow, pen taps, and a
reading eye-scan with occasional blinks — a seamless 39.6s loop @ 60fps.

## Sixth re-slug of an already-solved SVG — the intake gate held again

`assets/loop-zenek-our-kwze.svg` is **byte-identical** (md5
`93f891bc40cb275f234aaf7f65731441`) to the sources of `loop-zenek-our-fmj2`,
`loop-zenek-our-nzfu`, `loop-zenek-our-wn6g`, `loop-zenek-our-ufp3`, and
`loop-zenek-our-gq92` — same illustration, same `viewBox`, same ids. The intake
gate documented in
[`loop-zenek-our-nzfu-animation.md`](./loop-zenek-our-nzfu-animation.md) (diff
the SVG geometry against scenes this project has already shipped before
decomposing) resolved this in one `md5` check.

The `kwze` brief is the same detailed wording as the prior five — balloon
easing, contact-shadow breathing, noting-stroke flick, "~2.5s" counter-gears,
the settings-gear's status-light wiggle, and the "never clipped or flattened"
fully rounded blink. Every one of those behaviors is already what the shared
rig does, so **no rig change was warranted**. The build script is a verbatim
copy of `build-loop-zenek-our-gq92.mjs` (the prior variant) with four edits
only: the header-comment slug, `OUT_DIR`
(`…/loop-zenek-our-kwze/scene-1`), and the top-level `nm`
(`Loop Zenek — Our (kwze)`). Everything else — the 2376f LCM loop, the
precomp + track-matte for the badge-clipped gear cluster, the rigid gear+icon
grouping, the balloon-eased body/shadow float, the dense-sampled scan+float
pupils with sparse baked-in blink, the pen tap every other float cycle — is
unchanged.

**The full engineering rationale lives in
[`dataprocessing-loop-animation.md`](./dataprocessing-loop-animation.md)** (how
the rig works), [`loop-zenek-our-fmj2-animation.md`](./loop-zenek-our-fmj2-animation.md)
(why the body floats, the livelier pencil flurry), and
[`loop-zenek-our-ufp3-animation.md`](./loop-zenek-our-ufp3-animation.md) (the
double-blink follow-up). Treat this file, like the nzfu/wn6g/ufp3/gq92 docs,
only as the record that this slug is that rig on identical geometry.

The general lesson stands and is now six-for-six: a cheap geometry diff
(`md5`, or an `id → d` diff against existing `build-*.mjs` `SVG_PATHS` blocks)
is the gate that turns a dense multi-system rebuild into a four-line re-slug.
If any path had differed, reuse would have been off the table.

## Verification

`node scripts/preview-scene.mjs loop-zenek-our-kwze scene-1 0,30,66,90,132,264,2375`
plus a `--zoom 3` seam pass on frames `0,2375`. Confirmed: the gears' currency
icons rotate rigidly with their tooth rings (big hub+ticks CW, `$` CCW, black
gear on its own axis), the teeth read as genuinely meshing, Zenek floats with
the shadow breathing wider/lighter at the peak, the pupils stay fully rounded
through both the scan and the blink, and frame 2375 is pixel-identical to
frame 0 (gears at matching rotational phase, Zenek at his start float height
and eye position — the seam closes).
