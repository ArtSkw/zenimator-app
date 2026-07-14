#!/usr/bin/env node
/**
 * Generates an animated Lottie JSON for clouds_check.svg — a success
 * checkmark badge drawing itself on with two ambient background clouds.
 * Output: public/projects/cloudscheck/scene-1/lottie.json
 *
 * Animation design (60fps, 150f = 2.5s, plays once and holds). A clear
 * three-stage sequence — circle, THEN checkmark, THEN clouds:
 *  - Stage 1 (0-82): the circle draws itself. Its start-dot pops in first
 *    (0-12), the gradient circle stroke trims on (8-74), and the circle's
 *    end flourish + accent dot pop as the stroke closes (70-82). The
 *    start-dot and end-flourish/end-dot are the source's own decorative
 *    "pen down / pen lift" marks and sit exactly at the circle stroke's
 *    authored start and end points, so they belong to the circle's stage,
 *    not the checkmark's.
 *  - Stage 2 (82-126): the checkmark draws itself, starting only after the
 *    circle has fully closed. The checkmark's source path is authored
 *    tip-to-tip in the "wrong" direction for a left-to-right read (long arm
 *    first, ending on the short arm) — its vertex order is reversed before
 *    the trim so the reveal starts at the short arm (left) and finishes
 *    sweeping up to the long arm's tip (upper right), i.e. reads as "draws
 *    left to right."
 *  - Stage 3 (116-150): both clouds fade in and drift upward (~14px),
 *    beginning as the checkmark is ~85% drawn (so they arrive "when the
 *    checkmark is almost completed"), left cloud slightly leading the right.
 *  - Every animated property uses one consistent symmetric ease-in-out
 *    curve, per an explicit "use ease-in-out timing" brief — this file
 *    deliberately does NOT mix in the asymmetric entrance/settle anchors
 *    used elsewhere in this project's motion vocabulary.
 *
 * Skottie gotchas (same build as the other scripts in this folder):
 *  - Non-zero anchor + animated SCALE/ROTATION is safe; + animated
 *    POSITION is not. The dot/flourish pops use non-zero anchor + scale
 *    (safe); the cloud drift uses anchor [0,0,0] + position (also safe,
 *    since the anchor is zero).
 *  - Animated keyframe arrays must start at t=0 (ensureStartsAtZero).
 *  - A static (non-animated) gradient fill/stroke renders fine; an
 *    ANIMATED gradient's stops render nothing in this Skottie build
 *    (confirmed in build-zenimator.mjs and reconfirmed since) — not an
 *    issue here since both source gradients are static washes.
 */
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../public/projects/cloudscheck/scene-1')
const OUT = join(OUT_DIR, 'lottie.json')

const W = 375, H = 240, FPS = 60, FRAMES = 150 // 2.5s, plays once and holds

// ── SVG path → Lottie bezier ────────────────────────────────────────────────
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

// Reverse a subpath's traversal direction (open paths). Vertex order
// flips, and each vertex's in/out tangent pair swaps roles — the tangent
// that used to arrive at a point now leaves it, and vice versa.
function reverseSubpath(sp) {
  const v = sp.v.slice().reverse()
  const i = sp.o.slice().reverse()
  const o = sp.i.slice().reverse()
  return { closed: sp.closed, v, i, o }
}

// ── Raw path data lifted from clouds_check.svg (viewBox 0 0 375 240) ───────
const SVG_PATHS = {
  cloudLeftBump: 'M23.3254 139.47H35.1928C34.6504 138.06 34.3531 136.529 34.3531 134.928C34.3531 127.942 40.0156 122.28 47.0016 122.28C49.4656 122.28 51.7567 122.995 53.7012 124.213C53.7698 111.312 64.2469 100.874 77.1642 100.874C88.1315 100.874 97.3391 108.398 99.9119 118.565C102.518 116.844 105.636 115.836 108.991 115.836C118.103 115.836 125.489 123.222 125.489 132.333C125.489 135.019 124.847 137.554 123.709 139.795H138.462',
  cloudLeftDashL: 'M17.8128 139.793H9.37988',
  cloudLeftDashR: 'M153.382 139.793H144.949',
  cloudRightBump: 'M260.956 71.9865H270.176C269.755 70.8908 269.524 69.7013 269.524 68.4577C269.524 63.0302 273.923 58.6309 279.351 58.6309C281.265 58.6309 283.045 59.1866 284.556 60.1331C284.609 50.1097 292.749 42 302.785 42C311.306 42 318.459 47.8459 320.458 55.7451C322.483 54.4077 324.905 53.6244 327.512 53.6244C334.591 53.6244 340.329 59.3628 340.329 66.4418C340.329 68.5281 339.831 70.4978 338.946 72.2388H350.408',
  cloudRightDashR: 'M362 72.2371H355.449',
  cloudRightDashL: 'M239.286 72.2371H232.734',
  circleStroke: 'M274.998 121.717C274.707 138.381 269.681 154.618 260.506 168.531C251.332 182.445 238.388 193.461 223.186 200.293C207.985 207.125 191.153 209.491 174.657 207.114C158.161 204.736 142.682 197.715 130.028 186.869C117.374 176.023 108.067 161.8 103.194 145.862C98.3214 129.924 98.0841 112.929 102.51 96.8607C106.936 80.7929 115.842 66.3159 128.189 55.1209C140.535 43.9258 155.812 36.4748 172.235 33.6381',
  endFlourish: 'M171.598 40.9007L172.927 40.6102C173.942 40.3903 174.641 39.919 175.165 39.1741C175.687 38.4851 176.032 37.5674 176.278 36.584C176.506 35.6583 176.922 34.8006 177.543 34.1641C178.928 32.8237 181.411 32.8238 182.483 32.0237C183.145 31.4978 183.613 30.7433 183.734 29.7851C183.855 28.827 183.625 27.581 182.985 26.8694C182.349 26.1481 181.189 25.6893 180.091 25.6626C176.206 25.7631 173.143 26.1508 168.497 27.1636C161.491 28.6907 163.188 42.2312 171.598 40.9007Z',
  endDot: 'M191 31.0453C192.538 30.7675 193.56 29.2951 193.282 27.7566C193.004 26.2181 191.532 25.1961 189.994 25.4739C188.456 25.7517 187.434 27.2241 187.712 28.7626C187.99 30.3011 189.462 31.3231 191 31.0453Z',
  checkmark: 'M265.438 38.4088C265.438 38.4088 199.082 176.091 164.551 158.477C142.332 147.143 152.707 109.99 152.707 109.99',
};
const START_DOT = {"cx":272.5,"cy":119.5,"r":9.5};

// ── Lottie builder helpers ──────────────────────────────────────────────────
const hexToRgb1 = (hex) => {
  hex = hex.replace('#', '')
  return [parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255]
}

// One consistent symmetric ease-in-out for the entire scene, per the brief.
// Deliberately NOT mixing in this project's usual asymmetric anchors
// (entrance-sharp, settle-soft) — the brief explicitly asked for ease-in-out
// throughout, so every keyframe in this file uses this single curve.
const EASE_IN_OUT = [0.42, 0.0, 0.58, 1.0]

function kf(t, value, easeOut) {
  const k = { t, s: Array.isArray(value) ? value : [value] }
  if (easeOut) {
    const [x1, y1, x2, y2] = easeOut
    k.o = { x: [x1], y: [y1] }
    k.i = { x: [x2], y: [y2] }
  }
  return k
}

function ensureStartsAtZero(points) {
  if (points[0].t === 0) return points
  return [{ t: 0, v: points[0].v }, ...points]
}

function animProp(points) {
  points = ensureStartsAtZero(points)
  const keys = points.map((p, idx) => {
    const isLast = idx === points.length - 1
    return kf(p.t, p.v, isLast ? null : EASE_IN_OUT)
  })
  return { a: 1, k: keys }
}

function shapeFromSubpath(sp, nm) {
  return { ty: 'sh', nm, ks: { a: 0, k: { c: sp.closed, v: sp.v, i: sp.i, o: sp.o } } }
}

function fillItem(colorHex, opacity = 100, rule = 1, nm = 'Fill') {
  const [r, g, b] = hexToRgb1(colorHex)
  return { ty: 'fl', nm, o: { a: 0, k: opacity }, c: { a: 0, k: [r, g, b, 1] }, r }
}

function strokeItem(colorHex, width, opacity = 100, nm = 'Stroke') {
  const [r, g, b] = hexToRgb1(colorHex)
  return { ty: 'st', nm, o: { a: 0, k: opacity }, w: { a: 0, k: width }, c: { a: 0, k: [r, g, b, 1] }, lc: 2, lj: 2 }
}

// Static (non-animated) linear gradient stroke — same 'g' stop-packing
// convention as the gradient FILLs used in build-hubcash.mjs /
// build-worldwide.mjs (color stops then alpha stops, concatenated), just
// with ty: 'gs' and a stroke width instead of ty: 'gf'.
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

function groupTransform({ p = [0, 0], a = [0, 0], s = [100, 100], r = 0, o = 100 } = {}) {
  return { ty: 'tr', p: { a: 0, k: p }, a: { a: 0, k: a }, s: { a: 0, k: s }, r: { a: 0, k: r }, o: { a: 0, k: o }, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 } }
}

function group(nm, items, transform) {
  return { ty: 'gr', nm, it: [...items, groupTransform(transform)] }
}

function trimItem({ eKeys, m = 1, nm = 'Trim' } = {}) {
  return { ty: 'tm', nm, s: { a: 0, k: 0 }, e: { a: 1, k: trimEaseKeys(eKeys) }, o: { a: 0, k: 0 }, m }
}

function trimEaseKeys(points) {
  points = ensureStartsAtZero(points)
  return points.map((p, idx) => {
    const isLast = idx === points.length - 1
    const k = { t: p.t, s: [p.v] }
    if (!isLast) {
      const [x1, y1, x2, y2] = EASE_IN_OUT
      k.o = { x: [x1], y: [y1] }
      k.i = { x: [x2], y: [y2] }
    }
    return k
  })
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

function layer({ nm, ind, shapes, ks }) {
  return { ddd: 0, ind, ty: 4, nm, sr: 1, ks, ao: 0, shapes, ip: 0, op: FRAMES, st: 0, bm: 0 }
}

// ============================================================
// LAYER CONTENT ASSEMBLY
// ============================================================
let ind = 1
const layers = []

// Stage timing (see header). Circle first, checkmark second, clouds third.
const CIRCLE_DRAW = [8, 74]     // gradient circle trims on
const CHECK_DRAW = [82, 124]    // checkmark trims on, after circle closes
const CLOUD_DRIFT = 28          // fade+drift duration; sized so the trailing
                                // cloud lands exactly on the final frame

// ---- checkmark (frontmost): reversed direction, draws left to right ------
{
  const sp = reverseSubpath(parsePath(SVG_PATHS.checkmark)[0])
  // Degenerate source gradient (both stops identical #22E243) -> flat color.
  const shapes = [group('checkmark', [
    shapeFromSubpath(sp, 'checkmark-path'),
    strokeItem('#22E243', 14),
    trimItem({ eKeys: [{ t: CHECK_DRAW[0], v: 0 }, { t: CHECK_DRAW[1], v: 100 }] }),
  ])]
  layers.push(layer({ nm: 'checkmark', ind: ind++, shapes, ks: baseTransform() }))
}

// ---- start dot: pops in first, as the circle begins drawing --------------
{
  const c = [START_DOT.cx, START_DOT.cy]
  const shapes = [group('start-dot', [
    { ty: 'el', nm: 'start-dot-ellipse', p: { a: 0, k: c }, s: { a: 0, k: [START_DOT.r * 2, START_DOT.r * 2] } },
    fillItem('#22E243'),
  ])]
  const ks = baseTransform({ a: [c[0], c[1], 0], p: [c[0], c[1], 0] })
  ks.s = animProp([{ t: 0, v: [0, 0, 100] }, { t: 12, v: [100, 100, 100] }])
  ks.o = animProp([{ t: 0, v: 0 }, { t: 10, v: 100 }])
  layers.push(layer({ nm: 'start-dot', ind: ind++, shapes, ks }))
}

// ---- end dot + end flourish: pop as the circle stroke closes -------------
for (const [nm, key] of [['end-dot', 'endDot'], ['end-flourish', 'endFlourish']]) {
  const sp = parsePath(SVG_PATHS[key])[0]
  const c = bboxCenter(bboxOf([sp]))
  const shapes = [group(nm, [shapeFromSubpath(sp, `${nm}-path`), fillItem('#22E243')])]
  const ks = baseTransform({ a: [c[0], c[1], 0], p: [c[0], c[1], 0] })
  ks.s = animProp([{ t: 70, v: [0, 0, 100] }, { t: 82, v: [100, 100, 100] }])
  ks.o = animProp([{ t: 70, v: 0 }, { t: 78, v: 100 }])
  layers.push(layer({ nm, ind: ind++, shapes, ks }))
}

// ---- circle stroke: static gradient, draws itself first ------------------
{
  const sp = parsePath(SVG_PATHS.circleStroke)[0]
  const shapes = [group('circle-stroke', [
    shapeFromSubpath(sp, 'circle-stroke-path'),
    gradientStrokeItem({
      width: 14,
      s: [199, 114],
      e: [11.4997, 240],
      stops: [
        { offset: 0, color: '#22E243', alpha: 1 },
        { offset: 0.15694, color: '#22E243', alpha: 1 },
        { offset: 0.73997, color: '#0A9F24', alpha: 1 },
        { offset: 1, color: '#22E243', alpha: 0.2 },
      ],
    }),
    trimItem({ eKeys: [{ t: CIRCLE_DRAW[0], v: 0 }, { t: CIRCLE_DRAW[1], v: 100 }] }),
  ])]
  layers.push(layer({ nm: 'circle-stroke', ind: ind++, shapes, ks: baseTransform() }))
}

// ---- clouds: fade in + drift up as the checkmark is ~85% drawn -----------
// checkmark draws CHECK_DRAW[0]..[1]; ~85% point is where the clouds enter.
const cloudsStart = Math.round(CHECK_DRAW[0] + 0.85 * (CHECK_DRAW[1] - CHECK_DRAW[0]))
for (const [nm, bumpKey, dashLKey, dashRKey, driftStart] of [
  ['cloud-left', 'cloudLeftBump', 'cloudLeftDashL', 'cloudLeftDashR', cloudsStart],
  ['cloud-right', 'cloudRightBump', 'cloudRightDashL', 'cloudRightDashR', cloudsStart + 4],
]) {
  const bump = parsePath(SVG_PATHS[bumpKey])[0]
  const dashL = parsePath(SVG_PATHS[dashLKey])[0]
  const dashR = parsePath(SVG_PATHS[dashRKey])[0]
  const shapes = [group(nm, [
    shapeFromSubpath(bump, `${nm}-bump`),
    shapeFromSubpath(dashL, `${nm}-dash-l`),
    shapeFromSubpath(dashR, `${nm}-dash-r`),
    strokeItem('#222222', 2),
  ])]
  const ks = baseTransform()
  ks.p = animProp([{ t: driftStart, v: [0, 14, 0] }, { t: driftStart + CLOUD_DRIFT, v: [0, 0, 0] }])
  ks.o = animProp([{ t: driftStart, v: 0 }, { t: driftStart + CLOUD_DRIFT, v: 100 }])
  layers.push(layer({ nm, ind: ind++, shapes, ks }))
}

// ============================================================
const doc = {
  v: '5.9.0', fr: FPS, ip: 0, op: FRAMES, w: W, h: H, nm: 'CloudsCheck Reveal',
  ddd: 0, assets: [], layers, markers: [],
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT, JSON.stringify(doc))
console.log(`Wrote ${OUT} — ${layers.length} layers, ${FRAMES}f @ ${FPS}fps`)
