# Live Onboarding Companion (Double-Bicep Flex) — 8or8 pass

`assets/live-onboarding-companion-8or8.svg` is byte-identical to
`live-onboarding-companion-i8ek.svg`, and this brief is the same bodybuilder
mascot scene ("the pump": both arms squeeze up and inward into a deeper flex,
brief isometric quiver at the peak, chest puffs counter-phase, fists tighten
fractionally, happy-arc eyes deepen in sync, shadow widens slightly as the
body settles; "Making great progress" bubble with a punchier overshoot).
Slug-swap rather than a re-derivation, sourced directly from
`scripts/build-live-onboarding-companion-i8ek.mjs` — the squeeze envelope is a
pure function of `t % IDLE` (no echo/tileForward bookkeeping needed, alive
from frame 0 by construction), the raster shadow pattern is decoded to a real
image asset and tiled/masked per `svg-compatibility.md`'s pattern fallback,
and the bubble/text/trail follow `recipe-companion-bubble.md` unchanged
(`bubble.text`/`bubble.size`/`bubble.textPos`/`bubble.anchor` slots, Nunito
Bold text layer, autoFit controls).

## Verification (this pass)

- `node scripts/build-live-onboarding-companion-8or8.mjs` — 30 layers, valid
  JSON, 738 animated keyframes, `T=54`/`IDLE=144`/`OP=198`.
- Frame grid `[0,10,20,30,44,54,60,78,100,132,150,197]` — trail circles pop
  smallest-first, bubble pops with a punchy overshoot, text renders bold and
  centered in the plate, arms/fists/eyes/shadow already differ between frames
  inside the loop segment.
- Zoomed `f44` — ink insets on "Making great progress" read even top/bottom,
  fist and muscle-highlight strokes render crisp, happy-arc eyes closed and
  symmetric.
- Idle beats `[54,68,114,186]` — visible squeeze at frame 114 (arms pulled up
  and inward, eyes deepened, chest pulled in) vs. the rest pose at 54/68/186;
  bubble and trail hold static across all four.
- Loop seam: a direct-seek throwaway script (`anim.seekFrame(54)` vs
  `anim.seekFrame(198)`, using the same `MakeManagedAnimation`/
  `canvaskit-wasm/full` init as `preview-scene.mjs`) diffed the full RGBA
  buffer — **0 differing pixels out of 57,600, max per-channel delta 0**.

No new capability landed this pass; this is a pure confirm-and-inherit copy.
