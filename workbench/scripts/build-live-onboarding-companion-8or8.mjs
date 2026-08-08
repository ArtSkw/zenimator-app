#!/usr/bin/env node
/**
 * Generates the INTRO+LOOP Lottie for "live-onboarding-companion-8or8.svg" —
 * a live onboarding companion: zenek mid double-bicep flex ("the pump"),
 * arms squeezing up and inward into a deeper flex with a brief proud
 * isometric quiver at the peak, while a speech bubble pops in once, over an
 * idle that is ALREADY RUNNING when the scene starts.
 *
 * Same rig FAMILY as the other live-onboarding-companion-* builds (round
 * dark body, white face, two closed happy-arc eyes, dark flexed-arm groups
 * ending in fists with white muscle-highlight strokes) but a DIFFERENT
 * source pose (already double-bicep-flexed) and a unique element this
 * family hasn't shipped before: the ground shadow is filled with a raster
 * <pattern> (an embedded base64 PNG tiled ~2.7x across the shadow ellipse),
 * not a flat color. Per svg-compatibility.md "never flatten a pattern fill
 * to a solid": the shadow ellipse is too small/photographic-looking a
 * texture to revectorize faithfully as a hatch, and it only ever moves as
 * ONE piece (a uniform width/height scale, never rotates or scales
 * independently) — so this uses svg-compatibility's documented FALLBACK:
 * decode the embedded PNG to a real image asset at build time, tile it
 * across the shadow ellipse's bbox at the pattern's own authored tile size
 * (derived from the SVG's patternContentUnits fractions, not guessed), and
 * clip each tile to the ellipse silhouette with a per-layer MASK (simpler
 * than a track-matte here since each tile needs its own translated clip
 * path and masks don't require array adjacency).
 *
 * Source SVG groups mapped to layers (ids read live from the SVG at build
 * time via tagById()/pathD(), never hand-transcribed, to keep the long path
 * strings byte-exact):
 *  - "âTooltip/Compact" rect -> bubble plate (rc primitive, slotted size)
 *  - baked "font" glyph path -> REPLACED with a native ty:5 text layer
 *    (slot bubble.text), per recipe-companion-bubble.md
 *  - Ellipse 2421 (r4, nearest mouth) / Ellipse 2420 (r8) -> the two trail
 *    circles; smallest pops first (recipe convention).
 *  - "body" (raster-pattern-filled ellipse) -> the ground shadow.
 *  - "Vector" (white) -> the round background blob behind the body.
 *  - "Union" / "Union_2" (white) -> the two arm cutouts in the background
 *    blob (the wedge each dark arm sits in front of).
 *  - "Group 1000007121" (dark, right side) -> the RIGHT flexed arm:
 *      Ellipse 486 = forearm/blob mass, Ellipse 488 = upper-arm/bicep mass,
 *      Ellipse 489 = shoulder cap, Ellipse 487 = the FIST (a circle — the
 *      classic clenched-fist read), Ellipse 490/491 = white muscle-
 *      highlight strokes.
 *  - "Group 1000007122" (dark, left side) -> the LEFT flexed arm, same
 *      part roles with "_2" suffixes; Ellipse 487_2's circle carries a
 *      `matrix(...)` transform (a rotation+reflection of unit scale, from
 *      mirroring the right arm) — applied programmatically to its center,
 *      not hand-computed, since a pure-rotation/reflection matrix keeps a
 *      circle a circle (only its center moves).
 *  - "zenek" group -> the round body: Vector_2 (dark body), Vector_3
 *      (white face patch), Vector 804 / Vector 805 (the two closed
 *      happy-arc eyes, open stroked curves).
 *
 * MOTION — "the pump" (one cycle): a single SQUEEZE envelope (waypointCurve,
 * true stop-to-stop waypoints per motion-taste.md "Bake smooth, not
 * stepped") drives every dependent track, so the whole cast peaks and
 * releases in the same coherent motion system rather than N hand-authored
 * curves that could drift apart:
 *  - arm-rig (both sides, mirrored): position pulls up+inward with a small
 *    Lissajous-style X/Y phase offset (so the pivot traces a genuine arc,
 *    not a straight line — motion-taste.md's Fluidity "organic motion
 *    travels in arcs") plus a few degrees of extra flex rotation, pivoted
 *    at each arm's own body-side edge (the character-rig "pivot at the
 *    base" idiom, derived from the parsed geometry's own bbox).
 *  - fist-right/fist-left: their own extra own-center scale bump at the
 *    peak ("fists tighten fractionally").
 *  - a brief 1.4px isometric QUIVER (a windowed high-frequency wobble)
 *    layered on top of the arm position, active only during the squeeze's
 *    short hold plateau — the loop's snappy accent.
 *  - zenek-body / zenek-face: a silhouette squash/bulge (motion-taste
 *    "Living idles — the silhouette breathes") driven by `1 - squeeze`
 *    (counter-phase to the arms, per the brief) — chest reads fuller at
 *    rest, pulls in as the arms flex hardest.
 *  - eye-left/eye-right: the SAME 2-vertex stroked arcs, handles scaled up
 *    toward the peak (no new vertices, same count/order) — reads as the
 *    happy-arc eyes squeezing into a deeper closed-eye blink, released with
 *    the arms.
 *  - shadow-rig: a small width/height scale, peaking opposite the squeeze
 *    ("the shadow widens slightly as the body settles").
 * Squeeze is a pure function of `t % IDLE`, so it's alive for every frame
 * from 0 to op by construction — no echo/tileForward bookkeeping needed —
 * and the seam is exact because op = T + IDLE means op % IDLE === T % IDLE
 * for any T (verified by pixel diff, see the learnings doc).
 *
 * Output: public/projects/live-onboarding-companion-8or8/scene-1/lottie.json
 */
import { writeFileSync, mkdirSync, copyFileSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../public/projects/live-onboarding-companion-8or8/scene-1')
const OUT = join(OUT_DIR, 'lottie.json')

const W = 240, H = 240, FPS = 60
const T = 54           // 0.9s intro — punchy, "more snap than a calm scene"
const IDLE = 144        // 2.4s idle — one pump per cycle
const OP = T + IDLE      // 198 total — exactly one idle cycle after T

// ── Read the source SVG once; pull ids/paths live so long path strings are
// byte-exact (never hand-transcribed) ───────────────────────────────────────
const SVG_SRC = readFileSync(join(__dirname, '../assets/live-onboarding-companion-8or8.svg'), 'utf8')
function tagById(id) {
  const needle = `id="${id}"`
  const idx = SVG_SRC.indexOf(needle)
  if (idx < 0) throw new Error(`id not found in source SVG: ${id}`)
  const tagStart = SVG_SRC.lastIndexOf('<', idx)
  const tagEnd = SVG_SRC.indexOf('>', idx)
  return SVG_SRC.slice(tagStart, tagEnd + 1)
}
function attr(tag, name) {
  // Word-boundary anchored: a bare `name="..."` regex would also match
  // inside a LONGER attribute that happens to end with the same letters
  // (e.g. `d="..."` matching inside `id="..."`, `x="..."` matching inside
  // `rx="..."`) — require the character before the name to be whitespace
  // or the tag start.
  const m = tag.match(new RegExp('(?:^|\\s)' + name + '="([^"]*)"'))
  return m ? m[1] : null
}
function pathD(id) { const d = attr(tagById(id), 'd'); if (!d) throw new Error(`no d= on ${id}`); return d }
function numAttr(tag, name) { return parseFloat(attr(tag, name)) }
function circleOf(id) { const t = tagById(id); return { cx: numAttr(t, 'cx'), cy: numAttr(t, 'cy'), r: numAttr(t, 'r') } }

const rectTag = SVG_SRC.match(/<rect x="[^"]*" y="[^"]*" width="[^"]*" height="[^"]*" rx="[^"]*"[^>]*\/>/)[0]
const TOOLTIP_RECT = { x: numAttr(rectTag, 'x'), y: numAttr(rectTag, 'y'), w: numAttr(rectTag, 'width'), h: numAttr(rectTag, 'height'), rx: numAttr(rectTag, 'rx') }

const TRAIL_LARGE_SRC = circleOf('Ellipse 2420') // r8
const TRAIL_SMALL_SRC = circleOf('Ellipse 2421') // r4

const D = {
  shadow: pathD('body'),
  bgBlob: pathD('Vector'),
  cutoutLeft: pathD('Union'),
  cutoutRight: pathD('Union_2'),
  rArmBlob: pathD('Ellipse 486'),
  rArmBicep: pathD('Ellipse 488'),
  rArmShoulder: pathD('Ellipse 489'),
  rArmHiliteA: pathD('Ellipse 490'),
  rArmHiliteB: pathD('Ellipse 491'),
  lArmBlob: pathD('Ellipse 486_2'),
  lArmBicep: pathD('Ellipse 488_2'),
  lArmShoulder: pathD('Ellipse 489_2'),
  lArmHiliteA: pathD('Ellipse 490_2'),
  lArmHiliteB: pathD('Ellipse 491_2'),
  bodyDark: pathD('Vector_2'),
  bodyFace: pathD('Vector_3'),
  eyeLeft: pathD('Vector 804'),
  eyeRight: pathD('Vector 805'),
}
const R_KNUCKLE_SRC = circleOf('Ellipse 487') // simple rotate-about-own-center transform, ignored (no-op on a circle)
const L_KNUCKLE_LOCAL = circleOf('Ellipse 487_2')
const L_KNUCKLE_MATRIX = (() => {
  const t = tagById('Ellipse 487_2')
  const m = attr(t, 'transform').match(/matrix\(([^)]+)\)/)[1].trim().split(/[\s,]+/).map(Number)
  return m // [a,b,c,d,e,f]
})()

// ── Pattern shadow: raster fallback (svg-compatibility.md "Masks, Clips,
// Gradients, Patterns" — rasterize + clip, since the motif is a photographic
// texture too intricate to revectorize and it only ever moves as one piece).
// Tile size is DERIVED from the pattern's own authored fractions (never
// guessed): patternContentUnits="objectBoundingBox" means width/height on
// the <pattern> are fractions of the shadow ellipse's OWN bbox.
// ============================================================
const patternTag = tagById('pattern0_5390_69337')
const PATTERN_FRAC_W = numAttr(patternTag, 'width')
const PATTERN_FRAC_H = numAttr(patternTag, 'height')
const imageTag = tagById('image0_5390_69337')
const IMAGE_NATIVE_W = numAttr(imageTag, 'width')
const IMAGE_NATIVE_H = numAttr(imageTag, 'height')
const IMAGE_B64 = attr(imageTag, 'xlink:href').replace(/^data:image\/png;base64,/, '')

// ── SVG path -> Lottie bezier (house parser, unchanged across scripts) ─────
function parsePath(d) {
  const RE = /([MLHVCZmlhvcz])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g
  const tokens = []
  let m
  while ((m = RE.exec(d))) tokens.push(m[1] ? { c: m[1] } : { n: parseFloat(m[2]) })
  let i = 0
  const nums = (n) => { const out = []; for (let k = 0; k < n; k++) out.push(tokens[i++].n); return out }
  const subpaths = []
  let cur = null, cx = 0, cy = 0, sx = 0, sy = 0, lastCmd = null
  const pushVert = (x, y) => cur.verts.push({ pt: [x, y], in: [0, 0], out: [0, 0] })
  const setOutOfLast = (ox, oy) => {
    const v = cur.verts[cur.verts.length - 1]
    v.out = [ox - v.pt[0], oy - v.pt[1]]
  }
  while (i < tokens.length) {
    const tok = tokens[i]
    let cmd
    if (tok.c) { cmd = tok.c; i++; lastCmd = cmd } else cmd = lastCmd === 'M' ? 'L' : lastCmd
    switch (cmd) {
      case 'M': { if (cur) subpaths.push(finish(cur)); const [x, y] = nums(2); cur = { verts: [], closed: false }; pushVert(x, y); cx = x; cy = y; sx = x; sy = y; break }
      case 'L': { const [x, y] = nums(2); pushVert(x, y); cx = x; cy = y; break }
      case 'H': { const [x] = nums(1); pushVert(x, cy); cx = x; break }
      case 'V': { const [y] = nums(1); pushVert(cx, y); cy = y; break }
      case 'C': {
        const [x1, y1, x2, y2, x, y] = nums(6)
        setOutOfLast(x1, y1)
        cur.verts.push({ pt: [x, y], in: [x2 - x, y2 - y], out: [0, 0] })
        cx = x; cy = y; break
      }
      case 'Z': case 'z': {
        cur.closed = true
        const first = cur.verts[0], last = cur.verts[cur.verts.length - 1]
        if (cur.verts.length > 1) {
          const dx = last.pt[0] - first.pt[0], dy = last.pt[1] - first.pt[1]
          if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) { first.in = last.in; cur.verts.pop() }
        }
        cx = sx; cy = sy; break
      }
      default: throw new Error('Unhandled command ' + cmd)
    }
  }
  if (cur) subpaths.push(finish(cur))
  function finish(c) { return { closed: c.closed, v: c.verts.map((x) => x.pt), i: c.verts.map((x) => x.in), o: c.verts.map((x) => x.out) } }
  return subpaths
}

// ── Lottie builder helpers (house pattern) ──────────────────────────────────
const hexToRgb1 = (hex) => {
  hex = hex.replace('#', '')
  return [parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255]
}
const EASE = {
  linear: [0, 0, 1, 1],
  entranceSharp: [0.20, 0.75, 0.34, 0.94],
  settleSoft: [0.00, 0.65, 0.51, 0.99],
}
function kf(t, value, easeOut, hold) {
  const k = { t, s: Array.isArray(value) ? value : [value] }
  if (hold) k.h = 1
  else if (easeOut) { const [x1, y1, x2, y2] = easeOut; k.o = { x: [x1], y: [y1] }; k.i = { x: [x2], y: [y2] } }
  return k
}
function animProp(points) {
  const keys = points.map((p, idx) => {
    const isLast = idx === points.length - 1
    return kf(p.t, p.v, isLast ? null : (EASE[p.ease] || EASE.linear), p.hold)
  })
  return { a: 1, k: keys }
}
// motion-taste.md "Living idles — key exactly on the loop boundaries": force
// an explicit keyframe AT T and AT op with equal values on one-shot tracks
// that settle before T (so the required hold shows up as a real key, not
// only as Skottie's implicit "hold after last keyframe" behavior).
function keyOnBoundaries(points, restValue) {
  const out = [...points]
  if (!out.some((p) => p.t === T)) out.push({ t: T, v: restValue, ease: 'linear' })
  if (!out.some((p) => p.t === OP)) out.push({ t: OP, v: restValue })
  out.sort((a, b) => a.t - b.t)
  return out
}

// Stop-to-stop waypoint curve (smootherstep: zero velocity at every
// waypoint) — motion-taste.md "Bake smooth, not stepped": no bezier
// time-remapping, so the travel-balanced-style mid-segment singularity is
// structurally impossible. `t` outside the waypoint range holds flat at the
// nearest end.
function smootherstep(u) { const c = Math.max(0, Math.min(1, u)); return c * c * c * (c * (c * 6 - 15) + 10) }
function waypointCurve(t, waypoints) {
  if (t <= waypoints[0].t) return waypoints[0].v
  const last = waypoints[waypoints.length - 1]
  if (t >= last.t) return last.v
  let seg = waypoints.length - 2
  for (let k = 0; k < waypoints.length - 1; k++) { if (t >= waypoints[k].t && t <= waypoints[k + 1].t) { seg = k; break } }
  const a = waypoints[seg], b = waypoints[seg + 1]
  const u = (t - a.t) / ((b.t - a.t) || 1)
  return a.v + (b.v - a.v) * smootherstep(u)
}

function shapeFromSubpath(sp, nm) {
  return { ty: 'sh', nm, ks: { a: 0, k: { c: sp.closed, v: sp.v, i: sp.i, o: sp.o } } }
}
function fillItem(colorHex, opacity = 100, nm = 'Fill') {
  const [r, g, b] = hexToRgb1(colorHex)
  return { ty: 'fl', nm, o: { a: 0, k: opacity }, c: { a: 0, k: [r, g, b, 1] }, r: 1 }
}
function strokeItem(colorHex, width, opacity = 100, nm = 'Stroke', cap = 2, join = 2) {
  const [r, g, b] = hexToRgb1(colorHex)
  return { ty: 'st', nm, o: { a: 0, k: opacity }, w: { a: 0, k: width }, c: { a: 0, k: [r, g, b, 1] }, lc: cap, lj: join }
}
function groupTransform({ p = [0, 0], a = [0, 0], s = [100, 100], r = 0, o = 100 } = {}) {
  return { ty: 'tr', p: { a: 0, k: p }, a: { a: 0, k: a }, s: { a: 0, k: s }, r: { a: 0, k: r }, o: { a: 0, k: o }, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 } }
}
function group(nm, items, transform) { return { ty: 'gr', nm, it: [...items, groupTransform(transform)] } }
function bboxOf(subpaths) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const sp of subpaths) for (const [x, y] of sp.v) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y) }
  return [minX, minY, maxX, maxY]
}
function bboxCenter(bbox) { return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2] }
function circleBbox(cx, cy, r) { return [cx - r, cy - r, cx + r, cy + r] }
function mergeBbox(a, b) { return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])] }
function unionBboxOfPaths(ds) { let subs = []; for (const d of ds) subs = subs.concat(parsePath(d)); return bboxOf(subs) }
function matrixApplyPoint([a, b, c, d, e, f], [x, y]) { return [a * x + c * y + e, b * x + d * y + f] }

function baseTransform({ a = [0, 0, 0], p = [0, 0, 0], s = [100, 100, 100], o = 100 } = {}) {
  return { a: { a: 0, k: a }, p: { a: 0, k: p }, s: { a: 0, k: s }, r: { a: 0, k: 0 }, o: { a: 0, k: o } }
}

let ind = 1
const layers = []
function pushLayer({ nm, shapes, ks, parent, ty, textData, refId, masks }) {
  const l = { ddd: 0, ind, nm, sr: 1, ks, ao: 0, ip: 0, op: OP, st: 0, bm: 0 }
  if (ty === 5) { l.ty = 5; l.t = textData }
  else if (ty === 2) { l.ty = 2; l.refId = refId }
  else if (ty === 0) { l.ty = 0; l.refId = refId; l.w = W; l.h = H }
  else if (ty === 3) { l.ty = 3 }
  else { l.ty = 4; l.shapes = shapes }
  if (parent) l.parent = parent
  if (masks) l.masksProperties = masks
  layers.push(l)
  ind++
  return l.ind
}
function staticShapeLayer(nm, d, paintItems, parent, p) {
  const subs = parsePath(d)
  const items = subs.map((s, i) => shapeFromSubpath(s, `${nm}-${i}`))
  const shapes = [group(nm, [...items, ...paintItems])]
  return pushLayer({ nm, shapes, ks: baseTransform(p ? { p } : {}), parent })
}
// Silhouette morph: an animated shape track (`ks:{a:1,...}`), same vertex
// count/order every key — motion-taste.md "Living idles — the silhouette
// breathes". `animProp`'s `s` field already accepts a shape object per
// point (Array.isArray guard), so no separate shape keyframe builder needed.
function animatedShapeLayer(nm, shapePoints, paintItems, parent) {
  const shapeItem = { ty: 'sh', nm: `${nm}-path`, ks: animProp(shapePoints) }
  const shapes = [group(nm, [shapeItem, ...paintItems])]
  return pushLayer({ nm, shapes, ks: baseTransform(), parent })
}

// Squash/bulge a subpath's vertices (and their in/out handle deltas) about a
// pivot, anisotropic scale along `axisUnit` and 1/scale perpendicular to it —
// area-conserving by construction (exact on beziers, no per-segment
// approximation).
function squashSubpath(sp, pivot, axisUnit, scaleAlong) {
  const perpUnit = [-axisUnit[1], axisUnit[0]]
  const scalePerp = 1 / scaleAlong
  const xformPoint = ([x, y]) => {
    const dx = x - pivot[0], dy = y - pivot[1]
    const along = dx * axisUnit[0] + dy * axisUnit[1]
    const across = dx * perpUnit[0] + dy * perpUnit[1]
    const na = along * scaleAlong, nc = across * scalePerp
    return [pivot[0] + na * axisUnit[0] + nc * perpUnit[0], pivot[1] + na * axisUnit[1] + nc * perpUnit[1]]
  }
  const xformDelta = ([dx, dy]) => {
    const along = dx * axisUnit[0] + dy * axisUnit[1]
    const across = dx * perpUnit[0] + dy * perpUnit[1]
    const na = along * scaleAlong, nc = across * scalePerp
    return [na * axisUnit[0] + nc * perpUnit[0], na * axisUnit[1] + nc * perpUnit[1]]
  }
  return { c: sp.closed, v: sp.v.map(xformPoint), i: sp.i.map(xformDelta), o: sp.o.map(xformDelta) }
}

const MARGIN = 240 * 0.03 // 7.2 — Render-Aware Motion safety margin
const SAMPLE_STEP = 2      // dense-sample cadence (motion-taste "Bake smooth, not stepped")

// ============================================================
// SQUEEZE — the master envelope. "Slow squeeze, short hold, softer
// release": anticipation dip (a small release before gathering), a 40f
// build to peak, an 18f hold (the quiver window), a 54f release, then a
// flat rest before the next cycle. Pure function of `t % IDLE`, so every
// dependent track is alive from frame 0 and the seam is exact by
// construction (op = T + IDLE => op % IDLE === T % IDLE for any T).
// ============================================================
const SQUEEZE_WAYPOINTS = [
  { t: 0, v: 0 },
  { t: 14, v: 0 },     // explicit flat rest before the anticipation begins
  { t: 20, v: -0.10 },  // small anticipation — a slight ease-out before gathering
  { t: 60, v: 1.0 },    // peak — slow squeeze build (40f)
  { t: 78, v: 1.0 },    // end of the brief hold (18f)
  { t: 132, v: 0 },     // softer release (54f)
]
const squeezeEnvelope = (t) => waypointCurve(((t % IDLE) + IDLE) % IDLE, SQUEEZE_WAYPOINTS)

// Isometric quiver — a windowed high-frequency wobble active only during the
// hold plateau [60,78] of each cycle, the loop's one snappy accent.
const QUIVER_LO = 60, QUIVER_HI = 78
function quiverEnvelope(t) {
  const lt = ((t % IDLE) + IDLE) % IDLE
  if (lt < QUIVER_LO || lt > QUIVER_HI) return 0
  const u = (lt - QUIVER_LO) / (QUIVER_HI - QUIVER_LO)
  const window = Math.sin(Math.PI * u)
  const osc = Math.sin(2 * Math.PI * u * 4)
  return window * osc
}
const QUIVER_AMOUNT = 1.4 // px, "1-2px" per the brief

function denseSample(fn) {
  const pts = []
  for (let t = 0; t <= OP; t += SAMPLE_STEP) pts.push({ t, v: fn(t), ease: 'linear' })
  if (pts[pts.length - 1].t !== OP) pts.push({ t: OP, v: fn(OP) })
  return pts
}

// ============================================================
// BUBBLE — plate (slotted size) + native text, one entrance unit. Punchier
// than a calm scene: bigger overshoot, faster settle — "it's a flex."
// Vertical geometry (rect y=14 h=35) is IDENTICAL to the sibling companion
// scenes' tooltip, so the same stage-shift/headroom derivation applies
// unchanged (see live-onboarding-companion-ler6-animation.md); width (189,
// wider than the other sibling's 176) doesn't affect that vertical math.
// ============================================================
const SHIFT_Y = 4
const PLATE_DEFAULT_W = TOOLTIP_RECT.w, PLATE_DEFAULT_H = TOOLTIP_RECT.h, PLATE_R = TOOLTIP_RECT.rx
const PLATE_CX = 120 // true stage-center, not the source rect's own (asymmetric) x
const PLATE_CENTER_Y = 44.5
const PLATE_TOP = PLATE_CENTER_Y - PLATE_DEFAULT_H / 2   // 27
const PLATE_BOTTOM = PLATE_CENTER_Y + PLATE_DEFAULT_H / 2 // 62

const FONT_SIZE = 15, LINE_HEIGHT = 19, PAD_X = 16, PAD_Y = 8, LEADING = 2
const BASELINE_LOCAL = 5.41 // px below plate local center — verified against render below

const DEFAULT_STRING = 'Making great progress'
function textDoc(str) { return { s: FONT_SIZE, f: 'Nunito-Bold', t: str, j: 2, tr: 0, lh: LINE_HEIGHT, ls: 0, fc: hexToRgb1('#222222') } }

const BUBBLE_POP = [
  { t: 16, v: 0, ease: 'entranceSharp' },
  { t: 34, v: 118, ease: 'settleSoft' }, // punchier overshoot than a calm scene
  { t: 44, v: 100 },
]
const BUBBLE_OPACITY = [
  { t: 16, v: 0, ease: 'entranceSharp' },
  { t: 26, v: 100 },
]

const bubbleAnchorInd = pushLayer({
  nm: 'bubble-anchor',
  ty: 3,
  ks: {
    a: { a: 0, k: [0, PLATE_DEFAULT_H / 2, 0], sid: 'bubble.anchor' },
    p: { a: 0, k: [PLATE_CX, PLATE_BOTTOM + SHIFT_Y, 0] },
    s: animProp(keyOnBoundaries(BUBBLE_POP.map((p) => ({ ...p, v: [p.v, p.v, 100] })), [100, 100, 100])),
    r: { a: 0, k: 0 },
    o: { a: 0, k: 100 },
  },
})
{
  const shapes = [group('bubble-plate', [
    { ty: 'rc', nm: 'plate-rect', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [PLATE_DEFAULT_W, PLATE_DEFAULT_H], sid: 'bubble.size' }, r: { a: 0, k: PLATE_R } },
    strokeItem('#222222', 1.5),
  ])]
  const ks = baseTransform()
  ks.o = animProp(keyOnBoundaries(BUBBLE_OPACITY, 100))
  pushLayer({ nm: 'bubble-plate', shapes, ks, parent: bubbleAnchorInd })
}
{
  const doc = textDoc(DEFAULT_STRING)
  const ks = baseTransform({ a: [0, 0, 0] })
  ks.p = { a: 0, k: [0, BASELINE_LOCAL, 0], sid: 'bubble.textPos' }
  ks.s = animProp(keyOnBoundaries(BUBBLE_POP.map((p) => ({ ...p, v: [p.v, p.v, 100] })), [100, 100, 100]))
  ks.o = animProp(keyOnBoundaries(BUBBLE_OPACITY, 100))
  const textData = { d: { k: [{ s: doc, t: 0 }], sid: 'bubble.text' }, p: {}, m: { g: 1, a: { a: 0, k: [0, 0] } }, a: [] }
  pushLayer({ nm: 'bubble-text', ty: 5, textData, ks, parent: bubbleAnchorInd })
}

// ============================================================
// TRAIL — smallest pops first (recipe convention). Geometry (cx/cy/r) is
// pixel-identical to the sibling companion scenes' source, so the same
// re-centered placement (shifted +18 in x to land on the recentered
// PLATE_CX=120) and gap derivation applies unchanged. One-shot: settles and
// holds perfectly still (no float — this brief doesn't call for the
// deliberate exception the lounging sibling scene documents).
// ============================================================
function trailCircle(nm, cx, cy, r, points) {
  const shapes = [group(nm, [{ ty: 'el', nm: `${nm}-el`, p: { a: 0, k: [0, 0] }, s: { a: 0, k: [r * 2, r * 2] } }, strokeItem('#222222', 1.5)])]
  const ks = baseTransform({ p: [cx, cy + SHIFT_Y, 0] })
  ks.s = animProp(keyOnBoundaries(points.map((p) => ({ ...p, v: [p.v, p.v, 100] })), [100, 100, 100]))
  ks.o = animProp(keyOnBoundaries(points.map((p) => ({ t: p.t, v: p.v > 0 ? 100 : 0, ease: p.ease })), 100))
  pushLayer({ nm, shapes, ks })
}
trailCircle('trail-small', 132, 92.5, TRAIL_SMALL_SRC.r, [{ t: 0, v: 0, ease: 'entranceSharp' }, { t: 8, v: 112, ease: 'settleSoft' }, { t: 16, v: 100 }])
trailCircle('trail-large', 120, 79, TRAIL_LARGE_SRC.r, [{ t: 4, v: 0, ease: 'entranceSharp' }, { t: 14, v: 114, ease: 'settleSoft' }, { t: 22, v: 100 }])

// ============================================================
// STATIC BACKGROUND — bg blob + both arm cutouts, unparented, unanimated
// (steady island).
// ============================================================
staticShapeLayer('body-blob', D.bgBlob, [fillItem('#FFFFFF')], undefined, [0, SHIFT_Y, 0])
staticShapeLayer('arm-cutout-left', D.cutoutLeft, [fillItem('#FFFFFF')], undefined, [0, SHIFT_Y, 0])
staticShapeLayer('arm-cutout-right', D.cutoutRight, [fillItem('#FFFFFF')], undefined, [0, SHIFT_Y, 0])

// ============================================================
// ARMS — mirrored rig. Pivot at each arm's own body-side edge (derived from
// the parsed geometry, character-rig "pivot at the base" idiom): the RIGHT
// arm's inner/body-side edge is its bbox's MIN-x, the LEFT arm's is its
// bbox's MAX-x (body sits between them). Position pulls up+inward with a
// small phase offset between the x and y drivers (Lissajous-style: same
// squeeze function sampled at two different times) so the pivot traces a
// genuine arc rather than a straight line (motion-taste.md Fluidity).
// ============================================================
const ARM_DX = 3.4, ARM_DY = 3.0, ARM_ROT = 3, ARC_LEAD = 5
const FIST_GAIN_PCT = 4

// Part roles, identified from the parsed geometry (not guessed): the
// smallest-y (topmost, nearest the head) shape is the raised FIST in this
// double-bicep pose; the mid-height circle is the bicep's own knuckle-like
// bulge; the wide-y shape is the forearm; the lowest/widest shape is the
// shoulder/upper-arm mass that attaches to the body.
function buildArm(side, knuckleSrc) {
  const mirror = side === 'right' ? 1 : -1
  const fistD = side === 'right' ? D.rArmShoulder : D.lArmShoulder // Ellipse 489/489_2 — topmost shape = the raised fist
  const forearmD = side === 'right' ? D.rArmBicep : D.lArmBicep     // Ellipse 488/488_2
  const shoulderD = side === 'right' ? D.rArmBlob : D.lArmBlob      // Ellipse 486/486_2
  const hiliteA = side === 'right' ? D.rArmHiliteA : D.lArmHiliteA
  const hiliteB = side === 'right' ? D.rArmHiliteB : D.lArmHiliteB

  const knuckleBbox = circleBbox(knuckleSrc.cx, knuckleSrc.cy, knuckleSrc.r)
  const mainBbox = mergeBbox(unionBboxOfPaths([fistD, forearmD, shoulderD]), knuckleBbox)
  const pivotX = side === 'right' ? mainBbox[0] : mainBbox[2]
  const pivotY = (mainBbox[1] + mainBbox[3]) / 2
  const pivot = [pivotX, pivotY]

  const posPoints = denseSample((t) => {
    const sx = squeezeEnvelope(t)
    const sy = squeezeEnvelope(t + ARC_LEAD)
    const quiver = QUIVER_AMOUNT * quiverEnvelope(t) * -mirror // inward-axis jitter, same sign as the inward pull
    const dx = -mirror * ARM_DX * sx + quiver
    const dy = -ARM_DY * sy
    return [pivot[0] + dx, pivot[1] + dy + SHIFT_Y, 0]
  })
  const rotPoints = denseSample((t) => mirror * ARM_ROT * squeezeEnvelope(t))

  const rigInd = pushLayer({
    nm: `arm-${side}-rig`,
    ty: 3,
    ks: { a: { a: 0, k: [pivot[0], pivot[1], 0] }, p: animProp(posPoints), r: animProp(rotPoints), s: { a: 0, k: [100, 100, 100] }, o: { a: 0, k: 100 } },
  })

  const nmFor = (part) => `arm-${side}-${part}`

  // Paint order (matches the source's own doc order 486,488,487,490,489,491
  // — later = more front): blob(486) -> bicep/forearm(488) -> knuckle(487)
  // -> hilite-a(490) -> fist(489) -> hilite-b(491, frontmost).
  staticShapeLayer(nmFor('blob'), shoulderD, [fillItem('#222222')], rigInd)
  staticShapeLayer(nmFor('bicep'), forearmD, [fillItem('#222222')], rigInd)
  {
    const shapes = [group(nmFor('knuckle'), [
      { ty: 'el', nm: 'knuckle-el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [knuckleSrc.r * 2, knuckleSrc.r * 2] } },
      fillItem('#222222'),
    ])]
    pushLayer({ nm: nmFor('knuckle'), shapes, ks: baseTransform({ p: [knuckleSrc.cx, knuckleSrc.cy, 0] }), parent: rigInd })
  }
  staticShapeLayer(nmFor('hilite-a'), hiliteA, [strokeItem('#FFFFFF', 1.26445, 100, 'Stroke', 2, 1)], rigInd)

  // Fist: own-center scale bump on top of the rig — "fists tighten
  // fractionally at the peak" — the character-rig "own-center pulse" idiom.
  // Ellipse 489/489_2 is a general path (not a circle), so it gets the same
  // pulsing treatment as a static shape PLUS an animated layer-level scale,
  // pivoted at its own bbox center.
  {
    const fistSub = parsePath(fistD)
    const fistCenter = bboxCenter(bboxOf(fistSub))
    const fistScalePoints = denseSample((t) => 100 + FIST_GAIN_PCT * squeezeEnvelope(t))
    const items = fistSub.map((s, i) => shapeFromSubpath(s, `fist-${i}`))
    const shapes = [group(nmFor('fist'), [...items, fillItem('#222222')])]
    const ks = baseTransform({ a: [fistCenter[0], fistCenter[1], 0], p: [fistCenter[0], fistCenter[1], 0] })
    ks.s = animProp(fistScalePoints.map((p) => ({ ...p, v: [p.v, p.v, 100] })))
    pushLayer({ nm: nmFor('fist'), shapes, ks, parent: rigInd })
  }

  staticShapeLayer(nmFor('hilite-b'), hiliteB, [strokeItem('#FFFFFF', 1.58056, 100, 'Stroke', 2, 1)], rigInd)

  return rigInd
}
buildArm('right', R_KNUCKLE_SRC)
{
  // Ellipse 487_2 carries a matrix() transform in source — apply it to the
  // circle's own center programmatically (a rotation+reflection of unit
  // scale keeps a circle a circle; only its center moves).
  const [cx, cy] = matrixApplyPoint(L_KNUCKLE_MATRIX, [L_KNUCKLE_LOCAL.cx, L_KNUCKLE_LOCAL.cy])
  buildArm('left', { cx, cy, r: L_KNUCKLE_LOCAL.r })
}

// ============================================================
// ZENEK BODY — silhouette morph, counter-phase to the arms ("chest puffs
// counter-phase to the arms"): driven by `1 - squeeze`, so the body reads
// fullest at rest and pulls in as the arms flex hardest. Face gets the
// IDENTICAL deform so it rides the deforming mass. Eyes deepen their own
// arc (handle-scale, same vertex count/order) in sync with the squeeze —
// "the closed-eye happy-arc eyes squeeze deeper in sync with the pump."
// ============================================================
const bodyBbox = bboxOf(parsePath(D.bodyDark))
const bodyPivot = [(bodyBbox[0] + bodyBbox[2]) / 2, bodyBbox[3]] // base — contact point with the ground/shadow
const CHEST_PUFF_PCT = 0.024 // 2.4% at peak-relaxed
const bodyDarkBase = parsePath(D.bodyDark)[0]
const bodyFaceBase = parsePath(D.bodyFace)[0]
function chestScaleAt(t) { return 1 - CHEST_PUFF_PCT * (1 - squeezeEnvelope(t)) }
function bodyShapeAt(baseSp, t) { return squashSubpath(baseSp, bodyPivot, [0, 1], chestScaleAt(t)) }
animatedShapeLayer('zenek-body', denseSample((t) => bodyShapeAt(bodyDarkBase, t)), [fillItem('#222222')], undefined)
animatedShapeLayer('zenek-face', denseSample((t) => bodyShapeAt(bodyFaceBase, t)), [fillItem('#FFFFFF')], undefined)

const EYE_HANDLE_GAIN = 0.4
function eyeShapeAt(baseSp, t) {
  const factor = 1 + EYE_HANDLE_GAIN * squeezeEnvelope(t)
  return { c: baseSp.closed, v: baseSp.v, i: baseSp.i.map(([x, y]) => [x * factor, y * factor]), o: baseSp.o.map(([x, y]) => [x * factor, y * factor]) }
}
const eyeLeftBase = parsePath(D.eyeLeft)[0]
const eyeRightBase = parsePath(D.eyeRight)[0]
animatedShapeLayer('eye-left', denseSample((t) => eyeShapeAt(eyeLeftBase, t)), [strokeItem('#222222', 3.15919, 100, 'Stroke', 2, 1)], undefined)
animatedShapeLayer('eye-right', denseSample((t) => eyeShapeAt(eyeRightBase, t)), [strokeItem('#222222', 3.15919, 100, 'Stroke', 2, 1)], undefined)

// ============================================================
// SHADOW — raster pattern fallback (see file header). Tile size derived
// from the pattern's authored objectBoundingBox fractions * the shadow
// ellipse's own bbox; tiled left-to-right across the bbox width, one row
// (the tile's own height fraction already exceeds 1, so a single row
// covers the whole ellipse height); each tile clipped to the ellipse
// silhouette with its own translated mask. "Widens slightly as the body
// settles": a small width/height scale on shadow-rig, peaking opposite the
// squeeze (same driver as the chest puff).
// ============================================================
mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(join(OUT_DIR, 'shadow-pattern.png'), Buffer.from(IMAGE_B64, 'base64'))

const shadowSub = parsePath(D.shadow)
const shadowBbox = bboxOf(shadowSub)
const shadowW = shadowBbox[2] - shadowBbox[0], shadowH = shadowBbox[3] - shadowBbox[1]
const tileW = PATTERN_FRAC_W * shadowW, tileH = PATTERN_FRAC_H * shadowH
const tileCount = Math.ceil(shadowW / tileW)
const shadowCenter = bboxCenter(shadowBbox)

const SHADOW_WIDEN_X_PCT = 5, SHADOW_WIDEN_Y_PCT = 1.5
const shadowScalePoints = denseSample((t) => {
  const settle = 1 - squeezeEnvelope(t) // opposite phase of the squeeze — widest at rest
  return [100 + SHADOW_WIDEN_X_PCT * settle, 100 + SHADOW_WIDEN_Y_PCT * settle, 100]
})
const shadowRigInd = pushLayer({
  nm: 'shadow-rig',
  ty: 3,
  ks: { a: { a: 0, k: [shadowCenter[0], shadowCenter[1], 0] }, p: { a: 0, k: [shadowCenter[0], shadowCenter[1] + SHIFT_Y, 0] }, r: { a: 0, k: 0 }, s: animProp(shadowScalePoints), o: { a: 0, k: 100 } },
})

// Mask paths are defined in the layer's own LOCAL (pre-`ks`) coordinate
// space — the same space the image itself is drawn in, i.e. its native
// `IMAGE_NATIVE_W`x`IMAGE_NATIVE_H` pixel box, BEFORE the layer's `ks.s`
// scales that box down to `tileW`x`tileH` on stage. So the mask needs both
// the translation (into tile-local origin) AND the INVERSE of that scale
// (back up into native pixel units) — translating alone leaves the mask
// sized in ~22px stage units inside a 128px-native local space, covering
// only a sliver of the tile (the bug this comment replaces).
function maskFromSubpath(sp, offsetX, offsetY, scaleX, scaleY) {
  const toLocal = ([x, y]) => [(x - offsetX) * scaleX, (y - offsetY) * scaleY]
  const scaleDelta = ([dx, dy]) => [dx * scaleX, dy * scaleY]
  return { inv: false, mode: 'a', pt: { a: 0, k: { c: sp.closed, v: sp.v.map(toLocal), i: sp.i.map(scaleDelta), o: sp.o.map(scaleDelta) } }, o: { a: 0, k: 100 }, x: { a: 0, k: 0 } }
}
for (let i = 0; i < tileCount; i++) {
  const tileX = shadowBbox[0] + i * tileW, tileY = shadowBbox[1]
  const scaleX = IMAGE_NATIVE_W / tileW, scaleY = IMAGE_NATIVE_H / tileH
  const masks = shadowSub.map((sp) => maskFromSubpath(sp, tileX, tileY, scaleX, scaleY))
  const ks = baseTransform({ a: [0, 0, 0], p: [tileX, tileY, 0], s: [(tileW / IMAGE_NATIVE_W) * 100, (tileH / IMAGE_NATIVE_H) * 100, 100], o: 15 })
  pushLayer({ nm: `shadow-tile-${i}`, ty: 2, refId: 'shadowPattern', ks, parent: shadowRigInd, masks })
}

// ============================================================
// Reorder to front-to-back paint order (matches the source SVG's own
// document order, later-drawn = more front, plus bubble/trail frontmost).
// ============================================================
const FRONT_TO_BACK = [
  'bubble-plate', 'bubble-text', 'bubble-anchor',
  'trail-large', 'trail-small',
  'eye-right', 'eye-left', 'zenek-face', 'zenek-body',
  'arm-left-hilite-b', 'arm-left-fist', 'arm-left-hilite-a', 'arm-left-knuckle', 'arm-left-bicep', 'arm-left-blob', 'arm-left-rig',
  'arm-right-hilite-b', 'arm-right-fist', 'arm-right-hilite-a', 'arm-right-knuckle', 'arm-right-bicep', 'arm-right-blob', 'arm-right-rig',
  'arm-cutout-right', 'arm-cutout-left', 'body-blob',
  'shadow-rig', ...Array.from({ length: tileCount }, (_, i) => `shadow-tile-${i}`),
]
layers.sort((a, b) => FRONT_TO_BACK.indexOf(a.nm) - FRONT_TO_BACK.indexOf(b.nm))

const doc = {
  v: '5.9.0', fr: FPS, ip: 0, op: OP, w: W, h: H, nm: 'Live Onboarding Companion',
  ddd: 0,
  assets: [{ id: 'shadowPattern', w: IMAGE_NATIVE_W, h: IMAGE_NATIVE_H, u: '', p: 'shadow-pattern.png', e: 0 }],
  layers,
  markers: [
    { cm: 'intro', tm: 0, dr: T },
    { cm: 'loop', tm: T, dr: OP - T },
  ],
  fonts: { list: [{ fName: 'Nunito-Bold', fFamily: 'Nunito', fStyle: 'Bold', ascent: 75 }] },
  slots: {
    'bubble.text': { p: { k: [{ s: textDoc(DEFAULT_STRING), t: 0 }] } },
    'bubble.size': { p: { a: 0, k: [PLATE_DEFAULT_W, PLATE_DEFAULT_H] } },
    'bubble.textPos': { p: { a: 0, k: [0, BASELINE_LOCAL, 0] } },
    'bubble.anchor': { p: { a: 0, k: [0, PLATE_DEFAULT_H / 2, 0] } },
  },
}

writeFileSync(OUT, JSON.stringify(doc))
const totalKeyframes = layers.reduce((sum, l) => {
  let n = 0
  for (const prop of ['p', 'r', 's', 'o']) { const v = l.ks && l.ks[prop]; if (v && v.a === 1) n += v.k.length }
  return sum + n
}, 0)
console.log(`Wrote ${OUT} — ${layers.length} layers, ${totalKeyframes} animated keyframes, ${OP}f @ ${FPS}fps (intro ${T}f / loop ${OP - T}f)`)

copyFileSync(join(__dirname, '../assets/fonts/Nunito.ttf'), join(OUT_DIR, 'Nunito.ttf'))
copyFileSync(join(__dirname, '../assets/fonts/Nunito-Bold.ttf'), join(OUT_DIR, 'Nunito-Bold.ttf'))
console.log(`Copied fonts + shadow-pattern.png into ${OUT_DIR}`)

const AUTOFIT_MAX_W = 240 - 2 * MARGIN // 225.6
const AUTOFIT_MAX_H = 2 * (LINE_HEIGHT + LEADING) + 2 * PAD_Y // 58
const controls = {
  controls: [
    { sid: 'bubble.text', label: 'Bubble text' },
    { sid: 'bubble.size', label: 'Bubble size', autoFit: { text: 'bubble.text', padding: [PAD_X, PAD_Y], min: [90, 35], max: [AUTOFIT_MAX_W, AUTOFIT_MAX_H], leading: LEADING } },
    { sid: 'bubble.textPos', label: 'Bubble text position', internal: true },
    { sid: 'bubble.anchor', label: 'Bubble anchor', internal: true },
  ],
  layerControls: [
    { target: 'arm-right-rig', kind: 'amount', property: 'position', label: 'Bicep squeeze', description: 'How far the arms pull up and in at the peak of the pump.' },
    { target: 'shadow-rig', kind: 'amount', property: 'scale', label: 'Shadow settle', description: 'How much the ground shadow widens as the body settles.' },
    { target: 'bubble-anchor', kind: 'amount', property: 'scale', label: 'Bubble pop', description: 'How much the speech bubble overshoots as it arrives.' },
  ],
}
writeFileSync(join(OUT_DIR, 'controls.json'), JSON.stringify(controls, null, 2))
console.log(`Wrote ${join(OUT_DIR, 'controls.json')}`)
