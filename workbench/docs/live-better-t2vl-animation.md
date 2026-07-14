# live-better-t2vl — How It's Animated

`assets/live-better-t2vl.svg` is byte-identical to the already-shipped
`assets/live-better-nqa3.svg` (same 20 brush-stroke paths, same per-path radial
gradients, same 575×374 canvas) — confirmed with `diff` before doing any
rebuild work. Rather than re-derive letter groupings from scratch, this scene
reuses the verified writing-unit mapping and matte-wipe write-on from
`scripts/build-live-better-nqa3.mjs` (documented in
`docs/live-better-nqa3-animation.md`) via `scripts/build-live-better-t2vl.mjs`,
which is that script with only the slug swapped (`nqa3` → `t2vl` in file
paths and the composition `nm`) — same 13 writing units (`l, i, v, e,
period1, b, e2, t1, t2, tt-cross, e3, r, period2`), same 62%-overlap stagger,
same 98-frame (1.63s) timeline with a 45f hold.

Verified by rendering the settled final frame (`op-1`) of both scenes
side-by-side with `scripts/preview-scene.mjs --zoom 2` — pixel-identical
output, including the diagonal underline-swash sheen from the source
gradients (a real design feature of this wordmark, not a matte artifact —
already confirmed in the nqa3 doc). No new technique to record here; this
file exists mainly to point back to the nqa3 doc for anyone who finds this
project slug first.
