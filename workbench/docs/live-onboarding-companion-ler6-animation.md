# Live Onboarding Companion (Deck Chair) — ler6 pass

`assets/live-onboarding-companion-ler6.svg` is byte-identical to
`live-onboarding-companion-ire9.svg` (and the rest of this family — eh0n,
i0r3, mqmh, phq0, qon2, uj7l, wg4l, z6ke, zkti, 0qab), and this brief is the
same deck-chair mascot scene (chair-as-furniture, tilt-axis recline, drink
lift with lagged straw/umbrella, one lens glint, "Almost time to relax"
bubble). Per `live-onboarding-companion-ire9-animation.md`'s own "Applying
this to a future duplicate-brief pass" note, this was a slug-swap, not a
re-derivation: `scripts/build-live-onboarding-companion-ire9.mjs` (the most
recently regenerated sibling — v7, dated after every fix in that file's
changelog: living-idle clock system, `keyOnBoundaries`, `bubble.textPos`/
`bubble.anchor` slots, the smoothness/velocity-audit rewrite to
`waypointCurve`, and the per-layer `SHIFT_Y` headroom fix) was copied
wholesale with `ire9` → `ler6` renamed throughout, then rerun. See
`live-onboarding-companion-eh0n-animation.md` and `-ire9-animation.md` for
the full build rationale and v1–v7 changelog — everything there applies here
unchanged.

## Verification (this pass)

- `node scripts/build-live-onboarding-companion-ler6.mjs` — 30 layers, valid
  JSON, 1158 animated keyframes, `T=90`/`IDLE=180`/`op=270`.
- Frame grid `[0,20,45,70,90,180,269]` — trail circles pop smallest-first,
  bubble emerges with a lazy overshoot, chair legs never move, text renders
  bold and centered in the plate.
- Zoomed `[15,45]` (×3) — head tilt and lens glint position both visibly
  differ between the two mid-intro frames while the bubble/trail are still
  mid-pop — idle alive under the entrance, not frozen.
- Mid-idle `[120,188,220]` (×3) — bubble and trail circles hold pixel-still
  while the drink visibly lifts toward the face at `f188` (paw/glass closer
  to the mouth) and settles back by `f220` — sip accent reads correctly.
- Text weight/centering, zoomed ×5 at `f90`: Nunito Bold renders at the same
  stroke weight as the source's baked glyph outlines, centered in the plate
  with even top/bottom inset.
- Loop seam: direct-seek throwaway CanvasKit script (`anim.seekFrame(90)` vs
  `anim.seekFrame(270)`, same `MakeManagedAnimation`/`canvaskit-wasm/full`
  init as `preview-scene.mjs`) diffed the full RGBA buffer — **0 differing
  bytes, max delta 0**.

No new defects surfaced; the ire9 build's v1–v7 fixes (living idle, mood
retune, smoothness fix, velocity audit, content-proof bubble headroom) all
carried over intact through the slug-swap.
