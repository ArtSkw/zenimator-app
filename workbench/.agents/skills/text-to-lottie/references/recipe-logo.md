# Recipe: Logo Animation

Use for brand marks, wordmarks, logo reveals, intro/outro marks, app splash
marks, and SVG logo sources.

## User-Language Aliases

- "make my logo move", "logo reveal", "animate our mark", "app splash"
- "draw in this logo", "intro logo", "outro bug", "wordmark animation"

## Defaults

- Preserve brand shape, color, spacing, and final lockup unless asked to
  redesign.
- Default to transparent background.
- Build toward a clean lockup, settle, then hold. The held lockup is where the
  brand registers.
- Ask for brand constraints only when the source does not imply them or when the
  user asks for a specific style.
- Read `svg-compatibility.md` when the logo source is SVG.

## Presets

- `mark-draw`: trim-path or mask reveal for line/outline logos.
- `assemble-settle`: pieces enter from nearby offsets and settle into the mark.
- `premium-fade`: soft opacity/scale reveal with subtle final polish.
- `accent-sweep`: brand accent passes across the mark, then disappears.
- `wordmark-cascade`: letters or word groups reveal in restrained stagger.
- `splash-pop`: compact app/splash reveal with a short hold.
- `shape-vocabulary-build`: brand shapes assemble first; wordmark lands as the
  payoff.

## Timing And Easing

- Simple mark: 45-75 frames.
- Mark plus wordmark: 75-120 frames.
- Use low-overshoot premium settles unless the brand is explicitly playful.
- Keep final 10-20 frames stable enough for a clean logo lockup.

## Ask Only When Needed

- Ask for transparent vs full-frame if the intended use is unclear.
- Ask for brand adjectives only when the prompt gives no style direction.
- Ask whether to animate the full lockup or mark-only when both are present and
  the requested use is ambiguous.

## Construction Notes

- Separate mark, wordmark, and accent layers when possible.
- Keep final pose exactly aligned to the source logo.
- If the logo has distinctive modules, strokes, or brand shapes, animate those
  before revealing the wordmark. Do not show the full answer too early.
- Avoid distorting brand geometry through squash, bounce, rotation, or blur-like
  effects unless the user requests that personality.
- If a background is requested, expose `bgColor` and keep logo colors editable
  only when useful.

## Filled-Shape And Wordmark Reveals

- A filled glyph can't be drawn on with a trim path — Skottie closes the cut
  with a straight chord that slices a diagonal across the letterform. Reveal a
  fill by clipping instead: keep the glyph as its exact, already-filled final
  path and clip it to a growing region with a Merge Paths Intersect (`mm: 4`),
  so every frame is a true sub-region of the final art, never a wrong silhouette.
- Bake a rotating sweep. A straight-axis reveal region (a growing rectangle) can
  be a plain 2-keyframe tween, but a ROTATING wedge cannot — a 2-keyframe tween
  moves each arc vertex in a straight line, so the shape looks like it inflates
  from a point instead of sweeping. Sample the wedge geometry per frame and emit
  one keyframe per frame; at 60fps that reads as a true arc.
- Slant the wipe. A vertical leading edge reads as a flat guillotine cut; push
  the edge's top a couple of units ahead of its bottom for a dynamic diagonal —
  same intersect-clip, no extra risk.
- Slant-wipe margin: the region is inflated past the glyph's bbox by a `margin`
  so its rest states clear the geometry; for a slanted edge set
  `margin = slant + 1` px. If `margin < slant`, the leading corner leaves a
  sliver inside the glyph before it starts and the trailing corner leaves a
  permanent clipped strip after it ends (Lottie holds the last keyframe).
- Counters/holes block clipping: Merge Paths combines pairwise in list order, so
  `[outer, hole, reveal]` intersects the outer contour with the hole first and
  destroys the glyph. A letter whose fill needs an inner counter (two subpaths,
  one fill) can't be intersect-clipped — reveal it with an exact-shape opacity
  fade instead.

## Common Failure Modes

- Final frame does not match the source lockup.
- Wordmark letter spacing drifts during or after motion.
- Decorative effects overpower brand recognition.
- Wordmark appears before the build earns it.
- Transparent output accidentally includes background pixels.

## Acceptance Checks

- Final frame is a faithful logo lockup.
- Lockup holds long enough to read after the reveal.
- Transparent output contains no unintended background pixels.
- Motion feels brand-appropriate, not generic.
- SVG intersections, holes, masks, and strokes render correctly in Skottie.
