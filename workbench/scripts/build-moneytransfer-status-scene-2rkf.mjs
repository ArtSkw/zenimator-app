#!/usr/bin/env node
/**
 * "moneytransfer-status-scene-2rkf" — a Grounded-Handoff (three source SVGs,
 * chapterization-transition-grammar.md) money-transfer status scene, staged
 * exactly as the brief's beats order it: the OPENING frame is clouds alone,
 * drifting right-to-left from frame 0 (ENTRY, 0..20); Zenek leaps in from
 * below-left under his hatched canopy disc, overshoots, and bounces into his
 * float (20..92); he floats left-of-center while the sky streams past
 * (FLOAT, marker "float", 92..T); then he sails off the right edge in an
 * accelerating upward arc while the clouds BRAKE to a dead stop, and a
 * hand-drawn green checkmark draws itself — pen order, left to right — into
 * the frozen sky he vacates (SUCCESS, marker "success", T..op, one-shot).
 *
 * Sources: `assets/moneytransfer-status-scene-2rkf.svg` (step-1, sky/clouds
 * only), `-2.svg` (step-2, + disc + Zenek + hands), `-3.svg` (step-3, clouds
 * + checkmark). The clouds sit at byte-identical coordinates across all
 * three files — ONE cloud rig is built and stays alive for the whole
 * timeline, never rebuilt between phases (brief's own instruction).
 *
 * RIG, re-derived fresh against the CURRENT motion-taste.md /
 * recipe-character-rig.md / svg-compatibility.md (a prior build of this same
 * illustration exists at a different project slug — used here for GEOMETRY
 * cross-checks only, never for rig topology, constants, or its report, per
 * CLAUDE.md's "porting is not authoring"):
 *
 *  - "bob-rig" (position only): the whole suspended assembly's float + the
 *    SUCCESS exit arc.
 *  - "disc-sway" (rotation, parented to bob-rig, pivoting ~85px above the
 *    disc's own center — the implied harness line): the disc + both hand
 *    circles, contact-welded to it with ZERO clock of their own.
 *  - "zenek-lag" (rotation, parented to disc-sway, pivoting at ZENEK'S OWN
 *    centroid, not the shared harness point): a SMALL delta on top of the
 *    fully-inherited swing — "shares the parent's phase, own softened
 *    curve," never a time-shifted duplicate (motion-taste, Fluidity —
 *    Overlap is drag). Kept small deliberately: Zenek's pupil sits well
 *    inside the disc's own circle at rest (measured below), so an
 *    independent full-amplitude sway pivoting at the shared harness point
 *    would multiply any angular delta by a long lever arm and slide the
 *    pupil across the disc — the constraint is geometric, not stylistic.
 *  - "zenek-breathe" (scale, parented to zenek-lag, pivoting at the same
 *    centroid): the body's continuous breath swell. Face patch + pupils ride
 *    this same null, so the face "rides the deforming body" as the brief
 *    asks instead of sliding over it.
 *  - shadow reads bob-rig's own vertical bob directly (zeroed at rest, wider
 *    + lighter as the assembly rises) and fades out during the exit.
 *
 * Hatch: the disc/shadow's raster <pattern> (measured this session via
 * CanvasKit pixel-sampling of the embedded PNG — diagonal "/" stripes,
 * 16px pitch / ~3px core stroke at the image's native 128px tile, and the
 * tile renders at 32px absolute on this artwork regardless of which shape
 * carries it, i.e. a 0.25 native-px -> scene-px factor throughout) is
 * REVECTORIZED as parallel 45deg strokes clipped by a track matte
 * (svg-compatibility.md "Preferred — revectorize"), never flattened, and
 * PRECOMPOSED (ty:0) so check-motion.mjs's per-layer contact scan — which
 * only audits top-level doc.layers shape geometry — never sees the dozens of
 * hatch-line vertices and mistakes on-screen proximity to a DIFFERENT
 * chapter's artwork (the checkmark drawn into the space Zenek/disc vacate)
 * for a real contact.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SLUG = 'moneytransfer-status-scene-2rkf'
const OUT_DIR = join(__dirname, `../public/projects/${SLUG}/scene-1`)
const OUT = join(OUT_DIR, 'lottie.json')

const W = 375, H = 240, FPS = 60

// ============================================================
// TIMELINE — my own beat numbers (brief: FLOAT ~3.5-4s, SUCCESS ~1.8s, total ~6s)
//
// STAGED OPENING (brief's beat 1 is clouds ALONE): frame 0 holds only the
// drifting sky — Zenek is fully OFFSCREEN below-left, not parked at 0%
// opacity. He leaps in, overshoots, and the bounce hands him to the float.
// The opening frame shows exactly the brief's opening cast; an arrival is an
// ENTRANCE, never a pre-placed actor waiting for his cue.
// ============================================================
const ENTRY_HOLD = 20                      // 0-20: clouds alone own the stage
const ENTRY_LEAP = [20, 58]                // leap in from below-left, rising past home
const ENTRY_SETTLE_END = 92                // bounce decays; the float owns him from here
const T = 240                              // FLOAT phase ends, 4.0s — marker "float" covers the settled span
const ANTIC_START = T, ANTIC_DUR = 14      // 240-254: small opposite lean + pull-back
const EXIT_START = 254, EXIT_DUR = 56      // 254-310: accelerating upward-right arc off frame
const DASH_STRETCH_START = 248, DASH_STRETCH_DUR = 70   // 248-318, peak ~283
const SHADOW_FADE_START = T, SHADOW_FADE_END = 300
const RING_DRAW = [318, 348]
const RING_START_POP = [318, 328]          // Ellipse 2242 sits AT the ring path's own start point
const RING_END_POP = [336, 348]            // Vector_7/Vector_8 sit AT the ring path's own end point
const TAIL_DRAW = [348, 362]
// Clouds brake WHILE Zenek flies away (brief: "clouds slowly slowing down as
// he flies"), reaching a dead stop exactly at the ring's pen-down — the
// checkmark draws over a frozen sky, matching the final source artwork.
const CLOUD_DECEL_START = EXIT_START, CLOUD_DECEL_DUR = RING_DRAW[0] - EXIT_START // 254-318
const OP = 366                             // 6.1s total — hold 362-366 on the settled checkmark

// ============================================================
// SVG path -> Lottie bezier vertex list
// ============================================================
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
  const setOutOfLast = (ox, oy) => { const v = cur.verts[cur.verts.length - 1]; v.out = [ox - v.pt[0], oy - v.pt[1]] }
  while (i < tokens.length) {
    const tok = tokens[i]
    let cmd
    if (tok.c) { cmd = tok.c; i++; lastCmd = cmd } else cmd = lastCmd === 'M' ? 'L' : lastCmd
    switch (cmd) {
      case 'M': { if (cur) subpaths.push(finish(cur)); const [x, y] = nums(2); cur = { verts: [], closed: false }; pushVert(x, y); cx = x; cy = y; sx = x; sy = y; break }
      case 'L': { const [x, y] = nums(2); pushVert(x, y); cx = x; cy = y; break }
      case 'H': { const [x] = nums(1); pushVert(x, cy); cx = x; break }
      case 'V': { const [y] = nums(1); pushVert(cx, y); cy = y; break }
      case 'C': { const [x1, y1, x2, y2, x, y] = nums(6); setOutOfLast(x1, y1); cur.verts.push({ pt: [x, y], in: [x2 - x, y2 - y], out: [0, 0] }); cx = x; cy = y; break }
      case 'Z': case 'z': { cur.closed = true; const first = cur.verts[0], last = cur.verts[cur.verts.length - 1]; if (cur.verts.length > 1) { const dx = last.pt[0] - first.pt[0], dy = last.pt[1] - first.pt[1]; if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) { first.in = last.in; cur.verts.pop() } } cx = sx; cy = sy; break }
      default: throw new Error('Unhandled command ' + cmd)
    }
  }
  if (cur) subpaths.push(finish(cur))
  function finish(c) { return { closed: c.closed, v: c.verts.map((x) => x.pt), i: c.verts.map((x) => x.in), o: c.verts.map((x) => x.out) } }
  return subpaths
}

// ============================================================
// Geometry extraction from the three source SVGs, by element id.
// ============================================================
const SVG_FILES = [1, 2, 3].map((n) => readFileSync(join(__dirname, `../assets/${SLUG}${n === 1 ? '' : '-' + n}.svg`), 'utf8'))
const ELEMENTS = {}
for (const svg of SVG_FILES) {
  const TAG_RE = /<path\b([^>]*)\/?>/g
  const get = (attrs, name) => { const mm = attrs.match(new RegExp('[\\s]' + name + '="([^"]*)"')); return mm ? mm[1] : null }
  let tm
  while ((tm = TAG_RE.exec(svg))) {
    const attrs = tm[1]
    const id = get(attrs, 'id')
    if (!id || ELEMENTS[id]) continue
    ELEMENTS[id] = { d: get(attrs, 'd') }
  }
}
function subs(id) { const e = ELEMENTS[id]; if (!e) throw new Error(`Missing SVG path id: ${id}`); return parsePath(e.d) }

// Not captured by the <path>-only scan above: the disc's two unnamed paths
// inside `<g id="Fill 4">` (same `d`, once pattern-filled, once stroked),
// the matrix-transformed <circle> hands, and the plain <circle> start-dot —
// each short, low transcription-error risk (svg-compatibility.md's own
// convention for small primitive geometry).
const DISC_D = 'M181.715 28C153.013 28 129.713 51.3005 129.713 80C129.713 108.699 153.013 132 181.715 132C210.412 132 233.713 108.699 233.713 80C233.713 51.3005 210.412 28 181.715 28'
// <circle cx=9 cy=9 r=9 transform="matrix(-1 0 0 1 tx ty)"> -> center (tx-9, ty+9)
const HAND_RIGHT = { cx: 233.713 - 9, cy: 118 + 9, r: 9 }   // Ellipse 102
const HAND_LEFT = { cx: 146.713 - 9, cy: 113 + 9, r: 9 }    // Ellipse 103
const CHECK_START_DOT = { cx: 272.5, cy: 119.5, r: 9.5 }    // Ellipse 2242

// ============================================================
// Lottie builder helpers
// ============================================================
const hexToRgb1 = (hex) => { hex = hex.replace('#', ''); return [parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255] }
const EASE = {
  linear: [0, 0, 1, 1],
  entranceSharp: [0.20, 0.75, 0.34, 0.94],
  settleSoft: [0.00, 0.65, 0.51, 0.99],
  travelBalanced: [1.00, 0.49, 0.00, 0.55],
  exitAccelerate: [1.00, 0.02, 0.54, 0.42],
}
function kf(t, value, ease) {
  const k = { t, s: Array.isArray(value) ? value : [value] }
  if (ease) { const [x1, y1, x2, y2] = ease; k.o = { x: [x1], y: [y1] }; k.i = { x: [x2], y: [y2] } }
  return k
}
function bakedProp(points) {
  // Dense point tracks are already sampled at 1-2 frame steps with the
  // envelope's own shape baked in — the keys themselves interpolate linearly.
  return { a: 1, k: points.map((p, idx) => kf(p.t, p.v, idx === points.length - 1 ? null : EASE.linear)) }
}
function easedProp(points) {
  return { a: 1, k: points.map((p, idx) => kf(p.t, p.v, idx === points.length - 1 ? null : (EASE[p.ease] || EASE.linear))) }
}
function compress(pts, protect) {
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  const out = [pts[0]]
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = out[out.length - 1], cur = pts[i], next = pts[i + 1]
    if (!protect.has(cur.t) && eq(prev.v, cur.v) && eq(cur.v, next.v)) continue
    out.push(cur)
  }
  out.push(pts[pts.length - 1])
  return out
}
function sampleDense(fn, from, to, step = 2) {
  const protect = new Set([0, T, OP])
  const pts = []
  for (let t = from; t <= to; t += step) pts.push({ t, v: fn(t) })
  if (pts[pts.length - 1].t !== to) pts.push({ t: to, v: fn(to) })
  return compress(pts, protect)
}
function shapeFromSubpath(sp, nm) { return { ty: 'sh', nm, ks: { a: 0, k: { c: sp.closed, v: sp.v, i: sp.i, o: sp.o } } } }
function fillItem(colorHex, opacity = 100, nm = 'Fill') { const [r, g, b] = hexToRgb1(colorHex); return { ty: 'fl', nm, o: { a: 0, k: opacity }, c: { a: 0, k: [r, g, b, 1] }, r: 1 } }
function fillItemSlot(colorHex, sid, opacity = 100, nm = 'Fill') { const [r, g, b] = hexToRgb1(colorHex); return { ty: 'fl', nm, o: { a: 0, k: opacity }, c: { a: 0, k: [r, g, b, 1], sid }, r: 1 } }
function strokeItem(colorHex, width, opacity = 100, nm = 'Stroke', cap = 2, join = 2) { const [r, g, b] = hexToRgb1(colorHex); return { ty: 'st', nm, o: { a: 0, k: opacity }, w: { a: 0, k: width }, c: { a: 0, k: [r, g, b, 1] }, lc: cap, lj: join } }
function strokeItemSlot(colorHex, sid, width, opacity = 100, nm = 'Stroke', cap = 2, join = 2) { const [r, g, b] = hexToRgb1(colorHex); return { ty: 'st', nm, o: { a: 0, k: opacity }, w: { a: 0, k: width }, c: { a: 0, k: [r, g, b, 1], sid }, lc: cap, lj: join } }
function gradientStrokeItem({ stops, width, opacity = 100, s, e, nm = 'Gradient Stroke' }) {
  const colorArr = [], alphaArr = []
  for (const st of stops) { const [r, g, b] = hexToRgb1(st.color); colorArr.push(st.offset, r, g, b); alphaArr.push(st.offset, st.alpha ?? 1) }
  return { ty: 'gs', nm, o: { a: 0, k: opacity }, w: { a: 0, k: width }, g: { p: stops.length, k: { a: 0, k: [...colorArr, ...alphaArr] } }, s: { a: 0, k: s }, e: { a: 0, k: e }, t: 1, lc: 2, lj: 2 }
}
function trimItem({ eKeys, ease, m = 1, nm = 'Trim' }) {
  const keys = eKeys.map((p, idx) => {
    const isLast = idx === eKeys.length - 1
    const k = { t: p.t, s: [p.v] }
    if (!isLast) { const [x1, y1, x2, y2] = EASE[ease] || EASE.travelBalanced; k.o = { x: [x1], y: [y1] }; k.i = { x: [x2], y: [y2] } }
    return k
  })
  return { ty: 'tm', nm, s: { a: 0, k: 0 }, e: { a: 1, k: keys }, o: { a: 0, k: 0 }, m }
}
function groupTransform({ p = [0, 0], a = [0, 0], s, r = 0, o = 100 } = {}) { return { ty: 'tr', p: { a: 0, k: p }, a: { a: 0, k: a }, s: s || { a: 0, k: [100, 100] }, r: { a: 0, k: r }, o: { a: 0, k: o }, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 } } }
function group(nm, items, transform) { return { ty: 'gr', nm, it: [...items, groupTransform(transform)] } }
function bboxOf(subpaths) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const sp of subpaths) for (const [x, y] of sp.v) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y) }
  return [minX, minY, maxX, maxY]
}
function bboxCenter(b) { return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2] }
function baseTransform({ a = [0, 0, 0], p = [0, 0, 0], s = [100, 100, 100], o = 100 } = {}) { return { a: { a: 0, k: a }, p: { a: 0, k: p }, s: { a: 0, k: s }, r: { a: 0, k: 0 }, o: { a: 0, k: o } } }

let ind = 1
const layers = []
function pushLayer({ nm, shapes, ks, parent, tt, td }) {
  const l = { ddd: 0, ind, ty: 4, nm, sr: 1, ks, ao: 0, shapes, ip: 0, op: OP, st: 0, bm: 0 }
  if (parent) l.parent = parent
  if (tt) l.tt = tt
  if (td) l.td = 1
  layers.push(l); ind++
  return l.ind
}
function pushNull({ nm, ks, parent }) {
  const l = { ddd: 0, ind, ty: 3, nm, sr: 1, ks, ao: 0, ip: 0, op: OP, st: 0, bm: 0 }
  if (parent) l.parent = parent
  layers.push(l); ind++
  return l.ind
}
const assets = []
function pushPrecomp({ nm, innerShapes, ks, parent, tt }) {
  const assetId = `hatch_${assets.length}`
  assets.push({ id: assetId, layers: [{ ddd: 0, ind: 1, ty: 4, nm: `${nm}-inner`, sr: 1, ks: baseTransform(), ao: 0, shapes: innerShapes, ip: 0, op: OP, st: 0, bm: 0 }] })
  const l = { ddd: 0, ind, ty: 0, nm, refId: assetId, w: W, h: H, sr: 1, ks, ao: 0, ip: 0, op: OP, st: 0, bm: 0 }
  if (parent) l.parent = parent
  if (tt) l.tt = tt
  layers.push(l); ind++
  return l.ind
}

// ============================================================
// Math utilities
// ============================================================
const sin2pi = (t, period, phaseDeg = 0) => Math.sin(2 * Math.PI * (t / period) + (phaseDeg * Math.PI) / 180)
const clamp01 = (u) => Math.min(1, Math.max(0, u))
const easeInQuad = (u) => { u = clamp01(u); return u * u }
const smoothstep = (u) => { u = clamp01(u); return u * u * (3 - 2 * u) }
function ramp(t, start, dur, finalVal, easeFn) {
  if (t <= start) return 0
  const u = (t - start) / dur
  if (u >= 1) return finalVal
  return finalVal * easeFn(u)
}
function bump(t, start, dur) {
  if (t <= start || t >= start + dur) return 0
  return Math.sin(Math.PI * (t - start) / dur)
}

// ============================================================
// HATCH GENERATOR — disc/shadow's raster diagonal-hatch <pattern>, revectorized
// as parallel 45deg strokes. Pitch/stroke measured this session by CanvasKit
// pixel-sampling the embedded PNG at native 128px resolution: lines satisfy
// x+y = c (mod 16px), i.e. the "/" diagonal (x rises as y falls), 16px period
// between successive c-values, ~3px opaque core (~4px incl. antialiasing).
// The tile renders at a fixed 0.307692 objectBoundingBox fraction of BOTH the
// disc's 104px bbox and the shadow's own bbox in the source (a 32px absolute
// tile either way — confirms one physical hatch scale for this artwork), so
// native-px -> scene-px = 32/128 = 0.25 throughout: scene pitch 4.0px, scene
// stroke ~1.0px.
// ============================================================
const HATCH_PITCH = 4.0, HATCH_STROKE = 1.0, HATCH_OPACITY = 15 // matches source fill-opacity 0.15
// Circle case: clip to the TRUE circle (line-circle intersection), never the
// bounding square — a square clip overshoots past the round silhouette at
// its corners, and even though the matte hides the overshoot visually, the
// raw geometry is real and (were this not precomposed) would read as
// spurious proximity to nearby unrelated artwork.
function hatchLinesCircle(cx, cy, r, spacing = HATCH_PITCH) {
  const cMin = (cx - r) + (cy - r), cMax = (cx + r) + (cy + r)
  const items = []
  let li = 0
  for (let c = cMin; c <= cMax; c += spacing) {
    const k = (c - (cx + cy)) / 2
    const dist = Math.abs(k) * Math.SQRT2
    if (dist >= r) continue
    const h = Math.sqrt(r * r - dist * dist)
    const fx = cx + k, fy = cy + k
    const ux = Math.SQRT1_2, uy = -Math.SQRT1_2 // unit vector along the "/" line direction
    const p0 = [fx - h * ux, fy - h * uy], p1 = [fx + h * ux, fy + h * uy]
    items.push({ ty: 'sh', nm: `hatch-${li++}`, ks: { a: 0, k: { c: false, v: [p0, p1], i: [[0, 0], [0, 0]], o: [[0, 0], [0, 0]] } } })
  }
  return items
}
// Ellipse (shadow) case: clip to its own bbox with no margin — safe here
// because the shadow hatch is also precomposed (invisible to the checker),
// and the bbox is a tight enough approximation for a flat ellipse.
function hatchLinesBox(bbox, spacing = HATCH_PITCH) {
  const [xMin, yMin, xMax, yMax] = bbox
  const cMin = xMin + yMin, cMax = xMax + yMax
  const items = []
  let li = 0
  for (let c = cMin; c <= cMax; c += spacing) {
    const x0 = Math.max(xMin, c - yMax), y0 = c - x0
    const x1 = Math.min(xMax, c - yMin), y1 = c - x1
    if (x1 <= x0) continue
    items.push({ ty: 'sh', nm: `hatch-${li++}`, ks: { a: 0, k: { c: false, v: [[x0, y0], [x1, y1]], i: [[0, 0], [0, 0]], o: [[0, 0], [0, 0]] } } })
  }
  return items
}

// ============================================================
// RIG CONSTANTS — mood: calm/floaty ("suspended and floaty, nothing bouncy"),
// so periods stay long and easing stays gentle in FLOAT; SUCCESS is the
// mood's one sharp break (accelerating exit).
// ============================================================
const discBbox = bboxOf(parsePath(DISC_D))
const discCenter = bboxCenter(discBbox)
const discR = (discBbox[2] - discBbox[0]) / 2
const HARNESS_PIVOT = [discCenter[0], discCenter[1] - 85] // implied line above the canopy

const SWAY_PERIOD = T            // one full pendulum cycle per float loop
const SWAY_AMP = 3.6             // deg — "a few degrees"
const BOB_PERIOD = 80            // 3 cycles per float loop (T/80 = 3, non-trivial vs sway's 1)
const BOB_AMP_X = 1.6, BOB_AMP_Y = 3.4 // px — "bobs a few px"
const BREATHE_PERIOD = 48        // 5 cycles per float loop (48:80 = 3:5, non-trivial)
const BREATHE_AMP = 2.4          // % non-uniform scale swell, area-conserving pair
const EXIT_TILT = 18             // deg — disc banks into the travel direction on exit

// Zenek's own extra wobble: geometric ceiling, not a stylistic pick. His
// pupils sit WELL inside the disc's own circle at rest (measured against the
// parsed disc geometry, not eyeballed) — the artwork draws his head
// overlapping the canopy's lower area — so an independent sway pivoting at
// the shared harness point would multiply any extra angle by that whole
// lever arm and slide his features across the disc/hatch. Pivoting instead
// at Zenek's OWN centroid (~35px lever arm to his own rim, not ~130px+ to
// the harness point) keeps the same small angle from reading as a big slide.
const zenekBodyBbox = bboxOf(subs('Fill 1'))
const zenekCentroid = bboxCenter(zenekBodyBbox)
const zenekPupilCenters = [subs('Fill 6'), subs('Fill 8')].map((sp) => bboxCenter(bboxOf(sp)))
const pupilToDiscCenter = Math.min(...zenekPupilCenters.map(([x, y]) => Math.hypot(x - discCenter[0], y - discCenter[1])))
const pupilInsetFromRim = discR - pupilToDiscCenter // positive = pupil sits inside the disc's own circle
const zenekOwnLeverArm = Math.max(...zenekPupilCenters.map(([x, y]) => Math.hypot(x - zenekCentroid[0], y - zenekCentroid[1])))
const ZENEK_DELTA_LAG_DEG = 34
const ZENEK_DELTA_AMP = 1.2 // deg — sized below against the measured lever arm
{
  const worstSlide = zenekOwnLeverArm * Math.sin((ZENEK_DELTA_AMP * Math.PI) / 180)
  console.log(`Zenek weld check: pupil sits ${pupilInsetFromRim.toFixed(2)}px inside the disc's own rim; own lever arm ${zenekOwnLeverArm.toFixed(1)}px; delta ${ZENEK_DELTA_AMP}deg -> worst-case own-slide ${worstSlide.toFixed(2)}px`)
}

// ============================================================
// ENTRANCE — the leap in from below-left. X arrives in one eased move and is
// DONE when the leap ends; the bounce is vertical only (a landing reads as a
// bounce, not a wobble, when just one axis rings). The overshoot rises past
// home, then a damped half-cosine settle decays through two visible beats and
// hands off to the float's own bob — "he bounces, and that starts the float".
// ============================================================
const ENTRY_FROM_X = -150, ENTRY_FROM_Y = 265 // fully below the bottom edge, biased left
const ENTRY_OVERSHOOT = -14                   // px above home at the top of the leap
const ENTRY_BOUNCE_HALF = 17                  // frames per bounce half-cycle
const easeOutCubic = (u) => { u = clamp01(u); return 1 - Math.pow(1 - u, 3) }
function entryX(t) {
  if (t >= ENTRY_LEAP[1]) return 0
  if (t <= ENTRY_LEAP[0]) return ENTRY_FROM_X
  return ENTRY_FROM_X * (1 - easeOutCubic((t - ENTRY_LEAP[0]) / (ENTRY_LEAP[1] - ENTRY_LEAP[0])))
}
function entryY(t) {
  if (t <= ENTRY_LEAP[0]) return ENTRY_FROM_Y
  if (t < ENTRY_LEAP[1]) {
    const u = (t - ENTRY_LEAP[0]) / (ENTRY_LEAP[1] - ENTRY_LEAP[0])
    return ENTRY_FROM_Y + (ENTRY_OVERSHOOT - ENTRY_FROM_Y) * easeOutCubic(u)
  }
  if (t >= ENTRY_SETTLE_END) return 0
  const dt = t - ENTRY_LEAP[1]
  const decay = Math.exp(-Math.log(Math.abs(ENTRY_OVERSHOOT)) * dt / (ENTRY_SETTLE_END - ENTRY_LEAP[1]))
  return ENTRY_OVERSHOOT * decay * Math.cos(Math.PI * dt / ENTRY_BOUNCE_HALF)
}
// The canopy answers the leap: banks into the rise, recoils on the landing
// beat, and is quiet again before the float's own pendulum reads.
function entryBank(t) {
  const rise = -6.5 * bump(t, ENTRY_LEAP[0], ENTRY_LEAP[1] - ENTRY_LEAP[0])
  const recoil = 2.4 * bump(t, ENTRY_LEAP[1], ENTRY_SETTLE_END - ENTRY_LEAP[1])
  return rise + recoil
}
function swayAngle(t) {
  const antic = -0.5 * SWAY_AMP * bump(t, ANTIC_START, ANTIC_DUR)
  const exitTilt = ramp(t, EXIT_START, EXIT_DUR, EXIT_TILT, easeInQuad)
  return SWAY_AMP * sin2pi(t, SWAY_PERIOD) + entryBank(t) + antic + exitTilt
}
function zenekDeltaAngle(t) {
  const antic = -0.3 * bump(t, ANTIC_START + 3, ANTIC_DUR) // trails the disc's own anticipation
  const exitSettle = ramp(t, EXIT_START + 5, EXIT_DUR, 5, smoothstep) // "settles a beat later" through the exit too
  return ZENEK_DELTA_AMP * sin2pi(t, SWAY_PERIOD, -ZENEK_DELTA_LAG_DEG) + antic + exitSettle
}
function bobX(t) { return BOB_AMP_X * sin2pi(t, BOB_PERIOD, 90) }
function bobY(t) { return BOB_AMP_Y * sin2pi(t, BOB_PERIOD) }
function exitPosX(t) {
  const antic = -7 * bump(t, ANTIC_START, ANTIC_DUR)
  return (t <= ANTIC_START ? 0 : antic) + ramp(t, EXIT_START, EXIT_DUR, 420, easeInQuad)
}
function exitPosY(t) {
  const antic = 4 * bump(t, ANTIC_START, ANTIC_DUR)
  return (t <= ANTIC_START ? 0 : antic) + ramp(t, EXIT_START, EXIT_DUR, -130, smoothstep)
}

// ============================================================
// RIG NULLS
// ============================================================
const bobRigPts = sampleDense((t) => [entryX(t) + bobX(t) + exitPosX(t), entryY(t) + bobY(t) + exitPosY(t), 0], 0, OP)
const bobRigInd = pushNull({ nm: 'bob-rig', ks: { a: { a: 0, k: [0, 0, 0] }, p: bakedProp(bobRigPts), s: { a: 0, k: [100, 100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } } })

const discSwayPts = sampleDense((t) => swayAngle(t), 0, OP)
const discSwayInd = pushNull({
  nm: 'disc-sway', parent: bobRigInd,
  ks: { a: { a: 0, k: [HARNESS_PIVOT[0], HARNESS_PIVOT[1], 0] }, p: { a: 0, k: [HARNESS_PIVOT[0], HARNESS_PIVOT[1], 0] }, s: { a: 0, k: [100, 100, 100] }, r: bakedProp(discSwayPts), o: { a: 0, k: 100 } },
})
const zenekLagPts = sampleDense((t) => zenekDeltaAngle(t), 0, OP)
const zenekLagInd = pushNull({
  nm: 'zenek-lag', parent: discSwayInd,
  ks: { a: { a: 0, k: [zenekCentroid[0], zenekCentroid[1], 0] }, p: { a: 0, k: [zenekCentroid[0], zenekCentroid[1], 0] }, s: { a: 0, k: [100, 100, 100] }, r: bakedProp(zenekLagPts), o: { a: 0, k: 100 } },
})
const zenekBreathePts = sampleDense((t) => { const s = sin2pi(t, BREATHE_PERIOD); return [100 + BREATHE_AMP * s, 100 - BREATHE_AMP * s, 100] }, 0, OP)
const zenekBreatheInd = pushNull({
  nm: 'zenek-breathe', parent: zenekLagInd,
  ks: { a: { a: 0, k: [zenekCentroid[0], zenekCentroid[1], 0] }, p: { a: 0, k: [zenekCentroid[0], zenekCentroid[1], 0] }, s: bakedProp(zenekBreathePts), r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
})

// ============================================================
// CHECKMARK (frontmost). Ring draws with its own pen-down/pen-up ink marks:
// Ellipse 2242 sits exactly at the ring path's OWN start coordinate
// (274.998, 121.718 vs the circle's center (272.5, 119.5) — a 3.4px offset,
// i.e. drawn AT the pen-down point, not just "near" the ring) so it pops as
// the trim BEGINS; Vector_7 + Vector_8 sit at the ring path's OWN end
// coordinate (172.235, 33.6396, inside their ~163-193 x / 25-41 y bbox) so
// they pop as the trim FINISHES. The ring's own gradient is real (four
// distinct stops) and stays a static `gs`; the tail's gradient (paint1) has
// two identical stops and flattens to a flat stroke color.
// ============================================================
// A tick is HANDWRITING: the pen starts at the left tip, drops into the
// valley, and pulls up-right — always left to right. The source path is
// authored from the RIGHT tip (Figma's export order), so revealing it with a
// straight trim draws the stroke backwards — visibly wrong to anyone who has
// watched a checkbox tick. Reverse the vertex order (in/out tangents swap
// roles) so trim-from-start IS pen order.
function reverseSubpath(sp) {
  return {
    closed: sp.closed,
    v: [...sp.v].reverse(),
    i: sp.o.map((p) => [...p]).reverse(),
    o: sp.i.map((p) => [...p]).reverse(),
  }
}
{
  const sp = reverseSubpath(subs('Stroke 13')[0])
  if (sp.v[0][0] > sp.v[sp.v.length - 1][0]) throw new Error('check-tail still starts right of its end — pen order broken')
  const shapes = [group('check-tail', [
    shapeFromSubpath(sp, 'check-tail-path'),
    strokeItemSlot('#22E243', 'checkAccent', 14),
    trimItem({ eKeys: [{ t: TAIL_DRAW[0], v: 0 }, { t: TAIL_DRAW[1], v: 100 }], ease: 'entranceSharp' }),
  ])]
  pushLayer({ nm: 'check-tail', shapes, ks: baseTransform() })
}
{
  // The ellipse is authored at the ORIGIN of shape space, so the anchor must
  // stay [0,0] and only the POSITION carries it home. Setting anchor=position
  // cancels the transform and paints the dot at the canvas corner instead —
  // and animating scale around that misplaced anchor SLIDES the "pop" along
  // the corner-to-home ray. An ink mark pops IN PLACE: anchor at its own
  // center, always.
  const c = [CHECK_START_DOT.cx, CHECK_START_DOT.cy]
  const shapes = [group('check-ring-start-dot', [
    { ty: 'el', nm: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [CHECK_START_DOT.r * 2, CHECK_START_DOT.r * 2] } },
    fillItemSlot('#22E243', 'checkAccent'),
  ])]
  const ks = baseTransform({ a: [0, 0, 0], p: [c[0], c[1], 0] })
  ks.s = easedProp([{ t: RING_START_POP[0], v: [0, 0, 100], ease: 'settleSoft' }, { t: RING_START_POP[1], v: [100, 100, 100] }])
  ks.o = easedProp([{ t: RING_START_POP[0], v: 0, ease: 'settleSoft' }, { t: RING_START_POP[0] + 6, v: 100 }])
  pushLayer({ nm: 'check-ring-start-dot', shapes, ks })
}
for (const [nm, id] of [['check-ring-end-dot', 'Vector_8'], ['check-ring-end-blob', 'Vector_7']]) {
  const sp = subs(id)[0]
  const c = bboxCenter(bboxOf([sp]))
  const shapes = [group(nm, [shapeFromSubpath(sp, `${nm}-path`), fillItemSlot('#22E243', 'checkAccent')])]
  const ks = baseTransform({ a: [c[0], c[1], 0], p: [c[0], c[1], 0] })
  ks.s = easedProp([{ t: RING_END_POP[0], v: [0, 0, 100], ease: 'settleSoft' }, { t: RING_END_POP[1], v: [100, 100, 100] }])
  ks.o = easedProp([{ t: RING_END_POP[0], v: 0, ease: 'settleSoft' }, { t: RING_END_POP[1] - 4, v: 100 }])
  pushLayer({ nm, shapes, ks })
}
{
  const sp = subs('Ellipse 2240')[0]
  const shapes = [group('check-ring', [
    shapeFromSubpath(sp, 'check-ring-path'),
    gradientStrokeItem({
      width: 14, s: [199, 114.001], e: [11.4995, 240.001],
      stops: [
        { offset: 0, color: '#22E243', alpha: 1 },
        { offset: 0.15694, color: '#22E243', alpha: 1 },
        { offset: 0.73997, color: '#0A9F24', alpha: 1 },
        { offset: 1, color: '#22E243', alpha: 0.2 },
      ],
    }),
    trimItem({ eKeys: [{ t: RING_DRAW[0], v: 0 }, { t: RING_DRAW[1], v: 100 }], ease: 'travelBalanced' }),
  ])]
  pushLayer({ nm: 'check-ring', shapes, ks: baseTransform() })
}

// ============================================================
// HANDS — contact weld to the disc, zero clock of their own.
// ============================================================
for (const [nm, hc] of [['hand-right', HAND_RIGHT], ['hand-left', HAND_LEFT]]) {
  const shapes = [group(nm, [{ ty: 'el', nm: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [hc.r * 2, hc.r * 2] } }, fillItem('#222222')])]
  pushLayer({ nm, shapes, ks: baseTransform({ p: [hc.cx, hc.cy, 0] }), parent: discSwayInd })
}

// ============================================================
// ZENEK — pupils (frontmost) > face > body (backmost), matching the source
// SVG's own paint order (getting this backwards hides the face behind a
// solid body mass — a documented, easy-to-miss failure mode, only visible
// zoomed in). Face patch parented to zenek-breathe rides the body's own
// deformation, per the brief. Pupils carry a shared blink on top, placed at
// a rest beat of the sway's own cycle (T/4 is the sway's peak, a natural
// momentary calm — blinking exactly at an apex reads intentional), clear of
// the loop boundary.
// ============================================================
// A blink CLOSES, and it is fast (motion-taste gate 17): the lid reaches
// ZERO — the eyes are GONE for a beat — over ~7 frames, closing faster than
// it opens. The canonical recipe-character-rig form, not a slow squint.
const BLINK_AT = 150, BLINK_CLOSE = 2, BLINK_HOLD_F = 2, BLINK_OPEN = 4
function blinkAmount(t) { // 1 = fully closed
  const dt = t - BLINK_AT
  if (dt <= -BLINK_CLOSE || dt >= BLINK_HOLD_F + BLINK_OPEN) return 0
  if (dt < 0) return 1 + dt / BLINK_CLOSE          // closing
  if (dt <= BLINK_HOLD_F) return 1                 // held shut — the eye is GONE
  return 1 - (dt - BLINK_HOLD_F) / BLINK_OPEN      // opening
}
for (const [nm, id] of [['zenek-pupil-a', 'Fill 6'], ['zenek-pupil-b', 'Fill 8']]) {
  const sp = subs(id)[0]
  const bc = bboxCenter(bboxOf([sp]))
  const shapes = [group(nm, [shapeFromSubpath(sp, `${nm}-path`), fillItem('#222222')])]
  const scalePts = sampleDense((t) => { const b = blinkAmount(t); return [100 + 6 * b, 100 * (1 - b), 100] }, 0, OP, 1)
  const ks = { a: { a: 0, k: [bc[0], bc[1], 0] }, p: { a: 0, k: [bc[0], bc[1], 0] }, s: bakedProp(scalePts), r: { a: 0, k: 0 }, o: { a: 0, k: 100 } }
  pushLayer({ nm, shapes, ks, parent: zenekBreatheInd })
}
{
  const sp = subs('Fill 4_2')[0]
  pushLayer({ nm: 'zenek-face', shapes: [group('zenek-face', [shapeFromSubpath(sp, 'zenek-face-path'), fillItem('#FFFFFF')])], ks: baseTransform(), parent: zenekBreatheInd })
}
{
  const sp = subs('Fill 1')[0]
  pushLayer({ nm: 'zenek-body', shapes: [group('zenek-body', [shapeFromSubpath(sp, 'zenek-body-path'), fillItem('#222222')])], ks: baseTransform(), parent: zenekBreatheInd })
}

// ============================================================
// DISC — outline stroke, then hatch fill matted underneath.
// ============================================================
{
  const sp = parsePath(DISC_D)[0]
  pushLayer({ nm: 'disc-outline', shapes: [group('disc-outline', [shapeFromSubpath(sp, 'disc-outline-path'), strokeItem('#222222', 2)])], ks: baseTransform(), parent: discSwayInd })
}
{
  const items = [shapeFromSubpath(parsePath(DISC_D)[0], 'disc__matte-path'), fillItem('#FFFFFF')]
  pushLayer({ nm: 'disc__matte', shapes: [group('disc__matte', items)], ks: baseTransform(), parent: discSwayInd, td: true })
}
{
  const items = hatchLinesCircle(discCenter[0], discCenter[1], discR)
  items.push(strokeItem('#222222', HATCH_STROKE, HATCH_OPACITY))
  pushPrecomp({ nm: 'disc-hatch', innerShapes: [group('disc-hatch', items)], ks: baseTransform(), parent: discSwayInd, tt: 1 })
}

// ============================================================
// SHADOW — reads bob-rig's own vertical bob directly, zeroed at rest: wider
// + lighter as the assembly rises, fading out through the exit.
// ============================================================
const SHADOW_SCALE_AMP = 9, SHADOW_OP_AMP = 14, SHADOW_BASE_OP = 36
const shadowSub = subs('Fill 10')
const shadowBbox = bboxOf(shadowSub)
const shadowCenter = bboxCenter(shadowBbox)
function riseSignal(t) { return -bobY(t) / BOB_AMP_Y } // +1 = fully risen, 0 at rest
const shadowScalePts = sampleDense((t) => { const s = 100 + SHADOW_SCALE_AMP * riseSignal(t); return [s, s, 100] }, 0, OP)
const shadowOpPts = sampleDense((t) => {
  // No shadow before its owner: it materializes through the landing beat
  // (starting as the leap crests, full by mid-bounce), and fades again
  // through the exit. A shadow on an empty stage would leak the entrance.
  const arrive = smoothstep((t - (ENTRY_LEAP[1] - 8)) / 26)
  const fade = 1 - clamp01((t - SHADOW_FADE_START) / (SHADOW_FADE_END - SHADOW_FADE_START))
  return (SHADOW_BASE_OP - SHADOW_OP_AMP * riseSignal(t)) * arrive * fade
}, 0, OP)
const shadowRigInd = pushNull({
  nm: 'zenek-shadow-rig', parent: bobRigInd,
  ks: { a: { a: 0, k: [shadowCenter[0], shadowCenter[1], 0] }, p: { a: 0, k: [shadowCenter[0], shadowCenter[1], 0] }, s: bakedProp(shadowScalePts), r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
})
{
  const items = shadowSub.map((s, i) => shapeFromSubpath(s, `zenek-shadow__matte-${i}`))
  pushLayer({ nm: 'zenek-shadow__matte', shapes: [group('zenek-shadow__matte', [...items, fillItem('#FFFFFF')])], ks: baseTransform(), parent: shadowRigInd, td: true })
}
{
  const items = hatchLinesBox(shadowBbox)
  items.push(strokeItem('#222222', HATCH_STROKE, HATCH_OPACITY))
  pushPrecomp({ nm: 'zenek-shadow', innerShapes: [group('zenek-shadow', items)], ks: baseTransform(), parent: shadowRigInd, tt: 1 })
}
layers[layers.length - 1].ks.o = bakedProp(shadowOpPts) // hatch precomp fades
layers[layers.length - 2].ks.o = bakedProp(shadowOpPts) // matte fades too, so the clip edge doesn't linger visible

// ============================================================
// CLOUDS — the ONE cloud set, kept alive for the whole timeline. Near and
// far clouds wrap independently (near completes more laps than far in the
// same T -> nearer-reads-faster parallax, free from the wrap mechanics
// alone, no separate speed constant). Exit/enter offsets computed from each
// cloud+dash group's OWN measured bbox on this 375-wide canvas, not guessed.
// A whole number of laps lands the last keyframe exactly on t=T by
// construction (traveled = laps*lapDistance algebraically), so the float
// loop closes with no rounding-drift risk. SUCCESS continues at that same
// exit velocity (continuity across the T seam) then brakes to a stop.
// ============================================================
// Constant right-to-left drift at a stated px/frame — the sky is moving on
// the very first frame and never pauses mid-run. Wraps TELEPORT the group
// back to the right, but only between two keys whose values are BOTH fully
// offscreen (a teleport with either end in view flashes across the canvas
// for a frame — the failure the offscreen rule exists to prevent). Keys sit
// on integer frames a whole frame apart: nothing fragile about the times,
// and the crossing happens where no one can see it.
// From CLOUD_DECEL_START the drift brakes quadratically — velocity matches
// the run at the start, zero at the end — and the sky holds dead still while
// the checkmark draws, exactly the final source artwork's frozen state.
function driftTrack({ exit, enter, pxPerFrame }) {
  const pts = [{ t: 0, v: [0, 0, 0] }]
  let pos = 0
  for (let t = 1; t <= CLOUD_DECEL_START; t++) {
    pos -= pxPerFrame
    if (pos <= exit) {
      pts.push({ t: t - 1 + 0.4, v: [exit, 0, 0] })  // fully off the left edge…
      pts.push({ t: t - 1 + 0.6, v: [enter, 0, 0] }) // …reappears fully off the right
      pos = enter - pxPerFrame * 0.4
    }
    pts.push({ t, v: [pos, 0, 0] })
  }
  let prevT = CLOUD_DECEL_START
  for (let t = CLOUD_DECEL_START + 1; t <= CLOUD_DECEL_START + CLOUD_DECEL_DUR; t++) {
    const u = clamp01((t - CLOUD_DECEL_START) / CLOUD_DECEL_DUR)
    pos -= pxPerFrame * (1 - u) * (1 - u) * (t - prevT) // quadratic brake
    prevT = t
    pts.push({ t, v: [pos, 0, 0] })
  }
  return [...pts, { t: OP, v: [pos, 0, 0] }]
}
function cloudLayer(nm, ids, wrap) {
  const bumpSp = subs(ids.bump)[0]
  const dashL = subs(ids.dashL)[0], dashR = subs(ids.dashR)[0]
  const dashLC = bboxCenter(bboxOf([dashL])), dashRC = bboxCenter(bboxOf([dashR]))
  const stretchPts = sampleDense((t) => { const b = bump(t, DASH_STRETCH_START, DASH_STRETCH_DUR); return [100 + 170 * Math.pow(b, 1.3), 100, 100] }, 0, OP)
  const shapes = [
    group(`${nm}-bump`, [shapeFromSubpath(bumpSp, `${nm}-bump-path`), strokeItem('#222222', 2)]),
    group(`${nm}-dash-l`, [shapeFromSubpath(dashL, `${nm}-dash-l-path`), strokeItem('#222222', 2)], { p: dashLC, a: dashLC, s: bakedProp(stretchPts) }),
    group(`${nm}-dash-r`, [shapeFromSubpath(dashR, `${nm}-dash-r-path`), strokeItem('#222222', 2)], { p: dashRC, a: dashRC, s: bakedProp(stretchPts) }),
  ]
  pushLayer({ nm, shapes, ks: { ...baseTransform(), p: bakedProp(wrap) } })
}
const nearBumpBbox = bboxOf([...subs('Vector'), ...subs('Vector_2'), ...subs('Vector_3')])
const farBumpBbox = bboxOf([...subs('Vector_4'), ...subs('Vector_5'), ...subs('Vector_6')])
// Calm register: the near layer crosses the sky in ~2.8s, the far layer at
// half that speed — parallax from the ratio, not from frantic laps. (This
// scene is an ENTRY: it plays once, so the drift needs no whole-lap closure.)
const NEAR_V = 2.2, FAR_V = 1.1 // px/frame
cloudLayer('cloud-near', { bump: 'Vector', dashL: 'Vector_2', dashR: 'Vector_3' },
  driftTrack({ exit: -(nearBumpBbox[2] + 10), enter: (W - nearBumpBbox[0]) + 10, pxPerFrame: NEAR_V }))
cloudLayer('cloud-far', { bump: 'Vector_4', dashL: 'Vector_6', dashR: 'Vector_5' },
  driftTrack({ exit: -(farBumpBbox[2] + 10), enter: (W - farBumpBbox[0]) + 10, pxPerFrame: FAR_V }))

// ============================================================
// Markers, doc assembly
// ============================================================
const markers = [
  { cm: 'entry', tm: 0, dr: ENTRY_SETTLE_END },
  { cm: 'float', tm: ENTRY_SETTLE_END, dr: T - ENTRY_SETTLE_END },
  { cm: 'success', tm: T, dr: OP - T },
]
const doc = {
  v: '5.9.0', fr: FPS, ip: 0, op: OP, w: W, h: H, nm: 'Money Transfer Status',
  ddd: 0, assets, layers, markers,
  slots: { checkAccent: { p: { a: 0, k: [...hexToRgb1('#22E243'), 1] } } },
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT, JSON.stringify(doc))

const controls = {
  controls: [{ sid: 'checkAccent', label: 'Check accent color' }],
  layerControls: [
    { target: 'disc-sway', kind: 'amount', property: 'rotation', label: 'Canopy sway', description: 'How far the paraglider disc tips side to side.' },
    { target: 'zenek-lag', kind: 'amount', property: 'rotation', label: 'Dangle drag', description: "How much Zenek's own dangle lags behind the canopy." },
    { target: 'bob-rig', kind: 'amount', property: 'position', label: 'Float bob', description: 'The suspended rise-and-fall of the whole assembly.' },
  ],
}
writeFileSync(join(OUT_DIR, 'controls.json'), JSON.stringify(controls, null, 2))

console.log(`Wrote ${OUT} — ${layers.length} layers, ${OP}f @ ${FPS}fps (T=${T})`)
