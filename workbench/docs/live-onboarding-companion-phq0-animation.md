# Live Onboarding Companion (Deck Chair) — phq0 pass

`assets/live-onboarding-companion-phq0.svg` is byte-identical to
`live-onboarding-companion-wg4l.svg` (and the rest of the family), and this
brief is the same deck-chair mascot scene (chair-as-furniture, tilt-axis
recline, drink lift with lagged straw/umbrella, one lens glint, "Almost time
to relax" bubble). Slug-swap rather than a re-derivation, sourced from
`scripts/build-live-onboarding-companion-wg4l.mjs` — the most recently
regenerated sibling at build time, itself carrying v1-v4 of the family's
fixes (living-idle clock system, `keyOnBoundaries`, `bubble.textPos`,
source-derived bubble/trail spacing, silhouette morphs, true-sine hammock
sway). See `docs/live-onboarding-companion-eh0n-animation.md` for the full
build rationale and `docs/live-onboarding-companion-wg4l-animation.md`'s v2-v4
sections for the ported fixes — everything there applies here unchanged.

## Verification (this pass)

- `node scripts/build-live-onboarding-companion-phq0.mjs` — 30 layers, valid
  JSON, 662 animated keyframes, `T=90`/`IDLE=180`/`OP=270`.
- Frame grid `[0,20,45,70,90,180,269]` — chair never moves, trail circles pop
  smallest-first, bubble pops with a lazy overshoot, text renders bold and
  centered in the plate.
- Zoomed `[15,45]` — the recline/drink idle and lens glint are already
  progressing at different points between the two frames while the bubble is
  still mid-pop — alive under the entrance, not frozen.
- Mid-idle `[120,220]` — bubble and trail circles are pixel-identical between
  the two frames (hold perfectly still) while the mascot's recline and drink
  lift keep animating underneath.
- Loop seam: a direct-seek throwaway script (`anim.seekFrame(90)` vs
  `anim.seekFrame(270)`, using the same `MakeManagedAnimation`/
  `canvaskit-wasm/full` init as `preview-scene.mjs`) diffed the full RGBA
  buffer — **0 differing bytes, max per-channel delta 0**.

No new capability landed this pass; this is a pure confirm-and-inherit copy.
