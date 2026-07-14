# Live Better Entrance (4a8z) — How It's Animated

`assets/live-better-4a8z.svg` is byte-identical to the earlier
`assets/live-better-k7ur.svg` (same "live better" script-lettering artwork,
`viewBox 0 0 575 374`). Rather than re-deriving the letter grouping, timing,
and reveal technique from scratch, `scripts/build-live-better-4a8z.mjs` reuses
`scripts/build-live-better-k7ur.mjs` verbatim — only the source/output paths
change (`live-better-4a8z` slug throughout).

See `docs/live-better-k7ur-animation.md` for the full writeup: the 20-path
letter identification (via full-canvas red-highlight-per-path rendering, no
ids on any path), the intersect-clip wipe reveal (one Merge Paths group per
source path, never combining a letter's main-stroke and tail path in one
group), the curve-sampled bbox fix for the wipe mask (vertex-only bboxes
undersize by ~8px on these sweeping cursive curves and leak slivers), and the
60fps / 5-frame-stagger / 9-frame-trace timing that writes the full phrase by
frame 59 (~1s) and holds to frame 100.

**Takeaway for future duplicate-asset tasks**: before re-deriving a hand-lettered
SVG's letter mapping, `diff` against prior `assets/*.svg` files with a similar
name — an identical source means the whole reveal plan (grouping, timing,
pitfall fixes) transfers directly, and only the slug needs updating.

## Verification

`node scripts/preview-scene.mjs live-better-4a8z scene-1 <frames>` — matched
`live-better-k7ur`'s output frame-for-frame at 0/3/15/30/45/59/99, and a 4x
zoom on frames 0 and 3 confirmed no pre-start ink slivers (the curve-bbox fix
carried over correctly).
