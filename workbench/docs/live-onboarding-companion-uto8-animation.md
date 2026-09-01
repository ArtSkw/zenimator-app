# live-onboarding-companion-uto8 — build notes

Same source artwork as ler6/qj19/svmt/szpq (byte-identical SVG diff confirmed
before writing anything). This run's brief, though, spells out a materially
different breathe mechanic than the most recently built script (szpq) — a
useful case study in "porting is not authoring" since the geometry being
identical made it tempting to reuse szpq's rig wholesale.

## What differed from szpq, and why it wasn't ported

- **szpq's shell breathe was a UNIFORM `sx===sy` scale swell**, justified
  there as "a sealed rigid helmet has no soft torso to morph." THIS brief
  spells out an explicit counter-phased squash instead (`sx = 100 +
  2.6*sin`, `sy = 100 - 2.5*sin`, exact numbers given) plus a *separate* real
  path-morph on the visible interior BODY (parametric bulge-from-top, area
  conserved ±2%, lagged a quarter cycle behind the shell squash), with the
  face/eyes riding the same field scaled to their own radius. Reusing szpq's
  script here would have shipped a defect this brief's own text closes —
  confirmed by re-reading motion-taste.md's Living-idles section fresh this
  session, which frames the uniform swell as the rejected case, not an
  accepted alternative for "no soft torso" scenes.
- Moon parallax `k` is pinned by THIS brief at exactly `-0.3 x` the mascot's
  own drift (not a freely-chosen value in generic motion-taste's 0.2-0.5
  range) — used verbatim.
- Idle clock lengths (mascot 140f/3 cycles, breathe 105f/4 cycles, blinks
  every 140f, IDLE=420, OP=510) match szpq because both briefs state the
  identical numbers, not because they were copied from the script.
- Tilt/drift amplitudes, occupant lag, trail float periods/amplitudes, blink
  phase and shine amplitudes were chosen fresh, distinct from every prior
  script, within the brief's stated ranges.
- Default bubble string is "To the moon…" (this brief's own text) rather
  than szpq's "One moment…" override — ships as a real `ty:5` text layer
  either way, never baked glyphs.

## The parametric body/face morph

Built one small deform field, `deformPoint([x,y], cx, topY, height, amt,
bulge, vertK)`, applied identically to the body's outer subpath and the
face's inner (hole) subpath — same function, different local bbox, which is
what "scaled to its own radius" means in practice: the bulge fraction is
already relative to each shape's own width/height, so passing the face's own
`cx/topY/height` scales the effect down automatically, no extra factor
needed.

`vertK` (the vertical compensation that keeps area conserved) was solved
numerically per-shape via bisection on the polygon's shoelace area at the
`amt=+1` extreme, rather than hand-tuned — printed in the build log:
body morph settled at ±0.04% area drift, face at ±0.07%, both comfortably
inside the brief's ±2% budget. Solving it in code means the number is
correct by construction rather than eyeballed, and re-verifiable on the next
edit for free.

Handles (`i`/`o`) were transformed by running the ABSOLUTE control point
(vertex + offset) through the same deform function and re-deriving the
relative offset from the result, rather than scaling the offset directly —
this keeps tangent direction consistent with the local field gradient
instead of just translating handles rigidly with their vertex.

## Bug caught this session: matte/matted paint order was inverted

First build had the occupant-face carve rendering as a bare thin outline
with no white fill and no visible eyes — a completely different symptom
than "face not visible," which made it non-obvious at first glance. Root
cause: the front-to-back paint-order array listed `occupant-face` (the
`tt:1` matted layer) BEFORE `body-mass__matte` (the `td:1` matte source),
separated by a null in between. Lottie/Skottie resolve a track matte purely
by array adjacency — the source must be the literal preceding array entry —
so the matte silently failed to apply and the face rendered essentially
unclipped-and-unfilled instead. Fixed by moving the matte source immediately
before the matted layer in the array. Promoted to `player-contract.md` as a
named failure mode (see "A track matte's source must be the literal
PRECEDING entry") since this is a general Skottie mechanic, not specific to
this scene — worth checking on every future matte pairing built from a
hand-assembled front-to-back list.

## Verification

- `node scripts/check-motion.mjs live-onboarding-companion-uto8` → exit 0.
  Contact pairs (frame/tag/cord/bead assembly, ring, shine) all measured
  0.00px slide. Breathe inheritance: ring and occupant-face both swell
  5.2% — confirms the occupant correctly inherits the shell's squash.
  Occupant drift axes: 0.0px horizontal × 3.3px vertical — single-axis,
  clears the ~3px floor. Both blinks close to 0% of eye height.
- `node scripts/check-loop-seam.mjs live-onboarding-companion-uto8` → exit
  0, frames 90/510 pixel-identical, and the loop is visibly moving from its
  first beat (not a frozen opening).
- `node scripts/check-parameters.mjs live-onboarding-companion-uto8` → exit
  0 (no gradient content in this scene, 0 parameters expected).
- Hand self-test: rendered the two breathe extremes on a shared clock
  occurrence away from any scheduled blink (frames 236/289) — the face
  patch and helmet outline visibly differ in shape between them, not just
  size (screenshot compared side by side). An earlier attempt at this same
  check picked a breathe extreme that coincided with a scheduled blink
  window and made the eyes look "swallowed" by the face — worth deliberately
  avoiding blink-phase frames when picking silhouette-comparison beats.
- Ground-truth cross-check: rendered the raw source SVG directly in headless
  Chromium (`chrome-mac-arm64/Google Chrome for Testing.app` under the
  cached Playwright install) to confirm the belly "ring-with-dots" hardware
  detail and the mostly-hidden bead-cord (occluded by the visor's own white
  shine-cap sweep, which paints last in the source document) are both
  faithful to the artwork's own layering — not a paint-order bug on this
  project's side.

## Follow-up: amplitude turned down, driver reshaped (feedback: morph read too strong)

Two independent softenings, both keeping the rig itself (90° lag, counter-
phased axes, carve, matte, contacts) untouched:

- **Amplitude ~40% down**: `mascot-breathe` sx/sy amps 2.6/2.5 → 1.5/1.45
  (still ~6pp of `sx − sy` swing, 6× `ANISO_MIN`); `BULGE` (the single
  constant driving both `body-mass`'s and `occupant-face`'s path morph)
  0.03 → 0.0169, which scales BOTH shapes' outline travel in lockstep
  without a separate factor — body-mass measured 1.81px max(vertex,handle)
  p2p (target ~1.8, was 3.19), occupant-face 1.20px (target ~1.2, was 2.12)
  — confirms "same field, scaled to its own bbox" keeps them proportional
  under a shared amplitude edit, not just at the original tuning.
- **Driver reshaped**: replaced the raw `sin2pi` calls feeding
  `shellBreatheDriver`/`bodyAmt` with a `shapedDrive` (raised cosine through
  a smoothstep, same `2π·t/period + phase` angle, same ±1 range) so the
  extremes hang instead of the body moving fastest at the exact midpoint. A
  pure sine's max/median-velocity ratio is a fixed ≈1.41 (√2); the shaped
  driver measured ≈2.83 on both the squash and morph tracks (computed
  directly from the driver math at 20-cycle/0.05f resolution, not sampled
  keyframes) — still comfortably under the Fluidity gate's 3× ceiling.
  Promoted to `motion-taste.md`'s Fluidity section as a named technique
  since "pure sine is gate-compliant but restless" applies to any baked
  cyclical driver, not just this scene.
- Re-verified: `check-motion.mjs` Silhouette line still reads `squash 5.9pp
  · 3 morphing path(s)` (target ~6pp / 3 paths); `check-loop-seam.mjs` and
  `check-parameters.mjs` both still exit 0 — the shaped driver is exactly
  periodic in the same phase/period, so the 90/510 boundary keys stayed
  pixel-identical with no extra seam work.
