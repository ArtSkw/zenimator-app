#!/usr/bin/env node
/**
 * Generates an animated Lottie JSON for EverydayExpress.svg — Zenek walk cycle.
 * Output: public/projects/everyday-express/scene-1/lottie.json
 *
 * Animation design:
 *  - Whole character bounces Y ±6px on a 1.2s (36-frame) rhythm, 2 cycles = 72-frame loop.
 *  - Soft 4% scaleY squash at bottom of each step (pivot at body bottom y=111).
 *  - Blink once per loop (frames 33–37).
 *  - Grocery bag sways ±4° opposite to bounce (rotation around hand pivot).
 *  - Two steam strokes drift upward 16px and fade out over 28 frames, staggered by 18f.
 *  - First and last frame identical → seamless loop.
 */
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../public/projects/everyday-express/scene-1')
const OUT = join(OUT_DIR, 'lottie.json')

const W = 375, H = 133, FPS = 30, FRAMES = 72   // 2.4 s seamless loop

const BLACK = [0.1333, 0.1333, 0.1333, 1]   // #222222
const WHITE = [1, 1, 1, 1]

// ── SVG path → Lottie bezier ──────────────────────────────────────────────────
function parsePath(d) {
  // Returns array of {v, i, o, c} bezier objects (one per sub-path).
  // Handles absolute M L H V C Z.
  const RE = /([MLHVCZmlhvcz])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g
  const tok = []
  let m
  while ((m = RE.exec(d)) !== null) tok.push(m[1] !== undefined ? m[1] : +m[2])

  const segs = []
  let idx = 0
  const n = () => tok[idx++]
  let cx = 0, cy = 0, sx = 0, sy = 0
  let V, I, O, cl

  const newSeg = () => { V = []; I = []; O = []; cl = false }
  const saveSeg = () => {
    if (V?.length > 0) {
      // Detect implicit close: last vertex == first vertex
      if (V.length > 1) {
        const [fx, fy] = V[0], [lx, ly] = V[V.length - 1]
        if (Math.abs(lx - fx) < 0.01 && Math.abs(ly - fy) < 0.01) {
          const ii = I.pop(); O.pop(); V.pop()
          I[0] = ii   // transfer incoming tangent to closing vertex
          cl = true
        }
      }
      segs.push({ v: [...V], i: [...I], o: [...O], c: cl })
    }
    newSeg()
  }

  newSeg()
  while (idx < tok.length) {
    const cmd = tok[idx++]
    if (typeof cmd === 'number') { idx--; continue }
    if (cmd === 'M') {
      saveSeg()
      cx = n(); cy = n(); sx = cx; sy = cy
      V.push([cx, cy]); I.push([0, 0]); O.push([0, 0])
    } else if (cmd === 'L') {
      while (idx < tok.length && typeof tok[idx] === 'number') {
        cx = n(); cy = n()
        V.push([cx, cy]); I.push([0, 0]); O.push([0, 0])
      }
    } else if (cmd === 'H') {
      while (idx < tok.length && typeof tok[idx] === 'number') {
        cx = n()
        V.push([cx, cy]); I.push([0, 0]); O.push([0, 0])
      }
    } else if (cmd === 'V') {
      while (idx < tok.length && typeof tok[idx] === 'number') {
        cy = n()
        V.push([cx, cy]); I.push([0, 0]); O.push([0, 0])
      }
    } else if (cmd === 'C') {
      while (idx < tok.length && typeof tok[idx] === 'number') {
        const x1 = n(), y1 = n(), x2 = n(), y2 = n(), x = n(), y = n()
        const last = V.length - 1
        O[last] = [x1 - V[last][0], y1 - V[last][1]]
        cx = x; cy = y
        V.push([cx, cy]); I.push([x2 - cx, y2 - cy]); O.push([0, 0])
      }
    } else if (cmd === 'Z' || cmd === 'z') {
      cl = true
      // Deduplicate closing vertex produced by a C that lands exactly on the start
      if (V.length > 1) {
        const [fx, fy] = V[0], [lx, ly] = V[V.length - 1]
        if (Math.abs(lx - fx) < 0.01 && Math.abs(ly - fy) < 0.01) {
          const ii = I.pop(); O.pop(); V.pop()
          I[0] = ii
        }
      }
      saveSeg()
      cx = sx; cy = sy
    }
  }
  saveSeg()
  return segs
}

// ── Lottie property helpers ───────────────────────────────────────────────────
const sk = k => ({ a: 0, k })   // static property

// Smooth ease-in-out handle (same for all dims)
const EIO = { x: [0.5], y: [0.5] }

// Build animated property: kfs = [{t, s, ?ease:'smooth'|'linear'}]
// 's' values must be arrays even for scalars: [100] not 100.
function anim(kfs) {
  return {
    a: 1,
    k: kfs.map((kf, idx) => {
      if (idx === kfs.length - 1) return { t: kf.t, s: kf.s }
      // last kf has no i/o
      return { t: kf.t, s: kf.s, i: EIO, o: EIO }
    })
  }
}

// ── Layer / shape factories ───────────────────────────────────────────────────
function makeKs({ p, a, s, r, o }) {
  return {
    p: p ?? sk([0, 0, 0]),
    a: a ?? sk([0, 0, 0]),
    s: s ?? sk([100, 100, 100]),
    r: r ?? sk(0),
    o: o ?? sk(100)
  }
}

function shapeLayer(nm, ind, parent, shapes, ksOverrides = {}) {
  return {
    ty: 4, nm, ind,
    ip: 0, op: FRAMES, st: 0, sr: 1,
    parent,
    ks: makeKs(ksOverrides),
    shapes
  }
}

function nullLayer(nm, ind, parent, ksOverrides = {}) {
  return {
    ty: 3, nm, ind,
    ip: 0, op: FRAMES, st: 0, sr: 1,
    w: 100, h: 100,
    ...(parent != null ? { parent } : {}),
    ks: makeKs(ksOverrides)
  }
}

const fill  = c => ({ ty: 'fl', c: sk(c), o: sk(100) })
const stroke = (c, w, lc = 2, lj = 2) => ({ ty: 'st', c: sk(c), o: sk(100), w: sk(w), lc, lj })

function pathShape(bez) {
  return { ty: 'sh', ks: sk(bez) }
}

function ellipseShape(cx, cy, rx, ry) {
  return { ty: 'el', p: sk([cx, cy]), s: sk([rx * 2, ry * 2]) }
}

function group(items, nm = '') {
  return {
    ty: 'gr', nm,
    it: [
      ...items,
      {
        ty: 'tr',
        p: sk([0, 0]), a: sk([0, 0]), s: sk([100, 100]),
        r: sk(0), o: sk(100)
      }
    ]
  }
}

// ── SVG source data ───────────────────────────────────────────────────────────
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

const P = Object.fromEntries(
  Object.entries(SVG_PATHS).map(([k, d]) => [k, parsePath(d)])
)

// ── Animation keyframe builders ───────────────────────────────────────────────

// Root null: anchor=[187,111] (bubble bottom = squash pivot).
// Position Y bounces 111↔117 (+6px). Scale Y squashes 100↔96.
// 9-frame half-steps → one 1.2s walk cycle = 36 frames. Two cycles = 72f.
function bouncePos() {
  const kfs = []
  for (let t = 0; t <= FRAMES; t += 9) {
    const bot = (t / 9) % 2 === 1
    kfs.push({ t, s: [187, bot ? 117 : 111, 0] })
  }
  return anim(kfs)
}

function bounceSca() {
  const kfs = []
  for (let t = 0; t <= FRAMES; t += 9) {
    const bot = (t / 9) % 2 === 1
    kfs.push({ t, s: [100, bot ? 96 : 100, 100] })
  }
  return anim(kfs)
}

// Bag sway: rotates ±4° in phase with bounce (pivot at null anchor [143,80]).
function bagRot() {
  const kfs = []
  for (let t = 0; t <= FRAMES; t += 9) {
    const bot = (t / 9) % 2 === 1
    kfs.push({ t, s: [bot ? 4 : 0] })
  }
  return anim(kfs)
}

// Blink: squash eyes scaleY to 8% at frame 35, recover at 37. Anchored at [202,57].
function blinkSca() {
  return anim([
    { t: 0,  s: [100, 100, 100] },
    { t: 33, s: [100, 100, 100] },
    { t: 35, s: [100,   8, 100] },
    { t: 37, s: [100, 100, 100] },
    { t: 72, s: [100, 100, 100] },  // last frame = frame 0 → seamless
  ])
}

// Steam: drift up 16px over 28 frames, hold invisible, snap back, restart.
// Opacity 100→0 over 28f, hold 0 until next cycle.

// Steam 1 — cycle starts at t=0.
function steam1Pos() {
  return anim([
    { t:  0, s: [0,   0, 0] },
    { t: 28, s: [0, -16, 0] },
    { t: 29, s: [0,   0, 0] },   // 1-frame snap, opacity=0 so invisible
    { t: 64, s: [0, -16, 0] },
    { t: 65, s: [0,   0, 0] },
    { t: 72, s: [0,   0, 0] },   // last
  ])
}

function steam1Opa() {
  return anim([
    { t:  0, s: [100] },
    { t: 28, s: [  0] },
    { t: 35, s: [  0] },   // hold invisible
    { t: 36, s: [100] },
    { t: 64, s: [  0] },
    { t: 71, s: [  0] },
    { t: 72, s: [100] },   // last
  ])
}

// Steam 2 — cycle starts at t=18 (half-period stagger for continuous heat effect).
// At t=0 we're 18f into the cycle: Y = -16*(18/28), opa = 100*(10/28).
function steam2Pos() {
  const Y0 = -16 * 18 / 28   // ≈ -10.286
  return anim([
    { t:  0, s: [0,  Y0, 0] },
    { t: 10, s: [0, -16, 0] },
    { t: 11, s: [0,   0, 0] },   // invisible snap reset
    { t: 46, s: [0, -16, 0] },
    { t: 47, s: [0,   0, 0] },
    { t: 72, s: [0,  Y0, 0] },   // last = t=0 → seamless
  ])
}

function steam2Opa() {
  const O0 = 100 * 10 / 28   // ≈ 35.714
  return anim([
    { t:  0, s: [ O0] },
    { t: 10, s: [  0] },
    { t: 17, s: [  0] },
    { t: 18, s: [100] },
    { t: 46, s: [  0] },
    { t: 53, s: [  0] },
    { t: 54, s: [100] },
    { t: 72, s: [ O0] },   // last
  ])
}

// ── Layer definitions ─────────────────────────────────────────────────────────
// Parent null indices
const ROOT = 1   // zenek-root (bounce + squash)
const BAGR = 2   // bag-root (sway rotation)

// Body — black circle, r=44 centred at (187, 67)
const bodyLyr = shapeLayer('body', 3, ROOT, [
  group([ellipseShape(187, 67, 44, 44), fill(BLACK)])
])

// Face — white bezier ellipse
const faceLyr = shapeLayer('face', 4, ROOT, [
  group([pathShape(P.face[0]), fill(WHITE)])
])

// Eyes — two strokes with blink scale; anchor at eye-centre (202, 57)
const eyesLyr = shapeLayer('eyes', 5, ROOT,
  [group([pathShape(P.eye1[0]), pathShape(P.eye2[0]), stroke(BLACK, 3)])],
  {
    p: sk([202, 57, 0]),
    a: sk([202, 57, 0]),
    s: blinkSca(),
  }
)

// Right hand — black circle at (242.78, 79.22) r=10.5 (from SVG matrix transform)
const rightHandLyr = shapeLayer('right-hand', 6, ROOT, [
  group([ellipseShape(242.78, 79.22, 10.5, 10.5), fill(BLACK)])
])

// Arm sleeve — white fill + thin outline; parented to bag-root for sway
const armLyr = shapeLayer('arm-sleeve', 7, BAGR, [
  group([pathShape(P.arm[0]), fill(WHITE), stroke(BLACK, 1.5)])
])

// Bag body — white fill + stroke
const bagBodyLyr = shapeLayer('bag-body', 8, BAGR, [
  group([pathShape(P.bag[0]), fill(WHITE), stroke(BLACK, 2)])
])

// Bag interior lines (two open sub-paths)
const bagLinesLyr = shapeLayer('bag-lines', 9, BAGR, [
  group([pathShape(P.bagLines[0]), pathShape(P.bagLines[1]), stroke(BLACK, 2)])
])

// Bag handle arc — white stroke (shows through the dark bag outline)
const bagHandleLyr = shapeLayer('bag-handle', 10, BAGR, [
  group([pathShape(P.bagHandle[0]), stroke(WHITE, 2)])
])

// Arm hair strokes (three short curved lines)
const armHair1Lyr = shapeLayer('arm-hair1', 11, BAGR, [
  group([pathShape(P.armHair1[0]), stroke(BLACK, 2)])
])
const armHair2Lyr = shapeLayer('arm-hair2', 12, BAGR, [
  group([pathShape(P.armHair2[0]), stroke(BLACK, 2)])
])
const armHair3Lyr = shapeLayer('arm-hair3', 13, BAGR, [
  group([pathShape(P.armHair3[0]), stroke(BLACK, 2)])
])

// Coffee cup — three stacked polygon shapes; stays steady (no extra animation)
const cup1Lyr = shapeLayer('cup-body',   14, ROOT, [group([pathShape(P.cup1[0]), fill(WHITE), stroke(BLACK, 2)])])
const cup2Lyr = shapeLayer('cup-rim',    15, ROOT, [group([pathShape(P.cup2[0]), fill(WHITE), stroke(BLACK, 2)])])
const cup3Lyr = shapeLayer('cup-sleeve', 16, ROOT, [group([pathShape(P.cup3[0]), fill(WHITE), stroke(BLACK, 2)])])

// Steam 1 (right wave) — drift + fade
const steam1Lyr = shapeLayer('steam-1', 17, ROOT,
  [group([pathShape(P.steam[0]), stroke(BLACK, 2)])],
  { p: steam1Pos(), o: steam1Opa() }
)

// Steam 2 (left wave) — drift + fade, staggered 18f
const steam2Lyr = shapeLayer('steam-2', 18, ROOT,
  [group([pathShape(P.steam[1]), stroke(BLACK, 2)])],
  { p: steam2Pos(), o: steam2Opa() }
)

// Left hand — black circle at (142.78, 79.22), follows bag sway
const leftHandLyr = shapeLayer('left-hand', 19, BAGR, [
  group([ellipseShape(142.78, 79.22, 10.5, 10.5), fill(BLACK)])
])

// ── Null layers ───────────────────────────────────────────────────────────────
// Bag-root: rotation sway pivots around left-hand position (143, 80)
const bagRootLyr = nullLayer('bag-root', BAGR, ROOT, {
  p: sk([143, 80, 0]),
  a: sk([143, 80, 0]),
  r: bagRot(),
})

// Zenek-root: main bounce + squash. Anchor at bubble bottom (187, 111).
const zenekRootLyr = nullLayer('zenek-root', ROOT, null, {
  p: bouncePos(),
  a: sk([187, 111, 0]),
  s: bounceSca(),
})

// ── Compose JSON ──────────────────────────────────────────────────────────────
// layers[0] renders first (bottom), layers[last] renders last (top).
// Null layers at end (invisible, z-order irrelevant).
const lottie = {
  v: '5.7.0',
  fr: FPS,
  ip: 0,
  op: FRAMES,
  w: W,
  h: H,
  nm: 'EverydayExpress',
  assets: [],
  // Skottie: layers[0] = front/top, layers[last] = back/bottom.
  // Order is reverse of SVG document order.
  layers: [
    zenekRootLyr,   // null: bounce + squash (invisible)
    bagRootLyr,     // null: bag sway pivot (invisible)
    leftHandLyr,    // Ellipse 323 — topmost visible
    steam2Lyr,      // steam left  (staggered, drifts + fades)
    steam1Lyr,      // steam right (drifts + fades)
    cup3Lyr,        // cup sleeve  (topmost cup part)
    cup2Lyr,        // cup rim
    cup1Lyr,        // cup body
    armHair3Lyr,    // arm fur stroke 3
    armHair2Lyr,    // arm fur stroke 2
    armHair1Lyr,    // arm fur stroke 1
    bagHandleLyr,   // bag handle arc
    bagLinesLyr,    // bag interior lines
    bagBodyLyr,     // grocery bag body
    armLyr,         // left arm sleeve
    rightHandLyr,   // right wrist circle
    eyesLyr,        // happy eye squiggles (blink)
    faceLyr,        // white face plate
    bodyLyr,        // black bubble body — bottommost visible
  ]
}

// ── Write output ──────────────────────────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT, JSON.stringify(lottie, null, 2))
console.log(`Written ${OUT}`)
