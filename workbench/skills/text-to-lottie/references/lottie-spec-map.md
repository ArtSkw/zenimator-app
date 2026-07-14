# Lottie Spec Map

Use this reference when authoring or debugging Lottie JSON structure. It is a
curated map of the upstream spec for this project, not a replacement for it.

Upstream specs:

- https://github.com/lottie/lottie-spec/tree/main/docs/specs

## Core Structure

- Top-level documents should include `v`, `fr`, `ip`, `op`, `w`, `h`, `nm`,
  `assets`, and `layers`.
- `ip` is inclusive and `op` is exclusive. `ip: 0`, `op: 90`, `fr: 60` renders
  frames `0..89`.
- Prefer a meaningful top-level `nm`; the player shows it as the canvas label.
- Keep assets local to the scene folder and reference images by bare filename in
  `assets[].p`.

## Properties And Keyframes

- Static properties use `{ "a": 0, "k": value }`.
- Animated properties use `{ "a": 1, "k": [keyframes] }`.
- Keyframes must be sorted by strictly ascending `t`. A descending or
  out-of-order `t` does not error — it silently freezes that property (see
  Renderer gotchas).
- Non-hold interpolation should put `o` on the start keyframe and `i` on the
  destination keyframe; the final keyframe does not need an outgoing `o`.
- Scalar animated values use arrays in keyframes, for example `"s": [45]` for
  rotation or opacity.
- Color values are RGB or RGBA floats in `0..1`; opacity values are `0..100`.
- Easing handle `x` values are `0..1`; `y` values may exceed that range for
  controlled overshoot.
- A cubic-bezier `(x1,y1,x2,y2)` splits across two keyframes: it is the
  **outgoing** handle of the start keyframe `o:{x:[x1],y:[y1]}` and the
  **incoming** handle of the end keyframe `i:{x:[x2],y:[y2]}`.
- Overshoot: prefer a short settle-back keyframe past the target; the compact
  alternative is pushing the end `i.y` above 1. Anticipation: push the start
  `o.y` below 0.

## Layers

- Shape layers use `ty: 4`.
- Image layers reference entries in `assets`.
- Layer visibility is `ip <= frame < op`.
- Parent transforms compose through `parent` references. Avoid cycles.
- Mattes, masks, precomps, and time remap are valid but more fragile; reach for
  them only when simpler shape/layer structure will not produce the result.
  Track-matte mechanics, precisely:
  - `td: 1` marks a layer as a matte **source** — it supplies alpha (or luma)
    only and renders no visible content of its own.
  - `tt: 1` makes a layer use the layer **immediately above it in the array**
    as its matte. Adjacency is what pairs them — not any id or name — so the
    matte (`td: 1`) must sit directly before its matted layer in the
    front-to-back `layers` array, with nothing between them.
  - A matte clips only the **single** layer directly below it. To matte several
    layers at once, precompose them into one asset and matte that precomp layer
    once, rather than copying the matte above each layer.

## Shapes

- Group related shapes with `ty: "gr"` and put the group transform
  `ty: "tr"` last in the group's `it` array.
- Styles apply to shapes that precede them within the current scope. A shape
  without an applicable fill or stroke will not render.
- Shapes render in reverse stack order inside groups. Verify visually when layer
  order matters.
- Common primitive types:
  - rectangle: `ty: "rc"`
  - ellipse: `ty: "el"`
  - path: `ty: "sh"`
  - polystar: `ty: "sr"`
  - fill: `ty: "fl"`
  - stroke: `ty: "st"`
  - trim path: `ty: "tm"`
  - group transform: `ty: "tr"`

## Slots

- Define reusable values in top-level `slots`.
- Reference a slot with `sid` on a compatible property.
- Slot type is inferred from the slot value. Keep slot values compatible with
  every property that references that `sid`.
- If a property has a missing `sid`, renderers may fall back to the inline value
  or a type default. Do not rely on missing slots.

## Asset And Renderer Notes

- Image asset dimensions should match the expected `w` and `h` bounds when
  possible.
- SVG, masks, gradients, blend modes, and intersections can differ between
  renderers. Verify in Skottie.
- Avoid expressions or renderer-specific extensions unless the player explicitly
  supports them.

## Renderer gotchas (confirmed)

Failure modes reproduced and isolated in this Skottie/CanvasKit build — known
traps, each with the fix that avoids it.

- **Animated gradients render nothing — but STATIC gradients render fine.** A
  gradient fill or stroke (`gf`/`gs`) whose stops — or `s`/`e` start/end points —
  are keyframed silently draws *nothing at all*, with no error. Only *animation
  of the gradient itself* fails; a static gradient renders correctly. So keep the
  gradient static and animate a trim (`tm`) or a mask/matte *over* it.
  - **Preserve the source's gradient paint — this is a REQUIREMENT, not a
    judgment call.** If the artwork ships per-path gradient fills (tapers, sheens,
    highlights), the output MUST keep them: source-paint fidelity is part of the
    deliverable. When the animation is a *reveal* or *transform* (draw-on, wipe,
    move, scale, rotate — none of which touch the fill), carry each path's
    gradient through **unchanged** and reveal/transform *over* it. **Do NOT
    flatten to a solid color.** "The gradient is subtle / just a highlight" and
    "there are N gradients, that's more work" are **NOT** acceptable reasons to
    flatten — port every one; the work is the job. The *only* time flattening is
    allowed is when the brief requires animating the gradient's own stops (which
    doesn't render — rare); otherwise a flattened result that shipped with
    gradients in the source is a defect. Verify against the source: if the source
    has a gradient and your render is flat, you have regressed the artwork.
- **Descending or out-of-order keyframe `t` silently freezes the property.** No
  error is raised; the property (and any sibling built the same way) simply
  stops animating. Assert `t` is strictly monotonic before trusting a track. In
  generated staggers/round-robins, a cycle whose `start + span` overruns the
  loop can emit a keyframe *after* the loop-closing one — **drop any such cycle
  entirely** before appending the closing keyframe; do not clip it.
- **The anchor + animated-position "freeze."** A non-zero anchor combined with
  animated `position` has been seen to freeze a layer at its rest value in this
  build. But a blank frame is *often a stale-tooling artifact* — before
  concluding a layer has stalled, restart the dev server and re-render
  deterministically. Either way, prefer the safe pattern to relying on the
  combo:
  - Animate `position` only on a **zero-anchor** layer.
  - Put any **pivoted** scale/rotation on a **separate static-position null**
    (anchor at the pivot, `p` fixed), or bake the pivot into the shape's own
    vertices around its rest center.
  - When one element must **both** translate *and* pivot-scale/rotate, split it
    across two chained nulls: the parent animates `position` (zero anchor); its
    child animates the pivoted scale/rotation (non-zero anchor, static `p`).
- **Verify with a deterministic CanvasKit-in-Node render, not headless-browser
  screenshots.** A cold headless browser can screenshot the same frame blank on
  one run and correct on the next (GPU/timing race), sending you chasing a
  rendering bug that isn't there. Seek and render each frame through
  `canvaskit-wasm` in Node for reproducible pixels; a stuck/blank frame is
  trustworthy there, but in a browser path may be only a tooling artifact.
