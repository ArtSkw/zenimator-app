# Live Onboarding Companion (Deck Chair) — z6ke pass

`assets/live-onboarding-companion-z6ke.svg` is byte-identical to
`live-onboarding-companion-eh0n.svg`, and this brief is the same deck-chair
mascot scene (chair-as-furniture, tilt-axis recline, drink lift with lagged
straw/umbrella, one lens glint, "Almost time to relax" bubble). Rather than
re-deriving the rig, `scripts/build-live-onboarding-companion-z6ke.mjs` is
`scripts/build-live-onboarding-companion-eh0n.mjs` with only the project slug
swapped — same paths, same timing (`T=90`/`IDLE=180`/`OP=270`), same
mechanisms. See `live-onboarding-companion-eh0n-animation.md` for the full
build rationale (steady-island chair, geometry-derived tilt axis, two-null
lift-with-lag, echo technique for idle-from-frame-0, the
`anchor === position` text-fidelity trap, and the "don't diff `op-1`"
previewer gotcha) — everything there applies here unchanged.

## Verification (this pass)

- `node scripts/build-live-onboarding-companion-z6ke.mjs` — 30 layers, valid
  JSON.
- Frame grid `[0,20,45,70,90,180,269]` and zoomed `[105,125,160,168,196]`,
  `[15,45]` — chair never moves, sunglasses shine/glint reads at `~f125`,
  drink lift + straw/umbrella lag visible mid-cycle, text renders bold and
  centered in the plate.
- Loop seam: a direct-seek script (`anim.seekFrame(90)` vs
  `anim.seekFrame(270)`, bypassing the previewer's `op-1` display clamp per
  the eh0n doc's lesson) diffed the full RGBA buffer — **0 differing bytes**.
- Frames 15 vs 45 confirm the idle (drink lift, recline) is already
  progressing at different points while the bubble/trail are still mid-pop —
  alive under the entrance, not frozen.

## Applying this to a future duplicate-brief pass

When a new project slug arrives with a source SVG that's byte-identical (or
near-identical) to a prior scene and the brief matches, don't re-author from
the recipe — copy the prior scene's build script, rename the slug throughout
(output dir, file-header comments, source-SVG references), rerun, and
re-verify the loop seam directly. It's faster and it inherits every
already-fixed defect (text baseline, font weight, echo technique) for free.
