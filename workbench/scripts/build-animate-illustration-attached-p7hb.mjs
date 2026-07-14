#!/usr/bin/env node
/**
 * ENTRY animation for assets/animate-illustration-attached-p7hb.svg — a stylised
 * "card" (really a rocket-shaped card: white trapezoid with a bold black spine)
 * launching upward out of a cloud, with exhaust motion-lines streaming beneath,
 * a faint diagonal-hatch dome backdrop, and four decorative dots.
 * Output: public/projects/animate-illustration-attached-p7hb/scene-1/lottie.json
 *
 * Brief: card appears in the centre, then takes off to the sky like a rocket
 * launching upwards; the cloud beneath appears as the card moves up; the other
 * decorative elements animate/move around smoothly; the cloud fades away at the
 * end. Plays once.
 *
 * CHOREOGRAPHY (60fps, 180f = 3s):
 *  - APPEAR      0–38   card fades + scales in at a low-centre "ready" position,
 *                       gently settling. Dome backdrop fades in behind; the four
 *                       dots drift + fade in on staggered offsets.
 *  - ANTICIPATE  38–46  a small downward crouch + squash (wider/shorter) — the
 *                       rocket loading energy before ignition.
 *  - LAUNCH      46–100 card rockets UP to its source position with a vertical
 *                       stretch (narrow/tall) peaking mid-flight and a small
 *                       overshoot past the target, settling back. As it lifts,
 *                       the exhaust lines stream on (trim-path draw, from the
 *                       base downward/outward) and the cloud billows in beneath
 *                       (scale-up + fade) — "appears as the card moves up".
 *  - FLOAT       100–135 card holds high in the sky with a gentle buoyant bob;
 *                       dots keep drifting.
 *  - DISSIPATE   135–180 the cloud fades away and gently expands (exhaust smoke
 *                       dissipating). Card stays up; dots settle to source.
 *
 * Final frame == the source composition MINUS the cloud (the brief explicitly
 * asks the cloud to fade away at the end), everything else landing on its exact
 * source geometry.
 *
 * House pattern (see docs/): parse the SVG path data directly, emit every shape
 * / keyframe programmatically, verify headlessly via scripts/preview-scene.mjs.
 *
 * Skottie gotchas honoured here (see docs/allset-*, docs/cloudscheck-*):
 *  - Non-zero anchor + ANIMATED POSITION on one layer is the freeze bug; scale
 *    and position are therefore split across two nulls (mover = position, zero
 *    anchor; scaler = stretch, non-zero base-pivot anchor, static position).
 *  - Keyframe times stay strictly ascending.
 *  - The dome's raster hatch pattern is reproduced as real diagonal strokes
 *    clipped to the dome silhouette with a track matte (td/tt), the pattern
 *    proven in build-dataprocessing.mjs.
 */
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../public/projects/animate-illustration-attached-p7hb/scene-1')
const OUT = join(OUT_DIR, 'lottie.json')

const W = 256, H = 256, FPS = 60, FRAMES = 180

const BLACK = [0.1333, 0.1333, 0.1333, 1]   // #222222
const WHITE = [1, 1, 1, 1]
const HATCH = [0.1333, 0.1333, 0.1333, 1]   // dome hatch ink (shown faint via layer opacity)
const STROKE_W = 1.61911                    // source stroke-width

// ── SVG path → Lottie bezier (M L H V C Z, absolute) ─────────────────────────
function parsePath(d) {
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
      if (V.length > 1) {
        const [fx, fy] = V[0], [lx, ly] = V[V.length - 1]
        if (Math.abs(lx - fx) < 0.01 && Math.abs(ly - fy) < 0.01) {
          const ii = I.pop(); O.pop(); V.pop()
          I[0] = ii
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

// Reverse a subpath's draw-on direction (reverse vertices AND swap in/out tangents).
function reverseSubpath(sp) {
  return {
    c: sp.c,
    v: sp.v.slice().reverse(),
    i: sp.o.slice().reverse(),
    o: sp.i.slice().reverse(),
  }
}

function bbox(segs) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const seg of segs) for (const [x, y] of seg.v) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x)
    minY = Math.min(minY, y); maxY = Math.max(maxY, y)
  }
  return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 }
}

// ── Easing anchors (cubic-bezier x1,y1,x2,y2) ────────────────────────────────
const EASE = {
  settleSoft:    { o: { x: [0.00], y: [0.65] }, i: { x: [0.51], y: [0.99] } },
  travelBal:     { o: { x: [1.00], y: [0.49] }, i: { x: [0.00], y: [0.55] } },
  expressivePop: { o: { x: [0.94], y: [0.75] }, i: { x: [0.34], y: [0.94] } },
  entranceSharp: { o: { x: [0.20], y: [0.75] }, i: { x: [0.34], y: [0.94] } },
}

// ── Lottie helpers ───────────────────────────────────────────────────────────
const sk = k => ({ a: 0, k })

// kfs: [{t, s, ease?}] — last kf has no i/o.
function anim(kfs, defaultEase = EASE.settleSoft) {
  return {
    a: 1,
    k: kfs.map((kf, idx) => {
      if (idx === kfs.length - 1) return { t: kf.t, s: kf.s }
      const e = kf.ease || defaultEase
      return { t: kf.t, s: kf.s, i: e.i, o: e.o }
    })
  }
}

function makeKs({ p, a, s, r, o }) {
  return {
    p: p ?? sk([0, 0, 0]),
    a: a ?? sk([0, 0, 0]),
    s: s ?? sk([100, 100, 100]),
    r: r ?? sk(0),
    o: o ?? sk(100)
  }
}

function shapeLayer(nm, ind, parent, shapes, ksOverrides = {}, extra = {}) {
  return {
    ty: 4, nm, ind,
    ip: 0, op: FRAMES, st: 0, sr: 1,
    ...(parent != null ? { parent } : {}),
    ks: makeKs(ksOverrides),
    shapes,
    ...extra,
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

const fill = (c, fillRule) => ({ ty: 'fl', c: sk(c), o: sk(100), ...(fillRule === 'evenodd' ? { r: 2 } : {}) })
const strokeStyle = (c, w, lc = 2, lj = 2) => ({ ty: 'st', c: sk(c), o: sk(100), w: sk(w), lc, lj })
const pathShape = seg => ({ ty: 'sh', ks: sk(seg) })
// Trim-paths modifier with animated end (draw-on). m:1 = whole group as one path.
const trim = (endKfs, ease = EASE.entranceSharp) => ({
  ty: 'tm', s: sk(0), e: anim(endKfs, ease), o: sk(0), m: 1,
})

function group(items, nm = '', trOverrides = {}) {
  return {
    ty: 'gr', nm,
    it: [
      ...items,
      { ty: 'tr', p: sk([0, 0]), a: sk([0, 0]), s: sk([100, 100]), r: sk(0), o: sk(100), ...trOverrides }
    ]
  }
}

// ── SVG source paths ─────────────────────────────────────────────────────────
const SVG = {
  card:   'M157.871 40.8944C161.171 40.8758 164.274 42.4812 166.186 45.1997C168.095 47.9157 168.575 51.4 167.468 54.5379C158.084 81.2799 154.754 107.978 155.205 134.647C155.256 137.379 154.223 140.018 152.334 141.977C150.445 143.935 147.859 145.05 145.151 145.074C140.291 145.116 116.054 145.116 111.196 145.074C108.488 145.05 105.902 143.935 104.012 141.977C102.123 140.018 101.089 137.379 101.139 134.647C101.593 107.978 98.2621 81.2799 88.8777 54.5379C87.7703 51.4 88.2503 47.9157 90.1617 45.1997C92.0714 42.4812 95.1753 40.8758 98.4766 40.8944C106.76 40.9317 149.584 40.9317 157.871 40.8944Z',
  stripe: 'M114.453 144.975C114.453 144.975 115.457 73.6674 102.694 40.8942C107.891 40.8942 117.88 40.9929 117.88 40.9929C122.746 57.5726 126.212 79.2581 125.943 145.072C121.841 145.185 114.453 144.975 114.453 144.975Z',
  cloud:  'M1.88184 178.566C5.56045 176.603 15.9964 176.185 25.1776 179.979C35.9511 184.431 41.6585 192.599 38.5919 194.382C35.5261 196.166 31.5698 188.275 29.8471 183.473C29.8471 183.473 17.2294 156.055 36.721 144.545C51.263 135.961 65.4262 147.742 65.4262 147.742C65.4262 147.742 63.4922 128.99 80.0484 121.963C92.2929 116.764 103.196 122.986 108.888 134.385H147.306C148.85 125.368 163.902 116.764 176.147 121.963C192.702 128.99 190.767 147.742 190.767 147.742C190.767 147.742 204.93 135.961 219.472 144.545C238.964 156.055 226.347 183.473 226.347 183.473C224.624 188.275 220.668 196.166 217.601 194.382C214.536 192.599 220.242 184.431 231.014 179.979C240.198 176.185 250.634 176.603 254.311 178.566',
  dome:   'M207.936 135.966C207.936 90.8065 171.482 54.1976 126.512 54.1976C81.5424 54.1976 45.0874 90.8065 45.0874 135.966C45.0874 142.552 45.88 148.949 47.3452 155.083H205.68C207.143 148.949 207.936 142.552 207.936 135.966Z',
  ex11:   'M126.511 155.083V189.45',
  ex13:   'M126.511 200.536V214.948',
  ex15:   'M89.3999 207.188C89.3999 207.188 116.326 196.722 117.095 155.083',
  ex17:   'M163.623 207.188C163.623 207.188 136.697 196.722 135.928 155.083',
  dot1:   'M48.4105 112.955C52.6906 112.955 56.1652 116.433 56.1652 120.716C56.1652 125 52.6906 128.476 48.4105 128.476C44.1312 128.476 40.6558 125 40.6558 120.716C40.6558 116.433 44.1312 112.955 48.4105 112.955Z',
  dot2:   'M200.181 160.626C204.461 160.626 207.935 164.104 207.935 168.387C207.935 172.67 204.461 176.147 200.181 176.147C195.901 176.147 192.426 172.67 192.426 168.387C192.426 164.104 195.901 160.626 200.181 160.626Z',
  dot3:   'M30.6855 128.476C32.5208 128.476 34.0087 129.966 34.0087 131.801C34.0087 133.637 32.5208 135.128 30.6855 135.128C28.8495 135.128 27.3623 133.637 27.3623 131.801C27.3623 129.966 28.8495 128.476 30.6855 128.476Z',
  dot4:   'M212.367 105.195C214.202 105.195 215.69 106.685 215.69 108.52C215.69 110.356 214.202 111.847 212.367 111.847C210.531 111.847 209.043 110.356 209.043 108.52C209.043 106.685 210.531 105.195 212.367 105.195Z',
}
const P = Object.fromEntries(Object.entries(SVG).map(([k, d]) => [k, parsePath(d)]))

// Card + stripe pivot at the base (thrust stretches upward from the base).
const cardBox = bbox([...P.card, ...P.stripe])
const BASE = [cardBox.cx, cardBox.maxY, 0]   // ~[127.8, 145]
const cloudBox = bbox(P.cloud)
const domeBox = bbox(P.dome)

// Cloud fill closes across the bottom (matches the source open path's implicit
// fill close); its outline stays open (the scalloped top with two curled ends).
const cloudFillSeg = { ...P.cloud[0], c: true }
const cloudStrokeSeg = { ...P.cloud[0], c: false }

// ── Timeline ─────────────────────────────────────────────────────────────────
const APPEAR_Y = 44          // low-centre "ready" offset below the source spot
const CROUCH_Y = 52          // anticipation dip
const OVERSHOOT_Y = -8       // launch overshoot above the source spot

// mover null — position offset only (zero anchor: the safe animated-position combo)
const moverPos = anim([
  { t: 0,   s: [0, APPEAR_Y, 0], ease: EASE.settleSoft },
  { t: 26,  s: [0, APPEAR_Y, 0], ease: EASE.settleSoft },
  { t: 38,  s: [0, APPEAR_Y, 0], ease: EASE.travelBal },   // hold — the "appeared in centre" beat
  { t: 46,  s: [0, CROUCH_Y, 0], ease: EASE.expressivePop },// crouch, then ignite
  { t: 74,  s: [0, OVERSHOOT_Y, 0], ease: EASE.settleSoft },// LAUNCH, overshoot up
  { t: 100, s: [0, 0, 0], ease: EASE.settleSoft },          // settle at source spot
  { t: 128, s: [0, -3, 0], ease: EASE.settleSoft },         // buoyant bob
  { t: 156, s: [0, 1.5, 0], ease: EASE.settleSoft },
  { t: 180, s: [0, 0, 0] },
])

// scaler null — squash/stretch about the base pivot (non-zero anchor + animated
// SCALE + static position: the safe combo)
const scalerScale = anim([
  { t: 0,   s: [100, 100, 100], ease: EASE.settleSoft },
  { t: 40,  s: [100, 100, 100], ease: EASE.settleSoft },
  { t: 46,  s: [107, 93, 100],  ease: EASE.expressivePop },// crouch squash (wide/short)
  { t: 62,  s: [93, 111, 100],  ease: EASE.settleSoft },   // launch stretch (narrow/tall)
  { t: 84,  s: [102, 99, 100],  ease: EASE.settleSoft },   // over-settle
  { t: 100, s: [100, 100, 100], ease: EASE.settleSoft },
  { t: 180, s: [100, 100, 100] },
])

const rocketOpacity = anim([
  { t: 0,  s: [0], ease: EASE.settleSoft },
  { t: 24, s: [100], ease: EASE.settleSoft },
  { t: 180, s: [100] },
])

// cloud — billow in as the card lifts, hold, then dissipate (fade + expand)
const cloudScale = anim([
  { t: 0,   s: [55, 55, 100], ease: EASE.settleSoft },
  { t: 50,  s: [55, 55, 100], ease: EASE.expressivePop },
  { t: 72,  s: [105, 105, 100], ease: EASE.settleSoft },
  { t: 88,  s: [100, 100, 100], ease: EASE.settleSoft },
  { t: 135, s: [100, 100, 100], ease: EASE.travelBal },
  { t: 180, s: [120, 120, 100] },
])
const cloudOpacity = anim([
  { t: 0,   s: [0], ease: EASE.settleSoft },
  { t: 50,  s: [0], ease: EASE.settleSoft },
  { t: 72,  s: [100], ease: EASE.settleSoft },
  { t: 135, s: [100], ease: EASE.settleSoft },
  { t: 178, s: [0] },
])

// exhaust — trim-path draw, streaming from the base downward as the card lifts
const exhaustGroups = [
  group([pathShape(P.ex11[0]), strokeStyle(BLACK, STROKE_W), trim([{ t: 52, s: [0] }, { t: 84, s: [100] }])], 'ex-center'),
  group([pathShape(reverseSubpath(P.ex15[0])), strokeStyle(BLACK, STROKE_W), trim([{ t: 56, s: [0] }, { t: 90, s: [100] }])], 'ex-left'),
  group([pathShape(reverseSubpath(P.ex17[0])), strokeStyle(BLACK, STROKE_W), trim([{ t: 56, s: [0] }, { t: 90, s: [100] }])], 'ex-right'),
  group([pathShape(P.ex13[0]), strokeStyle(BLACK, STROKE_W), trim([{ t: 62, s: [0] }, { t: 92, s: [100] }])], 'ex-tail'),
]

// dots — fade + gentle continuous drift, settling to source geometry
function dotLayer(nm, ind, seg, fadeIn, drift) {
  return shapeLayer(nm, ind, null, [group([pathShape(seg), fill(BLACK)])], {
    p: anim(drift, EASE.settleSoft),
    o: anim([{ t: fadeIn[0], s: [0], ease: EASE.settleSoft }, { t: fadeIn[1], s: [100], ease: EASE.settleSoft }, { t: 180, s: [100] }]),
  })
}

// dome hatch — diagonal "/" lines clipped to the dome silhouette by a track matte
function hatchLines(box, spacing = 7, pad = 12) {
  const lines = []
  const cMin = box.minX + box.minY - pad
  const cMax = box.maxX + box.maxY + pad
  const x0 = box.minX - pad, x1 = box.maxX + pad
  for (let c = cMin; c <= cMax; c += spacing) {
    lines.push({ v: [[x0, c - x0], [x1, c - x1]], i: [[0, 0], [0, 0]], o: [[0, 0], [0, 0]], c: false })
  }
  return lines
}

// ── Layers ───────────────────────────────────────────────────────────────────
const moverLyr = nullLayer('mover', 1, null, { p: moverPos, a: sk([0, 0, 0]) })
const scalerLyr = nullLayer('scaler', 2, 1, { a: sk(BASE), p: sk(BASE), s: scalerScale })

// Within a layer's shapes array, index 0 paints frontmost — so the black spine
// group leads, the white card body + outline group follows behind it.
const rocketLyr = shapeLayer('rocket', 3, 2, [
  group([pathShape(P.stripe[0]), fill(BLACK)], 'stripe'),
  group([pathShape(P.card[0]), fill(WHITE), strokeStyle(BLACK, STROKE_W)], 'card'),
], { o: rocketOpacity })

const exhaustLyr = shapeLayer('exhaust', 4, null, exhaustGroups)

const cloudLyr = shapeLayer('cloud', 5, null, [
  group([pathShape(cloudFillSeg), fill(WHITE, 'evenodd')], 'cloud-fill'),
  group([pathShape(cloudStrokeSeg), strokeStyle(BLACK, STROKE_W)], 'cloud-outline'),
], { a: sk([cloudBox.cx, cloudBox.cy, 0]), p: sk([cloudBox.cx, cloudBox.cy, 0]), s: cloudScale, o: cloudOpacity })

const dot1Lyr = dotLayer('dot-1', 6, P.dot1[0], [8, 30], [
  { t: 0, s: [7, -5, 0], ease: EASE.settleSoft }, { t: 30, s: [0, 0, 0], ease: EASE.settleSoft },
  { t: 80, s: [-4, 4, 0], ease: EASE.travelBal }, { t: 130, s: [4, -3, 0], ease: EASE.travelBal }, { t: 180, s: [0, 0, 0] },
])
const dot2Lyr = dotLayer('dot-2', 7, P.dot2[0], [14, 36], [
  { t: 0, s: [-6, -4, 0], ease: EASE.settleSoft }, { t: 36, s: [0, 0, 0], ease: EASE.settleSoft },
  { t: 90, s: [4, 4, 0], ease: EASE.travelBal }, { t: 140, s: [-3, 3, 0], ease: EASE.travelBal }, { t: 180, s: [0, 0, 0] },
])
const dot3Lyr = dotLayer('dot-3', 8, P.dot3[0], [10, 32], [
  { t: 0, s: [5, 4, 0], ease: EASE.settleSoft }, { t: 32, s: [0, 0, 0], ease: EASE.settleSoft },
  { t: 85, s: [3, -5, 0], ease: EASE.travelBal }, { t: 135, s: [-4, 2, 0], ease: EASE.travelBal }, { t: 180, s: [0, 0, 0] },
])
const dot4Lyr = dotLayer('dot-4', 9, P.dot4[0], [18, 40], [
  { t: 0, s: [-5, 5, 0], ease: EASE.settleSoft }, { t: 40, s: [0, 0, 0], ease: EASE.settleSoft },
  { t: 95, s: [-3, -4, 0], ease: EASE.travelBal }, { t: 145, s: [4, 3, 0], ease: EASE.travelBal }, { t: 180, s: [0, 0, 0] },
])

const domeMatteLyr = shapeLayer('dome-matte', 10, null, [
  group([pathShape(P.dome[0]), fill(WHITE)], 'dome-clip'),
], {}, { td: 1 })

const domeHatchLyr = shapeLayer('dome-hatch', 11, null, [
  group([...hatchLines(domeBox).map(pathShape), strokeStyle(HATCH, 1.0)], 'hatch'),
], {
  o: anim([{ t: 6, s: [0], ease: EASE.settleSoft }, { t: 40, s: [12], ease: EASE.settleSoft }, { t: 180, s: [12] }]),
}, { tt: 1 })

// ── Compose ──────────────────────────────────────────────────────────────────
// layers[0] frontmost. Nulls (mover/scaler) don't paint; the dome matte/hatch
// pair must stay adjacent (matte first) for the track matte to bind.
const lottie = {
  v: '5.7.0', fr: FPS, ip: 0, op: FRAMES, w: W, h: H,
  nm: 'Card Launch p7hb',
  assets: [],
  layers: [
    moverLyr, scalerLyr,
    dot1Lyr, dot2Lyr, dot3Lyr, dot4Lyr,
    rocketLyr,
    exhaustLyr,
    cloudLyr,
    domeMatteLyr, domeHatchLyr,
  ],
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT, JSON.stringify(lottie, null, 2))
console.log(`Written ${OUT}`)
console.log(`base pivot: ${BASE.map(n => Math.round(n * 10) / 10)}  cloud c: ${[cloudBox.cx, cloudBox.cy].map(n => Math.round(n))}`)
