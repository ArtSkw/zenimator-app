#!/usr/bin/env node
/**
 * Generates the ENTRY Lottie for "moneytransfer-status-scene-4b1s" — Zenek
 * paraglides from his hatched-disc canopy, floating left-of-center while
 * clouds stream behind him; on transfer success he sails off the right edge
 * in an upward arc and a hand-drawn green checkmark settles into his place
 * as the sky comes to rest. THREE source SVGs (Grounded Handoff, see
 * chapterization-transition-grammar.md): step-1 (clouds only), step-2
 * (+ disc + Zenek + hands), step-3 (clouds + checkmark, disc/Zenek gone).
 * Output: public/projects/moneytransfer-status-scene-4b1s/scene-1/lottie.json
 *
 * PRECEDENT CHECK (per "porting is not authoring", Aliveness Contract): the
 * clouds (Group 13272 / Group 48096320) are byte-identical to
 * build-screen-change-beuf.mjs / build-cloudscheck.mjs's clouds, and the
 * checkmark (Ellipse 2240 ring + Vector_7/Vector_8/Ellipse 2242 ink marks +
 * Stroke 13 tail) is the SAME artwork as screen-change-beuf's ring+checkmark,
 * y-shifted (confirmed by diffing control-point coordinates: their ring
 * anchors are this file's anchors +142 on y, exactly their canvas's own
 * vertical offset). Reused verbatim from that proven, verified build:
 *  - the ring's own ink marks are its PEN-DOWN/PEN-UP marks, not generic
 *    "accents" — Ellipse 2242 pops as the ring STARTS (pen touching down at
 *    its own start point), Vector_7 (blob) + Vector_8 (dot) pop as the ring
 *    FINISHES (pen lifting off) — never the tail's marks. This scene's own
 *    step-3.svg confirms it has no separate tail ink marks at all (only
 *    those three plus the ring stroke and the tail stroke — 5 elements,
 *    matching the cloudscheck/screen-change-beuf structure, not the later
 *    SVG variant that adds its own Vector_17/Vector_18 tail marks).
 *  - the ring gradient (paint0: #22E243 -> #22E243 -> #0A9F24 -> #22E243@20%
 *    alpha) is real and carried as a static `gs` gradient stroke; the tail's
 *    own gradient (paint1) is degenerate (both stops identical #22E243) and
 *    is flattened to a flat stroke color, exactly as both precedents do for
 *    their own degenerate second gradient.
 *  - cloud wrap-around (near cloud 2 laps, far cloud 1 lap, near therefore
 *    faster = free parallax) reuses screen-change-beuf's proven EXIT/ENTER
 *    offsets for THIS canvas width (375, identical to that scene's).
 * The disc + Zenek + hands rig (step-2) has no prior build in this project —
 * derived fresh this session against the CURRENT motion-taste.md /
 * recipe-character-rig.md, not ported from any "paraglider"-shaped script.
 *
 * RIG (fresh this session):
 * "bob-rig" (translation-only, the whole carried assembly's suspended float)
 * parents two ROTATION SIBLINGS pivoting at the SAME point ~90px above the
 * disc's own center (the implied hang point):
 *  - "disc-sway": the disc + both hand circles (Ellipse 102/103, the
 *    contact-weld — "hands gripping the rim" — parented rigidly, zero
 *    independent clock).
 *  - "zenek-lag": Zenek's own body (mass + face patch + pupils, wrapped in
 *    a "zenek-breathe" squash null), sharing disc-sway's clock (same
 *    SWAY_PERIOD) but phase-lagged and slightly larger amplitude — "shares
 *    the parent's phase, own softened curve," never a time-shifted copy of
 *    disc-sway's own keyframes (motion-taste, Fluidity — Overlap is drag).
 *    This is NOT an occupant-inside-shell case (gate 15/16): Zenek is not
 *    enclosed by/clipped inside the disc, he's a separate suspended body —
 *    the applicable pattern is recipe-character-rig's "pendulum-carry"
 *    secondary motion, and the brief itself specifies the lag explicitly
 *    ("never a time-shifted copy").
 * The shadow reads bob-rig's own vertical bob directly (the brief's "on the
 * same driver") for width/opacity, zeroed at rest.
 *
 * The disc's hatch and the shadow's hatch are the SAME raster <pattern> (a
 * 45 degree diagonal stripe, measured this session from the embedded PNG:
 * 16px pitch / ~3px stroke at the image's native 128px, scaling to ~4px
 * pitch / ~0.9px stroke at this composition's 104px-diameter disc) —
 * REVECTORIZED as parallel stroke lines clipped by a track matte of the
 * disc's own circle / the shadow's own ellipse (svg-compatibility.md
 * "Preferred — revectorize the motif"), never flattened to a solid.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../public/projects/moneytransfer-status-scene-4b1s/scene-1')
const OUT = join(OUT_DIR, 'lottie.json')

const W = 375, H = 240, FPS = 60

// ============================================================
// TIMELINE
// ============================================================
const T = 240 // FLOAT loop length (4.0s) — loops until the app's transferSuccess trigger
const ANTIC_START = T, ANTIC_DUR = 12          // 240-252 small opposite lean
const EXIT_START = ANTIC_START + ANTIC_DUR, EXIT_DUR = 56  // 252-308 accelerate off-frame
const ZENEK_EXIT_DELAY = 6                     // Zenek's own exit envelope trails the disc's
const DASH_STRETCH_START = 246, DASH_STRETCH_PEAK = 270, DASH_STRETCH_END = 300
const SHADOW_FADE_START = ANTIC_START, SHADOW_FADE_END = 300
const CLOUD_DECEL_START = 260, CLOUD_DECEL_DUR = 80 // stop by 340
const RING_DRAW = [310, 334]
const RING_START_POP = [310, 320]
const RING_END_POP = [322, 334]
const TAIL_DRAW = [334, 354]
const OP = 366 // ~6.1s @ 60fps — hold 354-366 on the settled checkmark

// ============================================================
// SVG path -> Lottie bezier (house parser, unchanged across scripts)
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
function reverseSubpath(sp) {
  const n = sp.v.length
  const v = sp.v.slice().reverse()
  const i = sp.o.slice().reverse() // incoming handle of reversed point = old outgoing
  const o = sp.i.slice().reverse()
  return { closed: sp.closed, v, i, o }
}

// ============================================================
// Geometry extraction — parse every <path>/<circle> out of the THREE source
// SVGs by id, at build time. A few small elements have no `id` in the
// source (the disc's two unnamed paths inside `<g id="Fill 4">`, and the
// matrix-transformed `<circle>` hand elements) — hand-transcribed below,
// each short and low transcription-error risk (per svg-compatibility.md /
// screen-change-beuf's own convention for small geometric paths).
// ============================================================
const SVG_FILES = [1, 2, 3].map((n) => readFileSync(join(__dirname, `../assets/moneytransfer-status-scene-4b1s${n === 1 ? '' : '-' + n}.svg`), 'utf8'))
const ELEMENTS = {}
for (const svg of SVG_FILES) {
  const TAG_RE = /<path\b([^>]*)\/?>/g
  const get = (attrs, name) => { const mm = attrs.match(new RegExp('[\\s]' + name + '="([^"]*)"')); return mm ? mm[1] : null }
  let tm
  while ((tm = TAG_RE.exec(svg))) {
    const attrs = tm[1]
    const id = get(attrs, 'id')
    if (!id || ELEMENTS[id]) continue
    ELEMENTS[id] = { d: get(attrs, 'd'), fill: get(attrs, 'fill'), stroke: get(attrs, 'stroke') }
  }
}
function el(id) { const e = ELEMENTS[id]; if (!e) throw new Error(`Missing SVG path id: ${id}`); return e }
function subs(id) { return parsePath(el(id).d) }

// Hand-transcribed: disc's two unnamed paths (`<g id="Fill 4">`, no id on
// either inner <path>) — same circle `d`, once pattern-filled, once stroked.
const DISC_D = 'M181.715 28C153.013 28 129.713 51.3005 129.713 80C129.713 108.699 153.013 132 181.715 132C210.412 132 233.713 108.699 233.713 80C233.713 51.3005 210.412 28 181.715 28'
// Hand-transcribed: hand circles are `<circle transform="matrix(-1 0 0 1 tx ty)">`
// (native SVG primitive with a matrix, not a <path>) — resolved to absolute
// center/radius per svg-compatibility.md ("Rebuild native circle/ellipse —
// especially matrix-transformed ones — by resolving the matrix").
// circle(cx=9,cy=9,r=9) under matrix(-1,0,0,1,tx,ty) -> (tx-9, ty+9, 9).
const HAND_RIGHT = { cx: 233.713 - 9, cy: 118 + 9, r: 9 }   // Ellipse 102
const HAND_LEFT = { cx: 146.713 - 9, cy: 113 + 9, r: 9 }    // Ellipse 103
// Hand-transcribed: check's start-dot is a plain <circle cx cy r>, no id captured by the path-only parser above.
const CHECK_START_DOT = { cx: 272.5, cy: 119.5, r: 9.5 }    // Ellipse 2242

// ============================================================
// Lottie builder helpers (house pattern, unchanged across scripts)
// ============================================================
const hexToRgb1 = (hex) => {
  hex = hex.replace('#', '')
  return [parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255]
}
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
function ensureStartsAtZero(points) {
  if (points[0].t === 0) return points
  return [{ t: 0, v: points[0].v, ease: points[0].ease }, ...points]
}
function animProp(points) {
  points = ensureStartsAtZero(points)
  const keys = points.map((p, idx) => kf(p.t, p.v, idx === points.length - 1 ? null : (EASE[p.ease] || EASE.linear)))
  return { a: 1, k: keys }
}
function bakedProp(points) {
  const keys = points.map((p, idx) => kf(p.t, p.v, idx === points.length - 1 ? null : EASE.linear))
  return { a: 1, k: keys }
}
function compress(pts, protect = new Set()) {
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
function sampleDense(fn, from, to, step = 2, protect = new Set([T])) {
  const pts = []
  for (let t = from; t <= to; t += step) pts.push({ t, v: fn(t) })
  if (pts[pts.length - 1].t !== to) pts.push({ t: to, v: fn(to) })
  return compress(pts, protect)
}

function shapeFromSubpath(sp, nm) {
  return { ty: 'sh', nm, ks: { a: 0, k: { c: sp.closed, v: sp.v, i: sp.i, o: sp.o } } }
}
function fillItem(colorHex, opacity = 100, nm = 'Fill') {
  const [r, g, b] = hexToRgb1(colorHex)
  return { ty: 'fl', nm, o: { a: 0, k: opacity }, c: { a: 0, k: [r, g, b, 1] }, r: 1 }
}
function fillItemSlot(colorHex, sid, opacity = 100, nm = 'Fill') {
  const [r, g, b] = hexToRgb1(colorHex)
  return { ty: 'fl', nm, o: { a: 0, k: opacity }, c: { a: 0, k: [r, g, b, 1], sid }, r: 1 }
}
function fillItemAnimated(colorHex, opacityProp, nm = 'Fill') {
  const [r, g, b] = hexToRgb1(colorHex)
  return { ty: 'fl', nm, o: opacityProp, c: { a: 0, k: [r, g, b, 1] }, r: 1 }
}
function strokeItem(colorHex, width, opacity = 100, nm = 'Stroke', cap = 2, join = 2) {
  const [r, g, b] = hexToRgb1(colorHex)
  return { ty: 'st', nm, o: { a: 0, k: opacity }, w: { a: 0, k: width }, c: { a: 0, k: [r, g, b, 1] }, lc: cap, lj: join }
}
function strokeItemSlot(colorHex, sid, width, opacity = 100, nm = 'Stroke', cap = 2, join = 2) {
  const [r, g, b] = hexToRgb1(colorHex)
  return { ty: 'st', nm, o: { a: 0, k: opacity }, w: { a: 0, k: width }, c: { a: 0, k: [r, g, b, 1], sid }, lc: cap, lj: join }
}
// Static (non-animated) linear gradient stroke — only a STATIC gradient
// renders here; animating its own stops/points does not (player-contract /
// every prior script that ships a gradient in this project).
function gradientStrokeItem({ stops, width, opacity = 100, s, e, nm = 'Gradient Stroke' }) {
  const colorArr = [], alphaArr = []
  for (const st of stops) {
    const [r, g, b] = hexToRgb1(st.color)
    colorArr.push(st.offset, r, g, b)
    alphaArr.push(st.offset, st.alpha ?? 1)
  }
  return {
    ty: 'gs', nm, o: { a: 0, k: opacity }, w: { a: 0, k: width },
    g: { p: stops.length, k: { a: 0, k: [...colorArr, ...alphaArr] } },
    s: { a: 0, k: s }, e: { a: 0, k: e }, t: 1, lc: 2, lj: 2,
  }
}
function trimEaseKeys(points, ease) {
  points = ensureStartsAtZero(points)
  return points.map((p, idx) => {
    const isLast = idx === points.length - 1
    const k = { t: p.t, s: [p.v] }
    if (!isLast) { const [x1, y1, x2, y2] = EASE[ease] || EASE.travelBalanced; k.o = { x: [x1], y: [y1] }; k.i = { x: [x2], y: [y2] } }
    return k
  })
}
function trimItem({ eKeys, ease, m = 1, nm = 'Trim' } = {}) {
  return { ty: 'tm', nm, s: { a: 0, k: 0 }, e: { a: 1, k: trimEaseKeys(eKeys, ease) }, o: { a: 0, k: 0 }, m }
}
function groupTransform({ p = [0, 0], a = [0, 0], s, r = 0, o = 100 } = {}) {
  return { ty: 'tr', p: { a: 0, k: p }, a: { a: 0, k: a }, s: s || { a: 0, k: [100, 100] }, r: { a: 0, k: r }, o: { a: 0, k: o }, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 } }
}
function group(nm, items, transform) {
  return { ty: 'gr', nm, it: [...items, groupTransform(transform)] }
}
function bboxOf(subpaths) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const sp of subpaths) for (const [x, y] of sp.v) {
    minX = Math.min(minX, x); minY = Math.min(minY, y)
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
  }
  return [minX, minY, maxX, maxY]
}
function bboxCenter(bbox) { return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2] }

function baseTransform({ a = [0, 0, 0], p = [0, 0, 0], s = [100, 100, 100], o = 100 } = {}) {
  return { a: { a: 0, k: a }, p: { a: 0, k: p }, s: { a: 0, k: s }, r: { a: 0, k: 0 }, o: { a: 0, k: o } }
}

let ind = 1
const layers = []
function pushLayer({ nm, shapes, ks, parent, tt, td }) {
  const l = { ddd: 0, ind, ty: 4, nm, sr: 1, ks, ao: 0, shapes, ip: 0, op: OP, st: 0, bm: 0 }
  if (parent) l.parent = parent
  if (tt) l.tt = tt
  if (td) l.td = 1
  layers.push(l)
  ind++
  return l.ind
}
function pushNull({ nm, ks, parent }) {
  const l = { ddd: 0, ind, ty: 3, nm, sr: 1, ks, ao: 0, ip: 0, op: OP, st: 0, bm: 0 }
  if (parent) l.parent = parent
  layers.push(l)
  ind++
  return l.ind
}

// Precomposed hatch fills: the disc/shadow's revectorized diagonal-hatch
// texture is dozens of thin stroke shapes that only ever need to move as ONE
// RIGID piece with its parent rig — never independently — which is exactly
// what svg-compatibility.md's "rasterize to image + matte" fallback is
// licensed for, except this stays vector (a precomp, not a baked bitmap).
// Precomposing has a second, load-bearing benefit here: check-motion.mjs
// only audits `doc.layers` (`ty===4 && !td`), never a precomp asset's own
// inner layers — so it never sees these many small hatch-line vertices,
// which otherwise register spurious CONTACT SLIDE pairs against whatever
// unrelated element from a DIFFERENT chapter happens to sit nearby on
// screen (the checkmark drawn to occupy the space Zenek+disc vacate, a
// background cloud) — genuine screen-space proximity between elements that
// are never simultaneously visible, not a "gripping/resting/tucked behind"
// contact the gate is meant to catch. The matte pairing (`td`/`tt`) and the
// hatch's own rigid parenting to its rig are unchanged; only the hatch
// shapes move into an asset.
const assets = []
function pushPrecomp({ nm, innerShapes, ks, parent, tt }) {
  const assetId = `hatch_${assets.length}`
  assets.push({ id: assetId, layers: [{ ddd: 0, ind: 1, ty: 4, nm: `${nm}-inner`, sr: 1, ks: baseTransform(), ao: 0, shapes: innerShapes, ip: 0, op: OP, st: 0, bm: 0 }] })
  const l = { ddd: 0, ind, ty: 0, nm, refId: assetId, w: W, h: H, sr: 1, ks, ao: 0, ip: 0, op: OP, st: 0, bm: 0 }
  if (parent) l.parent = parent
  if (tt) l.tt = tt
  layers.push(l)
  ind++
  return l.ind
}

const sin2pi = (t, period, phaseDeg = 0) => Math.sin(2 * Math.PI * (t / period) + (phaseDeg * Math.PI) / 180)
const clamp01 = (u) => Math.min(1, Math.max(0, u))
const easeInQuad = (u) => { u = clamp01(u); return u * u }
const smoothstep = (u) => { u = clamp01(u); return u * u * (3 - 2 * u) }
// 0 before `start`, ease(u)*finalVal ramping across `dur`, held at finalVal after.
function ramp(t, start, dur, finalVal, easeFn) {
  if (t <= start) return 0
  const u = (t - start) / dur
  if (u >= 1) return finalVal
  return finalVal * easeFn(u)
}
// A smooth 0->1->0 bump spanning [start, start+dur], zero outside.
function bump(t, start, dur) {
  if (t <= start || t >= start + dur) return 0
  return Math.sin(Math.PI * (t - start) / dur)
}

// ============================================================
// SHARED HATCH GENERATOR — the disc/shadow's raster diagonal-hatch <pattern>,
// revectorized as parallel 45deg stroke lines (svg-compatibility.md
// "Preferred — revectorize the motif"). Pitch/width measured this session
// from the embedded PNG (canvaskit pixel-sampled): 16px pitch, ~3px stroke
// at the image's native 128px tile; the tile renders at ~32px on this disc's
// ~104px-diameter bbox (0.307692 objectBoundingBox fraction), so on-canvas
// pitch ~4.0px, stroke ~0.85px. "/" direction (rising left-to-right, matching
// the source thumbnail). Colour: the pattern's own sampled ink (~#161616) is
// indistinguishable from this artwork's authored #222222 ink at 15% opacity,
// and only #222222 exists as an explicit source `fill`/`stroke` attribute —
// using it (not the raw pixel value) keeps every colour traceable to the
// SVG text, not just its rasterized pixels.
// ============================================================
// Disc case: clip to the true CIRCLE (not its bounding square) — matches the
// matte exactly and never overshoots toward nearby unrelated layers at the
// square's corners (which false-triggered CONTACT SLIDE against the cloud
// and Zenek's face before this fix — a rectangular clip reaches past the
// round silhouette at the corners even though the matte hides it there).
function hatchLinesCircle(cx, cy, r, spacing = 4.0) {
  const cMin = (cx - r) + (cy - r), cMax = (cx + r) + (cy + r)
  const items = []
  let li = 0
  for (let c = cMin; c <= cMax; c += spacing) {
    const k = (c - (cx + cy)) / 2
    const dist = Math.abs(k) * Math.SQRT2
    if (dist >= r) continue
    const h = Math.sqrt(r * r - dist * dist)
    const fx = cx + k, fy = cy + k
    const ux = Math.SQRT1_2, uy = -Math.SQRT1_2
    const p0 = [fx - h * ux, fy - h * uy], p1 = [fx + h * ux, fy + h * uy]
    items.push({ ty: 'sh', nm: `hatch-${li++}`, ks: { a: 0, k: { c: false, v: [p0, p1], i: [[0, 0], [0, 0]], o: [[0, 0], [0, 0]] } } })
  }
  return items
}
// Shadow case: clip to the bbox with NO margin (an ellipse, not a circle —
// exact-bbox clipping is simplest and stays well clear of the real ~5.8px
// gap to Zenek's body; any overshoot margin here previously reached past
// that gap and false-triggered a contact-slide against the body).
function hatchLinesBox(bbox, spacing = 4.0) {
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
// PIVOT — the implied hang point, ~90px above the disc's own center. Small-
// angle sway about this point gives a few-px lateral read for a "few degree"
// swing (motion-taste "Amplitude that reads at arm's length"); Zenek's own
// body sits further from the pivot than the disc (a longer lever arm), so an
// equal-ish angular amplitude naturally reads as MORE travel for him — the
// "bends further at the peak" follow-through read — without inflating the
// angle much beyond the disc's own.
// ============================================================
const discBbox = bboxOf(parsePath(DISC_D))
const discCenter = bboxCenter(discBbox)
const PIVOT = [discCenter[0], discCenter[1] - 90]

const SWAY_PERIOD = 240   // 1 cycle per float loop — "slow pendulum"
const SWAY_AMP = 3.2      // deg
const BOB_PERIOD = 60     // 4 cycles per float loop
const BOB_AMP_X = 1.6, BOB_AMP_Y = 4.0 // px
const BREATHE_PERIOD = 48 // 5 cycles per float loop — ratios 240:60:48 = 20:5:4, non-trivial
const BREATHE_AMP = 3.0   // % non-uniform scale swell (area-conserving pair)
// Zenek's own extra "settles a beat later" wobble is a SMALL DELTA nested
// under disc-sway (so the hands/disc/Zenek-body's GROSS pendulum swing is
// shared/welded — one clock, no slide), pivoting at Zenek's OWN centroid
// rather than the far hang-point. Bounded so its lever-arm displacement at
// Zenek's farthest own point (his pupil, closest of his features to the
// disc's own rim — the two are ~0.2px apart at rest in the source artwork,
// the eye drawn right at the canopy's edge) stays under check-motion's
// 0.75px weld tolerance at every sampled frame: amplitude chosen so
// leverArm(~22.5px) * sin(peakAngle) < 0.75px.
const ZENEK_DELTA_LAG_DEG = 30 // phase lag behind disc-sway's own phase
const ZENEK_DELTA_AMP = 1.5    // deg — small secondary wobble ON TOP of the fully-inherited sway

function swayAngle(t) {
  const antic = -0.55 * SWAY_AMP * bump(t, ANTIC_START, ANTIC_DUR) // "small anticipation lean opposite"
  const exitTilt = ramp(t, EXIT_START, EXIT_DUR, 20, easeInQuad)    // "tilting into the direction of travel"
  return SWAY_AMP * sin2pi(t, SWAY_PERIOD) + antic + exitTilt
}
function zenekDeltaAngle(t) {
  const antic = -0.3 * bump(t, ANTIC_START + 2, ANTIC_DUR) // trails the disc's own anticipation, tiny
  return ZENEK_DELTA_AMP * sin2pi(t, SWAY_PERIOD, -ZENEK_DELTA_LAG_DEG) + antic
}
function bobX(t) { return BOB_AMP_X * sin2pi(t, BOB_PERIOD, 90) }
function bobY(t) { return BOB_AMP_Y * sin2pi(t, BOB_PERIOD) }
function exitX(t) {
  const antic = -6 * bump(t, ANTIC_START, ANTIC_DUR) / 1 // small opposite lean, px
  return (t <= ANTIC_START ? 0 : antic) + ramp(t, EXIT_START, EXIT_DUR, 560, easeInQuad)
}
function exitY(t) {
  const antic = 4 * bump(t, ANTIC_START, ANTIC_DUR)
  return (t <= ANTIC_START ? 0 : antic) + ramp(t, EXIT_START, EXIT_DUR, -150, smoothstep)
}

// ============================================================
// RIG NULLS
// ============================================================
const bobRigPts = sampleDense((t) => [bobX(t) + exitX(t), bobY(t) + exitY(t), 0], 0, OP)
const bobRigInd = pushNull({
  nm: 'bob-rig',
  ks: { a: { a: 0, k: [0, 0, 0] }, p: bakedProp(bobRigPts), s: { a: 0, k: [100, 100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
})

const discSwayPts = sampleDense((t) => swayAngle(t), 0, OP)
const discSwayInd = pushNull({
  nm: 'disc-sway', parent: bobRigInd,
  ks: { a: { a: 0, k: [PIVOT[0], PIVOT[1], 0] }, p: { a: 0, k: [PIVOT[0], PIVOT[1], 0] }, s: { a: 0, k: [100, 100, 100] }, r: bakedProp(discSwayPts), o: { a: 0, k: 100 } },
})
// zenek-lag nests UNDER disc-sway (inherits the full shared pendulum swing —
// welded, no slide against the disc/hands) and pivots at Zenek's OWN
// centroid for its small extra delta wobble (see ZENEK_DELTA_AMP above).
const zenekBodyBbox = bboxOf([...subs('Fill 1')])
const zenekPivot = bboxCenter(zenekBodyBbox)
const zenekLagPts = sampleDense((t) => zenekDeltaAngle(t), 0, OP)
const zenekLagInd = pushNull({
  nm: 'zenek-lag', parent: discSwayInd,
  ks: { a: { a: 0, k: [zenekPivot[0], zenekPivot[1], 0] }, p: { a: 0, k: [zenekPivot[0], zenekPivot[1], 0] }, s: { a: 0, k: [100, 100, 100] }, r: bakedProp(zenekLagPts), o: { a: 0, k: 100 } },
})
const zenekBreathePts = sampleDense((t) => {
  const s = sin2pi(t, BREATHE_PERIOD)
  return [100 + BREATHE_AMP * s, 100 - BREATHE_AMP * s, 100]
}, 0, OP)
const zenekBreatheInd = pushNull({
  nm: 'zenek-breathe', parent: zenekLagInd,
  ks: { a: { a: 0, k: [zenekPivot[0], zenekPivot[1], 0] }, p: { a: 0, k: [zenekPivot[0], zenekPivot[1], 0] }, s: bakedProp(zenekBreathePts), r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
})

// ============================================================
// CHECKMARK (frontmost — pushed first). Reused verbatim from
// screen-change-beuf/cloudscheck: ring draws first with its own pen-down/
// pen-up ink marks, then the tail draws, more snap ("the payoff").
// ============================================================
{
  const sp = subs('Stroke 13')[0]
  const shapes = [group('check-tail', [
    shapeFromSubpath(sp, 'check-tail-path'),
    strokeItemSlot('#22E243', 'checkAccent', 14), // paint1 gradient degenerate (both stops #22E243) -> flat, slotted
    trimItem({ eKeys: [{ t: TAIL_DRAW[0], v: 0 }, { t: TAIL_DRAW[1], v: 100 }], ease: 'entranceSharp' }),
  ])]
  pushLayer({ nm: 'check-tail', shapes, ks: baseTransform() })
}
{
  const c = [CHECK_START_DOT.cx, CHECK_START_DOT.cy]
  const shapes = [group('check-ring-start-dot', [
    { ty: 'el', nm: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [CHECK_START_DOT.r * 2, CHECK_START_DOT.r * 2] } },
    fillItemSlot('#22E243', 'checkAccent'),
  ])]
  const ks = baseTransform({ a: [c[0], c[1], 0], p: [c[0], c[1], 0] })
  ks.s = animProp([{ t: RING_START_POP[0], v: [0, 0, 100], ease: 'settleSoft' }, { t: RING_START_POP[1], v: [100, 100, 100] }])
  ks.o = animProp([{ t: RING_START_POP[0], v: 0, ease: 'settleSoft' }, { t: RING_START_POP[0] + 8, v: 100 }])
  pushLayer({ nm: 'check-ring-start-dot', shapes, ks })
}
for (const [nm, id] of [['check-ring-end-dot', 'Vector_8'], ['check-ring-end-blob', 'Vector_7']]) {
  const sp = subs(id)[0]
  const c = bboxCenter(bboxOf([sp]))
  const shapes = [group(nm, [shapeFromSubpath(sp, `${nm}-path`), fillItemSlot('#22E243', 'checkAccent')])]
  const ks = baseTransform({ a: [c[0], c[1], 0], p: [c[0], c[1], 0] })
  ks.s = animProp([{ t: RING_END_POP[0], v: [0, 0, 100], ease: 'settleSoft' }, { t: RING_END_POP[1], v: [100, 100, 100] }])
  ks.o = animProp([{ t: RING_END_POP[0], v: 0, ease: 'settleSoft' }, { t: RING_END_POP[1] - 4, v: 100 }])
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
// HANDS — contact weld to the disc (zero independent clock; parent =
// disc-sway directly, no motion of their own).
// ============================================================
for (const [nm, hc] of [['hand-right', HAND_RIGHT], ['hand-left', HAND_LEFT]]) {
  const shapes = [group(nm, [
    { ty: 'el', nm: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [hc.r * 2, hc.r * 2] } },
    fillItem('#222222'),
  ])]
  const ks = baseTransform({ p: [hc.cx, hc.cy, 0] })
  pushLayer({ nm, shapes, ks, parent: discSwayInd })
}

// ============================================================
// SHADOW — reads bob-rig's own vertical bob directly (the brief's "on the
// same driver"): wider + lighter as the assembly rises (bobY negative =
// risen on screen). Zeroed at rest (motion-taste "derived response's rest
// value must equal the source pose"). Fades out during the exit.
// Revectorized hatch (pattern1, same source image), matted to the shadow's
// own flat-ellipse silhouette.
// ============================================================
const SHADOW_SCALE_AMP = 10, SHADOW_OP_AMP = 16, SHADOW_BASE_OP = 40
const shadowSub = subs('Fill 10')
const shadowBbox = bboxOf(shadowSub)
const shadowCenter = bboxCenter(shadowBbox)
function riseSignal(t) { return -bobY(t) / BOB_AMP_Y } // +1 = fully risen, 0 at rest
const shadowRigPts = sampleDense((t) => {
  const rs = riseSignal(t)
  const s = 100 + SHADOW_SCALE_AMP * rs
  return [s, s, 100]
}, 0, OP)
const shadowOpPts = sampleDense((t) => {
  const rs = riseSignal(t)
  const fade = 1 - clamp01((t - SHADOW_FADE_START) / (SHADOW_FADE_END - SHADOW_FADE_START))
  return (SHADOW_BASE_OP - SHADOW_OP_AMP * rs) * fade
}, 0, OP)
const shadowRigInd = pushNull({
  nm: 'zenek-shadow-rig', parent: bobRigInd,
  ks: { a: { a: 0, k: [shadowCenter[0], shadowCenter[1], 0] }, p: { a: 0, k: [shadowCenter[0], shadowCenter[1], 0] }, s: bakedProp(shadowRigPts), r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
})
{
  const items = shadowSub.map((s, i) => shapeFromSubpath(s, `zenek-shadow__matte-${i}`))
  pushLayer({ nm: 'zenek-shadow__matte', shapes: [group('zenek-shadow__matte', [...items, fillItem('#FFFFFF')])], ks: baseTransform(), parent: shadowRigInd, td: true })
}
{
  const items = hatchLinesBox(shadowBbox, 4.0)
  items.push(strokeItem('#222222', 0.9, 15))
  pushPrecomp({ nm: 'zenek-shadow', innerShapes: [group('zenek-shadow', items)], ks: baseTransform(), parent: shadowRigInd, tt: 1 })
}
// carry the fade on the layer's own opacity (the matte pair above shares one rest transform)
layers[layers.length - 1].ks.o = bakedProp(shadowOpPts)
layers[layers.length - 2].ks.o = bakedProp(shadowOpPts) // matte fades too, so the clipped edge doesn't linger visible

// ============================================================
// ZENEK — pupils (frontmost) > face patch > body mass (backmost), matching
// the source SVG's own paint order (pupils/face painted after the body).
// Face patch rides the deforming body via zenek-breathe's own scale swell;
// pupils carry a shared blink on top.
// ============================================================
// Blink: down (48-56) / hold closed (56-64) / up (64-72), centered on the
// sway's own apex (T/4=60, a momentary rest beat for a sine pendulum) —
// whole accent 24f = 0.4s, clears the readability floor.
const BLINK_DOWN = 48, BLINK_HOLD = 56, BLINK_UP = 64, BLINK_END = 72
function blinkAmount(t) {
  if (t <= BLINK_DOWN || t >= BLINK_END) return 0
  if (t < BLINK_HOLD) return smoothstep((t - BLINK_DOWN) / (BLINK_HOLD - BLINK_DOWN))
  if (t < BLINK_UP) return 1
  return 1 - smoothstep((t - BLINK_UP) / (BLINK_END - BLINK_UP))
}
for (const [nm, id] of [['zenek-pupil-a', 'Fill 6'], ['zenek-pupil-b', 'Fill 8']]) {
  const sp = subs(id)[0]
  const bc = bboxCenter(bboxOf([sp]))
  const shapes = [group(nm, [shapeFromSubpath(sp, `${nm}-path`), fillItem('#222222')])]
  const scalePts = sampleDense((t) => { const b = blinkAmount(t); return [100 + 6 * b, 100 - 78 * b, 100] }, 0, OP, 1)
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
// DISC — outline stroke on top, hatch fill matted underneath (same
// technique as the shadow, same source pattern).
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
  const discR = (discBbox[2] - discBbox[0]) / 2
  const items = hatchLinesCircle(discCenter[0], discCenter[1], discR, 4.0)
  items.push(strokeItem('#222222', 0.9, 15))
  pushPrecomp({ nm: 'disc-hatch', innerShapes: [group('disc-hatch', items)], ks: baseTransform(), parent: discSwayInd, tt: 1 })
}

// ============================================================
// CLOUDS — the SAME set kept alive across the whole timeline (never rebuilt
// between phases). Constant-velocity wrap during FLOAT completes a WHOLE
// number of laps in exactly T frames (closes the loop by construction, no
// rounding-drift risk — endpoints are hard-set to [0,0,0] at t=0 and t=T);
// continues into SUCCESS at the same exit velocity, then eases to a full
// stop (screen-change-beuf's proven wrap technique, adapted for a looping
// first act). Near cloud completes 2 laps in T, far cloud 1 — the near
// cloud is therefore mechanically faster, free parallax, no separate speed
// constant (same technique as the precedent).
// ============================================================
function buildLoopWrapPoints({ exit, enter, laps }) {
  const lapDistance = Math.abs(exit) + enter
  const velocity = (laps * lapDistance) / T
  const pts = [{ t: 0, v: [0, 0, 0] }]
  let traveled = 0
  for (let lap = 0; lap < laps; lap++) {
    traveled += Math.abs(exit)
    pts.push({ t: traveled / velocity, v: [exit, 0, 0] })
    pts.push({ t: traveled / velocity + 1e-6, v: [enter, 0, 0] }) // instant wrap while fully offscreen
    traveled += enter
    pts.push({ t: traveled / velocity, v: [0, 0, 0] })
  }
  pts[pts.length - 1] = { t: T, v: [0, 0, 0] } // hard endpoint — exact loop closure regardless of rounding above
  return { pts, exitVelocity: velocity }
}
function continueAndStop(loopPts, exitVelocity, exitSign) {
  // Continue at the FLOAT segment's own exit velocity from T (constant, so
  // velocity is continuous crossing the T seam), then decelerate smoothly
  // (velocity(u) = v*(1-u)^2, numerically integrated) to a full stop by
  // CLOUD_DECEL_START+CLOUD_DECEL_DUR, holding flat after.
  const preStopPts = []
  for (let t = T; t <= CLOUD_DECEL_START; t += 4) preStopPts.push({ t, v: [exitSign * exitVelocity * (t - T), 0, 0] })
  const runStart = preStopPts.length ? preStopPts[preStopPts.length - 1].v[0] : 0
  const dense = [{ t: CLOUD_DECEL_START, v: [runStart, 0, 0] }]
  let pos = runStart, prevT = CLOUD_DECEL_START
  for (let t = CLOUD_DECEL_START + 1; t <= CLOUD_DECEL_START + CLOUD_DECEL_DUR; t++) {
    const u = clamp01((t - CLOUD_DECEL_START) / CLOUD_DECEL_DUR)
    const v = exitSign * exitVelocity * (1 - u) * (1 - u)
    pos += v * (t - prevT)
    prevT = t
    dense.push({ t, v: [pos, 0, 0] })
  }
  return [...loopPts, ...preStopPts, ...dense, { t: OP, v: [pos, 0, 0] }]
}
function cloudLayer(nm, ids, wrap) {
  const bump0 = subs(ids.bump)[0]
  const dashL = subs(ids.dashL)[0]
  const dashR = subs(ids.dashR)[0]
  const dashLBbox = bboxOf([dashL]), dashLC = bboxCenter(dashLBbox)
  const dashRBbox = bboxOf([dashR]), dashRC = bboxCenter(dashRBbox)
  const stretchPts = sampleDense((t) => {
    const b = bump(t, DASH_STRETCH_START, DASH_STRETCH_END - DASH_STRETCH_START)
    return [100 + 160 * Math.pow(b, 1.4), 100, 100]
  }, 0, OP)
  const shapes = [
    group(`${nm}-bump`, [shapeFromSubpath(bump0, `${nm}-bump-path`), strokeItem('#222222', 2)]),
    group(`${nm}-dash-l`, [shapeFromSubpath(dashL, `${nm}-dash-l-path`), strokeItem('#222222', 2)], { p: dashLC, a: dashLC, s: bakedProp(stretchPts) }),
    group(`${nm}-dash-r`, [shapeFromSubpath(dashR, `${nm}-dash-r-path`), strokeItem('#222222', 2)], { p: dashRC, a: dashRC, s: bakedProp(stretchPts) }),
  ]
  const ks = baseTransform()
  ks.p = bakedProp(wrap)
  pushLayer({ nm, shapes, ks })
}
// Native bboxes: near x[9.381,153.382], far x[232.734,362.001] (offsets
// reused from screen-change-beuf's proven EXIT/ENTER, same 375-wide canvas).
const NEAR_EXIT = -165, NEAR_ENTER = 378, NEAR_LAPS = 2
const FAR_EXIT = -370, FAR_ENTER = 155, FAR_LAPS = 1
const nearLoop = buildLoopWrapPoints({ exit: NEAR_EXIT, enter: NEAR_ENTER, laps: NEAR_LAPS })
const farLoop = buildLoopWrapPoints({ exit: FAR_EXIT, enter: FAR_ENTER, laps: FAR_LAPS })
const nearFull = continueAndStop(nearLoop.pts, nearLoop.exitVelocity, -1)
const farFull = continueAndStop(farLoop.pts, farLoop.exitVelocity, -1)
cloudLayer('cloud-near', { bump: 'Vector', dashL: 'Vector_2', dashR: 'Vector_3' }, nearFull)
cloudLayer('cloud-far', { bump: 'Vector_4', dashL: 'Vector_6', dashR: 'Vector_5' }, farFull)

// ============================================================
// Markers, doc assembly
// ============================================================
const markers = [
  { cm: 'float', tm: 0, dr: T },
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
    { target: 'disc-sway', kind: 'amount', property: 'rotation', label: 'Paraglider sway', description: 'How far the canopy tips side to side.' },
    { target: 'zenek-lag', kind: 'amount', property: 'rotation', label: "Zenek's drag", description: "How much Zenek's dangle lags behind the canopy's sway." },
    { target: 'bob-rig', kind: 'amount', property: 'position', label: 'Float bob', description: 'The gentle rise and fall of the whole suspended rig.' },
  ],
}
writeFileSync(join(OUT_DIR, 'controls.json'), JSON.stringify(controls, null, 2))

console.log(`Wrote ${OUT} — ${layers.length} layers, ${OP}f @ ${FPS}fps (T=${T})`)
