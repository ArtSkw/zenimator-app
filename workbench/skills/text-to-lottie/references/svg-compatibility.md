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

## Masks, Clips, Gradients, And Effects

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
