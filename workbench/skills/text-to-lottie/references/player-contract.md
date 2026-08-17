# Player Contract

Use this reference before creating, editing, fixing, or verifying any scene.

## Setup

Use the official player project. Do not verify through a custom page,
`lottie-web`, or another renderer.

If the player project is missing:

```bash
npx degit diffusionstudio/lottie my-animation
cd my-animation
npm install
npm run dev
```

The dev server defaults to port `3030`, but never assume it. On `npm run dev`,
Vite prints the URL it bound to (`Local: http://localhost:<port>/`) and falls
back to the next free port when `3030` is taken — e.g. when another project
folder is already serving. Treat that printed port as the source of truth and
use it as `<port>` in every curl and navigation below; a second folder's server
answers on a different port, so a blind request to `3030` will hit the wrong
project.

If the project already exists, use its existing setup and start `npm run dev`
when browser verification is needed.

## Scene Layout

Every renderable scene lives under `public/projects/`:

```text
public/
  canvaskit.wasm
  projects/
    <project-slug>/
      <scene-N>/
        lottie.json
        controls.json
        <image files>
        <font files>
```

- `lottie.json` is required. A scene without it is ignored.
- Project and scene slugs become URL segments: `/<project>/<scene>`.
- Scene ordering comes from the trailing number in `scene-<N>`.
- Put image assets next to the scene and reference them by bare filename in
  `assets[].p`, for example `"p": "logo.svg"`.
- Put font files (`.ttf`, `.otf`, `.ttc`) next to the scene to render native text.
  The loader passes every scene font to Skottie; see "Native Text" below.

## Target Scene Policy

- Resolve target scenes by authority. A user-provided file path wins. A browser
  URL route like `/<project>/<scene>` wins next and maps to
  `public/projects/<project>/<scene>/lottie.json`. An already-known
  project/scene for the task wins next.
- Do not let the active scene from `GET /__context`, the `live` block in
  `/__context`, or `/__context.live` override a known file path, URL, or
  project/scene.
- If project/scene is known, navigate directly to
  `http://localhost:<port>/<project>/<scene>` and inspect frames there with
  `?frame=<N>`.
- Use the active project/scene from `GET /__context` only when the task is
  explicitly to edit what is currently on screen and no more specific target
  exists.
- If creating new work without a target, create a new project/scene or the next
  available `scene-<N>`.
- For dropped, uploaded, or imported Lottie JSON, work on the generated scene
  under `public/projects/<imported-project>/<scene>/lottie.json`, not the
  original dropped/uploaded JSON context.
- Before editing, verify the resolved file is the intended
  `public/projects/<project>/<scene>/lottie.json`; before overwriting an
  existing `lottie.json`, re-read the current file from disk.
- Overwrite `public/projects/main-project/scene-1/lottie.json` only when it is
  still the untouched placeholder. If unsure, create a new scene.

Treat `main-project/scene-1` as safe to overwrite only if it has one simple
background layer, no meaningful assets, no custom controls, and a generic name
such as `Scene 1 - 512x512`.

## Live Editor Behavior

- The scene tree watches folders and updates live.
- Editing an existing `lottie.json` may require reload or re-navigation.
- Slot edits in the UI are written back through `/__scenes/lottie`, so re-read
  source before applying another edit.

## Context Endpoint

Use the context endpoint for project-tree discovery, last-modified checks, and
observational playback state:

```bash
curl -s http://localhost:<port>/__context
```

It reports the project tree, active project/scene, frame, total frames, fps, and
last-modified times. Treat that active scene as observational unless the task is
explicitly to edit what is currently on screen and no path, URL route, or known
project/scene target exists.

## Frame Pinning

Inspect exact frames by navigating to:

```text
http://localhost:<port>/<project>/<scene>?frame=<N>
```

`?frame=N` seeks and pauses on load. Use frame `0`, midpoint, and `op - 1` for
new scenes; use focused frames for small edits. The canvas is
`<canvas id="main-canvas">`.

## Layer Naming

Layer `nm`s are user-facing: the app's Layers panel prettifies them directly
("bag-body" → "Bag body"), selection and edit anchors reference them, and the
parametric controls group under them. Naming is all-or-nothing:

- **Every non-plumbing layer gets a name a non-technical user recognizes on
  sight** — say what the thing IS: `letter-b`, `i-dot`, `t-crossbar`,
  `left-arm`, `steam`, `headline`. Terse codes (`e2`, `t1`, `p3`) read as
  random noise in the panel — prefix with the kind (`letter-e2`) or spell it
  out.
- **If contextual names aren't possible, name ALL layers generically**
  (`layer-1`, `layer-2`, … in stacking order). Never mix the two styles in one
  scene — a half-named list looks broken.
- Plumbing keeps its conventions and stays out of the panel: matte sources are
  `<host>__matte` (also how the app pairs a wipe's knobs to the layer it
  reveals), sheen/emerge/mask helpers keep their `__` suffixes.

## Slots And Controls

Use slots for user-editable values that should appear in the player properties
panel. The player discovers slots automatically through Skottie.

Top-level slot pattern:

```json
{
  "slots": {
    "accentColor": { "p": { "a": 0, "k": [0.2, 0.5, 1, 1] } },
    "scaleAmount": { "p": { "a": 0, "k": 100 } }
  }
}
```

Reference a slot with `sid` on a compatible property:

```json
{ "c": { "sid": "accentColor" } }
```

Add `controls.json` next to `lottie.json` when labels or numeric ranges matter:

```json
{
  "controls": [
    { "sid": "accentColor", "label": "Accent color" },
    { "sid": "scaleAmount", "label": "Scale", "min": 40, "max": 160, "step": 1 }
  ]
}
```

Slot value types map to controls:

| Slot value | Control |
| --- | --- |
| number | slider |
| RGBA array `0..1` | color picker |
| two-number array | two number inputs |
| string text slot | text input |

Slot types must match the properties that reference them.

### Layer controls (agent-authored knobs)

Beyond slots, `controls.json` may carry a `layerControls` array — your own
bespoke, contextual knobs for the scene's key layers. This is where the scene
gets its signature controls: you know what each layer does and what a user
would want to tune, so name the knob the way a motion designer would name it
for THIS piece ("Bag sway", "Steam rise", "Landing feel") — never generic
filler. 1–2 per key layer, only for motion that truly benefits from a handle.

```json
{
  "controls": [ { "sid": "accentColor", "label": "Accent color" } ],
  "layerControls": [
    { "target": "bag", "kind": "amount", "property": "rotation",
      "label": "Bag sway", "description": "How far the bag swings each step." },
    { "target": "steam", "kind": "steps", "property": "position",
      "label": "Steam rise", "description": "How tall the steam plume grows.",
      "steps": [ { "label": "Wisp", "intensity": 0.5 },
                 { "label": "Full", "intensity": 1 },
                 { "label": "Billow", "intensity": 1.6 } ] },
    { "target": "zenek-root", "kind": "toggle", "property": "position",
      "label": "Bobbing", "description": "Whether Zenek bobs while walking." },
    { "target": "global", "kind": "feel",
      "label": "Feel", "description": "The easing personality of the whole entrance." }
  ]
}
```

- `kind`: `amount` (slider over the motion's amplitude), `steps` (named
  intensities, 2–5, as multipliers of the authored amplitude), `toggle`
  (on/off), `feel` (easing personality select).
- `target` is a layer `nm`, or `"global"` for a scene-wide `feel`.
- `property` (`position` | `rotation` | `scale`) is required except for `feel`,
  and must name motion that actually exists on that layer — the app grounds
  every spec against the real keyframes and silently drops what doesn't match,
  so a knob can never be dead.
- A custom amplitude knob replaces the auto-derived one for that property —
  use it when your label/steps say it better than a generic "Rotation".
- A `controls` slot entry may carry `autoFit` (companion-bubble scenes):
  `{ "sid": "bubble.size", "label": "Bubble size", "autoFit": { "text":
  "bubble.text", "padding": [24, 16], "min": [120, 52] } }` — the app then
  measures the text slot's current string in the scene's font and keeps the
  size slot at text extents + 2×padding (never below `min`), live, while a
  teammate previews locale strings. See `recipe-companion-bubble.md`.

## Intro + Loop (markers)

An `intro-loop` scene is ONE composition with two segments declared by
top-level Lottie markers — names are contract, lowercase:

```json
"markers": [
  { "cm": "intro", "tm": 0, "dr": T },
  { "cm": "loop",  "tm": T, "dr": op - T }
]
```

- This player (and every export) runs `[0..T]` once, then cycles `[T..op]`
  forever. Web/native runtimes do the same via `playSegments` /
  `play(fromMarker:toMarker:)` / `setMinAndMaxFrame`.
- The seam pair is frames `T` and `op`: every property animating inside the
  loop must match exactly at both; everything that settled during the intro
  must hold perfectly still from its settle through `op`.
- Duration/speed controls in the app rescale marker times together with the
  keyframes, so the boundary stays proportionally where it was authored.
- **Verifying the seam: never diff `preview-scene.mjs`'s own PNG output for
  frame `T` vs frame `op`.** The previewer clamps every requested frame to
  `last = Math.ceil(op) - 1` before seeking (since `op` is exclusive and
  never actually displayed), so asking it for frame `op` silently renders
  `op - 1` instead — one frame before the authored rest keyframe, which can
  show a few sub-pixel antialiasing differences from an easing curve that
  hasn't fully flattened out yet. That looks like a broken seam but isn't.
  Confirm a seam by calling `anim.seekFrame(T)` and `anim.seekFrame(op)`
  **directly** in a small throwaway CanvasKit script (bypassing the
  previewer's grid/clamp) and diffing the raw pixel buffers — that samples
  the keyframe tracks at the literal authored times.
  **In that throwaway script, pass `anim.render()` a real `CanvasKit.LTRBRect(...)`,
  never a plain `{fLeft,fTop,fRight,fBottom}` object literal** — the latter
  silently produces a garbage/undersized destination rect (the render comes
  out shrunk and mispositioned), which reads exactly like a broken loop seam
  (large pixel diff, content visibly different) and will send you hunting for
  a rig bug that doesn't exist. `preview-scene.mjs` already does this
  correctly (`ck.LTRBRect(0, 0, W, H)`) — copy its render call verbatim
  rather than hand-rolling the dest rect.
- **A periodic idle track's FIRST authored point must equal the true rest
  value, or the flat gap between cycles stops being flat.** The "echo"
  technique (sampling one cycle's shape at `t - period` to fill `[0, T)`,
  see the idle-from-frame-0 pattern) relies on there being a genuinely flat
  `[rest] -> [rest]` hold between one cycle's settle and the next cycle's
  first keyframe — that's what lets an arbitrary point in the middle (like
  `T` itself) safely evaluate to the same rest value as `op`. Inserting an
  anticipation dip (or any other non-zero lead-in beat) as that first point
  turns the ENTIRE inter-cycle gap into a slow drift toward it, so `T` no
  longer lands on the flat plateau and silently stops matching `op` — a seam
  break with no visible symptom in a single-cycle preview, only caught by
  the direct-seek pixel diff above. Fix: keep an explicit flat point at the
  true rest value shortly before the anticipation begins, so only the last
  few frames before it show motion — the long gap in between stays truly
  flat regardless of how many cycles are echoed.
- **A shared boundary key must not swallow its beat's PEAK.** When an
  entrance chain's last key IS the loop's first landing (the correct
  single-key form), the loop generator's "skip the duplicate landing" guard
  must still push that beat's peak/mid-cycle keys — a `continue` that skips
  both deletes the first beat entirely. The loop then opens frozen, moves,
  and freezes again after every wrap, and the boundary diff cannot see it,
  because a frozen boundary is a perfect seam. Verify by rendering a frame
  INSIDE the loop's first beat and reading the pose against the rest pose
  (`check-loop-seam.mjs` fails a static opening mechanically).
- **A boundary value must come from evaluating the SAME function at that
  boundary, never from a second hard-pinned keyframe at the identical
  timestamp.** A one-shot entrance handing off into a periodic idle at
  `t=E` is tempting to cap with an explicit `{t: E, v: restValue}` —
  but if the idle's own function is ALSO being dense-sampled starting at
  `t=E` (as it should be, per "keyframes are its samples" above), and that
  function's true value at `t=E` isn't the naive rest value (a phase-lagged
  secondary wobble sampled at its parent's own zero-crossing is generally
  NOT zero there), the array ends up with two keyframes at the identical
  timestamp with conflicting values. Some read paths silently prefer one
  over the other, so the bug doesn't always show as an obvious jump — it
  showed up only as a small angle discontinuity indistinguishable from
  correct secondary motion in a single-frame render. Caught by diffing every
  animated track's INTERPOLATED value at the two ends of a loop-repeatable
  segment (not eyeballing frames): a track that reads one value at the
  segment's start and a different one at its end has this bug, an
  entry-handoff mismatch, or a genuine seam break — diff first, don't guess
  which. Fix: drop the hard-pinned boundary keyframe and let the entrance
  curve ease directly into the idle function's own computed value at that
  boundary (compute it, never hand-type it, so the handoff cannot drift out
  of sync with the idle function later).

## Native Text

Native Lottie text layers (`ty:5`) and text slots render in this player, as long
as the scene supplies the font. The loader discovers every `.ttf`/`.otf`/`.ttc`
file in the scene folder and hands all of them to `MakeManagedAnimation`
alongside images. Skottie loads those bytes into a font manager and resolves each
text layer by the font's **embedded family name** — so the contract is:

1. Drop the font file in the scene folder (next to `lottie.json`).
2. Declare it in the Lottie's top-level `fonts.list`, e.g.
   `{ "fName": "Inter", "fFamily": "Inter", "fStyle": "Regular", "ascent": 75 }`.
   `fFamily` must equal the font's real embedded family name (not the filename).
3. Reference that font from text documents via `f` (matching `fName`).

The font's **filename is irrelevant** to resolution — Skottie matches on the
embedded family name, not the asset key — but keep it unique within the folder so
it does not collide with an image. If a font is present but doesn't match, the
text layer renders transparent (the classic "blank text" failure). If **no
assets are passed to `MakeManagedAnimation` at all** (a `null`/omitted second
argument, as opposed to an assets dict that's merely missing this one font),
the failure mode is different and easy to misdiagnose: a visible dark
placeholder mark pinned at the composition's absolute origin `(0,0)` on every
frame, unrelated to the text layer's own transform — it reads exactly like a
stray shape bug in the rig, not a missing-font symptom. `scripts/preview-scene.mjs`
(the headless verification tool) now builds this assets dict automatically —
any `.ttf`/`.otf`/`.ttc` or image file sitting in the scene folder is read and
passed in — so a scene built with a font in place should just work; if this
mark ever reappears, suspect the previewer's asset loading before the layer
transforms.

- Text slots (editable text in the properties panel) work the same way — the slot
  still needs the font present. The slot value type for text is a string input.
- Vector/shape text (baking glyphs to `ty:"sh"` outlines) is no longer required
  for text to render. Use it only when you deliberately want path-level control
  (stroke-on reveals, glyph morphs, handwritten traces) — not as a font
  workaround.
- **A parented text layer inherits the ancestor's animated position, but not
  its scale** (confirmed in this player): if a text layer needs to visually
  pop or grow together with a parent group (a speech-bubble entrance, a
  badge lockup), give the text its own explicit scale keyframes — pivoting at
  its own anchor point — rather than relying on the parent null's scale to
  carry it. Position inheritance through `parent` is unaffected and still the
  simplest way to place text relative to a moving group.
- **A layer's `ks.o` (opacity) does NOT cascade through `parent` in this
  player** (confirmed by direct pixel sampling): a parent null's animated
  opacity has zero visible effect on its parented children — only `p`/`a`/
  `s`/`r` compose down the transform chain. A rig that fades or pops a whole
  assembly by keying opacity on the shared parent null (the same pattern that
  correctly cascades scale/position/rotation, e.g. a badge popping and
  fading away, or a group of layers fading out together) will visibly render
  every child at full, unfaded opacity forever — the parent's `o` keyframes
  exist in the JSON and are silently inert. Fix: wrap the assembly in a real
  **precomp** (an asset with its own nested `layers`, referenced by a `ty: 0`
  layer with `refId`) and put the fade/pop opacity (and, if you like, the
  scale too) on the OUTER precomp layer instead of an inner parent null —
  precomp compositing is a genuine offscreen-buffer-then-composite operation,
  so its own `o` and `s` apply correctly to everything inside. Keep any
  shared *scale-only* rig (a breathe, a sway) on an inner null as usual; only
  opacity needs the precomp wrapper. See `build-moneytransfer-status-scene-s5zh.mjs`
  for a working precomp-wrapped matte/hatch precedent this pattern extends.
- **Setting a layer's `a` (anchor) and `p` (position) to the SAME value is a
  hidden zero, not a placeholder.** The transform is `screenPoint = S·(local
  − a) + p`; when `a == p`, that reduces to `S·local + 0` — whatever value you
  chose cancels out of the formula regardless of what it is. A text layer
  built with `a: [0, baselineOffset, 0], p: [0, baselineOffset, 0]` (meant to
  push the baseline below the layer's local origin) actually renders with the
  baseline pinned at local `(0,0)` no matter what `baselineOffset` is — for a
  string with no descenders this reads as "ink floating in the top half of
  its container," a fidelity bug that survives changing the offset constant
  because the constant was never live. Fix: anchor at the point that should
  stay fixed under scale (often the layer's own local origin, `a: [0,0,0]`)
  and let POSITION alone carry the actual placement offset, held constant
  and independent of the anchor. Only set `a == p` when the intent really is
  "no net translation at rest."

## Vector Text Vertical Placement

Vector text has no line-height or auto-centering. You place every glyph by hand,
so compute the baseline from the font's cap height instead of eyeballing it.

- Derive cap height from the font, not a guessed number:
  `capEm = sCapHeight / unitsPerEm`, then `cap = capEm * size`. If the font lacks
  the metric, fall back to `capEm ≈ 0.7` (use x-height `≈ 0.52em` for all-lowercase
  runs).
- To vertically center a run in a container whose center is `cy`:
  `baseline = cy + cap / 2`.
- For a row holding two runs of different sizes (for example a small label and a
  large value), center each run on the shared center line using its **own** cap
  height. A shared baseline makes the smaller run sink below the larger one.

## Background Policy

- Full-frame standalone compositions should include a visible background layer
  with a `bgColor` slot and a `controls.json` entry.
- Transparent-by-default outputs include logos, icons, loaders, overlays, lower
  thirds, and SVG-derived assets unless the user asks for a background.
- Do not add an opaque rectangle just to fill the canvas.
- If a transparent animation needs preview contrast, use the player/canvas
  environment for verification instead of baking unwanted pixels into the JSON.

## Draw-ons And Animated Path Tracks

- **A keyframed path track holds its FIRST keyframe backwards in time.** A
  draw-on whose earliest path key is its pen-down stub therefore paints that
  stub from frame 0 — on stage, in chapters it does not belong to. This has
  shipped twice (a pen-start dot beside a clock; gleam bands over an earlier
  chapter). Gate the LAYER's own opacity 0→100 at the draw's start frame;
  the path track cannot express "not yet started".
- **A stroke-to-fill polygon can still be DRAWN like a pen.** Expanded thick
  strokes (mandatory for wide self-crossing scribbles — see
  svg-compatibility) cannot take a trim path, and revealing one behind a
  travelling band reads as a curtain, not handwriting. Keyframe the tube
  itself: emit the polygon truncated at pen-progress `p` with a CONSTANT
  vertex count (points past the pen collapse onto the pen position —
  Skottie's shape-interpolation contract), so its round end-cap IS the pen
  tip. Sample eased pen progress at linear times (one keyframe per step,
  ~16–20 steps), and pace the hand as an S-curve — a sharp-attack ease
  throws half the stroke down in a few frames and reads as a jump cut.
  Emit **s-only keyframes** (players interpolate to the next keyframe's `s`):
  carrying both `s` and `e` duplicates every polygon and nearly doubled a
  shipped file (measured −44% on removal).

## Export Compatibility — what survives leaving this player

Skottie is not the only renderer the scene must satisfy. The app's HTML export
replays the same JSON on **lottie-web**, and the mobile packs run it on
**ThorVG** (dotLottie). A technique that works only in the preview is not
shipped, and the defect surfaces at handoff, where it is most expensive.

- **Merge Paths (`ty:'mm'`) do NOT survive the HTML export.** The exporter's
  lottie-web compatibility pass has no translation for them, and lottie-web
  paints the *operand* shapes instead of the boolean result — a clip mask
  becomes a visible slab — on stage from frame 0 ("Draw-ons And Animated
  Path Tracks" above explains why). ThorVG lists Merge Paths unsupported too.
  Confirmed on a shipped scene whose ribbon gleam was clipped this way:
  correct in the preview, wrong in the exported HTML.
- **Reach for these instead, in order.** A **trim window on the target's own
  stroke** — a light travelling along a ribbon IS a moving trim window with
  round caps: inside the shape by construction, soft at both ends, and trim is
  the best-supported modifier in every runtime. Then a **track matte**
  (`td`/`tt`), which the export does handle. Then authored geometry.
- If a boolean op is genuinely unavoidable, the scene is preview-only — say so
  in its learnings doc rather than letting the export fail silently.

(`recipe-logo.md`'s Merge-Paths clip reveal and `svg-compatibility.md`'s
pairwise-order rules still describe the mechanic correctly; this section
governs whether to use it at all in anything the designer will export.)

## Verification

- Validate JSON before browser verification.
- Never record a frame as "verified" unless it was RENDERED and its pose read
  against expectation — a keyframe list that looks right can still describe a
  frozen beat, and a doc that names unrendered frames poisons later sessions.
- Confirm the scene appears in `/__context`.
- Inspect pinned frames in the browser. New scenes need frame `0`, midpoint, and
  `op - 1`.
- Fix blank canvas, missing assets, unstyled shapes, wrong layer order, bad
  easing, cropped content, text overflow, and SVG artifacts before finishing.

## Final Review Passes

Run lightweight render, design, and motion reviews before calling a scene
complete. First, midpoint, and final frames are the minimum still-frame check,
not a substitute for motion review.

- Render review: validate JSON, confirm `/__context`, verify assets load, and
  inspect pinned frames in the official player.
- Design review: inspect frame `0`, midpoint, `op - 1`, and any major semantic
  still. Check focal point, placement, spacing, hierarchy, typography, color
  roles, object necessity, and final-frame strength.
- Text alignment review: inspect text rows zoomed in, not only at full-frame. A
  few pixels of vertical misalignment are invisible at composition scale. Confirm
  that mixed-size runs sharing a row are cap-center aligned, that single runs are
  optically centered in their container, and that stacked blocks (such as a
  headline and its subline) follow an intentional vertical rhythm.
- Motion review: scrub playback and inspect key beat frames: frame `0`, early
  reveal, midpoint, settle or near-final, `op - 1`, loop seam if looping, and
  semantic beats where a number resolves, word lands, logo lockup forms, chart
  finishes drawing, CTA appears, or camera move settles.
- Check beat order, stagger origin, timing, easing, settle/hold, loop seam,
  camera/framing, and readability during motion.
- If design or motion review fails, simplify and revise before finishing. A
  valid render is not enough.
