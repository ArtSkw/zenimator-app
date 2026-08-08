# Live Onboarding Companion (Deck Chair) — uj7l pass

`assets/live-onboarding-companion-uj7l.svg` is byte-identical to
`live-onboarding-companion-eh0n.svg` (and `-i0r3.svg`/`-z6ke.svg`), and this
brief is the same deck-chair mascot scene (chair-as-furniture, tilt-axis
recline, drink lift with lagged straw/umbrella, one lens glint, "Almost time
to relax" bubble). Rather than re-deriving the rig,
`scripts/build-live-onboarding-companion-uj7l.mjs` is
`scripts/build-live-onboarding-companion-eh0n.mjs` with only the project slug
swapped — same paths, same timing (`T=90`/`IDLE=180`/`OP=270`), same v4
"living idle" mechanisms (four shared clocks, derived chair-seat squash and
liquid slosh, tiled glint). `eh0n`'s script is the most evolved of the four
duplicate-brief passes (`i0r3`/`z6ke` were copied from an earlier, pre-v4
snapshot of `eh0n` and never got the living-idle/stage-safety backport), so
this pass copies `eh0n` directly rather than `z6ke`. See
`live-onboarding-companion-eh0n-animation.md` for the full build rationale
(steady-island chair, geometry-derived tilt axis, two-null lift-with-lag,
echo technique for idle-from-frame-0, the four-clock living-idle system, the
`anchor === position` text-fidelity trap, and the "don't diff `op-1`"
previewer gotcha) — everything there applies here unchanged.

## Verification (this pass)

- `node scripts/build-live-onboarding-companion-uj7l.mjs` — 30 layers, 276
  animated keyframes, valid JSON.
- Frame grid `[0,20,45,70,90,180,269]` — chair never moves, sunglasses shine
  slashes stay baked/static, drink cluster rides the paw, bubble/trail pop
  and settle, text renders bold and centered in the plate.
- Zoomed `[15,45]` mid-intro — the mascot's recline and lens glint are
  already progressing at different points between the two frames while the
  bubble/trail are still mid-pop — alive under the entrance, not frozen.
- Zoomed `[105,125,160,168,196]` (glint/sip window) — recline and drink
  height visibly differ across the window, consistent with the four
  independent clocks (`CLOCK_BREATHE`/`CLOCK_GLINT`/`CLOCK_SIP`/
  `CLOCK_DETAIL`) drifting in and out of phase rather than landing in lockstep.
- Loop seam: a direct-seek throwaway CanvasKit script (`anim.seekFrame(90)`
  vs `anim.seekFrame(270)`, bypassing the previewer's `op-1` display clamp
  per the eh0n doc's lesson) diffed the full RGBA buffer — **0 differing
  bytes** out of 230,400.

## Applying this to a future duplicate-brief pass

When a new project slug arrives with a source SVG byte-identical to a prior
scene and the brief matches, don't re-author from the recipe and don't
blindly copy the most recently-touched duplicate either — check which prior
build script is actually most evolved (grep for version markers like "v3"/
"v4" in the header comment, or diff candidates against each other) and copy
that one. Here `z6ke`/`i0r3` looked like the obvious template (more recent
slugs) but were actually frozen at a pre-living-idle snapshot; `eh0n` carried
every fix through v4. Copying the stale one would have silently regressed
this scene's idle density and stage-safety margins.
