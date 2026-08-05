# SVG Compatibility

Use this reference whenever the source artwork is SVG or the output depends on
SVG-like path behavior.

## Prevention-First Intake

- Diff geometry before rebuilding: an unknown SVG may repeat one already shipped
  in another scene. Hash the path `d` data (an `md5`, or an `id`→`d` map) and
  compare against the path data of already-shipped scenes; on a match, reuse the
  proven rig instead of re-deriving it. Any single differing path takes reuse
  off the table — treat the diff as a gate, not an assumption.
- Render the SVG statically first, before parsing. Recognizing what it depicts
  (a launch, a mechanism, a character, a diagram) reframes the brief and often
  makes the choreography obvious.
- **When per-path grouping (which paths form one letter/element) isn't obvious
  from IDs or bbox adjacency** — common in hand-lettered SVGs, where a pen
  stroke splits into a new fill region every time it crosses itself, so one
  letter can be 1-3 paths with heavily overlapping bounding boxes vs its
  neighbors — render each path **in isolation** (one throwaway CanvasKit-in-Node
  script: `ck.Path.MakeFromSVGString(d)` per path, drawn in red over the rest
  in gray, one cell per path index) and read off which glyph/element it lights
  up. Bbox math alone reliably fails here; a quick zoomed crop of just the
  ambiguous cluster resolves what the numbers can't. Discard the script after;
  it's a diagnostic, not a deliverable.
- Inspect the `viewBox`, width, height, coordinate origin, groups, masks,
  gradients, style tags, and text before animating.
- Preserve the intended viewBox and scale the Lottie composition around it.
- Inline or resolve CSS-dependent styling. Avoid external classes, inherited
  styles, web fonts, CSS variables, and filters that Skottie may not match.
- A decorative cluster whose bounding box exceeds the canvas or an enclosing
  sibling shape is the tell that the source cropped it with a `<mask>` —
  reconstruct that mask as a matte rather than porting the oversized cluster as
  a plain static layer.
- Render a tight `viewBox` crop around a single subpath's bbox to identify an
  ambiguous piece, instead of guessing its role from raw coordinates.
- Keep layer names meaningful when splitting paths for animation.
- Compare the settled Lottie frame against the source SVG before finishing.

## Geometry Cleanup

- Resolve nested transforms into path/group coordinates when practical.
- Rebuild native `<circle>`/`<ellipse>`/`<rect>` — especially matrix-transformed
  ones — as Lottie primitives by resolving the matrix to an absolute
  center/size, instead of forcing them through the path parser (which won't see
  them at all).
- Expand strokes to fills when stroke joins, caps, dash behavior, or scaling may
  render differently in Skottie or downstream players. A thick, self-crossing
  *live* stroke is a known trigger for a worse failure: in this renderer it can
  silently corrupt *other, unrelated* layers — they stop rendering, with no
  error — merely by being present, static or animated. Bake it into a single
  fill contour with consistently-wound caps and joins; overlapping subpaths of
  opposite winding cancel under nonzero fill and bite holes at the caps.
- Keep strokes as strokes when trim-path drawing is the animation itself, but
  verify cap/join behavior.
- Flatten unnecessary groups, but keep semantically useful groups for animation
  control.
- Avoid fragile boolean intersections when a simple separate path stack is
  visually equivalent. Merge Paths combines *every preceding shape in the group*
  pairwise, in list order, by the same op — so one intersect stack holding
  several shapes plus a mask computes `intersect(shapeA, shapeB)` first, not each
  shape clipped by the mask. To clip several shapes by one moving mask, give each
  its own group with its own copy of the mask geometry (built from the same
  box/timing so they stay in sync).

## Fill Rules And Compound Paths

- Watch self-intersections, compound paths, and holes. Even-odd and non-zero
  fill rules can differ after conversion.
- Prefer clean compound paths with explicit intended holes.
- If a shape relies on overlapping subpaths to cancel areas, consider splitting
  or rebuilding it into simpler visible shapes.
- A compound shape whose hole depends on an even-odd / non-zero fill rule cannot
  join a Merge Paths intersect stack at all: the first pairwise op intersects the
  hole subpath against its outer contour and destroys the hole. Keep such shapes
  out of any Merge Paths chain and reveal them with their own opacity/scale
  instead of a clip.
- Verify holes at frame `0`, during reveal, and at the settled frame.

## Masks, Clips, Gradients, Patterns, And Effects

- Use masks and clip paths only when needed; simple grouped shapes are safer.
- If a mask moves, check all masked frames for popping or disappearing content.
- Prefer simple linear/radial gradients. Provide solid fallback shapes if the
  look is critical.
- **Keep the source's gradient fills — do not flatten them to a solid.** If a
  path ships a gradient (`fill="url(#…)"`), carry that gradient into the Lottie
  shape unchanged; the reveal/transform animates *over* it. Flattening because a
  gradient is "subtle" or because there are several to port is a **regression of
  the artwork**, not a safe simplification (static gradients render fine here —
  only *animating a gradient's stops* fails; see lottie-spec-map Renderer gotchas).
  - **Converting a `userSpaceOnUse` `radialGradient` to a Lottie `gf`:** parse the
    def, don't transcribe by hand. A gradient built as the common
    `cx="0" cy="0" r="1"` unit circle plus
    `gradientTransform="translate(tx ty) rotate(a) scale(sx sy)"` maps to
    `gf.s = [tx, ty]` and `gf.e = [tx + sx*cos(a·π/180), ty + sx*sin(a·π/180)]`
    (radial `gf` has no independent x/y radius, so only `sx` sets the radius;
    reach for `h`/`a` highlight fields only if the source has an off-center
    focal point). Stops become `g.k = [...colorStops, ...alphaStops]` —
    color quadruples (`offset, r, g, b`, 0-1 range) followed by alpha pairs
    (`offset, alpha`) for the same offsets, `g.p` = stop count. A gradient
    whose every stop shares one hue and only ramps opacity (a soft highlight
    taper, common on hand-lettered strokes) is still a real gradient — encode
    the alpha ramp, don't collapse it to one flat opacity.
- **Keep the source's `<pattern>` fills too — carry the texture, do NOT flatten
  it.** A `fill="url(#patternN)"` — especially one tiling an embedded raster
  image (`<image>`/base64 PNG referenced by `<use>`) — is the same class of trap
  as a dropped gradient. Skottie has **no tiled-pattern fill**, so the naive move
  is to collapse the shape to a solid, which silently erases the texture. This is
  exactly what dropped the diagonal-hatch "grey cog" and its shadow on the
  data-processing scene. Preserve it, and pick the path by whether the piece
  moves:
  - **Preferred — revectorize the motif and clip it to the shape.** Rebuild the
    pattern's repeating unit as real vector geometry (a diagonal hatch → a set of
    stroke lines or thin rects) and clip it to the target shape's silhouette with
    a track matte. It stays vector, so it recolors, scales crisply, and — the
    point — **transforms WITH the shape**: the hatch rotates with its gear, the
    shadow texture breathes with the shadow. A baked bitmap can't do that
    cleanly. This is how the accepted data-processing scene does it: `shine`
    (71 hatch shards) and `shadow` (14), each a flat-fill subpath cluster matted
    by the badge. Match the source tile's spacing/angle and the pattern's
    `fill-opacity`.
  - **Fallback — rasterize the filled shape to an image layer + matte.** If the
    motif is too intricate to revectorize faithfully AND the piece is static,
    render the pattern-filled shape to a PNG, add it as an image asset, and clip
    it with a shape matte. Acceptable, but the texture is now a rigid bitmap —
    it can only move as one piece, so never use this for anything that must
    rotate or scale independently.
  - **Never** flatten the pattern to a solid fill and drop the texture — that is
    a regression of the artwork, same severity as flattening a gradient. Verify
    against the source: if the source has a hatch/texture and your render is
    flat, you have regressed it.
  - **Export note:** the same illustration can export a texture either as a
    raster `<pattern>` (hard) or as pre-expanded vector subpaths (easy — carry
    them straight through as shapes). Both are valid inputs and both must keep
    the texture; if you control the export, prefer the vector one.
- Rebuild SVG filters, shadows, blurs, and blend modes as simple Lottie shapes
  or restrained effect layers where possible.
- Align crisp icon geometry to avoid fuzzy fractional-pixel edges.

## Text And Morphing

- Convert SVG text to paths when exact typography matters or font availability is
  uncertain.
- Keep text editable only when the player text-slot behavior is the main need.
- Avoid path morphing unless source and target paths have compatible vertex
  structure and direction.
- For incompatible morphs, use masks, crossfades, staggered replacement, or
  layer assembly instead.

## Renderer Differences

- Browser SVG, Skottie, and downstream web playback may disagree on
  intersections, masks, gradients, strokes, and unsupported effects.
- Verify in Skottie as the source of truth for this project.
- For website export risk, prefer explicit fills, simple masks, local assets,
  and fewer renderer-specific features.

## Animation Strategy

- For logos, separate mark, wordmark, accents, and background policy.
- For icons, animate semantic parts rather than arbitrary path fragments.
- For diagrams, preserve reading order and trace paths in the direction users
  should understand them.
- For generic SVGs, first identify what should move: path drawing, reveal masks,
  layer assembly, color transition, or transform choreography.
- Keep transparent output by default unless the user requests a full-frame
  background.

## Verification

- Compare the settled Lottie frame against the source SVG at matching scale.
- Check frame `0`, the main action frame, and the settled frame.
- Look for holes filling incorrectly, clipped strokes, gradient jumps, masked
  areas disappearing, and intersections rendering differently than the source.
