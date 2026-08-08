# Live Onboarding Companion (Double-Bicep Flex, pez7) — How It's Animated

`assets/live-onboarding-companion-pez7.svg` is **byte-identical** to
`assets/live-onboarding-companion-i8ek.svg` — same rig, same pose, same
"Making great progress" bubble brief. Rather than re-derive the rig from
scratch, this scene reuses `scripts/build-live-onboarding-companion-i8ek.mjs`
verbatim (mechanical slug substitution `i8ek` → `pez7` throughout: source SVG
path, output directory, internal comments) since that script already carries
multiple rounds of team-feedback fixes:

1. A motion-craft pass that gave the arms real elbow/wrist articulation
   (bicep bulge, fold, lagged fist) instead of rigid rig-only motion.
2. A phase-timing fix correcting which point in the squeeze envelope
   actually renders as peak contraction (the anticipation dip, not the
   numeric "hold" plateau).
3. A living-idles pass adding trail float and body breathe so the idle stays
   alive across the whole loop, not just during the pump's own accent window.

See `docs/live-onboarding-companion-i8ek-animation.md` for the full technique
writeup (squeeze/contraction envelope split, raster-pattern shadow fallback
with its two mask-space bugs, elbow/wrist rig, tremble retiming, trail/body
life). Nothing in this scene deviates from that writeup — this doc only
records the reuse-and-reverify pass.

## Verification (this scene)

- `node scripts/build-live-onboarding-companion-pez7.mjs` — 34 layers, 1286
  animated keyframes, `T=54`/`IDLE=144`/`OP=198`, matching i8ek's final
  (post-living-idles-pass) build exactly.
- Frame grid `[0,24,36,54,66,197]` rendered and read: trail circles pop
  smallest-first, bubble emerges with the punchy overshoot from the tail
  anchor, arms visibly differ in position/fist-scale across every loop-phase
  frame, raster shadow pattern tiles render correctly.
- Mid-intro `[24,36]` at zoom 3: fists/arm position clearly differ between
  the two frames while the bubble is still mid-pop — the idle is alive under
  the entrance, not frozen.
- Loop seam: direct `anim.seekFrame(54)` vs `anim.seekFrame(198)` (CanvasKit
  raw RGBA buffer, bypassing the previewer's clamp) — **36 differing samples
  out of 230400, max delta 5**, matching i8ek's own figure exactly (sub-pixel
  antialiasing on the rotated elbow/wrist edges, not a logical seam break).
  Sanity checks: frame 0 vs frame 54 — 15852/230400 differing, max delta 255;
  frame 70 vs frame 118 (a third of `IDLE` apart, both idle) — 8021/230400
  differing, max delta 255 — both confirm the diff tool discriminates and the
  body/trail stay visibly alive mid-loop, not frozen stickers.
- Text baseline zoomed at frame 54: ink reads centered in the plate, matching
  i8ek's calibrated `BASELINE_LOCAL`.
- Markers: `[{"cm":"intro","tm":0,"dr":54},{"cm":"loop","tm":54,"dr":144}]`.

No new learnings to promote — this pass only validated that a byte-identical
source SVG under a new project slug reproduces the same verified output.
