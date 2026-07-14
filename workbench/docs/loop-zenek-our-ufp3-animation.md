# loop-zenek-our-ufp3 — How It's Animated

This scene (`public/projects/loop-zenek-our-ufp3/scene-1/lottie.json`, built by
`scripts/build-loop-zenek-our-ufp3.mjs`) is Zenek perched on his circular badge
processing data: a large central cog turning clockwise, a smaller counter-rotating
`$` gear meshed with it, an independent black settings-gear with a pulsing `×`
accent, and Zenek floating over his page with a breathing shadow, pen taps, and a
reading eye-scan with occasional blinks — a seamless 39.6s loop @ 60fps.

## Fourth re-slug of an already-solved SVG — the intake gate held again

`assets/loop-zenek-our-ufp3.svg` is **byte-identical** (md5
`93f891bc40cb275f234aaf7f65731441`) to the sources of `loop-zenek-our-fmj2`,
`loop-zenek-our-nzfu`, and `loop-zenek-our-wn6g` — same illustration, same
`viewBox`, same ids. The intake gate documented in
[`loop-zenek-our-nzfu-animation.md`](./loop-zenek-our-nzfu-animation.md) (diff the
SVG geometry against scenes this project has already shipped before decomposing)
resolved this in one `md5` check rather than a manual `id → d` diff, since the
whole file matched.

The `ufp3` brief is the same detailed wording as `fmj2` — it spells out the
balloon easing, the contact-shadow breathing, the noting-stroke flick, the
"~2.5s" counter-gears, the settings-gear's status-light wiggle, and the "never
clipped or flattened" fully-rounded blink. Every one of those behaviors is
already what the shared rig does (float body diverges from the base
dataprocessing rig — see below), so **no rig change was warranted**. The build
script is a verbatim copy of `build-loop-zenek-our-fmj2.mjs` with four edits
only: the two header-comment slugs, `OUT_DIR`
(`…/loop-zenek-our-ufp3/scene-1`), and the top-level `nm`
(`Loop Zenek — Our (ufp3)`). Everything else — the 2376f LCM loop, the precomp +
track-matte for the badge-clipped gear cluster, the rigid gear+icon grouping, the
balloon-eased body/shadow float, the dense-sampled scan+float pupils with sparse
baked-in blink, the pen tap every other float cycle — is unchanged.

**The full engineering rationale lives in
[`dataprocessing-loop-animation.md`](./dataprocessing-loop-animation.md)** (how
the rig works) and [`loop-zenek-our-fmj2-animation.md`](./loop-zenek-our-fmj2-animation.md)
(why the body floats, the livelier pencil flurry + sympathetic paper rock). Treat
this file, like the nzfu/wn6g/fmj2 docs, only as the record that this slug is that
rig on identical geometry.

The general lesson stands and is now four-for-four: a cheap geometry diff
(`md5`, or an `id → d` diff against existing `build-*.mjs` `SVG_PATHS` blocks) is
the gate that turns a dense multi-system rebuild into a four-line re-slug. If any
path had differed, reuse would have been off the table.

## Follow-up: double blinks (diverges slightly from the shared rig)

A later note asked for the blink to *sometimes* read as a double blink so the
eyes feel more alive and less metronomic. The rig bakes each blink into the
pupil **shape** track (a scale dip around the pupil's own rest center — the
freeze gotcha blocks a layer-scale blink while the pupils also translate). So
the smallest change lives entirely in that shape track: a `DOUBLE_BLINKS` set
(`{5, 12, 20}` of the 8 `BLINK_PASSES`) branches those passes into a five-key
flutter — close (0.12) → half-reopen (0.72) → close (0.12) → full reopen — all
inside a ~20f window, while the other five passes keep the original three-key
single dip. Verified frames `582/587/593/597/602` (pass 5 double) and
`801/810/818` (pass 7 single). The last double (pass 20, center f2214) closes by
~f2222, well clear of the seam, so frame 2375 stays identical to frame 0.

## Verification

`node scripts/preview-scene.mjs loop-zenek-our-ufp3 scene-1 0,30,66,90,132,264,2375`
plus a `--zoom 3` seam pass on frames `0,2375`. Confirmed: the gears' currency
icons rotate rigidly with their tooth rings (big hub+ticks CW, `$` CCW, black
gear on its own axis), the teeth read as genuinely meshing, Zenek floats with the
shadow breathing wider/lighter at the peak, the pupils stay fully rounded through
both the scan and the blink, and frame 2375 is pixel-identical to frame 0 (gears
at matching rotational phase, Zenek at his start float height and eye position —
the seam closes).
