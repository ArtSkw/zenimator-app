# Live Onboarding Companion (Deck Chair) — qon2 pass

`assets/live-onboarding-companion-qon2.svg` is byte-identical to
`live-onboarding-companion-wg4l.svg` (and the rest of this family), and the
brief is the same deck-chair mascot scene (chair-as-furniture, tilt-axis
recline, drink lift with lagged straw/umbrella, one lens glint, "Almost time
to relax" bubble). Per `live-onboarding-companion-wg4l-animation.md`'s own
guidance for this exact situation, this was a slug-swap rather than a
re-derivation: copied `scripts/build-live-onboarding-companion-wg4l.mjs` (the
most recently regenerated sibling — v5 port, `waypointCurve`-driven drink
gesture / breathe-envelope / trail-float, sine-based sway, silhouette morph,
source-true bubble spacing) and renamed the slug throughout. See
`live-onboarding-companion-eh0n-animation.md` for the full build rationale —
everything there and in the wg4l doc's v2-v5 port notes applies here
unchanged.

## Verification (this pass)

- `node scripts/build-live-onboarding-companion-qon2.mjs` — 30 layers, valid
  JSON, 270f @ 60fps (intro 90f / loop 180f), `T=90`/`op=270`.
- Frame grid `[0,20,45,70,90,180,269]` — chair and legs never move, trail
  circles pop smallest-first, bubble emerges with a lazy overshoot, text
  renders bold and centered in the plate, holds identically at 90/180/269.
- Zoomed `[15,45]` — sunglass-lens glint and body silhouette already differ
  between the two frames while the bubble/trail are still mid-pop — the idle
  is alive under the entrance, not frozen.
- Zoomed `[120,220]` — bubble and trail circles are pixel-identical between
  the two mid-idle frames (hold perfectly still) while the mascot's recline
  and glint keep animating underneath.
- Loop seam: a throwaway CanvasKit script mirroring `preview-scene.mjs`'s own
  render path exactly (`ck.MakeManagedAnimation(LOTTIE, assets)` +
  `anim.seekFrame(f)`, not a manual `seek(t/duration)` with a separate
  FontMgr — the latter produced a false-positive 54537-byte diff before this
  fix) diffed the full RGBA buffer at `seekFrame(90)` vs `seekFrame(270)`:
  **0 differing bytes, max delta 0**.
- `controls.json` shape unchanged from wg4l: `bubble.size` autoFit
  `max:[208,73]`, `bubble.textPos` still `internal:true`, three bespoke
  `layerControls` (hammock sway, sip lift, bubble pop).

## Note for a future duplicate-brief pass in this family

When pixel-diffing a loop seam with a standalone script instead of
`preview-scene.mjs`'s frame grid, mirror its render path exactly —
`MakeManagedAnimation(lottieJson, assetsDict)` then `anim.seekFrame(frame)`.
A hand-rolled variant using `anim.seek(frame/fps/duration)` plus a separate
`CanvasKit.FontMgr.FromData(...)` instead of the assets dict is NOT
equivalent and produced a large false-positive diff here — wasted a debug
cycle before switching to the project's standard method.
