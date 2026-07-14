# Gradient Verify Entrance — How It's Animated

`assets/gradient-verify.svg` is byte-identical to `assets/live-better-k7ur.svg`
(same "live better." script-lettering, `viewBox 0 0 575 374`, 20 filled paths,
14 of them `fill="url(#paintN...)"` per-path radial gradients, the rest flat
`#22E243`). This scene, `public/projects/gradient-verify/scene-1/lottie.json`
(built by `scripts/build-gradient-verify.mjs`), exists specifically to verify
the skill's gradient-preservation requirement in practice: the sibling
`live-better-k7ur` scene flattened every path to one solid ink color; this one
carries every source gradient through unchanged.

Letter identification (which path is which glyph) is the proven mapping from
`docs/live-better-k7ur-animation.md` — same source file, no need to re-derive
it. The only functional change is the fill: each path's own SVG fill (flat or
gradient) becomes its own Lottie fill, instead of every path sharing one
slotted flat color.

## Converting SVG `radialGradient` + `gradientTransform` to Lottie `gf`

Every gradient in this SVG has the same shape: base unit circle
(`cx="0" cy="0" r="1"`, `gradientUnits="userSpaceOnUse"`) plus a
`gradientTransform="translate(tx ty) rotate(angle) scale(sx sy)"`. That
composes to a plain center + radius, which maps directly onto Lottie's radial
`gf` `s` (center) / `e` (edge point defining radius + axis angle):

```js
s = [tx, ty]
e = [tx + sx * cos(angle_rad), ty + sx * sin(angle_rad)]
```

(`e` only needs `sx`, not `sy` — Lottie's radial gradient has no independent
x/y radius, only a highlight `h`/`a` for off-center falloff, unused here since
every stop is a symmetric ramp.) With `angle` near zero this reduces to
`e = [tx + sx, ty]`, but computing it from the real rotation costs nothing and
stays correct if a future source SVG has a real rotation.

Stops carry over as color quadruples followed by alpha pairs in `g.k`:

```js
g: { p: stops.length, k: { a: 0, k: [...colorStops, ...alphaStops] } }
// colorStops: [offset, r, g, b, offset, r, g, b, ...]  (0-1 range)
// alphaStops: [offset, alpha, offset, alpha, ...]
```

A detail worth naming: every gradient in this SVG is a pure **alpha ramp**
(same `#22E243` at every stop, opacity climbing 0.5 → ~0.77 → 1 from center to
edge) — there's no hue/lightness shift, just a soft falloff. That's exactly
the kind of "subtle highlight" the skill's gradient-preservation rule calls
out by name as *not* a valid reason to flatten: a flat fill at 100% opacity
looks visibly flatter/harder than the source's soft center-to-edge fade,
confirmed side by side against the sibling scene's flattened render.

One gradient (`paint12`, on the tiny period after "better") has its center
~90px away from the dot it fills, with a radius smaller than that distance —
so within the dot's few-pixel extent the gradient is already past its last
stop and renders as flat full-opacity color. That's not a bug; it's the
source reusing/positioning a gradient definition such that one particular
path only ever samples its tail. Parsing and computing the math generically
reproduces this automatically — no per-path special-casing needed.

## Reveal technique (unchanged from the sibling scene)

Intersect-clip (`mm: 4`) each glyph path against its own copy of a growing
rectangle, one group per source path — never a trim/stroke standing in for
the fill, and never two paths sharing one intersect stack. This still works
unmodified with a `gf` fill in the group instead of a shared `fl`: the fill
item just needs to come after the merge in the group's `it` list, same as
before. The gradient's `s`/`e` points are in the same local path coordinate
space as the shape's own vertices (both pre-transform), so a wipe or a pop's
anchor-centered scale carries the gradient along correctly without any extra
math — confirmed visually, no offset/detachment between the reveal and the
gradient at any frame.

## Timing

Identical to the sibling scene: 60fps, 11 wipe letter-units on a brisk
5-frame stagger with 9-frame traces, phrase fully written by frame 59 (~1s),
dots/periods pop instead of wiping, hold to frame 100 on the exact source
composition.

## Verification

`node scripts/preview-scene.mjs gradient-verify scene-1 <frames>`. Scrubbed
0/5/.../60/80/99 plus zoomed 0/3/7/12/18/25 to check for the vertex-vs-curve
bbox sliver bug the sibling scene's doc found (none present — `curveBbox`
carried over unchanged). Zoomed the final frame at 3x and visually confirmed
soft light-to-dark tapering in every stroke tail (the `l`, `b`, `t`-crossbar,
and `r` tails read noticeably softer than the sibling scene's flat render at
the same zoom) — the gradient preservation is not just present in the JSON
but visibly different in the render, which is the actual bar the skill's
rubric sets ("if the source has a gradient and your render is flat, you have
regressed the artwork").
