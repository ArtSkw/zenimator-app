# Live Better Entrance (59ov) — Duplicate of k7ur

`assets/live-better-59ov.svg` is byte-identical to `assets/live-better-k7ur.svg`
(confirmed with `diff`, zero output). `scripts/build-live-better-59ov.mjs` is
`scripts/build-live-better-k7ur.mjs` with only the project slug substituted —
same 20-path letter grouping, same intersect-clip wipe reveal, same
curve-sampled mask bbox, same 60fps/5f-stagger/9f-trace timing. See
`docs/live-better-k7ur-animation.md` for the full rationale (path→letter
mapping, the vertex-vs-curve bbox sliver bug and its fix, why intersect needs
one group per source path).

Verified at `public/projects/live-better-59ov/scene-1/lottie.json`: frame grid
0–99 reads as a clean continuous handwritten draw-on, phrase fully written by
frame 59 (~1s @ 60fps), holds on the exact source composition to frame 99. 3x
zoom on frames 0 and 3 confirmed no reveal-mask slivers.
