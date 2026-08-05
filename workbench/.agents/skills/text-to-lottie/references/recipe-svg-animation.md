# Recipe: SVG Animation

Use for generic "animate this SVG", SVG-to-Lottie, vector illustration reveals,
and SVG assets that are not clearly logo/icon/UI/lower-third/product/diagram
work.

Always read `svg-compatibility.md` with this recipe.

## User-Language Aliases

- "turn this SVG into Lottie", "animate this vector", "SVG reveal"
- "make this illustration move", "draw this SVG", "bring this SVG to life"

## Defaults

- Keep output transparent unless the SVG is clearly a full-frame illustration or
  the user requests a background.
- Preserve the source composition and viewBox.
- Animate meaningful structure: groups, paths, strokes, accents, labels, or
  visual flow.
- Route technical diagrams, product promos, and effect-led requests to their
  specific recipes when those are the main deliverable.

## Presets

- `path-draw`: strokes draw on with trim paths, then settle/fill.
- `layer-unfold`: grouped elements reveal in depth or reading order.
- `fill-sweep`: solid regions receive a directional color or opacity reveal.
  For gradient-painted regions and hand-lettered artwork, use the matte-wipe
  recipe in recipe-typography ("Handwritten Write-On Over Gradient Artwork") —
  the fill stays untouched, the sweep lives in the matte.
- `illustration-drift`: tiny grouped parallax/position motion after reveal.
- `morph-lite`: small shape/position changes, only when source paths are safe.

## Timing And Easing

- Simple SVG/icon: 45-90 frames.
- Complex illustration: 90-180 frames.
- Use trim-path pacing based on perceived length, not raw segment count.
- Use calm ease-out for assembly and avoid morphing unless geometry is safe.

## Ask Only When Needed

- Ask what part should move if the SVG is complex and no intent is given.
- Ask transparent vs full-frame only when source framing is ambiguous.
- Ask whether exact final fidelity matters if the prompt invites creative
  transformation.

## Construction Notes

- Inspect groups and paths before deciding animation units.
- Resolve SVG styling and transforms enough that Lottie output is predictable.
- Use masks/reveals for complex filled shapes; use trim paths for clean strokes.
- Avoid path morphing unless paths have compatible vertex structure.
- Expose slots for accent color, background color when used, and optional scale
  or emphasis controls when useful.

## Self-Drawing Strokes (Write-On)

- Draw a stroke on with a trim-path modifier (`ty: tm`): keyframe `e` from 0 to
  100 with `s` held at 0 (or animate `s` from 100 to 0 to draw from the far end
  backward), `o` at 0.
- `m: 1` trims the whole group as one continuous path; `m: 2` trims each subpath
  individually, so multiple shapes draw on one after another — set it
  deliberately.
- The trim modifier must sit AFTER the path and its stroke in the group's `it`
  order; a modifier only affects the items listed before it.
- Use round caps (`lc: 2`) so the growing tip reads as a pen, not a hard cut.
- To reverse the draw direction, reverse the path's vertex order AND swap each
  vertex's in/out tangents (the tangent that arrived at a point now leaves it).
  Reversing vertices alone kinks the curve, and flipping the trim start/end does
  not change direction. Check which endpoint the source path starts from and
  reverse only when the natural draw-on isn't already there.
- Gradient stroke (`ty: gs`): pack its stop array as all color stops
  (`offset, r, g, b` each) then all alpha stops (`offset, alpha` each), with
  `g.p` = stop count, and copy `s`/`e` from the SVG gradient coordinates.
  Keyframing a gradient's stops or `s`/`e` renders nothing in Skottie — animate
  a trim or mask over a STATIC gradient instead.

- Raster `<pattern>` fill (`fill="url(#patternN)"` tiling an embedded PNG —
  hatches, textures, halftones): Skottie has no tiled-pattern fill, so DON'T
  flatten it to a solid. Revectorize the motif as vector geometry clipped to the
  shape so it animates with the piece (a rotating textured gear keeps its hatch),
  or rasterize the filled shape to an image+matte only when it's static. Full
  rule + the accepted example in svg-compatibility ("Masks, Clips, Gradients,
  Patterns, And Effects").

## Common Failure Modes

- Final frame no longer matches the source.
- Hidden CSS styling disappears after conversion.
- A raster `<pattern>` fill gets flattened to a solid, dropping the texture.
- Fill rules or masks break holes/intersections.
- Arbitrary path fragments move without a readable idea.

## Acceptance Checks

- Final frame matches the SVG source visually unless creative change was asked.
- No holes, clips, masks, gradients, or intersections break in Skottie.
- The animation has a clear reading order or reveal logic.
- Transparent/full-frame background policy is intentional.
