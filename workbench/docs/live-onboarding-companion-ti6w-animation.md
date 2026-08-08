# Live Onboarding Companion (Double-Bicep Flex, ti6w) — How It's Animated

`assets/live-onboarding-companion-ti6w.svg` is **byte-identical** to
`assets/live-onboarding-companion-i8ek.svg` — same rig, same pose, same
"Making great progress" bubble brief. Rather than re-derive the rig from
scratch, this scene reuses `scripts/build-live-onboarding-companion-i8ek.mjs`
verbatim (mechanical slug substitution `i8ek` → `ti6w` throughout: source SVG
path, output directory, internal comments) since that script already carries
two rounds of team-feedback fixes:

1. A motion-craft pass that gave the arms real elbow/wrist articulation
   (bicep bulge, fold, lagged fist) instead of rigid rig-only motion.
2. A phase-timing fix correcting which point in the squeeze envelope
   actually renders as peak contraction (the anticipation dip, not the
   numeric "hold" plateau — see that scene's own doc for the full
   measurement).

See `docs/live-onboarding-companion-i8ek-animation.md` for the full technique
writeup (squeeze/contraction envelope split, raster-pattern shadow fallback
with its two mask-space bugs, elbow/wrist rig, tremble retiming). Nothing in
this scene deviates from that writeup — this doc only records the
reuse-and-reverify pass.

## Verification (this scene)

- `node scripts/build-live-onboarding-companion-ti6w.mjs` — 34 layers, 1138
  animated keyframes, `T=54`/`IDLE=144`/`OP=198`. (Layer/keyframe counts
  differ slightly from i8ek's own log line due to that scene's later
  iteration history: this build is the final, already-fixed script.)
- Frame grid `[0,24,36,54,66,197]` rendered and read: trail circles pop
  smallest-first, bubble emerges with the punchy overshoot from the tail
  anchor, arms visibly differ in position/fist-scale across every
  loop-phase frame.
- Mid-intro `[24,36]` at zoom 3: fists/arm position clearly differ between
  the two frames while the bubble is still mid-pop — the idle is alive
  under the entrance, not frozen.
- Loop seam: direct `anim.seekFrame(54)` vs `anim.seekFrame(198)`
  (CanvasKit raw RGBA buffer, bypassing the previewer's clamp) — **36
  differing samples out of 230400, max delta 5**, matching i8ek's own figure
  exactly (sub-pixel antialiasing on the rotated elbow/wrist edges, not a
  logical seam break). Sanity check (frame 0 vs frame 54): 13936/230400
  differing, max delta 255 — confirms the diff tool discriminates.
- Markers: `[{"cm":"intro","tm":0,"dr":54},{"cm":"loop","tm":54,"dr":144}]`.

No new learnings to promote — this pass only validated that a byte-identical
source SVG under a new project slug reproduces the same verified output.
