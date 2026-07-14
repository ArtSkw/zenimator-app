# loop-zenek-our-fmj2 — How It's Animated

This scene (`public/projects/loop-zenek-our-fmj2/scene-1/lottie.json`, built by
`scripts/build-loop-zenek-our-fmj2.mjs`) is Zenek perched on his circular badge
processing data: a large central cog turning clockwise, a smaller counter-rotating
`$` gear meshed with it, an independent black settings-gear with a pulsing X
accent, and Zenek floating over his page with a breathing shadow, pen taps, and
a reading eye-scan with occasional blinks — a seamless 39.6s loop @ 60fps.

## The one thing worth recording: this SVG was already solved (three times)

`assets/loop-zenek-our-fmj2.svg` is **geometrically identical** to the source of
the `dataprocessing`, `loop-zenek-our-nzfu`, and `loop-zenek-our-wn6g` scenes.
The intake pass was not "decompose a new illustration" — it was applying the
intake gate documented in
[`loop-zenek-our-nzfu-animation.md`](./loop-zenek-our-nzfu-animation.md): before
decomposing an "animate this SVG" task, diff its geometry against scenes this
project has already shipped.

The gate here: extract every `id → d` from `loop-zenek-our-fmj2.svg`,
whitespace-normalize, and compare against the `SVG_PATHS` block in
`scripts/build-loop-zenek-our-wn6g.mjs`. Result: **all 17 animated paths
identical** (`Vector_2` is only the mask circle, a whitespace-normalized
duplicate of the badge geometry, so it's not carried separately). Same
`<g id="…DataProcessing problem">` root, same `viewBox="0 0 256 257"`, same 18
ids.

Given that, the correct move was to reuse the proven, documented rig verbatim
rather than re-derive the gear decomposition, the LCM loop-length arithmetic, or
the anchor/position split for the pupils. The build script is a copy of
`build-loop-zenek-our-wn6g.mjs` with three edits only: the output directory
(`…/loop-zenek-our-fmj2/scene-1`), the header comment, and the top-level `nm`.
Everything else — the 2376f LCM loop, `tileCycle`, the precomp + track-matte for
the badge-clipped gear cluster, the rigid gear+icon grouping, the balloon-easing
float with breathing shadow, the dense-sampled scan+float pupils with sparse
baked-in blink, the pen tap every other float cycle — is unchanged.

**The full engineering rationale for every one of those decisions lives in
[`dataprocessing-loop-animation.md`](./dataprocessing-loop-animation.md).** Read
that for how the rig actually works; treat this file (like the nzfu and wn6g
docs) only as the record that this slug is that rig on identical geometry.

The `fmj2` brief is the most detailed wording of the four slugs — it spells out
the balloon easing, the contact-shadow breathing, the noting-stroke flick, the
"never clipped or flattened" blink — but every one of those behaviors is already
what the rig does, so no rig change was warranted. The general lesson stands: a
cheap `id → d` diff against existing `build-*.mjs` `SVG_PATHS` blocks is the gate
that turns a dense multi-system rebuild into a three-line re-slug. If any path
had differed, reuse would have been off the table.

## The body floats (diverges from the shared rig)

The inherited dataprocessing / nzfu / wn6g rig holds `zenek-body` (body
fill/stroke + eye-white) **completely still** — only the pupils and pen move.
This slug diverges by choice: the body floats so Zenek reads as a living being
quietly focused on his work. (The setting flip-flopped across a few follow-up
notes — floated, held still, then brought back; this floated state is the
current settled one.)

The lever: animate the body layer's position with the exact same balloon-eased
`FLOAT_POINTS` track the pupils already ride (via
`tileCycle(FLOAT_PERIOD, FLOAT_CYCLES, …)`), anchor left at `[0,0,0]` so the
animated-position freeze gotcha stays clear. Two reasons it's the right lever:

- **Coherence** — the pupils were already floating on that track while the
  eye-white sat still, so the eyes drifted ~8.5px *within* their whites at the
  peak. Floating the body on the identical track locks eye-white + pupils
  together, so the eyes stay seated through the drift.
- **Seam safety** — same 132f period, 18 whole cycles over the 2376f loop, so
  `float(0) == float(T) == 0`; the seam still closes with no other change.

The pen keeps its own (larger, `A=1.75`) float + tap track.

## Warmer, more playful writing (pencil + paper)

A later note asked to make the mascot and his writing feel more playful, warm,
and alive. The body float was already carrying the "alive mascot" read, and the
freeze gotcha blocks a cheap centered secondary transform on the
position-animated body — so the enhancement landed on the writing gesture,
which the note foregrounds ("his writing movement with the pencil and paper
sheet") and which was the least-alive part of the scene:

- **Pencil** — the flat 3-beat tap became a quick, bouncy flurry of ~6 little
  noting strokes that skip side-to-side *and* lift a hair between each other,
  then settle before the pen rides back up. Same tap window (~100–123f), same
  every-other-cycle cadence, roughly the same travel range — just livelier
  within it.
- **Paper** — was dead-static; now gives a tiny sympathetic rock (+1.4°/−0.8°
  about its own center) each time the pen jots, settling flat before the next
  cycle. It's driven by an animated **rotation** with a **static** position, so
  the animated-position freeze gotcha doesn't apply, and it returns to 0 every
  tap cycle so the loop seam stays shut (verified: paper flat and identical at
  frames 0/132/264/396/2375).

## Verification

`node scripts/preview-scene.mjs loop-zenek-our-fmj2 scene-1 0,30,66,90,132,264,2375`
plus a `--zoom 3` pass on the tap frames (96, 104, 112, 120) and the first blink
(264,268,270,272,276 — pass 2, center 270). Confirmed: the gears' icons rotate
rigidly with their tooth rings (big hub+ticks CW, `$` CCW, black gear on its own
axis), Zenek floats with the shadow breathing wider/lighter at the peak, the pen
dips to the page on tap cycles with its little noting flick, the pupils stay
fully rounded through both the scan and the ~12%-scale blink, and frame 2375 is
visually identical to frame 0 (the seam closes).
