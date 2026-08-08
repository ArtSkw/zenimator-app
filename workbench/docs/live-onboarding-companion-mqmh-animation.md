# Live Onboarding Companion (Deck Chair) — mqmh pass

`assets/live-onboarding-companion-mqmh.svg` is byte-identical to
`live-onboarding-companion-eh0n.svg` (and `-i0r3.svg`/`-uj7l.svg`/`-z6ke.svg`/
`-zkti.svg`), and this brief is the same deck-chair mascot scene
(chair-as-furniture, tilt-axis recline, drink lift with lagged straw/umbrella,
one lens glint, "Almost time to relax" bubble).

## v3 — ported wholesale from live-onboarding-companion-ire9 (mood retune)

`ire9` pulled ahead after a "calm relax archetype" mood retune (body y
pinned, breathe moved entirely into the silhouette morph, primary motion is
now a slow hammock rotation-only sway, sip stays the loop's one accent) —
ported wholesale (`cp` + slug/path swap, `controls.json` shape unchanged
except the retuned `head-rig` layerControl label) since the source SVGs are
pixel-identical; verified: seam `T=90` vs `op=270` is now **0 differing
bytes** (byte-exact), the sway/breathe extreme-beat pairs differ visibly
(11868 and 12614 RGBA bytes respectively, not rasterizer noise), and the
plate-to-trail-large gap still measures exactly 9px (source-true, unaffected
by the retune).

## v4 — ported wholesale from live-onboarding-companion-ire9 (smoothness fix)

`ire9` pulled further ahead with the smoothness fix (sway is now a true
`-Math.sin` instead of a `travelBalanced`-eased 4-point track, which had a
provable mid-segment infinite-velocity singularity per motion-taste's new
Easing Anchors note; dense sampling dropped 6f→2f) — ported wholesale again;
verified: seam `T=90` vs `op=270` — **0 differing bytes**; the authored
`swayEnvelope` scanned at 1-frame resolution between apexes 45→135 shows
deltas swelling smoothly from 0.0012° to 0.0698° and back, monotonic on both
halves with zero spikes or reversals; plate-to-trail-large gap still exactly
9px.

## v5 — ported wholesale from live-onboarding-companion-ire9 (velocity audit)

`ire9` pulled ahead again after the velocity audit (the whole drink gesture
— glass lift, shared drag, umbrella rock, liquid slosh, straw bow — rebuilt
around `waypointCurve`'s true-stop smootherstep chain, replacing sparse
`travel-balanced` pose-to-pose keys) — ported wholesale once more; verified:
all 11 hero tracks (drink-rig.p, trailing-rig.r, umbrella.r/total,
drink-fill.r, head-rig.r, both trail floats, straw bow, both silhouette
morphs) audited at 1-frame resolution from the shipped JSON sit at
1.3x-2.2x, matching ire9's own reference table; seam `T=90` vs `op=270` —
**0 differing bytes**; plate-to-trail-large gap still exactly 9px.

## Re-port: catching up to the current companion contract

The first mqmh pass copied `scripts/build-live-onboarding-companion-zkti.mjs`
— itself a slug-swap of an EARLIER `eh0n` snapshot, built under a stale
engine prompt that predates this project's current companion contract. Since
then `eh0n` was rebuilt in place to the full contract: a four-clock living
idle (breathe/detail/glint/sip, dense-sampled and boundary-keyed rather than
placed humps), Nunito-Bold 15/19 text with measured baseline centering
(`bubble.textPos` slot — text-doc `ls` is silently ignored by Skottie),
`bubble.size` autoFit with a required stage-safe `max`, and a loop seam
verified by a direct-seek RGBA pixel diff rather than the previewer's clamped
grid output. The old zkti-derived mqmh script had none of this — it was
correct for the contract it was written under, but that contract had moved
on.

Rather than hand-porting each mechanism, `scripts/build-live-onboarding-
companion-mqmh.mjs` is now `scripts/build-live-onboarding-companion-eh0n.mjs`
copied wholesale with only the slug/output path swapped (file header comment
+ `OUT_DIR`) — same paths, same timing (`T=90`/`IDLE=180`/`OP=270`), every v4
living-idle mechanism inherited unchanged. See
`live-onboarding-companion-eh0n-animation.md` for the full build rationale
(steady-island chair, geometry-derived tilt axis, two-null lift-with-lag,
echo technique for idle-from-frame-0, the four-clock living-idle system, the
`anchor === position` text-fidelity trap, and the "don't diff `op-1`"
previewer gotcha) — everything there applies here unchanged.

## Verification (this pass)

- `node scripts/build-live-onboarding-companion-mqmh.mjs` — 30 layers, 302
  animated keyframes, valid JSON; `Nunito.ttf` + `Nunito-Bold.ttf` copied into
  the scene dir; `controls.json` written with the eh0n shape (`bubble.text`,
  `bubble.size` autoFit `{padding:[16,8], min:[90,35], max:[208,73]}`,
  `bubble.textPos` `internal:true`, plus `head-rig`/`drink-rig`/
  `bubble-anchor` layerControls).
- Frame grid `[0,20,45,70,90,180,269]` — trail circles pop smallest-first,
  bubble mid-pop by `f70`, fully settled and static from `f90` through `f269`,
  plate recentered on the true stage-center (x=120).
- Mid-intro pair `[15,45]` zoomed 3x — head recline pose, lens glint position,
  and drink lift all visibly differ between the two frames while the bubble
  is still mid-pop: the idle is alive under the entrance, not frozen.
- Loop seam: a direct-seek throwaway script (`anim.seekFrame(90)` vs
  `anim.seekFrame(270)`, bypassing the previewer's `op-1` display clamp per
  the eh0n doc's lesson) diffed the full RGBA buffer — **0 differing bytes,
  max delta 0**.
- Text weight/centering, zoomed 5x at `f90`: Nunito Bold renders at the same
  stroke weight as the source's baked glyph outlines (not the thinner
  Regular weight), and sits centered in the plate with even top/bottom inset
  — the measured `bubble.textPos` calibration from the eh0n pass.

## Spacing fix: source geometry as LAW for rest placement

A later pass found the bubble plate sitting almost flush against the trail
circles — the earlier stage-safety recentering (`PLATE_CENTER_Y=54`, chosen
to clear the top margin at `bubble.size`'s autoFit `max`) moved the plate
down without moving the trail circles to match, compressing the authored
gap to ~0px (and the trail-large-to-trail-small gap to ~-1px, already
overlapping). The source SVG's own geometry is the ground truth for rest
placement: plate rect (x=14 y=14 w=176 h=35, bottom edge y=49) to Ellipse
2420/trail-large (cx=102 cy=66 r=8, top edge y=58) is an authored **9px
gap**; trail-large to Ellipse 2421/trail-small (cx=114 cy=84 r=4, top edge
y=80) is a second authored **6px gap**.

Restoring gap 1 exactly required moving the plate back up, not just nudging
the trail circles down — and that surfaced a second, pre-existing bug: the
16px top-margin figure the earlier pass used for stage safety was copied
verbatim from motion-taste.md's own worked example ("~3% of the min
dimension... ≈16px **at 512**"), but this composition is 240×240, not 512 —
the correct margin here is `3% × 240 = 7.2px`. Using the literal 16px pinned
`PLATE_CENTER_Y` at 54 with no room to spare; using the correctly-scaled
7.2px frees enough headroom to move it to **44.5** (top=27, bottom=62) while
still clearing the autofit-max (73px) top edge by 0.8px.

With the plate restored to y=44.5 and trail-large left untouched (still
y=79), the plate-to-trail-large gap comes out to **exactly 9px** — verified
by rendering frame 90 at 4x supersample and locating the plate-bottom and
trail-large-top stroke centers on the x=120 column: measured gap =
**9.00px**. Reproducing the SECOND gap (trail-large-to-trail-small) at the
full source 6px turned out to be geometrically impossible without the
trail-small circle's stroke landing on the head's fill and visually
vanishing (confirmed by rendering it and looking — the circle was simply
gone, camouflaged against `head-dark`'s identical `#222222`). The full
39px span (gap1 9 + trail-large diam 16 + gap2 6 + trail-small diam 8)
doesn't fit in the ~37.4px of headroom available at the tightest
margin-safe plate position, regardless of how the group is arranged. Since
only gap 1 was the verified requirement, trail-small was placed at y=92.5
instead (gap2 compressed to 1.5px, 2.1px clearance from the head) — a
visible, non-overlapping trail with the one explicitly-required gap exact.

**Lesson:** a stage-safety margin expressed as an absolute pixel figure in a
reference doc is scoped to the reference composition size it was measured
at; reapply it as the documented PERCENTAGE against the actual composition,
not the absolute number, or it silently over- or under-constrains scenes at
a different resolution.

## Silhouette morphs (motion-taste.md "the silhouette breathes")

Living-idle rigid transforms (head-rig's position/rotation/scale) move the
mascot but never change its outline — the new rule calls this out
explicitly as the gap between a "moved puppet" and a Rive-grade rig. Three
elements now carry actual shape-path keyframes (`ty:'sh'` with `ks:{a:1,
k:[...]}`, same vertex count/order on every key) on top of their existing
rigid motion:

- **`head-dark` / `head-face`** — `squashSubpath()` scales each vertex (and
  its relative in/out bezier handles) anisotropically about `headPivot`
  (the same bottom-center contact point head-rig already pivots its rigid
  transform on) along `axisUnit` (the same chair-recline axis head-rig
  already translates along). `scaleAlong = 1 - BODY_SQUASH*breathe` (peak
  4.5%) with `scalePerp = 1/scaleAlong` — area-conserved EXACTLY (product
  is 1 by construction, not merely within the ±2% tolerance) — squashes the
  body wide-and-low into the down-beat and draws it tall-and-narrow at
  rest. `head-face` gets the IDENTICAL deform (same pivot/axis/scale
  function) so it rides the deforming mass instead of sliding over it as a
  rigid overlay. Driven purely by `breatheEnvelope` (not `detailEnvelope`)
  per the rule's own "breath deformation" naming; sunglasses/lenses/bridge
  stay rigid (they're worn accessories, not organic mass).
- **`straw`** — the base path was a straight 2-vertex line; subdivided into
  3 vertices (start/mid/end) so the midpoint can bow sideways while both
  ends stay fixed (at bow=0 the rest shape is pixel-identical to the old
  straight line, since the extra vertex sits exactly on the line). Bow
  amount is `sampleTrackAt(dragPoints, t) * STRAW_BOW_GAIN` — reusing the
  SAME already-built `dragPoints` track that drives the straw/umbrella's
  rigid drag rotation (the file's established "world responds" idiom:
  derive, don't hand-author a second curve), so the flex is phase-locked to
  the sip-drag beat for free.
- New generic helpers: `sampleTrackAt(points, t)` (evalTrack generalized to
  a non-periodic, already-boundary-keyed points array — resamples an
  EXISTING track at an arbitrary cadence) and `animatedShapeLayer()` (turns
  out `animProp`'s existing `kf()` already handles shape values correctly:
  `k.s = Array.isArray(value)?value:[value]` wraps a shape object exactly
  the way Lottie's animated-shape keyframe format expects — no
  shape-specific keyframe builder needed).

All three tracks are dense-sampled every `HEAD_SAMPLE_STEP=6` frames across
`[0,OP]`, which lands exactly on `T=90` and `op=270` (both multiples of 6)
without a separate `keyOnBoundaries` call — `breatheEnvelope` is an exact
period-90 function (`t%90`) so it evaluates identically at both boundaries,
and `dragPoints` already carries explicit `t:90`/`t:270` keys at value 0
from its own `keyOnBoundaries` pass, so `sampleTrackAt` returns that exact
value at both. Confirmed by a direct-seek RGBA pixel diff, frame 90 vs frame
270: **0 differing bytes** (unchanged from before the morphs).

**Self-test** (motion-taste.md's own bar: "render the two extreme beats and
compare silhouettes — if the outline is identical, the character is a
puppet"): a naive dark-ink bounding-box diff at rest (t=90) vs peak (t=126,
local t=36 of the 90f breathe cycle) initially read as a FALSE FAIL —
0.00% change — because the sunglasses share `head-dark`'s exact fill color
and don't morph, so their static bbox dominated the combined region. Hiding
every layer except `head-dark`/`head-rig` and re-measuring: rest bbox
97×98 (ratio 0.9898) vs peak bbox 102×99 (ratio 1.0303), a **4.09%** aspect
change — confirms real outline deformation, not just a rigid move. At the
data level, `head-dark`'s own keyframe vertices at t=90 vs t=126 differ by
up to 4.27px per vertex. **Lesson:** a silhouette self-test must isolate
the morphing layer — any other same-colored rigid geometry sharing the
frame can null out a real shape change in an aggregate bbox measurement.

## Applying this to a future duplicate-brief pass

When a sibling scene's rig has since been rebuilt to a newer contract, don't
re-diff mechanism-by-mechanism — re-port the CURRENT most-evolved script
wholesale (slug/output swap only) rather than patching the sibling's stale
copy. It's the same amount of work as the original slug-swap and guarantees
every contract upgrade transfers, instead of silently keeping whatever
mechanisms happened to exist when THIS slug's copy was last made.
