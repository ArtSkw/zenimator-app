# Live Onboarding Companion (Deck Chair) — i0r3 pass

`assets/live-onboarding-companion-i0r3.svg` is byte-identical to
`live-onboarding-companion-eh0n.svg` and `live-onboarding-companion-z6ke.svg`,
and this brief is the same deck-chair mascot scene (chair-as-furniture,
tilt-axis recline, drink lift with lagged straw/umbrella, one lens glint,
"Almost time to relax" bubble). Rather than re-deriving the rig,
`scripts/build-live-onboarding-companion-i0r3.mjs` is
`scripts/build-live-onboarding-companion-z6ke.mjs` with only the project slug
swapped — same paths, same timing (`T=90`/`IDLE=180`/`OP=270`), same
mechanisms. See `live-onboarding-companion-eh0n-animation.md` for the full
build rationale (steady-island chair, geometry-derived tilt axis, two-null
lift-with-lag, echo technique for idle-from-frame-0, the
`anchor === position` text-fidelity trap, and the "don't diff `op-1`"
previewer gotcha) — everything there applies here unchanged.

## Verification (this pass)

- `node scripts/build-live-onboarding-companion-i0r3.mjs` — 30 layers, valid
  JSON.
- Frame grid `[0,20,45,70,90,180,269]` — chair never moves, drink cluster
  rides the paw, bubble/trail pop and settle, text renders bold and centered
  in the plate.
- Zoomed `[105,125,160,168,196]` (glint/sip window) and `[15,45]` mid-intro —
  the glint reads as a subtle sweep across the right lens around `f125`, and
  frames 15 vs 45 show the drink lift/recline already progressing at
  different points while the bubble/trail are still mid-pop — alive under
  the entrance, not frozen.
- Loop seam: a direct-seek throwaway CanvasKit script (`anim.seekFrame(90)`
  vs `anim.seekFrame(270)`, bypassing the previewer's `op-1` display clamp
  per the eh0n doc's lesson) diffed the full RGBA buffer — **0 differing
  bytes** out of 230,400.

## Applying this to a future duplicate-brief pass

When a new project slug arrives with a source SVG that's byte-identical (or
near-identical) to a prior scene and the brief matches, don't re-author from
the recipe — copy the prior scene's build script, rename the slug throughout
(output dir, file-header comments, source-SVG references), rerun, and
re-verify the loop seam directly. It's faster and it inherits every
already-fixed defect (text baseline, font weight, echo technique) for free.
