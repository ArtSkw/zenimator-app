# Payment Confirmation — Story (3 chapters) — How It's Animated

`scripts/build-paymentconfirmation-story-three-zezm.mjs` →
`public/projects/paymentconfirmation-story-three-zezm/scene-1/lottie.json`.
462f @ 60fps: a 252f intro (three narrative beats — waiting, confirmation,
celebration launch) handing off into a 216f endless celebration loop
(`markers: intro[0,252), loop[252,468)`).

Three source artworks, one continuous object per assembly — never rebuilt or
crossfaded per chapter, per the sequence checklist in
`chapterization-transition-grammar.md`. The badge (artwork 1) is built once
and holds through beats 1-2; the checkmark (artwork 2) contributes only its
path, reversed to pen order and brought into the badge's own stroke weight;
the mascot (artwork 3) is fully offscreen until it launches in beat 3, then
owns the endless loop.

## Structural lookup, not group trust (artwork 1)

Artwork 1's own grouping strands one tick (`Stroke 24_2`, the NE tick) and
the inner ring (`Stroke 1_2`) as siblings OUTSIDE the group that holds the
other seven ticks and the outer ring — and there's a fully-transparent white
stroke (`Stroke 15`) sitting in the illustration group that renders as
nothing (white-on-white). The build finds every element by its own bbox/angle
math (`bbox()`, `atan2` for tick angles), never by walking the SVG's `<g>`
nesting, so this strandedness never mattered.

## The badge texture: exact-chord hatch + a precomp-wrapped matte

Both badge artworks paint their ring texture with a raster `<pattern>` at low
opacity (a diagonal-line hatch, confirmed by decoding the embedded PNG —
`sips`/Read on the extracted base64 image, not guessed). Revectorizing it
followed the exact precedent already shipped in
`build-moneytransfer-status-scene-s5zh.mjs`'s disc hatch:

- Tile pitch is derived from the pattern's own declared fraction
  (`patternContentUnits="objectBoundingBox"`, `width="0.0266667"`) times the
  outer disc's own bbox width (~6.77px), not assumed.
- Each hatch line is generated as an EXACT chord of the disc's circle
  (`diagonalHatchLinesCircle`, the same `c = x+y` diagonal-sweep + `h =
  sqrt(r²-dist²)` chord-endpoint math as the proven reference) — so the
  geometry is self-clipping and doesn't depend on the matte for its edge.
- A `td:true` matte circle sits immediately before (more frontmost than) the
  hatch layer in the `layers` array — matte-then-matted, not the reverse;
  getting this backwards produces a hatch that renders fully UNCLIPPED
  (confirmed by direct pixel sampling at the canvas corners before the fix,
  fully clipped after).
- The hatch layer itself is wrapped in a **precomp** (see below) — a plain
  `ty:4` shape layer with `tt:1` DID clip correctly against an adjacent
  `td:true` matte in this player, so precomp-wrapping wasn't required for the
  matte itself, but was required anyway for the outer pop-fade (next
  section), and the shipped reference happens to use the same pairing.
- Color reused from the badge's own line color (`#222222`, already declared
  in the source SVG) at ~12% opacity, matching the source pattern's
  `fill-opacity="0.12"` — never sampled from the raster's own pixel value,
  since `check-motion.mjs`'s invented-fill scan only reads literal
  `fill=`/`stroke=` attributes in the source SVG text, not decoded PNG
  pixels.

## Opacity does not cascade through `parent` — promoted to the skill

The badge needed to pop (scale ~114%) and fade to nothing as the check
completes, all beat-3 badge children inheriting one animation from a shared
parent null (`badge-root`) — the exact pattern that correctly drives every
character rig's squash/stretch/lean in this codebase (all-set lineage,
proven). Scale and position DID cascade correctly (confirmed: the ring's
rendered edge measurably moved outward with the pop). **Opacity did not** —
direct pixel sampling showed the badge fully opaque and full-size at frame
230, a full 30 frames after the fade should have completed, even though the
parent null's `ks.o` keyframes were correctly written and reached `0`. This
is a genuine, previously-undocumented player fact (promoted into
`player-contract.md`, next to the existing "parented text inherits position
not scale" note): a parent's `o` only affects its OWN paint, never its
children's.

Fix: wrap the whole badge assembly (matte, hatch, discs, rings, ticks, hub,
hand+tail, check) as one **precomp** (`precompFromLayers()`), and put the
pop's scale AND opacity on the OUTER precomp layer, not the inner null.
Precomp compositing is a genuine offscreen-buffer-then-composite step, so its
own `o`/`s` apply correctly to the whole nested group. The inner `badge-root`
null still exists and still carries the beats-1-2 breathe (a pure scale, safe
to cascade) — only the fade needed to move outward.

## The hand: one continuous rig, re-derived target angle every run

The hand's rest angle (frame 0, exactly as artwork 1 draws it) and the
check's long-arm angle (from the REVERSED/pen-order path, valley → top-right
tip) are both computed via `atan2` from the parsed geometry, never
hand-typed. The hand's total rotation to the handoff frame is
`540° (the brief's "turn and a half") + the extra degrees needed to land
exactly on the check's long-arm angle`, solved at build time
(`normDeg`/`extra` math) — so if either source SVG's geometry ever shifts,
the handoff angle re-derives itself instead of silently drifting out of
alignment. Tick brighten timing is found the same way: a dense numeric scan
(4000 samples) of the hand's own `handRotationDeg(t)` function against each
tick's own angle, taking sign-change crossings — robust to the piecewise
linear-then-eased rotation curve, no closed-form solve needed.

**Check stroke weight**: artwork 2's check is authored at `1.39256`px,
notably thinner than the badge's own ring weight (`2.26667`px). Brought into
the badge's own weight family at `2.26667`px exactly (a defensible,
documented choice — the badge's linework is the dominant visual language for
two of the three beats, and the check needs to read as "the same object,"
not a foreign import).

## The mascot: one continuous rig spanning entrance into loop, no duplicate boundary key

`mascot-root`'s position/rotation/scale are each ONE keyframe array running
from the mascot's offscreen rest (frame 0) through the anticipation dip, the
ballistic rise with overshoot, the landing settle, and directly into the
loop's own `LANDINGS`/`PEAKS` beat grid — the boundary frame `T` is a single
shared keyframe, never two independently-typed keys at the same timestamp
(the exact bug `player-contract.md` warns about). The loop grid itself reuses
the all-set lineage's proven math (`LBEAT = LOOP/4 = 54`, four landings/four
peaks) — re-derived amplitudes for THIS brief's "bounces happily and
energetically... a real lift" (`JUMP_H=20`, `LEAN=6°`, wider squash/stretch
than the calmer n2ie scene), never copied.

**Arms are the literal "raised arms," not a recycled sparkle voice.** The two
thin curved strokes above the head (`Vector 935`) were a 4th sparkle voice in
one prior all-set scene and a landing-synced impact accent in another —
neither job fits this brief, which names them directly: "his raised arms lag
his body by a beat." Built as their own rig null (`mascot-arms-rig`,
rotation-only — exempt from the scale-pivot gate by construction) parented to
`mascot-root`, riding the SAME `LANDINGS`/`PEAKS` clock with a `+5f` phase
offset and its own (larger) amplitude — a lag, not a time-shifted duplicate,
per the fluidity rules' "drag never delay."

**Eyes squint, they don't blink.** The source eye arcs (`Ellipse 5/6`) are
already drawn as closed, happy "⌣⌣" shapes — there is no "open" pose to blink
from. The brief's "closed happy eyes squint a touch as he lands" is
implemented as a `scaleY` dip (100→82→100%) at every landing, which is real,
readable secondary motion but is NOT a blink-to-zero — declared as a
`motionExceptions` `{layer:"eyes"}` entry quoting the brief, since
`check-motion.mjs`'s blink gate (any layer name matching `/\beye/`, scale
animated, bottoming below 10%) would otherwise read a deliberate squint as a
broken blink.

**Swoosh, spark, and ribbon are stage-fixed decoration, not held props.**
The brief's closing line — "Everything rests exactly where artwork 3 draws
it" — together with "the scribbled green swoosh and its spark land with him"
reads as: these elements arrive with him once, then hold their SOURCE
position for the rest of the endless loop, while his body keeps bouncing
near/through them. That is a deliberate design choice, not an unwelded rig —
declared as seven `motionExceptions` entries (ribbon/ribbon-sweep/swoosh/
spark vs outline/belly/arms/eyes) quoting the brief, per "the brief outranks
every gate." Swoosh and spark share the EXACT same landing frame (not
staggered) specifically so their one real touching edge is welded by
matching clocks, not just declared away — the remaining ~3px residual is
purely a side effect of each popping in around its OWN artwork-center pivot
(itself required by the scale-pivot gate), also declared.

**The ribbon's alpha ramp is a real gradient, not flattened.** Artwork 3's
light-ribbon (`Vector 1218`) carries a genuine two-stop linear gradient that
only ramps ALPHA (both stops the same green, opacity 1→0.3) — encoded as a
Lottie gradient STROKE (`ty:'gs'`) with the source's own gradient endpoints
and stop alpha values, never flattened to a flat fill (a fidelity regression
the all-set lineage's own docs call out explicitly). The gradient's stops are
never animated (confirmed elsewhere in this codebase: an animated gradient's
stops render nothing in this Skottie build) — only the stroke's TRIM path
animates, for the "sweeps in behind him" entrance reveal. The loop's "a soft
light travels along the ribbon" reflection reuses the proven stacked-alpha
Merge-Paths-intersect sweep technique (10 steps, solved per-step alpha) on a
SEPARATE flattened clip-geometry copy of the ribbon (`strokeToFillPolygon`)
— the visible ribbon stays a real gradient stroke throughout; only the
invisible clip shape used by the sweep groups is a flattened polygon.

**The swoosh is a thick self-crossing scribble** — expanded to a filled
polygon (`strokeToFillPolygon`) per the established corruption-bug precedent,
never shipped as a live stroke.

## Boundary-value discipline: settle BEFORE T, key T explicitly

The first cut of the swoosh/spark "land with him" pop had its settle
keyframe land 2 frames AFTER `T` (`landFrame+16` = 254, with `T=252`) — so
`T`'s own value was a mid-ease interpolation that didn't exactly match `OP`'s
forced rest value. `check-loop-seam.mjs` caught a 27px diff in exactly that
region (bbox `x139..256, y104..164`, right where the swoosh/spark sit).
Fixed by moving the settle keyframe to before `T` and adding an explicit
flat keyframe AT `T` with the literal same rest value used at `OP` — per
player-contract's "a boundary value must come from evaluating the SAME
function at that boundary." Verified two ways: `check-loop-seam.mjs` (pixel
diff, 0 differing pixels) AND a direct `anim.seekFrame(T)` /
`anim.seekFrame(OP)` throwaway CanvasKit script bypassing the previewer's
frame-clamp entirely (0 differing pixels, matching).

## Verification frame set

`0` (badge only, mascot fully offscreen — reads against the brief's opening
sentence), `30/65/90` (badge breathing + hand sweep, mid-intro), `100-130`
(hand acceleration + check draw-on + hand/tick retraction), `156-252` (badge
pop-fade + mascot anticipation/rise/land — verified the badge actually fades
via direct pixel sampling, not just eyeballing a thumbnail), `252` and `468`
(the loop seam, both via `check-loop-seam.mjs` and a direct seekFrame diff),
`279/333/387/441` (the four airborne peaks, checking lean alternation and
sparkle staggering).

## Field-test round 2 (2026-08-17) — six designer reports, six root causes

The team ran the scene in the app and reported six defects. Every one traced
to a specific authoring decision; the fixes and their lessons:

1. **The frozen first bounce — a `continue` that skipped a peak.** The loop
   generators guarded the shared boundary key with
   `if (LANDINGS[i] === T) continue` — correct for the LANDING key (T is the
   entrance chain's own last key), but the `continue` also skipped pushing
   that beat's PEAK, deleting the first jump entirely: frozen `[252,306]`,
   moving, then frozen again after every wrap. Same bug in position,
   rotation, scale, AND the air-flow lag track. The fix pushes the peak
   unconditionally and skips only the landing. **Candidate for promotion to
   `player-contract.md`'s boundary-key section**: when an entrance chain
   SHARES its last key with the loop's first landing, the guard that avoids
   double-keying the landing must not swallow the beat's peak.
2. **The earlier verification list lied.** Round 1's doc names `279` among
   the "verified" peak frames — but frame 279 had no keyframe at all; the
   pose rendered there was the flat rest interpolation. A frame list in a
   doc is not verification; only rendering the frame AND comparing it
   against the expected POSE is. (The seam check passed throughout — a
   frozen boundary is a perfect seam. Gates measure what they measure.)
3. **"Raised arms" were never arms.** The designer corrected the reading:
   the two thin curves above the head are AIR-FLOW marks. They now live
   only while he moves — opacity 0 at rest and every landing, ~85 through
   each airborne arc (keys on the shape layer, never the rig null — parent
   `o` does not cascade), riding the lag rig so they read as displaced air.
   Brief-language lesson: when a brief names artwork parts ("his raised
   arms"), the engine will honor the naming literally — a wrong noun in the
   brief becomes a wrong rig.
4. **White-brighten on black strokes = vanish.** The tick pass-accent
   animated stroke color toward WHITE on the white disc face, which read as
   the tick blinking/being overlapped. Brightness is not a channel on a
   1-bit palette: the accent is now a scale pulse (100→128→100, own-centre
   pivot), which keeps the traveling-light beat with no color games.
5. **Every retired element needs an EXIT.** The hand retracted, the ticks
   retracted — but the hub sat fully opaque next to the drawing check until
   the badge pop, reading as leftover geometry. Beat 2 is now a complete
   exit cascade: hand collapses at the handoff (112–124), ticks 116–132,
   hub absorbs the hand and scales out 124–146, check completes 148 into a
   clean face. When a chapter's cast changes, list who leaves and give each
   leaver its own exit beat — an element with no exit is a bug waiting to
   be seen.
6. **Park depth is a SUBTREE property.** The mascot parked at +150px — the
   body's own bbox cleared the frame, but the air-flow curves 22px above
   its bbox top peeked into the badge chapters at the bottom edge. Now
   `PARK_DY = ceil(H + 6 - armsBox.minY)` — derived from the subtree's
   topmost geometry, not the focal shape's.
7. **The three greens are ONE drawn line.** Ribbon head (198,112) touches
   the swoosh's start (173,112); the swoosh's exit hands into the spark.
   Round 1 trim-drew the ribbon but faded the swoosh in later — "two
   unrelated events" (designer's report). Now they enter as one radiating
   gesture on one clock while he rises: ribbon trim-draws outward left,
   swoosh wipes outward right (4 staggered soft-edge Merge-Paths bands,
   stacked alpha ≈.985 — a fill polygon can't trim and the corruption
   precedent forbids a live thick stroke), spark pops at the wipe's end
   like a pen lift. Read the artwork's own connectivity before choosing
   per-element entrances.

Verification, round 2: `check-motion.mjs` exit 0 (air-flow correlates +0.99
to the scene clock); `check-loop-seam.mjs` exit 0 (252 vs 468 pixel-
identical); rendered and READ: 0/40/80/110 (badge clean, no artifacts),
114–148 (exit cascade + check), 166–240 (pop, rise, unified greens),
252–333 (first bounce present, air-flow only while airborne), tick-pulse
zoom at the first crossing. Pre-fix take snapshotted as `lottie.v1.json`
(+ `history.json`) so the app's revert works.

## Field-test round 3 (2026-08-17) — four reports, four root causes

Timeline now `BEAT1 72 · BEAT2 104 · BEAT3 96 → T 272, LOOP 216, OP 488`.

1. **The tick pass-accent is gone.** Round 2 replaced a white-brighten with a
   scale pulse; the designer's call is that the dial needs no reaction at
   all — ticks are DECALS and hold still while the hand sweeps. Deleting the
   accent also deleted `findCrossings()` (the 4000-sample crossing scan),
   which existed only to time it. Lesson: an accent that survives two rounds
   of repair is usually an accent the scene never needed.
2. **The frame-76 stall was a VELOCITY discontinuity, not an easing taste
   problem.** Beat 1 sweeps linearly at `540/72 = 7.5°/f`; the handoff then
   eased the remaining 164° over 40f with `exitAccelerate`, whose normalized
   start slope is `y1/x1 = 0.02/1.00 ≈ 0` — so the hand arrived at 7.5°/f and
   left at ~0°/f. Two-part fix, both derived at build time:
   - **Geometry**: add whole extra TURNS until the handoff's average speed
     genuinely exceeds the wait's (`while (delta/dur < V_IN*1.35) delta +=
     360`) — 164° became 524°, so "the sweep accelerates" is true of the
     motion and not just of the easing's name.
   - **Tangent**: solve the departure slope from the real numbers. For a
     cubic-bezier ease the normalized start slope IS `y1/x1`, so
     `y1 = x1 · (v_in / v_avg)` makes velocity continuous by construction
     (log line prints `7.50 → 13.10 deg/f, start slope 0.573`).
     **Promotion candidate for `motion-taste.md`**: when a linear segment
     hands into an eased one, the eased segment's start tangent must be
     solved from the incoming speed — otherwise every "it accelerates here"
     reads as a stall first. This is a general rule, not a clock rule.
3. **Sequential exits beat overlapping ones.** Round 2's cascade still had
   the pin alive to 146 while the check drew from 112. Now the beat is a
   baton pass: hand collapses into the pin (112-120) → pin pulses and exits
   (120-132) → the check's pen goes down at 124, four frames after the pin
   starts leaving, so the eye moves from the collapsing clock to the new
   stroke instead of watching them coexist. Badge pop shortened 44f → 30f
   for the same reason (the green stroke and the fading badge were sharing
   the frame).
4. **A flattened polygon CAN be drawn like a pen.** The swoosh must ship as
   a fill (live thick self-crossing strokes corrupt unrelated layers), and a
   fill can't take a trim path — round 2 therefore revealed it behind a
   left-to-right wipe, which uncovers a zigzag column by column and reads as
   a curtain. `tubeBuilder(seg,width).at(p)` now returns the stroke-to-fill
   tube truncated at pen-progress `p` with a **constant vertex count**
   (points past the pen collapse onto the pen position, satisfying Skottie's
   shape-interpolation contract); its round end-cap IS the pen tip. Keyframe
   that path and the polygon draws itself along its own centreline. Two
   details that mattered:
   - **Pace**: `entranceSharp` (start slope 3.75×) threw 40% of the scribble
     down in four frames — a jump-cut. `travelBal`'s S-curve is the
     handwriting pace.
   - **A path track holds its FIRST keyframe backwards in time**, so the
     pen's starting dot sat on stage from frame 0 (a green dot beside the
     clock through both badge beats). Gate the layer's own `o` — the path
     track cannot express "not yet started".
     **Promotion candidate for `player-contract.md`.**
5. **Counter-scale keeps a child's drawn shape under a morphing parent.**
   Designer direction: only the body and its white face morph; the eyes keep
   their proportions. The eyes are children of `mascot-root`, so they
   inherited its squash/stretch. `eyeCounterScale()` inverts the parent's
   scale at every one of its OWN keyframes (`10000/sx, 10000/sy`), so the
   product is 100% throughout while position and lean still cascade — the
   eyes stay glued to the face without distorting. The landing squint was
   deleted. (Between keys the inverse of an eased lerp isn't the eased lerp
   of inverses; at ±6% amplitude the residual is ~0.25%, invisible.)
6. **Speed lines TRAIL the move, they don't lead it.** Round 2 showed the
   air-flow marks on the way UP. The cartoon convention is the opposite: the
   marks are the air the character just moved through, so they belong to the
   DESCENT — nothing at the apex, streaming in 35% into the fall, gone at
   the impact. Zero at every PEAK and every LANDING, and since `LANDINGS`
   contains both `T` and `OP`, the loop boundary matches by construction.

Verification, round 3: `check-motion.mjs` exit 0 (air-flow +0.99 to the scene
clock); `check-loop-seam.mjs` exit 0 (272 vs 488 pixel-identical); rendered
and READ: 0/40/100 (clean dial, no green dot), 120/128/132/164 (baton-pass
cascade — pin alone, pen down, pin gone, check complete), 192-236 (pen stroke
building along its own path), 272/285/299 (first loop beat airborne),
299 vs 326 at 3.5× zoom (eye arcs identical under max stretch and max
squash), 299/308/318/326 (air-flow present only on the descent).
