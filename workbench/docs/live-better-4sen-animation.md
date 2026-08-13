# live-better-4sen — How It's Animated

`assets/live-better-4sen.svg` is byte-identical to the already-shipped
`assets/live-better-nqa3.svg` / `live-better-t2vl.svg` (same 20 brush-stroke
paths, same per-path radial gradients, same 575×374 canvas) — confirmed with
`diff` before any rebuild work. The path→letter mapping (which of the 20
source paths belongs to which letter) is geometry, carried forward unchanged
from `build-live-better-nqa3.mjs` — see `docs/live-better-nqa3-animation.md`
for how that grouping was originally reverse-engineered by isolation-render.
This run's brief supplied its own paint-id→role map directly (`paint0`
through `paint13` in strict numeric order matches the SVG's own doc order of
gradient-filled paths), which confirmed the nqa3 mapping independently rather
than requiring a fresh isolation-render pass.

**What's different from nqa3/t2vl is the rig, not the geometry.** Those two
scenes used one house recipe: 13 writing units, each a matte-wipe, staggered
uniformly at 62% overlap, ~1s total write. This brief stages five explicit,
timed beats instead — and the two differ in a way that matters structurally:

- **The i-dot, the period after "live", and the tail-tip dot after "better"
  are pulled OUT of their letter's sweep into their own layers**, each a
  scale-pop (0→115%→100%, no matte, no travel) timed to a beat-2/beat-4
  window the brief states in seconds, not derived from stroke width. In
  nqa3/t2vl these dots were still separate units but used the *same*
  matte-wipe technique as every letter, staggered into the same uniform
  cadence — reasonable when the brief doesn't say otherwise, wrong here
  because THIS brief explicitly describes them as "pen-lifts... not
  decorative satellites" that pop "with no travel, the way a pen taps down
  and lifts," landing on a stated timeline that runs concurrently with, not
  sequentially after, the letters around them (i-dot pops while the sweep
  that draws "e" is still finishing; the final dot pops "as [the crossbar]
  lands"). Read literally, the correct primitive for these three marks isn't
  a directional reveal at all — it's an entrance pop with its own anchor
  pinned to the mark's own absolute-coordinate bbox center (gate 18: anchor
  = own center for absolute geometry, never `[0,0]`+position, which would
  paint a 10px dot at the canvas corner).
- **Beat timing is read off the brief's own seconds, not computed from a
  house overlap constant.** `packBeat()` still uses width-informed relative
  durations per unit (so a wide stroke doesn't get the same frame count as a
  narrow one) but then rescales the whole batch to land exactly on the
  brief's stated beat window (`[0,48]` for beat 1's 0.0–0.8s, `[54,108]` for
  beat 3's 0.9–1.8s) — deriving pacing from geometry within a beat, but the
  beat boundaries themselves come from the brief, not from an accumulated
  stagger constant. The crossbar (one path, one beat, no packing needed) is
  hardcoded to its own stated window (100–120f, ~1.7–2.0s).
- **The crossbar is timed to *overlap* the letters' landing, not follow it.**
  It starts at 100f while "better"'s "r" (the last letter of beat 3) is still
  finishing its own sweep at 108f — this is the brief's own stated overlap
  ("beat 4 ~1.7–2.1s, overlapping beat 3's landing"), not a bug. Two
  concurrently-animating tracks reading as one continuous performance is the
  point of the "unbroken pass" language throughout this brief.

## Verification

`node scripts/check-motion.mjs live-better-4sen` — 7 contact pairs (each
letter unit touching its stagger-adjacent neighbor in writing order), all
0.00px slide, no invented colour. Rendered frame 0 (empty canvas — matches
the brief's opening beat literally), the i-dot/period pop window (42–60f,
zoomed ×4 — dot lands as a clean tap, no matte-fade artifact since it's a
scale-pop not a wipe), the crossbar sweep (100–120f — reads left-to-right
across both t-stems, matching the source ductus), the final-dot pop (118–
130f, zoomed ×5 — pops fully saturated with no pale-center bleed-through,
confirming the "this dot does not fade in pale" fidelity requirement), and
the settled final frame (149f) against the source SVG's own lockup — pixel
match on shape, gradients, and evenodd fills, nothing drifted past its
authored position.
