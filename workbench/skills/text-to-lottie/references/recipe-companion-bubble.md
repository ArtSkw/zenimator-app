# Recipe — Companion Scenes: Intro + Loop, Speech Bubbles, Localizable Text

The pattern behind a "live companion": a mascot idles forever in an endless
loop while one-shot furniture — a speech bubble, a tooltip, a badge — arrives
once at the start and then holds still. One file carries both behaviors, and
the text stays editable for localization instead of being baked into paths.

Three mechanisms compose here. Each is standard Lottie — no expressions, no
player-specific tricks — so the same file behaves identically in this
workbench's Skottie previewer, the app player, lottie-web, dotLottie, and the
native iOS/Android runtimes.

## 1 — Intro + Loop (`kind: intro-loop`)

Author ONE composition with two KINDS of layers — not two time segments:

- **The idle runs continuously from frame 0.** The mascot is alive the moment
  the scene exists — breathing, swaying, sipping — and never freezes to wait
  for the entrance. A subject that sits stiff until the bubble lands, then
  starts moving, reads as two animations glued together; the sin this rule
  exists to prevent. Author the idle as unbroken cycles across the WHOLE
  composition and choose `op` so `[T..op]` holds a whole number of cycles —
  the seam then closes automatically.
- **The one-shot elements enter during `[0..T]`,** layered over the already
  moving idle. The bubble emerges from the mascot (from the tail, as if
  spoken), overshoots gently if the tone allows, and is completely at rest
  strictly before `T`. To make a
  scale-from-0 read as *emerging from the tail* rather than inflating from
  its own middle, put the whole bubble (plate + text, both parented to it) on
  one null whose **anchor point sits at the plate's edge nearest the
  tail/trail**, not its center — e.g. anchor at local `[0, plateH/2]`
  (bottom-center) with position set to where that edge lands in composition
  space. Every other point on the plate then scales toward/away from that
  pinned edge. Text does not automatically scale with a parent's animated
  scale in this player (only position composes through `parent`) — give the
  text layer its own matching scale keyframes if it needs to pop with the
  plate; see player-contract.md's Native Text section.
- **The seam** is the pair `T` and `op`: every property that moves during the
  idle must match at both — value, velocity and easing — the same discipline
  as a seamless LOOP scene. Everything that settled in the intro holds
  perfectly still from its settle through `op` — a bubble that drifts even
  1px per cycle reads as broken after ten cycles.

Declare the boundary with top-level markers, exactly this shape:

```json
"markers": [
  { "cm": "intro", "tm": 0, "dr": T },
  { "cm": "loop",  "tm": T, "dr": op - T }
]
```

Players run `intro` once, then cycle `loop` forever (lottie-web
`playSegments`, dotLottie segments, iOS `play(fromMarker:toMarker:)`, Android
`setMinAndMaxFrame`; this project's player and exports honor the same names).
Marker names are contract — always `intro` and `loop`, lowercase.

Design the idle from the mascot's CONTEXT, not from a template: hugging a
pillow breathes into the squeeze; a lounge chair lounger raises its drink for
an almost-sip; a spacesuit bobs in low gravity. Restraint governs AMPLITUDE,
not the amount of craft — a top-tier idle is small but DENSE:

- One primary motion that owns the character, then 2–3 secondary details
  riding it with overlap and follow-through — as DRAG, never delay: a
  follower moves while its parent moves, bends further at the tip, and
  settles a beat later with its own overshoot. Time-shifting a copy of the
  parent's keyframes reads as detached lag, the classic clunk (see
  motion-taste "Fluidity"). Paws and held props travel in arcs with
  velocity flowing through intermediate poses.
- The mascot's SILHOUETTE itself breathes (motion-taste "Living idles" —
  morphs, not just transforms): the body path deforms on the breath with
  volume roughly conserved, the face patch rides the deforming mass, props
  flex along their length. A companion whose outline never changes reads as
  a moved puppet next to the Rive rigs it sits beside in the portal.
- Partition before animating: the mascot plus everything it WEARS is one
  assembly on one rig — a spacesuit's helmet, visor shine, packs and badges
  drift with the body as one mass, never as separate floaters (motion-taste
  "Worn gear is the wearer"; assemblies is a blocking gate in the Aliveness
  Contract). Free satellites — thought-trail circles, stars, loose props —
  get their own clocks; celestial backdrops (a moon, a sun) hold still and
  twinkle in place, or counter-drift only as parallax DERIVED from the
  mascot's own motion: opposite, far slower, smaller.
- Match the idle to the scene's MOOD (motion-taste "Mood governs the
  system"). The relax archetype specifically: breath lives in the chest/
  belly MORPH, the body SWAYS slowly about its seat contact like a hammock
  (a couple of degrees, 4–6s period), the body's y barely moves (~1–2px),
  and the sip is the loop's single accent. A bobbing body on a deck chair
  reads as squats — the one review question that catches it: "could this
  motion be described with a gym verb?"
- At least one SNAPPY accent per cycle — a quick squeeze, a glint, a blink —
  with real attack against the slow base, so the loop has a pulse, not a drone.
- Springy easings with visible overshoot on the accents; never one uniform
  ease across the cast. A "subtle" idle done with flat timing reads as cheap,
  not calm.
- Blink cycles and micro-motions must fit a whole number of times into
  `op - T` (see motion-taste's LCM rule), and different details should peak at
  DIFFERENT beats of the cycle, never in unison.

**The "echo" technique** turns an idle authored as `[T..op]` humps into one
alive from frame 0 without changing its tempo: since rests already fall at
`T` and `op` exactly one period (`IDLE = op - T`) apart, the SAME shape
sampled at `t - IDLE` is a valid earlier occurrence of the identical cycle.
Take the per-cycle keyframe generator (a plain function of a start time),
call it once at the "real" start (`T + offset`) and once at `T + offset -
IDLE`, drop any resulting points at negative `t`, and prepend one explicit
`t:0` rest so playback doesn't snap to whichever point survives the drop.
The echo and the real occurrence are the same generator function called
twice — zero extra state to keep in sync with the seam, and the cycle's own
pacing ("slow contented breathe") never has to shrink just to fit inside the
intro window.

Verification (blocking): render and READ the seam pair `T` and `op` — they
must be pixel-identical for looping elements. Render TWO mid-intro frames a
dozen frames apart — the mascot must already differ between them (alive under
the entrance) while the bubble is mid-pop. Render two mid-idle frames to
check the bubble holds still.

## 2 — Native, localizable text (never outlines)

When the brief supplies the string (or asks for editable/localizable text),
the text must be a REAL text layer — `ty:5` — not baked glyph paths. Outlined
text cannot be re-worded by developers; a text layer can, on every platform.

The contract:

1. **Layer**: `ty:5`, named for its role (`bubble-text`). Centered
   justification (`j:2`) so re-worded strings grow symmetrically.
2. **Font — match the WEIGHT, not just the family.** Declare it top-level,
   e.g. `"fonts":{"list":[{"fName":"Nunito-Bold","fFamily":"Nunito",
   "fStyle":"Bold"}]}` — `fName` must equal the weight file's basename.
   `assets/fonts/` ships `Nunito.ttf` (Regular 400) and `Nunito-Bold.ttf`
   (Bold 700); copy the one(s) you use next to the scene. The ZEN tooltip
   standard is **Nunito Bold 15px, line-height 19** — when replacing outlined
   tooltip text, that is the spec unless the artwork clearly differs. Compare
   your rendered stroke weight against the source outlines in the preview:
   text that renders thinner than the artwork is a fidelity failure, exactly
   like a wrong color. Never bake `chars` glyph data: baked glyphs only cover
   the default string's characters, and the first Polish or German
   translation would tofu.
3. **Slot**: bind the text document to a slot so modern runtimes re-word the
   file without touching layers:

   ```json
   "slots": { "bubble.text": { "p": { "k": [ { "s": { ...textDoc }, "t": 0 } ] } } }
   ```

   and on the layer: `"t": { "d": { "sid": "bubble.text", "k": [ ...same
   default... ] } }`. The slot's default IS the design copy — the file works
   untouched, localization is an override.

Developers then localize the one exported file two ways, both free:
slots (dotLottie theming, lottie-web ≥5.12, Skottie `setTextSlot`) or the
classic per-platform overrides that key off the layer/font name (lottie-web
`updateDocumentData`, Android `TextDelegate`, iOS `AnimationTextProvider`).

## 3 — The bubble that fits every translation

Lottie has no layout engine, and expressions don't run in Skottie — so the
bubble never "auto-sizes" inside the file. The portable contract instead:

- The bubble plate is a rounded rect whose **size is a vec2 slot**:
  `"s": { "a": 0, "k": [W, H], "sid": "bubble.size" }`, with the slot's
  default matching the design. Keep the rect's own `p` at `[0,0]` inside its
  group and place the group via the layer transform, so a size change grows
  the plate symmetrically around its center.
- The **tail** is a separate small path in the same group, anchored at the
  mascot's mouth — it must NOT scale with the plate. Anchor the plate's
  center directly above the tail so width changes stay visually attached.
- Padding is part of the design: the ZEN tooltip spec is **16px left/right,
  8px top/bottom** (plate height = line-height + 16 → 35 for the standard
  15/19 text). Match the source plate first; publish the real numbers in
  `controls.json` so tools and developers reproduce the fit for any string:

```json
"controls": [
  { "sid": "bubble.text", "label": "Bubble text" },
  { "sid": "bubble.size", "label": "Bubble size",
    "autoFit": { "text": "bubble.text", "padding": [16, 8],
                 "min": [90, 35], "max": [420, 73], "leading": 2 } },
  { "sid": "bubble.textPos", "label": "Bubble text position", "internal": true },
  { "sid": "bubble.anchor", "label": "Bubble anchor", "internal": true }
]
```

`max` is REQUIRED and comes from the stage, not taste: `max[0]` is the widest
plate that still clears both stage edges by the safety margin (motion-taste
"Render-Aware Motion") given where the plate sits; past it, tools WRAP the
string onto more lines (`\r` separators — Skottie honors them in point text)
and grow the plate downward in `lineHeight` steps, so `max[1]` documents the
tallest plate the layout has vertical headroom for (2 lines → `2×lh + 2×padY`
= 54 for the standard 15/19; 3 lines → 73). Author the plate's surroundings —
trail, mascot gap — to survive `max[1]`, and place the plate so `max[0]`
actually fits: a translation ~40% longer than the design string is normal,
so verify the stage against the plate AT `max`, never at the default.

**The entrance timing is a HOUSE CONSTANT in absolute time, not a fraction
of the intro.** The bubble arrives with the same unhurried feel in every
companion scene; a shorter intro window does not mean a faster bubble — it
means the intro window is too short and must be lengthened. Team-approved
values, measured off the reference scene (60 fps):

| element | starts | scale-in | opacity | overshoot |
| --- | --- | --- | --- | --- |
| trail-small | 0 | 20f (333 ms) | 10f | ~112% |
| trail-large | +8 | 24f (400 ms) | 12f | ~114% |
| bubble plate + text | +28 | **54f (900 ms)** | 16f | ~112% |

The plate's scale is the slow one — 900 ms of soft settle — while its
opacity resolves in ~270 ms (early-opacity/late-settle, so it reads legible
long before it stops moving). Keep the overshoot gentle at ~112%; 118% and
a half-length scale-in is the snappy UI-toast feel this pattern is not.
The intro marker `T` must sit a few frames AFTER the entrance settles, so
the bubble is provably motionless before the loop begins — size `T` to the
entrance, never the entrance to `T` (measured failure: a scene whose intro
was 54f compressed the plate scale-in to 28f / 467 ms, roughly half the
approved feel, purely because the window was short).

**A growable plate must grow AWAY from its tail.** A rounded rect is centred
on its own origin, so slot-driven height growth pushes the plate's BOTTOM
edge down — straight into the thought trail below it. Measured on a real
scene: a 35px plate sat 9px above the trail circle (the authored gap), and at
54px its bottom edge had crossed 0.5px INTO that circle. Pin the edge nearest
the tail by binding the plate layer's ANCHOR to a slot, `<prefix>.anchor`,
whose default is `[x, defaultHeight/2]`; tools rewrite its y to
`height / 2` on every resize, so the bottom edge never moves and all growth
goes upward. Publish it like the other plumbing:

```json
{ "sid": "bubble.anchor", "label": "Bubble anchor", "internal": true }
```

Because growth is upward, the composition must RESERVE that headroom: at
`max[1]` the plate's top edge still needs the stage margin (motion-taste
"Render-Aware Motion" — ~3% of the min dimension, so ≈7px on a 240 comp).
Derive `max[1]` from the geometry rather than wishing for it: it is
`plateBottomY − margin`, rounded down to a whole number of lines. If the copy
needs more lines than that allows, widen toward `max[0]` instead of growing
taller. Verify by BAKING a string at `max[1]` and rendering: the plate must
clear the stage top by the margin AND the trail by the authored gap.

**Wrapped lines need leading.** The design's line height is tuned for one
line; stacked lines at the same value read cramped. Publish
`"leading": 2` (px added to `lineHeight` when — and only when — the string
wraps) so the single-line default stays pixel-true to the source while
multi-line copy breathes. Tools write the resulting height into the text
document's `lh`.

**Multi-line centering needs a `.textPos` slot — text-doc `ls` does NOT
work.** Wrapped point text grows DOWN from the first baseline while the plate
grows from its center, so the block must rise `(lines−1)×lh/2` to stay
centered. The obvious tool — baseline shift `ls` in the text document — is
silently IGNORED by Skottie (measured 2026-08-05: ±9.5 and 0 rendered
byte-identical). The mechanism that works is a vec2 slot on the TEXT LAYER's
transform position (proved rendering in the same session):

```json
"slots": { "bubble.textPos": { "p": { "a": 0, "k": [0, 5.41] } } }
```
```json
{ "sid": "bubble.textPos", "label": "Bubble text position", "internal": true }
```

The layer's `ks.p` carries `"sid": "bubble.textPos"` with the calibrated
single-line position as the slot default (file works untouched). `internal:
true` tells tools it's layout plumbing — driven by the wrap math, never shown
as an editor. Every companion scene MUST ship this slot alongside
`bubble.text`/`bubble.size`.

- **Vertical centering is measured, not assumed.** Lottie draws text from the
  BASELINE: placing the baseline at the plate's centerY leaves the ink
  floating high (more air below than above). For single-line text, start at
  `baselineY ≈ plateCenterY + fontSize × 0.36` and then VERIFY: render, read
  the ink bounds against the plate bounds, and adjust until the top and
  bottom insets are equal within ~1px. Unequal insets are a blocking defect.
  **Measure the text and the plate SEPARATELY** — render one throwaway copy
  containing only the text layer and another containing only the plate, and
  compare their ink bounds. A single render of the assembled bubble cannot
  be measured: the plate's own stroke runs along every row and column, so
  any row-scan reports the plate's extent as the text's and a badly
  off-centre bubble passes (measured case: a whole-bubble scan reported
  equal 7px insets, while isolating the layers showed 7.50px top against
  15.33px bottom — the text sitting nearly 4px high).

`autoFit` means: correct plate size = measured text extents + `2×padding`,
never below `min`, wrapped at `max[0]`. The app applies it live while a
teammate previews locale strings; the scene's learnings doc must include the
same measure-wrap-and-set snippet for developers. Verification renders a
realistically long localized string (e.g. a Polish sentence ~40% wider than
the design string) baked into a throwaway copy: the wrapped plate must sit
fully inside the stage with the safety margin, text centered, before the
default is restored.

## Judgment calls

- The bubble text does not animate per-glyph. It fades/pops with its plate as
  ONE unit — per-character cascades fight localization (every language would
  time differently).
- If the source artwork carries the text as outlines (typical Figma export),
  REPLACE it with the text layer at the same position/size, matching optical
  size to the outlines. State the swap in the learnings doc.
- Static text that is purely decorative inside the artwork (a logo lockup, UI
  chrome in a screenshot) stays vector — this recipe is for strings a product
  team will re-word.
- Slots are additive freight: scenes without text needs carry none.
