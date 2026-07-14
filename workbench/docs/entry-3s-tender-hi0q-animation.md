# entry-3s-tender-hi0q — How It's Animated

`assets/entry-3s-tender-hi0q.svg` is byte-identical to `assets/entry-3s-tender-cvol.svg`
(verified with `diff`) — same phone-on-pillow illustration, same paint-order-encoded
ribbon route, same gradient. `scripts/build-entry-3s-tender-hi0q.mjs` is that project's
build script with only the slug swapped (`entry-3s-tender-cvol` → `entry-3s-tender-hi0q`
in the source path, output path, and `nm`); no other line differs.

**General lesson**: before re-deriving an SVG's structure (paint order, subpath
indices, matrix decomposition), `diff` it against sibling assets in `assets/` —
a duplicate source means the sibling's build script and its `docs/*-animation.md`
transfer directly, no re-analysis needed.

See `docs/entry-3s-tender-cvol-animation.md` for the full technique: how the
ribbon's front/behind crossings are read from paint order and split-strip
construction, the arbitrary-axis matte-wipe generalization, the one-rigid-body
breathing sway, the `matrix()` reflection+rotation decomposition, and the
named-color fill fix.

Verified headlessly with `scripts/preview-scene.mjs entry-3s-tender-hi0q scene-1
0,20,40,64,80,97,115,128,140,179` — renders identically to the cvol scene, ribbon
draws as one continuous gesture, accent pops in at frame ~128, settles exactly on
the source composition by frame 179.
