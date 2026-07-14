#!/usr/bin/env node
/**
 * Generates an animated Lottie JSON for AllSet.svg — Zenek "all set!" celebration loop.
 * Output: public/projects/all-set/scene-1/lottie.json
 *
 * Animation design (60fps, 216f = 3.6s seamless loop, 4 beats of 0.9s each L-R-L-R):
 *  - Body dance-sway: rotates around a low pivot (body base) while bouncing and
 *    squashing/stretching. Beat boundaries (0,54,108,162,216) are the upright,
 *    stretched-tall "center" crossings; beat midpoints (27,81,135,189) are the
 *    squashed, max-lean dip bottoms, alternating left/right.
 *  - Eyes blink (thin-line squash) at two of the four center crossings (54, 162).
 *  - Three sparkle bursts pop in round-robin: elastic scale-up + overshoot, brief
 *    hold, soft fade-down. Staggered 12f (200ms) apart, 30f (500ms) per pulse,
 *    36f per full round — 6 rounds fit exactly in the 216f loop.
 *  - Green doodle (ribbon + checkmark tick + spark dot) is static — a quiet
 *    background flourish, not a beat. A shared opacity breath (100%→88%→100%
 *    once per loop) plus a soft, multi-step light sweep gliding once left to
 *    right keep it from reading as dead, without any drawing or waving.
 *  - Shadow hatch shifts opposite the lean and compresses at each landing.
 *  - First and last frame identical on every layer → seamless loop.
 */
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../public/projects/all-set/scene-1')
const OUT = join(OUT_DIR, 'lottie.json')

const W = 257, H = 256, FPS = 60, FRAMES = 216   // 3.6 s seamless loop

const BLACK = [0.1333, 0.1333, 0.1333, 1]     // #222222
const WHITE = [1, 1, 1, 1]
const SHADOW_C = [0.8745, 0.8745, 0.8745, 1]  // #DFDFDF

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

function bbox(segs) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const seg of segs) for (const [x, y] of seg.v) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x)
    minY = Math.min(minY, y); maxY = Math.max(maxY, y)
  }
  return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 }
}
function bboxUnion(...boxes) {
  const minX = Math.min(...boxes.map(b => b.minX)), maxX = Math.max(...boxes.map(b => b.maxX))
  const minY = Math.min(...boxes.map(b => b.minY)), maxY = Math.max(...boxes.map(b => b.maxY))
  return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 }
}

// ── Easing anchors (o = departure, i = arrival — cubic-bezier x1,y1,x2,y2) ────
const EASE = {
  settleSoft:    { o: { x: [0.00], y: [0.65] }, i: { x: [0.51], y: [0.99] } },
  travelBal:     { o: { x: [1.00], y: [0.49] }, i: { x: [0.00], y: [0.55] } },
  expressivePop: { o: { x: [0.94], y: [0.75] }, i: { x: [0.34], y: [0.94] } },
  entranceSharp: { o: { x: [0.20], y: [0.75] }, i: { x: [0.34], y: [0.94] } },
}

// ── Lottie property helpers ───────────────────────────────────────────────────
const sk = k => ({ a: 0, k })

// kfs: [{t, s, ease?}] — ease defaults to settleSoft; last kf has no i/o.
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

function shapeLayer(nm, ind, parent, shapes, ksOverrides = {}) {
  return {
    ty: 4, nm, ind,
    ip: 0, op: FRAMES, st: 0, sr: 1,
    ...(parent != null ? { parent } : {}),
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

const fill = (c, fillRule) => ({ ty: 'fl', c: sk(c), o: sk(100), ...(fillRule === 'evenodd' ? { r: 2 } : {}) })
const strokeStyle = (c, w, lc = 2, lj = 2) => ({ ty: 'st', c: sk(c), o: sk(100), w: sk(w), lc, lj })

function pathShape(seg) { return { ty: 'sh', ks: sk(seg) } }

// Expand a stroked bezier seg into a single filled polygon (flatten + offset
// ribbon with round caps baked into the same contour). Needed for the tick: a
// thick (18.36px) stroke on a tightly self-crossing scribble reproducibly
// corrupts unrelated layers' rendering in this Skottie/CanvasKit build
// (confirmed by isolating layer-by-layer — a live stroke this width+shape is
// the trigger, independent of layer order, joins, or animation). A plain
// filled polygon sidesteps the stroke tessellator entirely, per
// svg-compatibility.md's "expand strokes to fills" guidance.
//
// The caps must be part of the SAME polygon contour, not separate circle
// shapes sharing the fill: two overlapping same-color shapes with opposite
// winding cancel under nonzero fill instead of union-ing, which is exactly
// what produced the "bite taken out" holes at the tick's rounded ends.
function strokeToFillPolygon(seg, width, samplesPerCurve = 20, capSteps = 10) {
  const n = seg.v.length
  const segCount = seg.c ? n : n - 1
  const raw = []
  for (let idx = 0; idx < segCount; idx++) {
    const p0 = seg.v[idx]
    const p3 = seg.v[(idx + 1) % n]
    const p1 = [p0[0] + seg.o[idx][0], p0[1] + seg.o[idx][1]]
    const p2 = [p3[0] + seg.i[(idx + 1) % n][0], p3[1] + seg.i[(idx + 1) % n][1]]
    for (let s = 0; s < samplesPerCurve; s++) {
      const t = s / samplesPerCurve, mt = 1 - t
      raw.push([
        mt * mt * mt * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t * t * t * p3[0],
        mt * mt * mt * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t * t * t * p3[1],
      ])
    }
  }
  if (!seg.c) raw.push(seg.v[n - 1])

  const pts = []
  for (const p of raw) {
    if (pts.length === 0 || Math.hypot(p[0] - pts[pts.length - 1][0], p[1] - pts[pts.length - 1][1]) > 0.05) pts.push(p)
  }
  const pn = pts.length
  const r = width / 2
  const normals = pts.map((p, idx) => {
    const prev = pts[Math.max(0, idx - 1)]
    const next = pts[Math.min(pn - 1, idx + 1)]
    const dx = next[0] - prev[0], dy = next[1] - prev[1]
    const len = Math.hypot(dx, dy) || 1
    return [-dy / len, dx / len]
  })
  const left = pts.map((p, idx) => [p[0] + normals[idx][0] * r, p[1] + normals[idx][1] * r])
  const right = pts.map((p, idx) => [p[0] - normals[idx][0] * r, p[1] - normals[idx][1] * r])

  // Semicircle from `fromVec` (a unit-ish vector giving the start angle),
  // sweeping through -180° — always the outward bulge given how left/right
  // and fromVec are derived (verified against both path ends below).
  const capArc = (center, fromVec) => {
    const a0 = Math.atan2(fromVec[1], fromVec[0])
    const out = []
    for (let s = 1; s < capSteps; s++) {
      const a = a0 - Math.PI * (s / capSteps)
      out.push([center[0] + Math.cos(a) * r, center[1] + Math.sin(a) * r])
    }
    return out
  }
  const endCap = capArc(pts[pn - 1], normals[pn - 1])
  const startNeg = [-normals[0][0], -normals[0][1]]
  const startCap = capArc(pts[0], startNeg)

  const poly = [...left, ...endCap, ...right.reverse(), ...startCap]
  const zeros = poly.map(() => [0, 0])
  return {
    tubeSeg: { v: poly, i: zeros, o: zeros, c: true },
    r,
  }
}

function group(items, nm = '', trOverrides = {}) {
  return {
    ty: 'gr', nm,
    it: [
      ...items,
      { ty: 'tr', p: sk([0, 0]), a: sk([0, 0]), s: sk([100, 100]), r: sk(0), o: sk(100), ...trOverrides }
    ]
  }
}

// ── SVG source data ───────────────────────────────────────────────────────────
const SVG_PATHS = {
  tick:       'M173.397 112.73C172.778 115.009 164.733 119.274 146.486 125.746C81.6081 148.756 103.547 160.484 138.591 149.606C173.635 138.728 172.932 133.973 140.753 151.963C108.575 169.952 98.1526 191.149 140.623 171.347C183.093 151.545 222.176 147.78 222.176 147.78',
  dot:        'M254.691 142.858C252.765 144.715 249.704 144.666 247.848 142.74C245.993 140.814 246.042 137.754 247.969 135.897C249.895 134.041 252.956 134.09 254.812 136.016C256.667 137.942 256.618 141.002 254.691 142.858ZM234.633 136.605L219.156 138.743L221.891 157.136C225.536 156.721 228.783 156.075 229.61 153.527C230.601 150.466 232.963 149.457 235.816 148.771C238.646 148.094 242.112 144.972 240.88 140.732C240.041 137.864 237.314 136.287 234.622 136.593L234.633 136.605Z',
  ribbon:     'M198.121 112.945C198.121 112.945 150.913 131.447 119.175 136.983C38.924 150.981 10.3887 103.667 10.3887 103.667',
  sparkleA:   'M78.2682 79.7127L69.8723 65.1705M66.4685 59.275L63.5186 54.1655M86.2103 93.4687L94.6063 108.011M98.01 113.906L100.96 119.016M74.2972 86.5904L57.5052 86.5904M50.6977 86.5904H44.7979M90.1813 86.59L106.973 86.59M113.781 86.59H119.681M78.2682 93.4687L69.8723 108.011M66.4685 113.906L63.5186 119.016M86.2103 79.7122L94.6063 65.17M98.01 59.2745L100.96 54.165',
  sparkleB:   'M165.54 69.1028V47.4746M165.54 42.645V36.7655M165.54 82.4185L165.54 104.047M165.54 108.876V114.756M171.881 76.0777H193.509M198.339 76.0777H204.218M159.2 76.0777H137.148M132.223 76.0777H126.229M171.047 72.5815L189.951 61.6671M194.172 59.2299L199.311 56.2629M160.034 78.9393L141.13 89.8536M136.909 92.2908L131.77 95.2578M168.719 81.2661L179.634 100.17M182.071 104.392L185.038 109.531M162.361 70.2542L151.447 51.3501M149.01 47.1287L146.043 41.9897M168.719 70.2542L179.634 51.3501M182.071 47.1287L185.038 41.9897M162.361 81.2661L151.447 100.17M149.01 104.392L146.043 109.531M171.047 78.9393L189.951 89.8536M194.172 92.2908L199.311 95.2578M160.034 72.5815L141.13 61.6671M136.909 59.2299L131.77 56.2629',
  sparkleC:   'M117.455 30.2839L111.642 36.0965M104.169 43.5701L98.3563 49.3827M98.356 30.2839L104.169 36.0965M97.6924 39.578H101.215M115.106 39.578H118.629M108.161 50.0464V46.5234M108.161 32.6332V29.1102M111.643 43.5701L117.455 49.3827',
  sparkAccent:'M114.048 117.151C114.048 102.188 102.101 96.8519 98.3887 95.9239M133.953 115.063C133.397 99.7519 142.352 94.068 147.455 93.14',
  bodyOutline:'M122.839 218.077C149.796 223.43 175.988 205.917 181.342 178.96C186.695 152.004 169.182 125.811 142.226 120.458C115.269 115.104 89.0759 132.617 83.7226 159.574C78.3691 186.531 95.8821 212.724 122.839 218.077Z',
  belly:      'M169.649 159.284C166.524 173.911 151.823 172.942 133.989 169.198L131.63 168.691C113.831 164.782 100.024 159.629 103.149 145.001C106.344 130.052 123.818 121.131 142.181 125.074C160.543 129.019 172.842 144.334 169.649 159.284Z',
  eye1:       'M136.181 141.964C135.443 140.398 134.378 139.477 132.15 139.035C129.922 138.592 128.384 138.996 127.306 140.201',
  eye2:       'M149.833 144.675C149.096 143.11 148.03 142.188 145.802 141.746C143.575 141.304 142.036 141.708 140.959 142.913',
}

const SHADOW_D = [
  'M151.271 227.703C151.683 227.727 152.093 227.751 152.501 227.777L135.052 245.176C134.616 245.179 134.179 245.181 133.741 245.182L151.271 227.703Z',
  'M148.143 227.539L130.456 245.175C130.024 245.172 129.593 245.167 129.164 245.163L146.896 227.481C147.313 227.499 147.729 227.519 148.143 227.539Z',
  'M155.581 227.989C155.988 228.019 156.392 228.047 156.794 228.079L139.711 245.114C139.269 245.123 138.826 245.133 138.381 245.14L155.581 227.989Z',
  'M143.724 227.361L125.924 245.111C125.496 245.102 125.07 245.095 124.646 245.084L142.457 227.324C142.881 227.336 143.303 227.347 143.724 227.361Z',
  'M161.017 228.452L144.437 244.985C143.989 245.001 143.54 245.015 143.089 245.029L159.825 228.34C160.225 228.377 160.623 228.413 161.017 228.452Z',
  'M137.959 227.225C138.388 227.232 138.815 227.24 139.241 227.248L121.448 244.99C121.027 244.975 120.609 244.958 120.191 244.942L137.959 227.225Z',
  'M165.163 228.901L149.237 244.782C148.784 244.805 148.328 244.823 147.87 244.844L163.996 228.765C164.389 228.809 164.778 228.855 165.163 228.901Z',
  'M134.699 227.193L117.037 244.805C116.622 244.785 116.208 244.763 115.797 244.741L133.4 227.189C133.835 227.19 134.268 227.191 134.699 227.193Z',
  'M169.227 229.433L154.127 244.489C153.665 244.52 153.2 244.549 152.732 244.579L168.084 229.271C168.469 229.324 168.85 229.379 169.227 229.433Z',
  'M112.689 244.557C112.279 244.531 111.87 244.506 111.464 244.478L128.777 227.213C129.216 227.208 129.657 227.2 130.099 227.197L112.689 244.557Z',
  'M108.405 244.245C108.001 244.212 107.6 244.179 107.202 244.144L124.093 227.301C124.536 227.29 124.982 227.28 125.429 227.27L108.405 244.245Z',
  'M173.19 230.065L159.117 244.098C158.646 244.14 158.171 244.178 157.692 244.217L172.077 229.874C172.454 229.936 172.825 230.001 173.19 230.065Z',
  'M104.19 243.865C103.793 243.825 103.4 243.782 103.01 243.741L119.336 227.461C119.786 227.443 120.237 227.426 120.691 227.41L104.19 243.865Z',
  'M175.956 230.589C176.322 230.665 176.681 230.741 177.032 230.818L164.235 243.579C163.752 243.634 163.264 243.686 162.77 243.739L175.956 230.589Z',
  'M100.053 243.407C99.6632 243.359 99.278 243.308 98.8965 243.259L114.497 227.703C114.955 227.676 115.416 227.65 115.879 227.625L100.053 243.407Z',
  'M179.684 231.457C180.034 231.549 180.375 231.643 180.705 231.738L169.514 242.897C169.015 242.97 168.509 243.043 167.994 243.113L179.684 231.457Z',
  'M96.002 242.862C95.6206 242.805 95.2446 242.745 94.873 242.687L109.568 228.034C110.035 227.998 110.504 227.963 110.978 227.929L96.002 242.862Z',
  'M183.189 232.543C183.517 232.664 183.829 232.787 184.125 232.911L175.047 241.963C174.525 242.065 173.99 242.165 173.442 242.263L183.189 232.543Z',
  'M92.0537 242.215C91.6816 242.148 91.3158 242.079 90.9561 242.009L104.531 228.472C105.007 228.425 105.487 228.381 105.972 228.336L92.0537 242.215Z',
  'M88.2334 241.441C87.8733 241.359 87.5213 241.277 87.1777 241.193L99.3516 229.053C99.8405 228.992 100.336 228.932 100.838 228.874L88.2334 241.441Z',
  'M186.293 234.032C186.574 234.219 186.821 234.407 187.029 234.599L181.091 240.52C180.521 240.689 179.92 240.856 179.287 241.018L186.293 234.032Z',
  'M84.5859 240.495C84.2435 240.392 83.9131 240.288 83.5947 240.183L93.9844 229.823C94.4899 229.74 95.0055 229.661 95.5303 229.582L84.5859 240.495Z',
  'M81.2109 239.277C80.8977 239.137 80.6052 238.994 80.334 238.851L88.29 230.917C88.8263 230.796 89.3805 230.677 89.9521 230.56L81.2109 239.277Z',
  'M78.4346 237.461C78.2002 237.191 78.0377 236.919 77.9531 236.642L81.7334 232.872C82.3498 232.617 83.0348 232.368 83.7852 232.125L78.4346 237.461Z',
]

const P = Object.fromEntries(Object.entries(SVG_PATHS).map(([k, d]) => [k, parsePath(d)]))
const SHADOW_SEGS = SHADOW_D.map(d => parsePath(d)[0])

// ── Body pivot & core geometry ─────────────────────────────────────────────────
const bodyBox = bbox(P.bodyOutline)
const PIVOT = [bodyBox.cx, bodyBox.maxY]           // low pivot at the base of the blob
const eyeBox = bboxUnion(bbox(P.eye1), bbox(P.eye2))
const sparkleABox = bbox(P.sparkleA)
const sparkleBBox = bbox(P.sparkleB)
const sparkleCBox = bbox(P.sparkleC)
const sparkAccentBox = bbox(P.sparkAccent)
const shadowBox = bboxUnion(...SHADOW_SEGS.map(seg => bbox([seg])))

// ── Beat timing ─────────────────────────────────────────────────────────────
const BEAT = FPS * 0.9   // 54 frames per beat
const CENTERS = [0, BEAT, BEAT * 2, BEAT * 3, BEAT * 4]           // upright crossings
const MIDS = [BEAT * 0.5, BEAT * 1.5, BEAT * 2.5, BEAT * 3.5]     // dip bottoms, L R L R
const LEAN = 7.5           // degrees at dip bottom
const BOUNCE_AMP = 6       // px, dip moves pivot down from rest
const STRETCH = { sy: 104, sx: 97 }   // at centers (tall)
const SQUASH = { sy: 96, sx: 104 }    // at mids (wide/flat)

function bodyRotation() {
  const kfs = []
  const signs = [-1, 1, -1, 1]   // left, right, left, right
  for (let i = 0; i < CENTERS.length; i++) {
    kfs.push({ t: CENTERS[i], s: [0], ease: EASE.travelBal })
    if (i < MIDS.length) kfs.push({ t: MIDS[i], s: [LEAN * signs[i]], ease: EASE.travelBal })
  }
  kfs.sort((a, b) => a.t - b.t)
  return anim(kfs, EASE.travelBal)
}

function bodyPosition() {
  const kfs = []
  for (let i = 0; i < CENTERS.length; i++) {
    kfs.push({ t: CENTERS[i], s: [PIVOT[0], PIVOT[1], 0], ease: EASE.travelBal })
    if (i < MIDS.length) kfs.push({ t: MIDS[i], s: [PIVOT[0], PIVOT[1] + BOUNCE_AMP, 0], ease: EASE.travelBal })
  }
  kfs.sort((a, b) => a.t - b.t)
  return anim(kfs, EASE.travelBal)
}

function bodyScale() {
  const kfs = []
  for (let i = 0; i < CENTERS.length; i++) {
    kfs.push({ t: CENTERS[i], s: [STRETCH.sx, STRETCH.sy, 100], ease: EASE.settleSoft })
    if (i < MIDS.length) kfs.push({ t: MIDS[i], s: [SQUASH.sx, SQUASH.sy, 100], ease: EASE.settleSoft })
  }
  kfs.sort((a, b) => a.t - b.t)
  return anim(kfs, EASE.settleSoft)
}

// Blink at two of the four center crossings (54, 162) — thin-line squash, ~7f (~120ms).
function blinkScale() {
  return anim([
    { t: 0,            s: [100, 100, 100], ease: EASE.entranceSharp },
    { t: BEAT - 3,      s: [100, 100, 100], ease: EASE.entranceSharp },
    { t: BEAT,          s: [100,  10, 100], ease: EASE.settleSoft },
    { t: BEAT + 4,       s: [100, 100, 100], ease: EASE.entranceSharp },
    { t: BEAT * 3 - 3,  s: [100, 100, 100], ease: EASE.entranceSharp },
    { t: BEAT * 3,       s: [100,  10, 100], ease: EASE.settleSoft },
    { t: BEAT * 3 + 4,    s: [100, 100, 100], ease: EASE.entranceSharp },
    { t: FRAMES,          s: [100, 100, 100] },
  ])
}

// ── Sparkle round-robin pulse builder ─────────────────────────────────────────
// starts: absolute frame at which each round's rise begins. Rounds whose
// 30-frame pulse would run past FRAMES are dropped (not clipped) — a round
// that doesn't fit isn't cut short, it just skips that lap. Keeping every
// generated keyframe strictly under FRAMES, with the loop-close keyframe
// appended after, guarantees ascending t values; letting a round run past
// FRAMES and then forcing an earlier "reset to idle" keyframe after it is
// what silently broke sparkle-b and sparkle-c (out-of-order keyframes stop
// the whole property from animating in this Skottie build).
// Rise/settle stretched (6→8f, 3→6f) and overshoot softened (118→112) versus
// the first pass — same beats, but the curve decelerates into the settle
// instead of snapping, reading as fluid rather than mechanical.
function sparklePulse(starts, { overshoot = 112, fadeScale = 88 } = {}) {
  const fitted = starts.filter(start => start + 30 <= FRAMES)
  const sKfs = []
  const oKfs = []
  if (fitted[0] !== 0) {
    sKfs.push({ t: 0, s: [0, 0, 100], ease: EASE.expressivePop })
    oKfs.push({ t: 0, s: [0], ease: EASE.settleSoft })
  }
  for (const start of fitted) {
    sKfs.push({ t: start,      s: [0, 0, 100],              ease: EASE.expressivePop })
    sKfs.push({ t: start + 8,  s: [overshoot, overshoot, 100], ease: EASE.settleSoft })
    sKfs.push({ t: start + 14, s: [100, 100, 100],           ease: EASE.settleSoft })
    sKfs.push({ t: start + 20, s: [100, 100, 100],           ease: EASE.settleSoft })
    sKfs.push({ t: start + 30, s: [fadeScale, fadeScale, 100], ease: EASE.settleSoft })

    oKfs.push({ t: start,      s: [0],   ease: EASE.settleSoft })
    oKfs.push({ t: start + 8,  s: [100], ease: EASE.settleSoft })
    oKfs.push({ t: start + 20, s: [100], ease: EASE.settleSoft })
    oKfs.push({ t: start + 30, s: [0],   ease: EASE.settleSoft })
  }
  sKfs.push({ t: FRAMES, s: [0, 0, 100] })
  oKfs.push({ t: FRAMES, s: [0] })
  return { scale: anim(sKfs, EASE.expressivePop), opacity: anim(oKfs, EASE.settleSoft) }
}

// 36 frames per full round-robin cycle; 6 rounds fit exactly in 216f.
const startsA = [0, 36, 72, 108, 144, 180]
const startsB = [12, 48, 84, 120, 156, 192]
const startsC = [24, 60, 96, 132, 168, 204]

const pulseA = sparklePulse(startsA)
const pulseB = sparklePulse(startsB)
const pulseC = sparklePulse(startsC)
const pulseAccent = sparklePulse(startsC, { overshoot: 110, fadeScale: 92 })


// ── Shadow: shifts opposite the lean, compresses on each landing. ────────────
function shadowPosition() {
  const AMP = 3
  const signs = [1, -1, 1, -1]   // opposite of body lean signs [-1,1,-1,1]
  const kfs = []
  for (let i = 0; i < CENTERS.length; i++) {
    kfs.push({ t: CENTERS[i], s: [shadowBox.cx, shadowBox.cy, 0], ease: EASE.settleSoft })
    if (i < MIDS.length) kfs.push({ t: MIDS[i], s: [shadowBox.cx + AMP * signs[i], shadowBox.cy, 0], ease: EASE.settleSoft })
  }
  kfs.sort((a, b) => a.t - b.t)
  return anim(kfs, EASE.settleSoft)
}
function shadowScale() {
  const kfs = []
  for (let i = 0; i < CENTERS.length; i++) {
    kfs.push({ t: CENTERS[i], s: [100, 100, 100], ease: EASE.settleSoft })
    if (i < MIDS.length) kfs.push({ t: MIDS[i], s: [100, 94, 100], ease: EASE.settleSoft })
  }
  kfs.sort((a, b) => a.t - b.t)
  return anim(kfs, EASE.settleSoft)
}

// ── Layer definitions ─────────────────────────────────────────────────────────
const ROOT = 1

const rootLyr = nullLayer('body-root', ROOT, null, {
  p: bodyPosition(),
  a: sk([PIVOT[0], PIVOT[1], 0]),
  r: bodyRotation(),
  s: bodyScale(),
})

const bellyLyr = shapeLayer('belly', 5, ROOT, [
  group([pathShape(P.belly[0]), fill(WHITE)])
])

const outlineLyr = shapeLayer('outline', 4, ROOT, [
  group([pathShape(P.bodyOutline[0]), fill(BLACK)])
])

const eyesLyr = shapeLayer('eyes', 6, ROOT,
  [group([pathShape(P.eye1[0]), pathShape(P.eye2[0]), strokeStyle(BLACK, 2.78393)])],
  { p: sk([eyeBox.cx, eyeBox.cy, 0]), a: sk([eyeBox.cx, eyeBox.cy, 0]), s: blinkScale() }
)

function sparkleLayer(nm, ind, segs, box, pulse) {
  return shapeLayer(nm, ind, null, [
    group([...segs.map(pathShape), strokeStyle(BLACK, 1.39197)])
  ], { p: sk([box.cx, box.cy, 0]), a: sk([box.cx, box.cy, 0]), s: pulse.scale, o: pulse.opacity })
}

const sparkleALyr = sparkleLayer('sparkle-a', 8, P.sparkleA, sparkleABox, pulseA)
const sparkleBLyr = sparkleLayer('sparkle-b', 9, P.sparkleB, sparkleBBox, pulseB)
const sparkleCLyr = sparkleLayer('sparkle-c', 10, P.sparkleC, sparkleCBox, pulseC)
const sparkAccentLyr = sparkleLayer('spark-accent', 11, P.sparkAccent, sparkAccentBox, pulseAccent)

const accentFill = fillRule => ({ ty: 'fl', c: { sid: 'accentColor' }, o: sk(100), ...(fillRule === 'evenodd' ? { r: 2 } : {}) })

// Doodle: ribbon + tick + dot, static — a background flourish, not a beat.
// A shared opacity breath (100% → 88% → 100% once per loop) keeps it from
// reading as completely dead, plus a soft light sweep: a pale, semi-
// transparent band clipped to the ribbon/tick silhouette (Merge Paths
// intersect, same technique as the earlier draw-on reveal) that glides once
// left to right across the full loop, like a slow gleam catching the ink.
const ribbonFill = strokeToFillPolygon(P.ribbon[0], 19.7116)
const tickFill = strokeToFillPolygon(P.tick[0], 18.3574)
const doodleBox = bboxUnion(bbox([ribbonFill.tubeSeg]), bbox([tickFill.tubeSeg]))

function doodleBreath() {
  return anim([
    { t: 0,             s: [100], ease: EASE.settleSoft },
    { t: FRAMES / 2,     s: [88],  ease: EASE.settleSoft },
    { t: FRAMES,          s: [100] },
  ])
}

const mergeIntersect = () => ({ ty: 'mm', mm: 4, nm: 'intersect' })
function slantBandKS(y0, y1, centerX, halfWidth, slant) {
  const xL = centerX - halfWidth, xR = centerX + halfWidth
  return {
    c: true,
    v: [[xL + slant, y0], [xR + slant, y0], [xR - slant, y1], [xL - slant, y1]],
    i: [[0, 0], [0, 0], [0, 0], [0, 0]],
    o: [[0, 0], [0, 0], [0, 0], [0, 0]],
  }
}
function sweepShape(box, halfWidth, slant) {
  const y0 = box.minY - 2, y1 = box.maxY + 2
  const startX = box.minX - halfWidth - slant - 4
  const endX = box.maxX + halfWidth + slant + 4
  return {
    ty: 'sh', nm: 'sweep',
    ks: {
      a: 1,
      k: [
        { t: 0, s: [slantBandKS(y0, y1, startX, halfWidth, slant)], e: [slantBandKS(y0, y1, endX, halfWidth, slant)], ...EASE.travelBal },
        { t: FRAMES, s: [slantBandKS(y0, y1, endX, halfWidth, slant)] },
      ],
    },
  }
}
// A single hard-edged clipped band reads as a straight border (confirmed —
// see the screenshots). Animating a true gradient's stops is a confirmed
// dead end in this Skottie build (silently renders nothing — see
// build-zenimator.mjs). So the soft edge is built the same way a feathered
// edge was approximated there too: several same-color bands of decreasing
// width stacked at identical alpha. Since every step shares one color, paint
// order between them doesn't affect the blended result — only the widest
// step's edge is a single layer of alpha (faint), each narrower step inside
// it adds another layer (brighter), so the overlap steps down smoothly from
// a soft, barely-there edge to a brighter core instead of one hard cutoff.
const sweepFillAlpha = a => ({ ty: 'fl', c: sk([1, 1, 1, 1]), o: sk(a * 100) })
// More, finer steps = smoother falloff (each ring is a smaller alpha jump).
// Per-step alpha is solved so the fully-stacked center still lands at
// TARGET_PEAK regardless of STEP_COUNT: 1-(1-a)^N = target → a = 1-(1-target)^(1/N).
const STEP_COUNT = 10, MAX_HALF_WIDTH = 26, MIN_HALF_WIDTH = 2, TARGET_PEAK = 0.42
const STEP_ALPHA = 1 - Math.pow(1 - TARGET_PEAK, 1 / STEP_COUNT)
const SWEEP_STEPS = Array.from({ length: STEP_COUNT }, (_, i) => {
  const halfWidth = MAX_HALF_WIDTH - (i * (MAX_HALF_WIDTH - MIN_HALF_WIDTH)) / (STEP_COUNT - 1)
  return { halfWidth, slant: Math.max(1, halfWidth * 0.28), alpha: STEP_ALPHA }
})

function sweepGroups(nm, seg) {
  return SWEEP_STEPS.map((step, i) => group([
    pathShape(seg),
    sweepShape(doodleBox, step.halfWidth, step.slant),
    mergeIntersect(),
    sweepFillAlpha(step.alpha),
  ], `${nm}-${i}`))
}

const doodleLyr = shapeLayer('doodle', 12, null, [
  group([pathShape(ribbonFill.tubeSeg), accentFill()], 'ribbon'),
  group([pathShape(tickFill.tubeSeg), accentFill()], 'tick'),
  group([pathShape(P.dot[0]), pathShape(P.dot[1]), accentFill('evenodd')], 'dot'),
], { o: doodleBreath() })

const doodleSweepLyr = shapeLayer('doodle-sweep', 13, null, [
  ...sweepGroups('ribbon-sweep', ribbonFill.tubeSeg),
  ...sweepGroups('tick-sweep', tickFill.tubeSeg),
])

const shadowLyr = shapeLayer('shadow', 2, null, [
  group([...SHADOW_SEGS.map(pathShape), fill(SHADOW_C)])
], { p: shadowPosition(), a: sk([shadowBox.cx, shadowBox.cy, 0]), s: shadowScale() })

// ── Compose JSON ──────────────────────────────────────────────────────────────
const lottie = {
  v: '5.7.0',
  fr: FPS,
  ip: 0,
  op: FRAMES,
  w: W,
  h: H,
  nm: 'AllSet',
  slots: {
    accentColor: { p: { a: 0, k: [0.1333, 0.8863, 0.2627, 1] } },
  },
  assets: [],
  // Skottie renders layers[0] frontmost, layers[last] backmost.
  layers: [
    sparkleALyr,
    sparkleBLyr,
    sparkleCLyr,
    sparkAccentLyr,
    eyesLyr,
    bellyLyr,
    outlineLyr,
    doodleSweepLyr,
    doodleLyr,
    shadowLyr,
    rootLyr,
  ]
}

const controls = {
  controls: [{ sid: 'accentColor', label: 'Accent color' }],
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT, JSON.stringify(lottie, null, 2))
writeFileSync(join(OUT_DIR, 'controls.json'), JSON.stringify(controls, null, 2))
console.log(`Written ${OUT}`)
console.log(`pivot: ${PIVOT}`)
