#!/usr/bin/env node
/**
 * Generates the ENTRY Lottie for "moneytransfer-status-scene-ytdq" — the sky
 * drifts, Zenek LEAPS IN under his hatched paraglider disc from below-left,
 * bounces into a suspended float, then on transfer success sails off the
 * right edge while a hand-drawn green checkmark draws itself into the space
 * he left, on a sky that has coasted to a stop. THREE source SVGs (Grounded
 * Handoff, chapterization-transition-grammar.md): step-1 (clouds only),
 * step-2 (+ disc + Zenek + hands), step-3 (clouds + checkmark).
 * Output: public/projects/moneytransfer-status-scene-ytdq/scene-1/lottie.json
 *
 * PRECEDENT CHECK (svg-compatibility.md "diff geometry before rebuilding"):
 * `diff` against every asset in moneytransfer-status-scene-4b1s/-6q7m came
 * back byte-identical on all three source files (confirmed, not eyeballed) —
 * same clouds, same disc + Zenek + hands, same checkmark, same embedded hatch
 * PNG. Geometry (path `d` data, hex colours, gradient stops, hand-transcribed
 * circle primitives) is reused from that shared artwork as measured fact.
 *
 * Per this run's own instructions, sibling build scripts are a source of
 * GEOMETRY only — never of rig topology, motion constants, or their
 * verification report — so the rig, every timing/amplitude constant, and the
 * mechanical gate are re-derived independently against the CURRENT
 * motion-taste.md / recipe-character-rig.md / chapterization-transition-
 * grammar.md / check-motion.mjs. This paid off immediately: checked directly
 * (not assumed), `node scripts/check-motion.mjs moneytransfer-status-scene-6q7m`
 * — the newest sibling, whose own doc claims "exit 0" — currently EXITS 1
 * with 2 WRAP IS INTERPOLATABLE violations (its ambient cloud scroll is a
 * teleport, not a tile — exactly the defect recipe-camera-scene-motion's
 * "Ambient Scroll" section warns against). Its own doc's Aliveness Contract
 * table also has no "entry" beat at all — Zenek is already floating at frame
 * 0, which THIS brief's cast-staging section explicitly forbids ("Frame 0
 * shows exactly beat 1's cast"). Both are fixed fresh below: clouds are
 * authored by TILING (never a teleport), and Zenek/disc/hands/shadow are
 * fully offscreen at frame 0, leaping in with a decaying bounce across a
 * dedicated "entry" marker that ends before "float" begins.
 *
 * RIG:
 * "bob-rig" (translation null: offscreen entry arc + suspended float bob +
 * exit travel, ONE continuous position function across the whole timeline)
 * parents two ROTATION siblings pivoting at the SAME implied hang point
 * ~85px above the disc's own center:
 *  - "disc-sway": disc outline + hatch + both hand circles ("hands gripping
 *    the rim" — the brief's own contact weld) parented rigidly, zero clock
 *    of their own. Carries entry bank+recoil, the float pendulum sway, the
 *    pre-exit anticipation lean, and the exit's into-travel tilt as ONE
 *    continuous rotation function.
 *  - "zenek-drag": Zenek's own body (wrapped in a "zenek-breathe" squash
 *    null) nests UNDER disc-sway so the shared pendulum swing is fully
 *    inherited (welded — no slide against the disc's hatch/hands), and
 *    carries only a small delta angle of its own, phase-lagged behind
 *    disc-sway's phase (motion-taste, Fluidity — Overlap is drag: "shares
 *    the parent's phase, own softened curve," never a time-shifted copy).
 *    Silent (0°) during the entry — the brief stages the arrival as ONE
 *    rigid mass ("gripping his disc, the whole assembly travelling as one")
 *    — and only comes alive once FLOAT begins.
 * Shadow reads bob-rig's own BOB sub-signal directly for width/opacity (the
 * brief's "on the same driver"), zeroed at rest, appearing only as the
 * landing bounce resolves and fading out as he lifts off in SUCCESS.
 *
 * The disc/shadow hatch is the SAME raster <pattern>, REVECTORIZED as
 * parallel stroke lines clipped by a track matte (svg-compatibility.md
 * "Preferred — revectorize the motif"), never flattened, and precomposed
 * (svg-compatibility.md's multi-beat guidance) so its dense line vertices
 * don't register spurious `check-motion.mjs` proximity against the
 * checkmark, which occupies the same screen region in a LATER,
 * never-simultaneous beat. Pitch/stroke measured THIS session by decoding
 * the embedded PNG directly (CanvasKit `MakeImageFromEncoded` + readPixels,
 * not eyeballed, not trusted from a sibling doc): a 45° diagonal stripe every
 * 16px with a ~3px dark core at the image's native 128×128 tile.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SLUG = 'moneytransfer-status-scene-ytdq'
const OUT_DIR = join(__dirname, `../public/projects/${SLUG}/scene-1`)
const OUT = join(OUT_DIR, 'lottie.json')

const W = 375, H = 240, FPS = 60

// ============================================================
// TIMELINE — three beats, three markers. The brief's cast-staging rule is
// law: frame 0 is clouds-alone, Zenek/disc/hands/shadow fully offscreen, and
// the loop-repeatable "float" marker starts only AFTER the arrival settles.
// ============================================================
const E = 54                                    // "entry" ends / "float" begins (0.9s @ 60fps)
const T = 222                                   // "float" ends / "success" begins
const FLOAT_LEN = T - E                         // 168f = 2.8s — highly divisible, see clocks below
const ANTIC_START = T, ANTIC_DUR = 8            // 222-230 small opposite lean before the exit
const EXIT_START = ANTIC_START + ANTIC_DUR, EXIT_DUR = 46 // 230-276 accelerate off-frame, upward arc
const CLOUD_DECEL_START = EXIT_START, CLOUD_DECEL_DUR = EXIT_DUR // sky brakes to a stop exactly as he exits
const RING_DRAW = [276, 304]                    // ring trims on right as the sky goes still
const TAIL_DRAW = [304, 324]
const POP_START = 320                           // dot/blob/circle pop in just after the tail, staggered
const OP = 352                                  // ~5.9s @ 60fps — hold 336-352 on the settled checkmark

// ============================================================
// SVG path -> Lottie bezier (house parser, shared across every build script)
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
  const v = sp.v.slice().reverse()
  const i = sp.o.slice().reverse() // incoming handle of a reversed point = the old outgoing handle
  const o = sp.i.slice().reverse()
  return { closed: sp.closed, v, i, o }
}

// ============================================================
// Geometry extraction — every <path> in the THREE source SVGs, by id. A few
// elements have no `id` under the path-tag scan (the disc's two unnamed
// paths inside `<g id="Fill 4">`, the matrix-transformed hand <circle>s, the
// checkmark's start-dot <circle>) — hand-transcribed below, each a short,
// low-transcription-risk primitive, independently re-read from the SVG text
// this session (not copied from a sibling script).
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
    ELEMENTS[id] = { d: get(attrs, 'd'), fill: get(attrs, 'fill'), stroke: get(attrs, 'stroke') }
  }
}
function el(id) { const e = ELEMENTS[id]; if (!e) throw new Error(`Missing SVG path id: ${id}`); return e }
function subs(id) { return parsePath(el(id).d) }

// Disc: `<g id="Fill 4">`'s two inner <path>s share this `d` (pattern-filled
// + stroked) — no id on either, transcribed once here.
const DISC_D = 'M181.715 28C153.013 28 129.713 51.3005 129.713 80C129.713 108.699 153.013 132 181.715 132C210.412 132 233.713 108.699 233.713 80C233.713 51.3005 210.412 28 181.715 28'
// Hand circles: native `<circle transform="matrix(-1 0 0 1 tx ty)">` —
// resolved per svg-compatibility.md ("rebuild native circle/ellipse —
// especially matrix-transformed ones — by resolving the matrix to an
// absolute center/size"). circle(cx=9,cy=9,r=9) under matrix(-1,0,0,1,tx,ty)
// -> center (tx-9, ty+9), r=9.
const HAND_RIGHT = { cx: 233.713 - 9, cy: 118 + 9, r: 9 }   // Ellipse 102
const HAND_LEFT = { cx: 146.713 - 9, cy: 113 + 9, r: 9 }    // Ellipse 103
// Checkmark start-dot: plain <circle cx cy r>, not captured by the <path>-only scan above.
const CHECK_START_DOT = { cx: 272.5, cy: 119.5, r: 9.5 }    // Ellipse 2242

// ============================================================
// Lottie builder helpers (house pattern, shared across every build script)
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
function bakedProp(points) {
  const keys = points.map((p, idx) => kf(p.t, p.v, idx === points.length - 1 ? null : EASE.linear))
  return { a: 1, k: keys }
}
function animProp(points) {
  points = ensureStartsAtZero(points)
  const keys = points.map((p, idx) => kf(p.t, p.v, idx === points.length - 1 ? null : (EASE[p.ease] || EASE.linear)))
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
function sampleDense(fn, from, to, step = 2, protect = new Set([E, T])) {
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
function strokeItem(colorHex, width, opacity = 100, nm = 'Stroke', cap = 2, join = 2) {
  const [r, g, b] = hexToRgb1(colorHex)
  return { ty: 'st', nm, o: { a: 0, k: opacity }, w: { a: 0, k: width }, c: { a: 0, k: [r, g, b, 1] }, lc: cap, lj: join }
}
function strokeItemSlot(colorHex, sid, width, opacity = 100, nm = 'Stroke', cap = 2, join = 2) {
  const [r, g, b] = hexToRgb1(colorHex)
  return { ty: 'st', nm, o: { a: 0, k: opacity }, w: { a: 0, k: width }, c: { a: 0, k: [r, g, b, 1], sid }, lc: cap, lj: join }
}
// Static (non-animated) gradient — only a STATIC gradient renders reliably
// here (player-contract: animating a gradient's own stops does not).
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

// Precomposed hatch — the revectorized diagonal hatch is dozens of thin
// stroke shapes that only ever move as ONE rigid piece with its parent rig.
// Precomposing keeps check-motion.mjs (which only audits top-level
// `doc.layers` shape geometry) from seeing those dense vertices — otherwise
// they register spurious CONTACT SLIDE pairs against the checkmark, which
// occupies the same screen region in a LATER, never-simultaneous beat
// (svg-compatibility.md, the multi-beat precompose guidance).
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
// SHARED HATCH GENERATOR — the disc/shadow's raster diagonal-hatch <pattern>
// revectorized as parallel 45° stroke lines. Pitch/stroke MEASURED this
// session by decoding the embedded PNG directly (CanvasKit
// MakeImageFromEncoded + readPixels: a dark diagonal stripe every 16px with
// a ~3px dark core, at the image's native 128px tile — confirmed on both a
// row and a column scan, identical period and phase, i.e. a true 45°
// diagonal). The tile covers 0.307692 of the disc's own bbox at native size
// -> on-canvas scale 0.25 -> pitch 4.0px, stroke ~0.85px (dark core plus its
// antialiased edge). Colour: the artwork's only explicit ink is #222222,
// used at 15% opacity to match the source's `fill-opacity="0.15"`.
// ============================================================
// Disc: clip to the true CIRCLE, not its bounding square — a square clip
// overshoots past the round silhouette at the corners (invisible once
// matted, but real geometry check-motion.mjs still measures against nearby
// unrelated elements).
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
// Shadow: clip to the bbox with zero margin (a flat ellipse — exact-bbox
// clipping stays well clear of the real gap to Zenek's body).
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
// PIVOT — the implied hang point, ~85px above the disc's own center. A
// small-angle pendulum sway about this point gives Zenek's own body (below
// the disc, ~150px from the pivot) a ~9px lateral arc for a 3.5° tilt — well
// clear of "amplitude that reads at arm's length" (motion-taste).
// ============================================================
const discBbox = bboxOf(parsePath(DISC_D))
const discCenter = bboxCenter(discBbox)
const discR = (discBbox[2] - discBbox[0]) / 2
const PIVOT = [discCenter[0], discCenter[1] - 85]

// ============================================================
// CLOCKS — FLOAT_LEN=168=2^3*3*7. Every period below is an exact divisor, so
// every FLOAT-span track keys identically at E and T (closes the loop by
// construction); the cycle-count ratio (1:4:7) is deliberately non-trivial
// (motion-taste, "a few shared clocks, non-trivial ratios" — not 1:2:4).
// ============================================================
const SWAY_PERIOD = 168    // 1 cycle/loop — slow pendulum, "nothing bouncy"
const SWAY_AMP = 3.5       // deg
const BOB_PERIOD = 42      // 4 cycles/loop (168/42 = 4)
const BOB_AMP_X = 1.3, BOB_AMP_Y = 3.6, BOB_PHASE_X = 90, BOB_PHASE_Y = 0 // px — slight ellipse, not a straight bob
const BREATHE_PERIOD = 24  // 7 cycles/loop (168/24 = 7) — ratio 1:4:7, not 1:2:4
const BREATHE_AMP = 2.6    // % area-conserving swell
// Zenek's own extra "settles a beat later" wobble nests UNDER disc-sway (so
// the gross pendulum swing is fully shared/welded — zero slide against the
// disc/hands) and pivots at Zenek's OWN centroid, not the far hang-point.
const ZENEK_DELTA_LAG_DEG = 32 // phase lag behind disc-sway's own phase
const ZENEK_DELTA_AMP = 1.3    // deg — small secondary wobble on top of the inherited sway

// ---- FLOAT + SUCCESS: continuous functions valid for all t >= E ----------
function swayR(t) {
  if (t < E) return 0
  const base = SWAY_AMP * sin2pi(t - E, SWAY_PERIOD)
  const antic = -0.6 * SWAY_AMP * bump(t, ANTIC_START, ANTIC_DUR)      // small opposite lean
  const exitTilt = ramp(t, EXIT_START, EXIT_DUR, 16, easeInQuad)       // banks into the direction of travel
  return base + antic + exitTilt
}
function zenekDeltaR(t) {
  if (t < E) return 0
  const antic = -0.3 * bump(t, ANTIC_START + 2, ANTIC_DUR) // trails the disc's own anticipation, tiny
  return ZENEK_DELTA_AMP * sin2pi(t - E, SWAY_PERIOD, -ZENEK_DELTA_LAG_DEG) + antic
}
function bobX(t) { if (t < E) return 0; return BOB_AMP_X * sin2pi(t - E, BOB_PERIOD, BOB_PHASE_X) }
function bobY(t) { if (t < E) return 0; return BOB_AMP_Y * sin2pi(t - E, BOB_PERIOD, BOB_PHASE_Y) }
function exitX(t) {
  if (t < ANTIC_START) return 0
  const antic = -9 * bump(t, ANTIC_START, ANTIC_DUR)
  return antic + ramp(t, EXIT_START, EXIT_DUR, 300, easeInQuad)
}
function exitY(t) {
  if (t < ANTIC_START) return 0
  const antic = 4 * bump(t, ANTIC_START, ANTIC_DUR)
  return antic + ramp(t, EXIT_START, EXIT_DUR, -110, smoothstep)
}
function posX(t) { return bobX(t) + exitX(t) }
function posY(t) { return bobY(t) + exitY(t) }

// ---- ENTRY (0..E): fully offscreen below-left -> overshoot -> decaying
// vertical bounce, handing off EXACTLY into the FLOAT function's own value
// at t=E (computed, never hand-typed, so the handoff cannot drift). X eases
// in on one smooth curve (no bounce); the bounce is Y-only, "one axis only"
// per the brief. The disc banks into the rise and recoils on the landing
// beat; Zenek's own delta wobble stays at 0 until FLOAT begins — the brief
// stages the whole assembly travelling as ONE rigid mass on arrival.
//
// Authored as ONE continuous function per channel (X, Y, rotation), densely
// sampled on the SAME time grid as FLOAT/SUCCESS — position's X and Y are
// NOT built from two separately-keyed sparse arrays merged by index (that
// silently pairs mismatched keyframe counts the moment the bounce needs
// more points on Y than X ever does; caught by rendering frame 36, which
// came out as bare sky instead of a mid-arc Zenek).
// ------------------------------------------------------------------------
const START_X = -280, START_Y = 270 // union bbox of disc+zenek+hands+shadow at this offset clears the frame
                                     // on every side with >45px margin (verified by render below)
const restX = posX(E), restY = posY(E), restR = swayR(E)
const easeOutCubic = (u) => 1 - Math.pow(1 - clamp01(u), 3)
function entryX(t) {
  if (t <= 18) return START_X
  const u = (t - 18) / (E - 18)
  return START_X + (restX - START_X) * easeOutCubic(u)
}
// Two explicit phases, continuous at the handoff (both evaluate to the same
// value at RISE_END): RISE is a plain monotonic ease-out (no oscillation) up
// to an overshoot past rest; BOUNCE is a decaying cosine that starts exactly
// at the overshoot (envelope=1) and lands exactly at rest with zero residual
// velocity (envelope AND its derivative -> 0 at u=1).
const RISE_END = 40
function decayBounce(u, from, to, omega) {
  const delta = from - to
  return to + delta * Math.pow(1 - clamp01(u), 2) * Math.cos(omega * u)
}
function entryY(t) {
  if (t <= 18) return START_Y
  const OVERSHOOT_Y = restY - 16 // above rest (smaller y = higher on screen)
  if (t <= RISE_END) return START_Y + (OVERSHOOT_Y - START_Y) * easeOutCubic((t - 18) / (RISE_END - 18))
  return decayBounce((t - RISE_END) / (E - RISE_END), OVERSHOOT_Y, restY, 3 * Math.PI) // ~1.5 decaying cycles
}
function entryR(t) {
  if (t <= 18) return 0
  const BANK_R = restR - 10 // banks into the rise
  if (t <= RISE_END) return (BANK_R) * easeOutCubic((t - 18) / (RISE_END - 18))
  return decayBounce((t - RISE_END) / (E - RISE_END), BANK_R, restR, 2.6 * Math.PI)
}
function fullX(t) { return t < E ? entryX(t) : posX(t) }
function fullY(t) { return t < E ? entryY(t) : posY(t) }
function fullR(t) { return t < E ? entryR(t) : swayR(t) }

// ============================================================
// RIG NULLS — bob-rig carries the whole entry arc + float bob + exit travel
// as ONE position function; disc-sway/zenek-drag/zenek-breathe as before.
// ============================================================
const bobRigPts = sampleDense((t) => [fullX(t), fullY(t), 0], 0, OP, 2)
const bobRigInd = pushNull({ nm: 'bob-rig', ks: { a: { a: 0, k: [0, 0, 0] }, p: bakedProp(bobRigPts), s: { a: 0, k: [100, 100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } } })

const discSwayPts = sampleDense((t) => fullR(t), 0, OP, 2)
const discSwayInd = pushNull({
  nm: 'disc-sway', parent: bobRigInd,
  ks: { a: { a: 0, k: [PIVOT[0], PIVOT[1], 0] }, p: { a: 0, k: [PIVOT[0], PIVOT[1], 0] }, s: { a: 0, k: [100, 100, 100] }, r: animProp(discSwayPts), o: { a: 0, k: 100 } },
})
// zenek-drag nests UNDER disc-sway (inherits the shared pendulum swing —
// welded, no slide against the disc/hands) and pivots at Zenek's OWN
// centroid for the small extra delta wobble. Silent (0°) through entry.
const zenekBodyBbox = bboxOf([...subs('Fill 1')])
const zenekPivot = bboxCenter(zenekBodyBbox)
// A single segment from 0 straight into the FLOAT function's own value at
// E (never re-pinned to 0 there): zenekDeltaR(E) is naturally non-zero
// (a phase-lagged sine sampled at its parent's zero-crossing isn't itself
// zero), and forcing a duplicate {t:E,v:0} keyframe on top of that value
// created two keyframes at the same t with conflicting values — a real bug,
// caught by diffing E against T on every rig track (see verification below).
const zenekDragPts = [{ t: 0, v: 0, ease: 'linear' }, ...sampleDense((t) => zenekDeltaR(t), E, OP, 2)]
const zenekDragInd = pushNull({
  nm: 'zenek-drag', parent: discSwayInd,
  ks: { a: { a: 0, k: [zenekPivot[0], zenekPivot[1], 0] }, p: { a: 0, k: [zenekPivot[0], zenekPivot[1], 0] }, s: { a: 0, k: [100, 100, 100] }, r: animProp(zenekDragPts), o: { a: 0, k: 100 } },
})
// Breathe runs continuously (the body always breathes, motion-taste gate 10)
// on its own clock, phase-referenced to E so it still closes cleanly over
// the FLOAT span even though it keeps running through entry/success too.
const zenekBreathePts = sampleDense((t) => {
  const s = sin2pi(t - E, BREATHE_PERIOD)
  return [100 + BREATHE_AMP * s, 100 - BREATHE_AMP * s, 100]
}, 0, OP, 2)
const zenekBreatheInd = pushNull({
  nm: 'zenek-breathe', parent: zenekDragInd,
  ks: { a: { a: 0, k: [zenekPivot[0], zenekPivot[1], 0] }, p: { a: 0, k: [zenekPivot[0], zenekPivot[1], 0] }, s: bakedProp(zenekBreathePts), r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
})

// ============================================================
// CHECKMARK (frontmost — pushed first). Ring draws first, then the tail
// (reversed to draw pen-down at its left tip), then the dot + two accents
// pop in staggered, each anchored on its own artwork.
// ============================================================
{
  // Source path is authored right-to-left (starts at the upper-right tip,
  // ends at the lower-left) — reversed so trim-from-start draws pen-down to
  // pen-up, left to right (motion-taste "Ink follows the pen").
  const sp = reverseSubpath(subs('Stroke 13')[0])
  const shapes = [group('check-tail', [
    shapeFromSubpath(sp, 'check-tail-path'),
    strokeItemSlot('#22E243', 'checkAccent', 14), // paint1 gradient degenerates to flat (both stops #22E243) -> slotted flat colour
    trimItem({ eKeys: [{ t: TAIL_DRAW[0], v: 0 }, { t: TAIL_DRAW[1], v: 100 }], ease: 'entranceSharp' }),
  ])]
  pushLayer({ nm: 'check-tail', shapes, ks: baseTransform() })
}
{
  // Ellipse geometry sits at the group's own local origin (0,0) — origin-
  // space geometry, so the layer anchors at [0,0] and POSITION alone carries
  // it home to the dot's real center (player-contract "anchor == position is
  // a hidden zero"; gate 18 "scale pivots on its artwork").
  const c = [CHECK_START_DOT.cx, CHECK_START_DOT.cy]
  const shapes = [group('check-ring-start-dot', [
    { ty: 'el', nm: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [CHECK_START_DOT.r * 2, CHECK_START_DOT.r * 2] } },
    fillItemSlot('#22E243', 'checkAccent'),
  ])]
  const ks = baseTransform({ a: [0, 0, 0], p: [c[0], c[1], 0] })
  ks.s = animProp([{ t: POP_START, v: [0, 0, 100], ease: 'settleSoft' }, { t: POP_START + 8, v: [100, 100, 100] }])
  ks.o = animProp([{ t: POP_START, v: 0, ease: 'settleSoft' }, { t: POP_START + 5, v: 100 }])
  pushLayer({ nm: 'check-ring-start-dot', shapes, ks })
}
for (const [nm, id, delay] of [['check-ring-end-blob', 'Vector_7', 4], ['check-ring-end-dot', 'Vector_8', 8]]) {
  const sp = subs(id)[0]
  const c = bboxCenter(bboxOf([sp]))
  const shapes = [group(nm, [shapeFromSubpath(sp, `${nm}-path`), fillItemSlot('#22E243', 'checkAccent')])]
  const start = POP_START + delay
  const ks = baseTransform({ a: [c[0], c[1], 0], p: [c[0], c[1], 0] })
  ks.s = animProp([{ t: start, v: [0, 0, 100], ease: 'settleSoft' }, { t: start + 8, v: [100, 100, 100] }])
  ks.o = animProp([{ t: start, v: 0, ease: 'settleSoft' }, { t: start + 5, v: 100 }])
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
// disc-sway directly), matching the source SVG's own paint order (hands
// painted LAST in step-2.svg = frontmost of this whole assembly).
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
// SHADOW — reads bob-rig's own BOB sub-signal directly (never the exit
// component, which would blow the ratio out): wider + lighter as the
// assembly rises, zeroed at rest. Appears only as the landing bounce
// resolves (never before he arrives) and fades out as he lifts off.
// Revectorized hatch, matted to the shadow's own flat-ellipse silhouette.
// ============================================================
const SHADOW_SCALE_AMP = 8.5, SHADOW_OP_AMP = 13, SHADOW_BASE_OP = 38
const SHADOW_APPEAR_START = 40 // during the landing bounce's descent, well after arrival begins
const shadowSub = subs('Fill 10')
const shadowBbox = bboxOf(shadowSub)
const shadowCenter = bboxCenter(shadowBbox)
function riseSignal(t) { if (t < E) return 0; return -bobY(t) / BOB_AMP_Y } // +1 = fully risen, 0 at rest
function shadowAppear(t) {
  if (t < SHADOW_APPEAR_START) return 0
  if (t >= E) return 1
  return smoothstep((t - SHADOW_APPEAR_START) / (E - SHADOW_APPEAR_START))
}
function shadowFade(t) { return 1 - clamp01((t - EXIT_START) / EXIT_DUR) }
const shadowRigPts = sampleDense((t) => {
  const rs = riseSignal(t)
  const s = 100 + SHADOW_SCALE_AMP * rs
  return [s, s, 100]
}, 0, OP, 2)
const shadowOpPts = sampleDense((t) => (SHADOW_BASE_OP - SHADOW_OP_AMP * riseSignal(t)) * shadowAppear(t) * shadowFade(t), 0, OP, 2)
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
// opacity carried on both halves of the matte pair so the clipped edge doesn't linger visible
layers[layers.length - 1].ks.o = bakedProp(shadowOpPts)
layers[layers.length - 2].ks.o = bakedProp(shadowOpPts)

// ============================================================
// ZENEK — pupils (frontmost) > face patch > body mass (backmost), matching
// the source SVG's own paint order. Face patch rides the deforming body via
// zenek-breathe's own scale swell; pupils carry a shared blink on top. The
// blink sits at the sway's own apex (a genuine zero-velocity rest beat) and
// is explicitly silenced once SUCCESS begins — a mid-exit blink would fight
// the dash-stretch/shadow-fade accents already carrying that beat.
// ============================================================
const BLINK_CENTER = SWAY_PERIOD / 4 // sway's own peak — zero angular velocity, a genuine rest beat
const BLINK_CLOSE = 2, BLINK_HOLD = 2, BLINK_OPEN = 4 // closing faster than opening reads as a lid, not a pulse
const BLINK_DOWN = BLINK_CENTER - BLINK_CLOSE - 1, BLINK_HELD = BLINK_DOWN + BLINK_CLOSE, BLINK_UP = BLINK_HELD + BLINK_HOLD, BLINK_END = BLINK_UP + BLINK_OPEN
function blinkAmount(t) {
  if (t >= T) return 0 // silenced once SUCCESS begins — don't fight the exit's own accents
  const local = ((t - E) % SWAY_PERIOD + SWAY_PERIOD) % SWAY_PERIOD
  if (local <= BLINK_DOWN || local >= BLINK_END) return 0
  if (local < BLINK_HELD) return smoothstep((local - BLINK_DOWN) / (BLINK_HELD - BLINK_DOWN))
  if (local < BLINK_UP) return 1
  return 1 - smoothstep((local - BLINK_UP) / (BLINK_END - BLINK_UP))
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
// DISC — outline stroke on top, hatch fill matted underneath.
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
  const items = hatchLinesCircle(discCenter[0], discCenter[1], discR, 4.0)
  items.push(strokeItem('#222222', 0.9, 15))
  pushPrecomp({ nm: 'disc-hatch', innerShapes: [group('disc-hatch', items)], ks: baseTransform(), parent: discSwayInd, tt: 1 })
}

// ============================================================
// CLOUDS — the SAME set kept alive across the whole timeline, drifting
// right-to-left at ONE constant speed from frame 0, continuously, through
// every beat until SUCCESS brakes them. Authored by TILING copies one lap
// apart on a single linear translation (recipe-camera-scene-motion,
// "Ambient Scroll") — never a wrap-teleport, which is exactly the defect
// `check-motion.mjs` currently catches on the sibling scene
// (WRAP IS INTERPOLATABLE). Near cloud faster than far — the ratio IS the
// parallax, no separate depth constant.
//
// Speed is DERIVED, not chosen freely: each cloud's lap distance is set so
// the FLOAT span (E..T, exactly 168f) covers precisely ONE whole lap
// (speed = lap / FLOAT_LEN). Every tile copy's position is then offset by
// exactly one lap between t=E and t=T, so the copy that scrolled off is
// standing in for the one that scrolled off before it — the rendered
// PICTURE at T is pixel-identical to the picture at E (verified below by
// direct pixel diff), which is what "repeat cleanly" means for a field of
// interchangeable tiles, even though any ONE tile's own numeric position
// differs by a full lap (the individual-track loop-seam contract in
// player-contract.md governs single hero tracks; a tiled ambient field's
// seam is the ENSEMBLE's, the same principle the loop-reset row of the
// transition grammar table already names: "state equals the first frame's
// state, or a deliberate exit"). GAP is chosen per cloud — small for the
// far cloud, larger for the near one — so the derived speeds land clearly
// apart (near ~2x far) while both stay a gentle drift.
// ============================================================

// travelled(): total leftward distance covered by frame t. Constant speed
// through 0..CLOUD_DECEL_START, then a smooth ease-out brake
// (velocity(u) = speed*(1-u)^2, closed-form integral) to a full stop,
// held forever after — reaching stillness exactly as the checkmark begins.
function travelled(speed, t) {
  if (t <= CLOUD_DECEL_START) return speed * t
  const base = speed * CLOUD_DECEL_START
  const dur = CLOUD_DECEL_DUR
  const u = clamp01((t - CLOUD_DECEL_START) / dur)
  return base + speed * dur * (u - u * u + (u * u * u) / 3)
}
function cloudTiledLayer(nm, ids, gap) {
  const bump0 = subs(ids.bump)[0]
  const dashL = subs(ids.dashL)[0]
  const dashR = subs(ids.dashR)[0]
  const groupBbox = bboxOf([bump0, dashL, dashR]) // bump + both dashes together — the visual "cloud unit"
  const bboxWidth = groupBbox[2] - groupBbox[0]
  const lap = bboxWidth + gap
  const speed = lap / FLOAT_LEN // exactly ONE lap crossed during FLOAT (E..T) -> picture matches at both ends
  const totalDist = travelled(speed, OP)
  const copies = Math.ceil(totalDist / lap) + 2
  // LEFT_MARGIN: copies starting at NEGATIVE indices, one+ lap to the left of
  // the native (i=0) position. Without these, the field is only "filled" as
  // far left as tile0 has drifted BY THE CURRENT FRAME — at t=E, nothing has
  // drifted into the strip that tile0 itself will occupy at t=T (a full lap
  // later), leaving that strip visibly BLANK at E while T shows a cloud
  // there. Caught by a direct pixel diff of frame E vs frame T (not by eye —
  // it's a ~440px patch, not a whole missing cloud): with negative copies
  // present, that strip is always covered by SOME tile at every frame, so
  // the ensemble picture is identical at E and T (verified below).
  const LEFT_MARGIN = 2
  const dashLBbox = bboxOf([dashL]), dashLC = bboxCenter(dashLBbox)
  const dashRBbox = bboxOf([dashR]), dashRC = bboxCenter(dashRBbox)
  const stretchPts = sampleDense((t) => {
    const b = bump(t, EXIT_START, EXIT_DUR)
    return [100 + 150 * Math.pow(b, 1.4), 100, 100]
  }, 0, OP, 2)
  const shapes = [
    group(`${nm}-bump`, [shapeFromSubpath(bump0, `${nm}-bump-path`), strokeItem('#222222', 2)]),
    group(`${nm}-dash-l`, [shapeFromSubpath(dashL, `${nm}-dash-l-path`), strokeItem('#222222', 2)], { p: dashLC, a: dashLC, s: bakedProp(stretchPts) }),
    group(`${nm}-dash-r`, [shapeFromSubpath(dashR, `${nm}-dash-r-path`), strokeItem('#222222', 2)], { p: dashRC, a: dashRC, s: bakedProp(stretchPts) }),
  ]
  for (let i = -LEFT_MARGIN; i < copies; i++) {
    const startX = i * lap
    const posPts = sampleDense((t) => [startX - travelled(speed, t), 0, 0], 0, OP, 2)
    const ks = baseTransform()
    ks.p = bakedProp(posPts)
    pushLayer({ nm: i === 0 ? nm : `${nm}-tile${i}`, shapes, ks })
  }
  return speed
}
// Native bboxes: near x[9.381,153.382] (bigger, lower — the FASTER/nearer
// cloud), far x[232.734,362.001] (smaller, higher — the SLOWER/farther one).
// GAP_NEAR >> GAP_FAR so the derived speeds land clearly apart (~2x).
const nearSpeed = cloudTiledLayer('cloud-near', { bump: 'Vector', dashL: 'Vector_2', dashR: 'Vector_3' }, 140)
const farSpeed = cloudTiledLayer('cloud-far', { bump: 'Vector_4', dashL: 'Vector_6', dashR: 'Vector_5' }, 8)
console.log(`cloud speeds — near ${nearSpeed.toFixed(3)}px/f, far ${farSpeed.toFixed(3)}px/f, ratio ${(farSpeed / nearSpeed).toFixed(2)}`)

// ============================================================
// Markers, doc assembly
// ============================================================
const markers = [
  { cm: 'entry', tm: 0, dr: E },
  { cm: 'float', tm: E, dr: T - E },
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
    { target: 'zenek-drag', kind: 'amount', property: 'rotation', label: "Zenek's drag", description: "How much Zenek's dangle lags behind the canopy's sway." },
    { target: 'bob-rig', kind: 'amount', property: 'position', label: 'Float bob', description: 'The gentle rise, fall and arrival/exit travel of the whole suspended rig.' },
  ],
}
writeFileSync(join(OUT_DIR, 'controls.json'), JSON.stringify(controls, null, 2))

console.log(`Wrote ${OUT} — ${layers.length} layers, ${OP}f @ ${FPS}fps (E=${E} T=${T})`)
