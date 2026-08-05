# screen-change-beuf — How It's Animated

Two source SVGs — `screen-change-beuf.svg` (transfer processing) and
`screen-change-beuf-2.svg` (transfer confirmed) — become ONE continuous
375×812 mobile-screen composition at
`public/projects/screen-change-beuf/scene-1/lottie.json`, built by
`scripts/build-screen-change-beuf.mjs`. This is a **Grounded Handoff**
(see `references/chapterization-transition-grammar.md`) of an unusual kind:
the two "chapters" aren't really different scenes, they're the *same*
screen's chrome (status bar, header title, both clouds) with new content
(the mark, headline, sub-copy, close icon, confirm button) arriving on top —
so the handoff isn't a transition at all, it's "nothing rebuilds."

## Source quirk: the finished screen is duplicated in the file

`screen-change-beuf-2.svg` ships the confirmed screen **twice**, stacked and
perfectly overlapping — a plain `"Screen"` group, then a `"Screen_2"` group
(every id suffixed `_2`) whose own opaque white background sits on top and
hides the first copy entirely. Only `"Screen_2"`'s ids are used here; the
buried `"Screen"` copy — and its `"_Home Indicator"` group, which belongs to
that buried copy only — is never touched. **Always check whether a Figma
export duplicated the "final" state as a hidden layer before animating a
confirmation/success screen exported this way** — animating the buried copy
plays the whole scene under an opaque plate and nothing ever appears to
change.

## Shared-chrome layers, never rebuilt

`Group 13272`/`Group 48096320` (the two clouds) and the whole
`"âNavbar/Regular"` block (status bar icons + header title) are
**byte-identical path data** between the two source files — confirmed before
writing a line of the build script. They're built as ONE set of layers that
exists for the full 360-frame timeline; nothing about them is duplicated or
crossfaded between "screen 1" and "screen 2." The only genuinely new content
in the second file is: the ring+checkmark mark, the headline, the grey
sub-copy, the close (✕) icon, and the confirm button.

## Reusing the cloudscheck ring+checkmark rig

`Group 1000007566_2` (ring) / `Group 1000007567_2` (checkmark) in this SVG
are the **exact same artwork** as `cloudscheck`'s circle+checkmark — same
control-point x-coordinates, y-shifted by a constant +142px (a taller canvas,
same badge). See `docs/cloudscheck-reveal-animation.md` for the full
technique writeup (trim-path self-drawing strokes, preserving the gradient
stroke, sequencing the pen-down/pen-lift ink marks to their parent stroke's
stage). Two things confirmed fresh for this SVG rather than assumed from the
prior doc:

- **Both strokes are already authored in the wanted draw direction** — the
  ring's `d` starts at its right-side dot and sweeps clockwise through the
  bottom to the top; the checkmark's `d` starts at its top-right tip, through
  the vertex, up the short arm. Neither needed `reverseSubpath`. (Cloudscheck's
  checkmark *did* need reversing — always check per-path, never assume.)
- **The checkmark's own source gradient (`paint2`) is degenerate** (two
  identical `#22E243` stops), flattened to a flat stroke color, exactly like
  cloudscheck's checkmark. **The ring's gradient (`paint3`) is real**
  (`#22E243` → `#0A9F24` → `#22E243` at 20% alpha) and is carried through as a
  static `gs` gradient stroke — never animate its own stops/points, only the
  trim drawn over it.
- This SVG adds a mark the cloudscheck badge didn't have: the checkmark also
  gets its own pen-down ink accents (`Vector_17`/`Vector_18`, a blob + a small
  dot at its top-right start point) that must stay invisible until the
  checkmark's trim begins — handled with the identical pop-in-at-trim-start
  pattern already used for the ring's begin/end marks.

## Cloud wrap-around: constant velocity, instant jump while offscreen, eased landing

The brief's hardest requirement: clouds drift continuously right-to-left,
each "wrapping" off the left edge and back in from the right, completing a
**whole number of laps** (2 for the near/larger cloud, 1 for the
far/smaller one) so both land back on their exact native coordinates for the
final frame to match the source pixel-for-pixel. Skottie has no expressions/
modulo here, so the wrap is baked as explicit keyframes
(`buildWrapPoints` in the build script):

1. Pick an `EXIT` offset (cloud fully off-canvas-left, verified against the
   cloud's own bbox with a safety margin) and an `ENTER` offset (fully
   off-canvas-right, same margin check). `lapDistance = |EXIT| + ENTER`.
2. Walk `laps` cycles of: linear drift `0 → EXIT` (distance `|EXIT|`), an
   **instant 1-frame jump** `EXIT → ENTER` (both endpoints fully offscreen,
   so the reset renders nothing — the player only samples whole frames, so a
   1-frame-apart position jump never gets an in-between frame to sweep
   through), then linear drift `ENTER → 0` (distance `ENTER`).
3. Reserve a small `finalApproach` distance (50px here) off the very end of
   the total lap distance; once cumulative travel reaches
   `laps*lapDistance - finalApproach`, stop the linear segments and ease
   (`settleSoft`) the remaining short stretch into landing at **exactly**
   offset 0 — this is the brief's "real deceleration and weight" settle.
4. Both clouds share the same linear-phase end frame (188) but travel
   different total distances (2 laps vs 1, different per-cloud `lapDistance`)
   — so **dividing distance by a shared duration naturally gives the near
   cloud a faster constant velocity than the far one**, which is exactly the
   "nearer/larger travels faster" parallax the brief asked for, with no
   separate speed constant to hand-tune.

Because the wrap only needs a plain rectangular clip at the canvas edges (the
clouds' y-range never crosses the rounded-corner radius near the top/bottom),
correctness here doesn't depend on the outer rounded-rect mask — but see
below, the mask exists anyway for a different reason.

**Verification**: rendered the frames straddling every computed jump (e.g.
the near cloud's two jumps at ≈30 and ≈128) and confirmed nothing is visible
at either side of the 1-frame gap; rendered frame 0 against the settle-end
frame (230) and the final frame (359) to confirm the clouds are pixel-static
at native position from the settle onward.

## Whole-scene rounded-rect clip via precomp + matte

The brief requires the 375×812 canvas to keep its rx=40 rounded corners
"including behind the bottom white plate and the top navbar bar" — i.e. any
plain rectangle drawn on top (a navbar background, a bottom button-bar plate)
must not visually square off the corners. Rather than give every such layer
its own mask, the **entire scene is one precomp**, referenced by a single
root-level layer with `tt: 1` (alpha matte), matted by one root-level
rounded-rect shape layer with `td: true` directly above it — same technique
as `build-dataprocessing.mjs`'s badge-circle matte, just applied to the whole
composition instead of one gear cluster. (This build ended up not drawing the
redundant navbar/plate background rects at all — they're plain white on an
already-white canvas, so skipping them is simpler than masking them — but the
whole-scene matte is kept anyway since it's what correctly clips the cloud
wrap-around at the canvas edges too.)

## Figma inner-border button → plain rounded rect

The confirm button's outline in the source is a Figma "inner border" export:
a `<mask>` cut from a rect, applied to a self-intersecting outline path. Per
the brief's own fallback, this was rebuilt directly as a 240×60 rounded rect
(`r: 30`) at `x=67.5, y=692` with a white fill and a 2px `#222222` stroke —
confirmed geometrically identical to the source mask's rect bounds. Cheaper
and more robust than fighting the mask, and pixel-identical once rendered.

## Extracting the long text-glyph paths at build time, not by hand

The headline (`"Transfer is on its way_2"`, ~21k characters) and sub-copy
(`"Text_3"`, ~51k characters) compound paths are far too large to safely
hand-transcribe into a `SVG_PATHS` constant — a single mistyped digit in a
50k-character path is effectively undetectable by eye. Instead the build
script reads the raw SVG files with `fs.readFileSync` and pulls each `d`
attribute out by its `id` with a small regex
(`extractPathD(svg, id)`) at build time. **Reach for this whenever a source
path is large enough that manual transcription is a real transcription-error
risk** — small geometric paths (clouds, icons, marks) are still safely
hand-copied into `SVG_PATHS` as in every other build script here, but a
multi-kilobyte text/letterform path should be parsed straight from the file.

## Beat 4: staggered fade + 8px rise, anchor-safe

Close icon + headline (together), sub-copy (+7f ≈ 120ms @ 60fps), and the
confirm button (+7f more) each fade in (`settleSoft`) while rising 8px, using
the safe anchor-`[0,0,0]` + animated-position combo (never a non-zero anchor
with animated position — that's the standing freeze bug in this player).
`animProp`'s `ensureStartsAtZero` auto-inserts a held `t:0` keyframe at each
item's own starting value, so a group whose first authored keyframe is at
frame 276 is correctly invisible (opacity 0, offset +8px) for the entire
0–276 span with no extra bookkeeping.
