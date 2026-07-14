# AllSet n2ie — Zenek's "all set!" jumping dance loop

`scripts/build-all-set-n2ie.mjs` → `public/projects/all-set-n2ie/scene-1/lottie.json`.
216f @ 60fps = 3.6s seamless loop, four 0.9s beats.

The source SVG (`assets/all-set-n2ie.svg`) is **byte-identical** to the earlier
`AllSet.svg`, so the whole scaffolding — `parsePath`, `strokeToFillPolygon`, the
`EASE`/`anim` helpers, the stacked-alpha Merge-Paths light sweep, the low-pivot
character rig — is lifted verbatim from `build-allset.mjs`. **Read
`allset-celebration-animation.md` first**; it is the pattern library (parser
command-set check, the thick-self-crossing-stroke corruption bug, the
keyframe-ordering freeze bug, the "never animate a gradient's stops" rule, the
`p == a` own-centre pivot idiom). This doc only records what the n2ie brief
changed on top of that base — a useful case study in **re-choreographing a rig
you already have** rather than rebuilding it.

## The one structural inversion: landings on the beat, peaks off it

The old `all-set` scene put the stretched-tall, max-lean pose on the beat
boundaries and the squashed dip at the midpoints. The n2ie brief describes the
opposite physical reading — "springing up on each beat… ending down, upright and
centered" — so the beat clock is inverted:

```js
const LANDINGS = [0, 54, 108, 162, 216]   // beat boundaries: DOWN, upright, squashed wide+flat
const PEAKS    = [27, 81, 135, 189]        // midpoints: airborne, tall, MAX lean (L,R,L,R)
```

Everything else about the rig is unchanged — still one parent null (`body-root`)
with `p == a` at the blob's base (`[bodyBox.cx, bodyBox.maxY]`), still three
independent functions (`bodyRotation`/`bodyPosition`/`bodyScale`) all reading the
same `LANDINGS`/`PEAKS` arrays so lean, spring and squash always land together.
Two consequences of the inversion worth stating:

- **The lever-arm "arc for free" trick is no longer enough by itself.** In the
  old scene the body only bounced ~6px and let the low-pivot rotation do the
  lateral travel. This brief wants a real *jump*, so `bodyPosition` now lifts the
  whole base up `JUMP_H = 18px` at each peak (`PIVOT.y → PIVOT.y - 18`) on top of
  the rotation. The squash still keeps the base planted at the landing (anchor at
  the base, `sy` down → the top flattens toward the fixed base = a landing
  compression), so you get vertical spring *and* squash without fighting.
- **Lean now swells while airborne, not at the dip.** `bodyRotation` is 0° at
  every landing and `±5.5°` at every peak — "tilt swelling to its peak while he's
  airborne, easing back to nearly upright as he lands." All segments use
  `travelBal` (ease-in-out) so the apex and the landing are both smooth: the
  brief explicitly wanted "smooth curved easing, no sharp corners," so **do not**
  reach for a ballistic bounce ease here; the squash/stretch supplies the spring
  read, the position easing stays premium-smooth.

Seamlessness is still just "frame 0 == frame 216 on every property," and because
0 and 216 are both landings, the loop closes down/upright/centered for free.

**Blink** moved with the beat: it now fires at two of the four *peaks* (frames 27
and 135, "every other beat"), landing the thin-line scaleY squash right at the
top of the jump — a wink at the apex.

## Vector 935 reassigned: sparkle voice → landing-synced air puff

The two small curved strokes above the head (`Vector 935`) were the 4th
round-robin sparkle in the old scene. This brief redefines them as
**air-movement highlights** — impact marks, not a sparkle:

- Own layer, `p == a` at their own bbox centre, **not parented** to the body
  (parenting would make them ride the jump and drift; the brief says "no drifting
  or floating — they live and die with the impact").
- `airPuff()` keys opacity `0→100` (fast, ~3f) + scale `~70→106→100` on each of
  the four landing starts `[0,54,108,162]`, brief hold, then fade back to
  opacity 0 / scale-70 idle by `+18f` as he springs up. Invisible the rest of the
  time.
- **Idle scale is 70, not 100.** Because the element is opacity-0 when idle its
  scale value is invisible, but pinning idle to the puff's *start* value (70) is
  what keeps frame 0 == frame 216 without any special seam keyframe: every
  landing window fits inside the loop (`162 + 18 = 180 < 216`), and both ends of
  the loop sit at the shared idle.

The "one small companion spark/accent trail paired with the smallest of the
three" that the brief still asks for therefore has **no dedicated source path**
left. Rather than invent geometry, it's realised as a fourth `sparkleLayer` that
reuses `sparkleC`'s own vertices, driven by a reduced-amplitude pulse
(`overshoot 60 / hold 55`, so it never reaches full size) and nudged up-left of
sparkleC via a `posOverride` (anchor stays at sparkleC's centre, position offset)
— a small satellite that pops on sparkleC's schedule (`startsC`). Lesson:
**when a brief names an element the source doesn't contain, echo an existing
element at reduced scale before authoring new geometry** — it stays on-brand and
avoids a lone hand-built shape that won't match the source's stroke language.

## The green doodle went *fully* static

The old scene gave the doodle a gentle opacity breath (100→88→100) plus a light
sweep. This brief forbids it outright: "no position, scale, rotation, or per-piece
opacity motion of any kind." So:

- The breath is **deleted** — `doodleLyr` opacity is a hard `100`.
- The **only** motion is the light-reflection gleam, and it is confined to the
  **ribbon**. The old scene swept the ribbon *and* the tick; here the tick and
  the spark dot get nothing at all. `sweepGroups` is called once (ribbon only)
  and the sweep box is `bbox([ribbonFill.tubeSeg])`, not the ribbon∪tick union.
- Direction is reversed to **tail → tip** (fat right end → tapered left end):
  `sweepShape` starts the band at `rightX` (fully clear, right of the ribbon) at
  t=0 and travels to `leftX` (fully clear, left) at t=216. Because the band is
  off the ribbon at *both* ends, the gleam is absent at the seam — "once per
  loop… gone by the time the loop wraps" — with no discontinuity to hide.
- `TARGET_PEAK` dropped 0.42 → 0.34 to honour "subtle and barely-there"; it reads
  as a faint lighter-green pass, clearest mid-ribbon (frames ~90–160).

The tick is *still* built through `strokeToFillPolygon` even though it never
moves — the thick-self-crossing-stroke render-corruption bug is about the stroke
merely *existing* in the scene, not about it animating (see the base doc). Static
≠ safe to ship as a live `st`.

## Shadow: grows/shrinks with the jump

Replaced the old lean-linked x-shift + scaleY squeeze with a straightforward
jump-tracker on the shared `LANDINGS`/`PEAKS` clock: uniform scale `83%` + opacity
`96%` (tight and crisp) at each peak, `114%` + opacity `60%` (spread wide and
soft) at each landing. It's the stylised cartoon convention (shadow splats out on
impact, pulls in when he's up), and it pairs with the air puff so each landing
reads as one coordinated impact beat: puff in + shadow spread + squash.

## Verification notes (headless previewer)

- The puffs and the gleam are the two things easy to *miss* in a spot-check: the
  air puffs are opacity-0 at the exact landing frames (0/54/108/162), so sampling
  only the beat boundaries shows nothing — scrub `L+4 … L+12` (e.g. 4, 60, 114,
  168) to see them. The gleam is deliberately faint; sample mid-loop (90, 160).
- Frame set that exercises everything: `0,27,54,81,108,135,162,189,215` for the
  jump/lean/blink/seam, `4,60,114,168` for the puffs, `20,90,160,210` for the
  gleam travel, and `0,10,20,27,34,44,54` for one full spring arc.
- Always re-run the monotonic-keyframe sanity check on the emitted JSON (a
  descending `t` silently freezes a property in this Skottie build) — the
  round-robin/puff builders all filter/idle so their generated lists stay
  ascending, but verify after any timing edit.
