#!/usr/bin/env node
/**
 * Generates a seamlessly-looping Lottie JSON for EverydayExpress.svg —
 * Zenek out on his coffee run, walk-cycle bounce.
 * Output: public/projects/everyday-express/scene-1/lottie.json
 *
 * This is the "improved" build. The original hand-tuned reference that
 * shipped with the project is preserved at build-everyday-express.reference.mjs
 * (it uses a near-linear symmetric bounce, Y-only squash, one-directional bag
 * sway, and a 1-frame steam snap-reset). This version keeps that reference's
 * exact geometry but rebuilds the motion for a warmer, more physical feel:
 *
 *  - 60fps, 144-frame (2.4s) seamless loop = two 1.2s steps (72f each). The
 *    bounce dips once per step (two footfalls per loop); the blink happens
 *    once per loop ("every couple of steps"); steam runs on a continuous
 *    offset cycle. First frame == last frame on every property.
 *  - Walk bounce with ASYMMETRIC per-phase easing: quick push-off out of the
 *    contact/squash, a gentle float at the top of the arc, then a
 *    gravity-accelerated fall back down. (The reference used one near-linear
 *    symmetric curve for both up and down, which reads mechanical.)
 *  - Volume-preserving squash & stretch pivoted at the body base: at contact
 *    the bubble squashes (scaleY↓, scaleX↑); during the fast rise/fall it
 *    stretches (scaleY↑, scaleX↓); neutral at the apex. (Reference squashed
 *    Y only, 4%.)
 *  - The grocery bag swings as a full ±5° pendulum (both directions, soft
 *    eased turns), lagging the body so it reads as reacting to the bounce.
 *    (Reference swung one direction only, 0→4°→0.)
 *  - The coffee cup, the right hand holding it, and the steam are held
 *    genuinely STEADY — they are NOT parented to the bouncing rig, so the
 *    coffee never bobs ("stays steady so it doesn't spill"). Everything else
 *    (body, face, eyes, left arm + bag) rides the bounce rig.
 *  - A warm, fast happy blink once per loop (eyes squash to ~18% with a
 *    slight widen, ~130ms), eased snappier than the reference.
 *  - Two steam wisps on a 72f cycle offset by half a period, so heat is
 *    continuous: each fades IN at the cup, drifts up ~14px with a gentle
 *    sideways waver, and fades OUT near the top; the position reset glides
 *    back down while fully transparent (no visible 1-frame snap).
 *
 * Rig technique: a parent-null hierarchy (ty:3 nulls, children link by
 * `parent` = the null's `ind`). The bounce/squash live on ONE null so every
 * walking part inherits them for free; the bag sway is a second null nested
 * under it. Parenting composes multiplicatively and resolves by `ind`
 * regardless of array position (documented in allset-celebration-animation.md).
 *
 * Skottie notes for this build:
 *  - A parent null with a NON-ZERO anchor and an ANIMATED position works
 *    correctly here (the bounce rig relies on it — anchor at the body base
 *    so the squash scales from the feet, position keyframed for the dip).
 *    Earlier scenes in this project worked around a suspected "anchor+position
 *    freeze"; that was later traced to stale dev-server state, not a real
 *    format limitation. Non-zero anchor + animated position/scale/rotation
 *    are all fine; verify in a fresh render (this file does).
 *  - Animated keyframe arrays start at t=0 (ensureStartsAtZero).
 */
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../public/projects/everyday-express/scene-1')
const OUT = join(OUT_DIR, 'lottie.json')

const W = 375, H = 133, FPS = 60
const STEP = 72                 // one 1.2s step
const T = STEP * 2              // 144-frame / 2.4s seamless loop (two steps)

const BLACK = '#222222'
const WHITE = '#FFFFFF'

// Geometry (from the source SVG; fists resolved from their matrix transforms).
const BODY = { cx: 187, cy: 67, r: 44 }
const BODY_BASE = [187, 111]          // squash pivot (bubble bottom)
const RIGHT_FIST = [242.78, 79.22]
const LEFT_FIST = [142.78, 79.22]
const BAG_PIVOT = [143, 80]           // bag hangs from the left hand
const EYE_CENTER = [202, 57]

// ── SVG path → Lottie bezier (M/L/H/V/C/Z; same parser as every build here) ──
function parsePath(d) {
  const RE = /([MLHVCZmlhvcz])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g
  const tokens = []
  let m
  while ((m = RE.exec(d))) tokens.push(m[1] ? { c: m[1] } : { n: parseFloat(m[2]) })
  let i = 0
  const nums = (k) => { const out = []; for (let j = 0; j < k; j++) out.push(tokens[i++].n); return out }
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

// ── Source path data (identical geometry to the shipped reference) ──────────
const SVG_PATHS = {
  face:     'M225.875 59.5957C225.875 73.4766 213.11 74.3933 195.266 74.3933C177.422 74.3933 165.768 72.9528 165.768 59.5957C165.768 46.2385 177.03 34.9766 195.266 34.9766C213.502 34.9766 225.875 45.7147 225.875 59.5957Z',
  eye1:     'M200.12 57.0952C196.969 53.3006 192.87 55.5141 191.215 57.0952',
  eye2:     'M205.095 57.0952C208.246 53.3006 212.345 55.5141 214 57.0952',
  arm:      'M144.065 55.7217C135.647 37.0298 125.5 27 122.924 30.6958C120.616 34.0065 143.203 77.482 147.935 86.506C148.425 87.4405 149.585 87.8341 150.358 87.1154C154.619 83.1522 151.691 72.654 144.065 55.7217Z',
  bag:      'M168.182 55.7156L168.612 75.1048L172.362 93.8287L150.998 96.3899L140.373 95.0815L142.043 80.4269L133.864 62.5899L143.276 57.8406L168.182 55.7156',
  bagLines: 'M144 62L148.5 78V91.5M164 75H156.5L151 78',
  bagHandle:'M159.002 54.4997C160.502 45.9997 150.002 48.4997 150.502 55.4997',
  armHair1: 'M142.5 52.5C139.7 52.5 137.333 53.8333 136.5 54.5',
  armHair2: 'M138 45C135.667 45 133.694 46.3333 133 47',
  armHair3: 'M133 37.5934C131.154 37.3165 129.396 38.401 128.748 38.9779',
  cup1:     'M258.418 71.0503L241.688 68.0344L239.398 92.0085L252.192 94.3148L258.418 71.0503Z',
  cup2:     'M260.289 66.3071L241.59 62.9364L240.703 67.8571L259.402 71.2278L260.289 66.3071Z',
  cup3:     'M257.062 61.6611L246.237 59.7097L245.527 63.6462L256.353 65.5977L257.062 61.6611Z',
  steam:    'M255.999 56C262.499 49.5 249.499 46.5 255.999 40M248.999 56C252.599 52.4 250.499 48.1667 248.999 46.5',
}
const P = Object.fromEntries(Object.entries(SVG_PATHS).map(([k, d]) => [k, parsePath(d)]))

// ── Lottie builder helpers ──────────────────────────────────────────────────
const hexToRgb1 = (hex) => {
  hex = hex.replace('#', '')
  return [parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255]
}

const EASE = {
  linear:        [0, 0, 1, 1],
  easeInOut:     [0.42, 0.0, 0.58, 1.0],
  riseOut:       [0.22, 0.68, 0.36, 1.0],   // push-off out of contact, decelerate into the float
  fallIn:        [0.55, 0.05, 0.78, 0.42],  // hang at the top, then accelerate down (gravity)
  squashRecover: [0.25, 0.80, 0.42, 1.0],   // snappy recovery from the squash
  blinkClose:    [0.30, 0.00, 0.30, 1.0],
}

function kf(t, value, easeOut) {
  const k = { t, s: Array.isArray(value) ? value : [value] }
  if (easeOut) { const [x1, y1, x2, y2] = easeOut; k.o = { x: [x1], y: [y1] }; k.i = { x: [x2], y: [y2] } }
  return k
}
function ensureStartsAtZero(points) {
  return points[0].t === 0 ? points : [{ t: 0, v: points[0].v }, ...points]
}
function animProp(points) {
  points = ensureStartsAtZero(points)
  return { a: 1, k: points.map((p, idx) => kf(p.t, p.v, idx === points.length - 1 ? null : (EASE[p.ease] || EASE.linear))) }
}
function staticProp(v) { return { a: 0, k: v } }

// Repeat one step's worth of points (t in [0, STEP)) `nSteps` times, then
// close with a final point at t = nSteps*STEP whose value == the cycle start.
function tileSteps(pts, nSteps, finalV) {
  const out = []
  for (let s = 0; s < nSteps; s++) for (const p of pts) out.push({ t: s * STEP + p.t, v: p.v, ease: p.ease })
  out.push({ t: nSteps * STEP, v: finalV })
  return out
}

// Cubic-bezier ease evaluator + arbitrary-frame track sampler (for steam,
// which is easier to phase-offset by sampling a cycle function than by
// hand-splicing wrapped keyframes).
function bez(x1, y1, x2, y2) {
  return (t) => {
    const bx = (s) => { const m = 1 - s; return 3 * m * m * s * x1 + 3 * m * s * s * x2 + s * s * s }
    const by = (s) => { const m = 1 - s; return 3 * m * m * s * y1 + 3 * m * s * s * y2 + s * s * s }
    let lo = 0, hi = 1
    for (let k = 0; k < 24; k++) { const mid = (lo + hi) / 2; if (bx(mid) < t) lo = mid; else hi = mid }
    return by((lo + hi) / 2)
  }
}
// pts cover [0, period); value at `period` implicitly equals pts[0].v (seamless cycle).
function cycleValue(pts, period, phase) {
  const t = ((phase % period) + period) % period
  const all = [...pts, { t: period, v: pts[0].v, ease: pts[0].ease }]
  let seg = 0
  for (let k = 0; k < all.length - 1; k++) { if (t >= all[k].t && t <= all[k + 1].t) { seg = k; break } }
  const a = all[seg], b = all[seg + 1]
  const f = (t - a.t) / ((b.t - a.t) || 1)
  const e = (EASE[a.ease] || EASE.linear)
  const eased = bez(e[0], e[1], e[2], e[3])(f)
  return a.v + (b.v - a.v) * eased
}

function shapeFromSubpath(sp, nm) {
  return { ty: 'sh', nm, ks: { a: 0, k: { c: sp.closed, v: sp.v, i: sp.i, o: sp.o } } }
}
function ellipseShape(cx, cy, r, nm = 'el') { return { ty: 'el', nm, p: { a: 0, k: [cx, cy] }, s: { a: 0, k: [r * 2, r * 2] } } }
function fillItem(hex) { const [r, g, b] = hexToRgb1(hex); return { ty: 'fl', o: { a: 0, k: 100 }, c: { a: 0, k: [r, g, b, 1] } } }
function strokeItem(hex, w) { const [r, g, b] = hexToRgb1(hex); return { ty: 'st', o: { a: 0, k: 100 }, w: { a: 0, k: w }, c: { a: 0, k: [r, g, b, 1] }, lc: 2, lj: 2 } }
function grpTr() { return { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 } } }
function group(nm, items) { return { ty: 'gr', nm, it: [...items, grpTr()] } }

function ks({ a = [0, 0, 0], p = [0, 0, 0], s = [100, 100, 100], r = 0, o = 100 } = {}) {
  return {
    a: Array.isArray(a) ? { a: 0, k: a } : a,
    p: Array.isArray(p) ? { a: 0, k: p } : p,
    s: Array.isArray(s) ? { a: 0, k: s } : s,
    r: typeof r === 'number' ? { a: 0, k: r } : r,
    o: typeof o === 'number' ? { a: 0, k: o } : o,
  }
}
function shapeLayer(nm, ind, shapes, transform, parent) {
  const l = { ddd: 0, ind, ty: 4, nm, sr: 1, ks: transform, ao: 0, shapes, ip: 0, op: T, st: 0, bm: 0 }
  if (parent != null) l.parent = parent
  return l
}
function nullLayer(nm, ind, transform, parent) {
  const l = { ddd: 0, ind, ty: 3, nm, sr: 1, ks: transform, ao: 0, ip: 0, op: T, st: 0, bm: 0 }
  if (parent != null) l.parent = parent
  return l
}

// ============================================================
// MOTION
// ============================================================

// Bounce (per step: contact/squash at 0 & 72, float peak at 36). Position is
// the null's own point; anchor sits at the body base so the coupled squash
// scales from the feet. Peak lifts 7px.
const BOUNCE_POS = [
  { t: 0, v: [BODY_BASE[0], BODY_BASE[1], 0], ease: 'riseOut' },       // contact (low)
  { t: 36, v: [BODY_BASE[0], BODY_BASE[1] - 7, 0], ease: 'fallIn' },   // float peak (high)
]
const SQUASH = [
  { t: 0, v: [105, 95, 100], ease: 'squashRecover' },  // contact: wide + short
  { t: 8, v: [99.5, 101.5, 100], ease: 'easeInOut' },  // push-off stretch
  { t: 36, v: [100, 100, 100], ease: 'easeInOut' },    // apex: neutral
  { t: 64, v: [99.5, 101.5, 100], ease: 'squashRecover' }, // falling stretch
]
// Bag pendulum: full ±5° both directions, one oscillation per step, soft turns.
const BAG_SWAY = [
  { t: 0, v: 0, ease: 'easeInOut' },
  { t: 18, v: 5, ease: 'easeInOut' },
  { t: 36, v: 0, ease: 'easeInOut' },
  { t: 54, v: -5, ease: 'easeInOut' },
]

// Steam: one 72f wisp cycle. Fades in at the cup, drifts up 14px with a
// sideways waver, fades out near the top; glides back down while invisible.
const STEAM_Y = [
  { t: 0, v: 0, ease: 'riseOut' },
  { t: 56, v: -14, ease: 'easeInOut' }, // top of visible rise
  { t: 72, v: 0, ease: 'linear' },      // reset (opacity 0 here)
]
const STEAM_X = [
  { t: 0, v: 0, ease: 'easeInOut' },
  { t: 20, v: 1.5, ease: 'easeInOut' },
  { t: 42, v: -1.2, ease: 'easeInOut' },
  { t: 56, v: 0, ease: 'linear' },
]
const STEAM_O = [
  { t: 0, v: 0, ease: 'easeInOut' },
  { t: 12, v: 82, ease: 'easeInOut' },
  { t: 44, v: 48, ease: 'easeInOut' },
  { t: 56, v: 0, ease: 'linear' },      // faded out before the reset
]
function steamProps(phase) {
  // Sample the wisp cycle every 4 frames across the loop, offset by `phase`,
  // so the two wisps stay a half-period apart (continuous heat) and both
  // close seamlessly at T (T is a whole number of 72f cycles).
  const posPts = [], opaPts = []
  for (let t = 0; t <= T; t += 4) {
    const x = cycleValue(STEAM_X, STEP, t + phase)
    const y = cycleValue(STEAM_Y, STEP, t + phase)
    const o = cycleValue(STEAM_O, STEP, t + phase)
    posPts.push({ t, v: [x, y, 0], ease: 'linear' })
    opaPts.push({ t, v: o, ease: 'linear' })
  }
  return { p: animProp(posPts), o: animProp(opaPts) }
}

// ============================================================
// LAYERS
// ============================================================
const ROOT = 100  // bounce + squash null
const BAGR = 101  // bag sway null (child of ROOT)

const layers = []
let ind = 1

// ---- bounce rig (front-to-back within the walking group) ----
// eyes (blink) — anchor at eye centre so the squash pivots on the eyes,
// on top of the inherited body bounce.
layers.push(shapeLayer('eyes', ind++, [group('eyes', [
  shapeFromSubpath(P.eye1[0], 'eye1'), shapeFromSubpath(P.eye2[0], 'eye2'), strokeItem(BLACK, 3),
])], ks({
  a: [EYE_CENTER[0], EYE_CENTER[1], 0], p: [EYE_CENTER[0], EYE_CENTER[1], 0],
  s: animProp([
    { t: 0, v: [100, 100, 100], ease: 'linear' },
    { t: 50, v: [100, 100, 100], ease: 'blinkClose' },
    { t: 54, v: [104, 18, 100], ease: 'blinkClose' },  // happy squint
    { t: 58, v: [100, 100, 100], ease: 'linear' },
    { t: T, v: [100, 100, 100] },
  ]),
}), ROOT))

// face (white plate)
layers.push(shapeLayer('face', ind++, [group('face', [shapeFromSubpath(P.face[0], 'face'), fillItem(WHITE)])], ks(), ROOT))

// bag group (all parented to the sway null BAGR)
layers.push(shapeLayer('left-hand', ind++, [group('left-hand', [ellipseShape(LEFT_FIST[0], LEFT_FIST[1], 10.5), fillItem(BLACK)])], ks(), BAGR))
layers.push(shapeLayer('bag-handle', ind++, [group('bag-handle', [shapeFromSubpath(P.bagHandle[0], 'bag-handle'), strokeItem(WHITE, 2)])], ks(), BAGR))
layers.push(shapeLayer('bag-lines', ind++, [group('bag-lines', [shapeFromSubpath(P.bagLines[0], 'l0'), shapeFromSubpath(P.bagLines[1], 'l1'), strokeItem(BLACK, 2)])], ks(), BAGR))
layers.push(shapeLayer('bag-body', ind++, [group('bag-body', [shapeFromSubpath(P.bag[0], 'bag'), fillItem(WHITE), strokeItem(BLACK, 2)])], ks(), BAGR))
layers.push(shapeLayer('arm-hair1', ind++, [group('arm-hair1', [shapeFromSubpath(P.armHair1[0], 'h1'), strokeItem(BLACK, 2)])], ks(), BAGR))
layers.push(shapeLayer('arm-hair2', ind++, [group('arm-hair2', [shapeFromSubpath(P.armHair2[0], 'h2'), strokeItem(BLACK, 2)])], ks(), BAGR))
layers.push(shapeLayer('arm-hair3', ind++, [group('arm-hair3', [shapeFromSubpath(P.armHair3[0], 'h3'), strokeItem(BLACK, 2)])], ks(), BAGR))
layers.push(shapeLayer('arm-sleeve', ind++, [group('arm-sleeve', [shapeFromSubpath(P.arm[0], 'arm'), fillItem(WHITE), strokeItem(BLACK, 1.5)])], ks(), BAGR))

// body (black bubble) — bottom of the walking group
layers.push(shapeLayer('body', ind++, [group('body', [ellipseShape(BODY.cx, BODY.cy, BODY.r), fillItem(BLACK)])], ks(), ROOT))

// ---- steady island (NOT parented to the bounce): right hand + cup + steam ----
const steam1 = steamProps(0)
const steam2 = steamProps(STEP / 2)   // half-period offset → continuous heat
layers.push(shapeLayer('steam-1', ind++, [group('steam-1', [shapeFromSubpath(P.steam[0], 'steam0'), strokeItem(BLACK, 2)])], ks({ p: steam1.p, o: steam1.o })))
layers.push(shapeLayer('steam-2', ind++, [group('steam-2', [shapeFromSubpath(P.steam[1], 'steam1'), strokeItem(BLACK, 2)])], ks({ p: steam2.p, o: steam2.o })))
layers.push(shapeLayer('cup-sleeve', ind++, [group('cup-sleeve', [shapeFromSubpath(P.cup3[0], 'cup3'), fillItem(WHITE), strokeItem(BLACK, 2)])], ks()))
layers.push(shapeLayer('cup-rim', ind++, [group('cup-rim', [shapeFromSubpath(P.cup2[0], 'cup2'), fillItem(WHITE), strokeItem(BLACK, 2)])], ks()))
layers.push(shapeLayer('cup-body', ind++, [group('cup-body', [shapeFromSubpath(P.cup1[0], 'cup1'), fillItem(WHITE), strokeItem(BLACK, 2)])], ks()))
layers.push(shapeLayer('right-hand', ind++, [group('right-hand', [ellipseShape(RIGHT_FIST[0], RIGHT_FIST[1], 10.5), fillItem(BLACK)])], ks()))

// ---- the two nulls (invisible; z-order irrelevant) ----
layers.push(nullLayer('bag-root', BAGR, ks({
  a: [BAG_PIVOT[0], BAG_PIVOT[1], 0], p: [BAG_PIVOT[0], BAG_PIVOT[1], 0],
  r: animProp(tileSteps(BAG_SWAY, 2, 0)),
}), ROOT))
layers.push(nullLayer('zenek-root', ROOT, ks({
  a: [BODY_BASE[0], BODY_BASE[1], 0],
  p: animProp(tileSteps(BOUNCE_POS, 2, [BODY_BASE[0], BODY_BASE[1], 0])),
  s: animProp(tileSteps(SQUASH, 2, [105, 95, 100])),
})))

// ============================================================
const doc = {
  v: '5.9.0', fr: FPS, ip: 0, op: T, w: W, h: H, nm: 'EverydayExpress Walk (improved)',
  ddd: 0, assets: [], layers, markers: [],
}
mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT, JSON.stringify(doc))
console.log(`Wrote ${OUT} — ${layers.length} layers, ${T}f @ ${FPS}fps (${(T / FPS).toFixed(1)}s loop)`)
