#!/usr/bin/env node
/**
 * Generates a seamlessly-looping Lottie JSON for "loop-zenek-our-pgjh.svg"
 * — Zenek, the black-and-white bubble mascot, out on his coffee run: a
 * grocery bag with a baguette in his left hand, a steaming coffee cup in his
 * right, walking a gentle bounce.
 *
 * Output: public/projects/loop-zenek-our-pgjh/scene-1/lottie.json
 *
 * Geometry note: this is the SAME source illustration documented in
 * docs/everydayexpress-walkcycle-animation.md (built by
 * scripts/build-everyday-express.mjs) — body/fist/eye coordinates match
 * exactly. That doc is GEOMETRY provenance only. Every rig decision, motion
 * constant and gate below is re-derived from the CURRENT
 * skills/text-to-lottie/references (motion-taste.md's Aliveness Contract,
 * recipe-character-rig.md, player-contract.md) as of this run — several of
 * those gates (blink must reach true zero, pendulum sway must avoid
 * travel-balanced's mid-segment singularity, silhouette squash must be a
 * genuine vertex morph, not just a transform) postdate that original build
 * and are handled differently here on purpose.
 *
 * Timing: 60fps, T=144 (2.4s) = two 72f (1.2s) steps — matches the brief's
 * "~1.2s rhythm" per step and "a soft squash at the bottom of each step".
 *
 * Rig:
 *  - zenek-root (null): bounce POSITION only (~6px dip), pivot irrelevant
 *    (no scale/rotation on this null — see silhouette note below).
 *  - Squash/stretch is NOT a transform on zenek-root. It's baked directly
 *    into the VERTICES of body / face / eye-left / eye-right (all four
 *    reference the same squashAt(t) curve, scaled about BODY_BASE) so the
 *    outline itself changes shape every beat — motion-taste's "silhouette
 *    breathes: morphs, not just transforms" self-test ("if the outline is
 *    identical the character is a puppet") is met by construction, not by
 *    argument, and body/face/eyes stay perfectly cohesive since they share
 *    one deform function.
 *  - eyes additionally carry their OWN blink (a second vertex-scale about
 *    EYE_CENTER, composed on top of the squash) — CLOSES TO TRUE ZERO
 *    height per the current gate 17 (the reference implementation elsewhere
 *    in this project used 18%, which is now a defect, not a style choice).
 *  - bag-root (null, parented to zenek-root): the left fist + baguette +
 *    bag body/fold-lines/handle/scores all ride this ONE null as a rigid
 *    assembly (contact welds — nothing in that cluster gets its own clock).
 *    Its rotation is the "opposite to his bounce" pendulum sway. Because a
 *    back-and-forth sway is exactly the case motion-taste calls out as
 *    having a hidden velocity singularity under the `travel-balanced`
 *    anchor (zero in dx/ds at s=0.5, independent of segment length), this
 *    is NOT bezier-keyframed — it's a real sin() envelope, densely baked.
 *  - The right fist + all three cup pieces + steam are the "steady island":
 *    unparented, at their authored coordinates, per the brief's own words
 *    ("the coffee cup stays steady so it doesn't spill") — declared as a
 *    motionException in controls.json rather than silently leaving them
 *    static, per player-contract's "the brief outranks every gate" rule.
 *    Steam still gets its own independent rise/waver/fade (nothing in
 *    frame stays truly inert) on a phase-offset loop so at least one wisp
 *    is always mid-rise.
 */
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../public/projects/loop-zenek-our-pgjh/scene-1')
const OUT = join(OUT_DIR, 'lottie.json')

const W = 375, H = 133, FPS = 60
const STEP = 72          // 1.2s per step
const T = STEP * 2       // 2.4s, two footfalls, seamless loop

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

// ── Raw path data lifted from loop-zenek-our-pgjh.svg (viewBox 0 0 375 133) ──
const SVG_PATHS = {
  body: 'M187 23C162.699 23 143 42.6995 143 67.0002C143 91.3005 162.699 111 187 111C211.3 111 231 91.3005 231 67.0002C231 42.6995 211.3 23 187 23Z',
  face: 'M225.875 59.5957C225.875 73.4766 213.11 74.3933 195.266 74.3933C177.422 74.3933 165.768 72.9528 165.768 59.5957C165.768 46.2385 177.03 34.9766 195.266 34.9766C213.502 34.9766 225.875 45.7147 225.875 59.5957Z',
  eyeLeft: 'M200.12 57.0952C196.969 53.3006 192.87 55.5141 191.215 57.0952',
  eyeRight: 'M205.095 57.0952C208.246 53.3006 212.345 55.5141 214 57.0952',
  baguetteFill: 'M144.065 55.7217C135.647 37.0298 125.5 27 122.924 30.6958C120.616 34.0065 143.203 77.482 147.935 86.506C148.425 87.4405 149.585 87.8341 150.358 87.1154C154.619 83.1522 151.691 72.654 144.065 55.7217Z',
  baguetteOutline: 'M122.924 30.6958L123.744 31.2677C123.795 31.1944 123.782 31.1661 123.769 31.2584C123.758 31.3432 123.753 31.4827 123.769 31.69C123.802 32.1058 123.912 32.6807 124.108 33.4168C124.499 34.8825 125.193 36.8443 126.121 39.1735C127.976 43.8238 130.719 49.8263 133.691 56.0261C139.633 68.4201 146.456 81.5322 148.82 86.0416L147.935 86.506L147.049 86.9704C144.682 82.4558 137.845 69.3181 131.887 56.8907C128.91 50.6798 126.143 44.6287 124.264 39.9142C123.325 37.561 122.597 35.5126 122.175 33.9318C121.966 33.1446 121.822 32.4372 121.775 31.848C121.752 31.5528 121.75 31.2592 121.788 30.9848C121.825 30.7178 121.908 30.4041 122.103 30.1239L122.924 30.6958ZM150.358 87.1154L149.677 86.3832C151.372 84.8068 151.841 81.7165 150.692 76.497C149.563 71.368 146.962 64.59 143.153 56.1323L144.065 55.7217L144.977 55.3111C148.793 63.7858 151.469 70.723 152.645 76.067C153.802 81.3205 153.605 85.4609 151.039 87.8476L150.358 87.1154ZM144.065 55.7217L143.153 56.1323C138.973 46.8515 134.383 39.7652 130.558 35.4793C128.633 33.3233 126.962 31.9437 125.688 31.3153C125.051 31.0011 124.597 30.917 124.306 30.9402C124.064 30.9595 123.895 31.0509 123.744 31.2677L122.924 30.6958L122.103 30.1239C122.596 29.4168 123.308 29.0132 124.147 28.9465C124.936 28.8838 125.764 29.123 126.572 29.5215C128.188 30.3183 130.063 31.9215 132.05 34.1475C136.046 38.6255 140.738 45.9 144.977 55.3111L144.065 55.7217ZM147.935 86.506L148.82 86.0416C148.945 86.2792 149.142 86.4208 149.31 86.4676C149.454 86.5081 149.569 86.4834 149.677 86.3832L150.358 87.1154L151.039 87.8476C150.374 88.4661 149.522 88.6039 148.771 88.3936C148.042 88.1897 147.414 87.6672 147.049 86.9704L147.935 86.506Z',
  bagBody: 'M168.182 55.7156L168.612 75.1048L172.362 93.8287L150.998 96.3899L140.373 95.0815L142.043 80.4269L133.864 62.5899L143.276 57.8406L168.182 55.7156Z',
  bagFoldLines: 'M144 62L148.5 78V91.5M164 75H156.5L151 78',
  bagHandle: 'M159.002 54.4997C160.502 45.9997 150.002 48.4997 150.502 55.4997',
  score1: 'M142.5 52.5C139.7 52.5 137.333 53.8333 136.5 54.5',
  score2: 'M138 45C135.667 45 133.694 46.3333 133 47',
  score3: 'M133 37.5934C131.154 37.3165 129.396 38.401 128.748 38.9779',
  cupBody: 'M258.418 71.0503L241.688 68.0344L239.398 92.0085L252.192 94.3148L258.418 71.0503Z',
  cupBand: 'M260.289 66.3071L241.59 62.9364L240.703 67.8571L259.402 71.2278L260.289 66.3071Z',
  cupLid: 'M257.062 61.6611L246.237 59.7097L245.527 63.6462L256.353 65.5977L257.062 61.6611Z',
  steam: 'M255.999 56C262.499 49.5 249.499 46.5 255.999 40M248.999 56C252.599 52.4 250.499 48.1667 248.999 46.5',
}

// ── Lottie builder helpers ──────────────────────────────────────────────────
const hexToRgb1 = (hex) => {
  hex = hex.replace('#', '')
  return [parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255]
}
const INK = '#222222'

const EASE = {
  linear: [0, 0, 1, 1],
  entranceSharp: [0.20, 0.75, 0.34, 0.94],
  settleSoft: [0.00, 0.65, 0.51, 0.99],
  exitAccelerate: [1.00, 0.02, 0.54, 0.42],
  // Derived from entrance-sharp/exit-accelerate (motion-taste's own anchors
  // for "entering, soft land" / "exiting, fast finish") but SOFTENED: those
  // two anchors are tuned for dramatic entrances/hard-cut exits, and at this
  // scene's small amplitudes (6px bounce, ~6% squash) their steep internal
  // tangents (slope ratio ~40-60x within a single curve) blow the fluidity
  // audit's max/median-while-moving ceiling (~3x) even though the curve
  // itself is smooth — measured 8-17x before softening. riseOut/fallIn keep
  // the same asymmetric character (ease OUT on the away phase, ease IN on
  // the return, per motion-taste's per-phase-easing rule) at a gentler
  // internal ratio that clears the audit (measured 1.3-1.9x below).
  riseOut: [0.40, 0.55, 0.60, 0.90],
  fallIn: [0.45, 0.20, 0.65, 0.70],
}

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
  return [{ t: 0, v: points[0].v, ease: points[0].ease }, ...points]
}
function animProp(points) {
  points = ensureStartsAtZero(points)
  const keys = points.map((p, idx) => {
    const isLast = idx === points.length - 1
    return kf(p.t, p.v, isLast ? null : (EASE[p.ease] || EASE.linear))
  })
  return { a: 1, k: keys }
}
// Repeat one cycle's keyframes (local t in [0,periodF)) numCycles times, then
// close with one final keyframe at t = numCycles*periodF = finalValue. The
// cycle's own first value must equal finalValue for the tiling to be seamless.
function tileCycle(periodF, numCycles, points, finalValue) {
  const out = []
  for (let c = 0; c < numCycles; c++) for (const p of points) out.push({ t: c * periodF + p.t, v: p.v, ease: p.ease })
  out.push({ t: numCycles * periodF, v: finalValue })
  return out
}
function shapeFromSubpath(sp, nm) {
  return { ty: 'sh', nm, ks: { a: 0, k: { c: sp.closed, v: sp.v, i: sp.i, o: sp.o } } }
}
function fillItem(colorHex, opacity = 100, nm = 'Fill') {
  const [r, g, b] = hexToRgb1(colorHex)
  return { ty: 'fl', nm, o: { a: 0, k: opacity }, c: { a: 0, k: [r, g, b, 1] }, r: 1 }
}
function fillItemSlot(sid, opacity = 100, nm = 'Fill') {
  const [r, g, b] = hexToRgb1(INK)
  return { ty: 'fl', nm, o: { a: 0, k: opacity }, c: { a: 0, k: [r, g, b, 1], sid }, r: 1 }
}
function strokeItem(colorHex, width, opacity = 100, nm = 'Stroke') {
  const [r, g, b] = hexToRgb1(colorHex)
  return { ty: 'st', nm, o: { a: 0, k: opacity }, w: { a: 0, k: width }, c: { a: 0, k: [r, g, b, 1] }, lc: 2, lj: 2 }
}
function strokeItemSlot(sid, width, opacity = 100, nm = 'Stroke') {
  const [r, g, b] = hexToRgb1(INK)
  return { ty: 'st', nm, o: { a: 0, k: opacity }, w: { a: 0, k: width }, c: { a: 0, k: [r, g, b, 1], sid }, lc: 2, lj: 2 }
}
function groupTransform({ p = [0, 0], a = [0, 0], s = [100, 100], r = 0, o = 100 } = {}) {
  return { ty: 'tr', p: { a: 0, k: p }, a: { a: 0, k: a }, s: { a: 0, k: s }, r: { a: 0, k: r }, o: { a: 0, k: o }, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 } }
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
function layer({ nm, ind, shapes, ks, parent, ty }) {
  const l = { ddd: 0, ind, ty: ty ?? (shapes ? 4 : 3), nm, sr: 1, ks, ao: 0, ip: 0, op: T, st: 0, bm: 0 }
  if (shapes) l.shapes = shapes
  if (parent != null) l.parent = parent
  return l
}

// ── Vertex-level deform: scale a set of subpaths about a fixed center. This
// is the "silhouette breathes" technique — the squash lives in the shape's
// own vertex/handle data, not in a transform, so the outline itself changes
// between beats (motion-taste's literal self-test: "if the outline is
// identical the character is a puppet"). Handles are DELTAS so they scale by
// the same linear factor as the vertices they're attached to. ─────────────
function deformSubpaths(subpaths, cx, cy, sx, sy) {
  return subpaths.map((sp) => ({
    c: sp.closed,
    v: sp.v.map(([x, y]) => [cx + (x - cx) * sx, cy + (y - cy) * sy]),
    i: sp.i.map(([x, y]) => [x * sx, y * sy]),
    o: sp.o.map(([x, y]) => [x * sx, y * sy]),
  }))
}

// ── Cubic-bezier eased evaluator, for sampling curves at arbitrary t ───────
function bezierEaseFn(x1, y1, x2, y2) {
  return (t) => {
    const bx = (s) => { const m = 1 - s; return 3 * m * m * s * x1 + 3 * m * s * s * x2 + s * s * s }
    const by = (s) => { const m = 1 - s; return 3 * m * m * s * y1 + 3 * m * s * s * y2 + s * s * s }
    let lo = 0, hi = 1
    for (let k = 0; k < 30; k++) { const mid = (lo + hi) / 2; if (bx(mid) < t) lo = mid; else hi = mid }
    return by((lo + hi) / 2)
  }
}
// points: [{t,v,ease}] covering [0,total), plus an implicit final point at
// (total, finalValue). Value at arbitrary t (wrapped into [0,total)).
function evalTrack(points, finalValue, total, t) {
  t = ((t % total) + total) % total
  const all = [...points, { t: total, v: finalValue }]
  let seg = all.length - 2
  for (let k = 0; k < all.length - 1; k++) { if (t >= all[k].t && t <= all[k + 1].t) { seg = k; break } }
  const a = all[seg], b = all[seg + 1]
  const frac = (t - a.t) / ((b.t - a.t) || 1)
  const [x1, y1, x2, y2] = EASE[a.ease] || EASE.linear
  const eased = bezierEaseFn(x1, y1, x2, y2)(frac)
  return a.v + (b.v - a.v) * eased
}

// ============================================================
// GEOMETRY CONSTANTS
// ============================================================
const BODY_BASE = [187, 111]              // body's own base — squash pivot
const RIGHT_FIST = [242.783, 79.217]      // resolved from source <circle transform=matrix(...)>
const LEFT_FIST = [142.783, 79.217]
const FIST_R = 10.5

const eyeSubs = { left: parsePath(SVG_PATHS.eyeLeft), right: parsePath(SVG_PATHS.eyeRight) }
const EYE_CENTER = bboxCenter(bboxOf([...eyeSubs.left, ...eyeSubs.right]))

// ============================================================
// TIMING & MOTION CURVES
// ============================================================
// Body bounce: push off fast (ease-out), hang, fall faster (ease-in) —
// neutral/apex at the velocity-zero peak. ~6px lift per the brief.
const BOUNCE_AMP = 6
const BOUNCE_POINTS = [
  { t: 0, v: 0, ease: 'riseOut' },              // contact -> push off
  { t: STEP / 2, v: -BOUNCE_AMP, ease: 'fallIn' }, // peak -> fall
]

// Coupled, volume-preserving squash (area ~const): wide+short at contact,
// neutral at the apex. Baked into VERTICES, not a transform scale — same
// 2-point-per-step shape as the bounce (same riseOut/fallIn eases) so both
// tracks stay physically locked to the same contact/apex timing.
const SQUASH_SX = [
  { t: 0, v: 1.05, ease: 'riseOut' },
  { t: STEP / 2, v: 1.00, ease: 'fallIn' },
]
const SQUASH_SY = [
  { t: 0, v: 0.95, ease: 'riseOut' },
  { t: STEP / 2, v: 1.00, ease: 'fallIn' },
]
function squashAt(t) {
  return [evalTrack(SQUASH_SX, 1.05, STEP, t), evalTrack(SQUASH_SY, 0.95, STEP, t)]
}
function bounceYAt(t) { return evalTrack(BOUNCE_POINTS, 0, STEP, t) }

// Blink: single event per loop, closes to TRUE zero height (gate 17), snaps
// shut faster than it reopens, widens x slightly on the way down. Placed
// mid-second-step, clear of the loop seam and clear of the bounce extremes.
const BLINK_AT = 100, CLOSE = 2, HOLD = 2, OPEN = 4
function blinkAmount(t) {
  const dt = t - BLINK_AT
  if (dt <= -CLOSE || dt >= HOLD + OPEN) return 0
  if (dt < 0) return 1 + dt / CLOSE
  if (dt <= HOLD) return 1
  return 1 - (dt - HOLD) / OPEN
}

// Bag pendulum sway, "opposite to his bounce": a genuine back-and-forth
// through center needs a TRUE sine, not a bezier anchor — travel-balanced
// (and any similar S-curve) has a real mid-segment dx/ds=0 singularity for
// this exact back-and-forth shape (motion-taste), independent of segment
// length. Quarter-phase-offset from the bounce (zero at contact AND at the
// bounce's own peak, extremes in between) reads as inertial counter-sway.
const BAG_SWAY_AMP = 4.5 // degrees, "slightly" per the brief
function bagRotAt(t) { return BAG_SWAY_AMP * Math.sin((2 * Math.PI * (((t % STEP) + STEP) % STEP)) / STEP) }

// Steam: two wisps a half-period apart so one is always mid-rise. Fades in
// near the cup, drifts up with a gentle waver, fades out before the top;
// position glides back to rest AFTER opacity hits 0 so the reset is hidden.
const STEAM_PERIOD = STEP
const STEAM_Y = [{ t: 0, v: 0, ease: 'riseOut' }, { t: 46, v: -12, ease: 'fallIn' }]
const STEAM_X = [{ t: 0, v: 0, ease: 'riseOut' }, { t: 18, v: 1.3, ease: 'fallIn' }, { t: 38, v: -1.1, ease: 'riseOut' }, { t: 46, v: 0, ease: 'fallIn' }]
// Single symmetric rise-then-fall (one peak at t=23) rather than a 4-point
// fast-in/plateau/fast-out shape — the latter measured 7x on the velocity
// audit (uneven segment lengths spike the ratio even with smooth eases).
const STEAM_O = [{ t: 0, v: 0, ease: 'riseOut' }, { t: 23, v: 70, ease: 'fallIn' }, { t: 46, v: 0, ease: 'fallIn' }]
function steamProps(phase) {
  const posPts = [], opaPts = []
  for (let t = 0; t <= T; t += 2) {
    posPts.push({ t, v: [evalTrack(STEAM_X, 0, STEAM_PERIOD, t + phase), evalTrack(STEAM_Y, 0, STEAM_PERIOD, t + phase), 0] })
    opaPts.push({ t, v: evalTrack(STEAM_O, 0, STEAM_PERIOD, t + phase) })
  }
  return { p: animProp(posPts), o: animProp(opaPts) }
}

let ind = 1
const layers = []
const byName = {}
function push(nm, l) { layers.push(l); byName[nm] = l.ind; return l }

// ---- rig nulls ----
const zenekRootInd = ind++
const bagRootInd = ind++

// ============================================================
// BODY ASSEMBLY — body / face / eyes, all sharing the squash curve so the
// mass reads as ONE cohesive squashing body (decals ride it for free).
// ============================================================
{
  const base = parsePath(SVG_PATHS.body)[0]
  const points = []
  for (let t = 0; t <= T; t += 3) {
    const [sx, sy] = squashAt(t)
    points.push({ t, v: deformSubpaths([base], BODY_BASE[0], BODY_BASE[1], sx, sy)[0], ease: 'linear' })
  }
  const keys = points.map((p, idx) => kf(p.t, p.v, idx === points.length - 1 ? null : EASE.linear))
  const shapes = [group('body', [{ ty: 'sh', nm: 'body-path', ks: { a: 1, k: keys } }, fillItemSlot('inkColor')])]
  push('body', layer({ nm: 'body', ind: ind++, shapes, ks: baseTransform(), parent: zenekRootInd }))
}
{
  const base = parsePath(SVG_PATHS.face)[0]
  const points = []
  for (let t = 0; t <= T; t += 3) {
    const [sx, sy] = squashAt(t)
    points.push({ t, v: deformSubpaths([base], BODY_BASE[0], BODY_BASE[1], sx, sy)[0], ease: 'linear' })
  }
  const keys = points.map((p, idx) => kf(p.t, p.v, idx === points.length - 1 ? null : EASE.linear))
  const shapes = [group('face', [{ ty: 'sh', nm: 'face-path', ks: { a: 1, k: keys } }, fillItem('#FFFFFF')])]
  push('face', layer({ nm: 'face', ind: ind++, shapes, ks: baseTransform(), parent: zenekRootInd }))
}
for (const [nm, key] of [['eye-right', 'eyeRight'], ['eye-left', 'eyeLeft']]) {
  const base = eyeSubs[key === 'eyeRight' ? 'right' : 'left'][0]
  const points = []
  for (let t = 0; t <= T; t += 1) {
    const [sx, sy] = squashAt(t)
    const squashed = deformSubpaths([base], BODY_BASE[0], BODY_BASE[1], sx, sy)[0]
    const b = blinkAmount(t)
    const final = deformSubpaths([squashed], EYE_CENTER[0], EYE_CENTER[1], 1 + 0.06 * b, 1 - b)[0]
    points.push({ t, v: final })
  }
  const keys = points.map((p, idx) => kf(p.t, p.v, idx === points.length - 1 ? null : EASE.linear))
  const shapes = [group(nm, [{ ty: 'sh', nm: `${nm}-path`, ks: { a: 1, k: keys } }, strokeItemSlot('inkColor', 3)])]
  push(nm, layer({ nm, ind: ind++, shapes, ks: baseTransform(), parent: zenekRootInd }))
}

// zenek-root: bounce POSITION only (no scale — squash lives in the shapes above)
push('zenek-root', layer({
  nm: 'zenek-root', ind: zenekRootInd, ty: 3,
  ks: (() => { const ks = baseTransform(); ks.p = animProp(tileCycle(STEP, 2, BOUNCE_POINTS, 0).map((p) => ({ t: p.t, v: [0, p.v, 0], ease: p.ease }))); return ks })(),
}))

// ============================================================
// BAG ASSEMBLY — left fist + baguette + bag, one rigid pendulum nested
// under zenek-root (inherits the bounce for free). Contact-welded: nothing
// in this cluster carries its own separate clock.
// ============================================================
{
  const ks = baseTransform({ a: [LEFT_FIST[0], LEFT_FIST[1], 0], p: [LEFT_FIST[0], LEFT_FIST[1], 0] })
  const rotPts = []
  for (let t = 0; t <= T; t += 2) rotPts.push({ t, v: bagRotAt(t) })
  ks.r = animProp(rotPts)
  push('bag-root', layer({ nm: 'bag-root', ind: bagRootInd, ty: 3, ks, parent: zenekRootInd }))
}
{
  const sp = parsePath(SVG_PATHS.baguetteFill)[0]
  const shapes = [group('baguette-fill', [shapeFromSubpath(sp, 'baguette-fill-path'), fillItem('#FFFFFF')])]
  push('baguette-fill', layer({ nm: 'baguette-fill', ind: ind++, shapes, ks: baseTransform(), parent: bagRootInd }))
}
{
  const sp = parsePath(SVG_PATHS.baguetteOutline)[0]
  const shapes = [group('baguette-outline', [shapeFromSubpath(sp, 'baguette-outline-path'), fillItemSlot('inkColor')])]
  push('baguette-outline', layer({ nm: 'baguette-outline', ind: ind++, shapes, ks: baseTransform(), parent: bagRootInd }))
}
{
  const sp = parsePath(SVG_PATHS.bagBody)[0]
  const shapes = [group('bag-body', [shapeFromSubpath(sp, 'bag-body-path'), fillItem('#FFFFFF'), strokeItemSlot('inkColor', 2)])]
  push('bag-body', layer({ nm: 'bag-body', ind: ind++, shapes, ks: baseTransform(), parent: bagRootInd }))
}
{
  const subs = parsePath(SVG_PATHS.bagFoldLines)
  const items = subs.map((s, i) => shapeFromSubpath(s, `bag-fold-lines-${i}`))
  items.push(strokeItemSlot('inkColor', 2))
  push('bag-fold-lines', layer({ nm: 'bag-fold-lines', ind: ind++, shapes: [group('bag-fold-lines', items)], ks: baseTransform(), parent: bagRootInd }))
}
{
  const sp = parsePath(SVG_PATHS.bagHandle)[0]
  const shapes = [group('bag-handle', [shapeFromSubpath(sp, 'bag-handle-path'), strokeItem('#FFFFFF', 2)])]
  push('bag-handle', layer({ nm: 'bag-handle', ind: ind++, shapes, ks: baseTransform(), parent: bagRootInd }))
}
{
  // decals on the baguette — zero motion of their own, they ride bag-root
  const subs = [parsePath(SVG_PATHS.score1)[0], parsePath(SVG_PATHS.score2)[0], parsePath(SVG_PATHS.score3)[0]]
  const items = subs.map((s, i) => shapeFromSubpath(s, `baguette-score-${i}`))
  items.push(strokeItemSlot('inkColor', 2))
  push('baguette-scores', layer({ nm: 'baguette-scores', ind: ind++, shapes: [group('baguette-scores', items)], ks: baseTransform(), parent: bagRootInd }))
}
{
  const shapes = [group('left-fist', [{ ty: 'el', nm: 'left-fist-shape', p: { a: 0, k: LEFT_FIST }, s: { a: 0, k: [FIST_R * 2, FIST_R * 2] } }, fillItemSlot('inkColor')])]
  push('left-fist', layer({ nm: 'left-fist', ind: ind++, shapes, ks: baseTransform(), parent: bagRootInd }))
}

// ============================================================
// STEADY ISLAND — right fist + cup + steam. NOT parented to zenek-root:
// the brief says the cup "stays steady so it doesn't spill" (motionException
// declared in controls.json). Steam still drifts/fades on its own clock so
// nothing here reads as inert.
// ============================================================
{
  const shapes = [group('right-fist', [{ ty: 'el', nm: 'right-fist-shape', p: { a: 0, k: RIGHT_FIST }, s: { a: 0, k: [FIST_R * 2, FIST_R * 2] } }, fillItemSlot('inkColor')])]
  push('right-fist', layer({ nm: 'right-fist', ind: ind++, shapes, ks: baseTransform() }))
}
for (const [nm, key] of [['cup-body', 'cupBody'], ['cup-band', 'cupBand'], ['cup-lid', 'cupLid']]) {
  const sp = parsePath(SVG_PATHS[key])[0]
  const shapes = [group(nm, [shapeFromSubpath(sp, `${nm}-path`), fillItem('#FFFFFF'), strokeItemSlot('inkColor', 2)])]
  push(nm, layer({ nm, ind: ind++, shapes, ks: baseTransform() }))
}
{
  const subs = parsePath(SVG_PATHS.steam)
  for (let w = 0; w < 2; w++) {
    const sp = subs[w]
    const shapes = [group(`steam-${w + 1}`, [shapeFromSubpath(sp, `steam-${w + 1}-path`), strokeItemSlot('inkColor', 2, `steam-${w + 1}-stroke`)])]
    const ks = baseTransform()
    const props = steamProps(w * (STEAM_PERIOD / 2))
    ks.p = props.p
    ks.o = props.o
    push(`steam-${w + 1}`, layer({ nm: `steam-${w + 1}`, ind: ind++, shapes, ks }))
  }
}

// ============================================================
// Reorder to front-to-back paint order (mirrors source document order,
// reversed — see build notes above).
// ============================================================
const FRONT_TO_BACK = [
  'left-fist', 'steam-2', 'steam-1', 'cup-lid', 'cup-band', 'cup-body',
  'baguette-scores', 'bag-handle', 'bag-fold-lines', 'bag-body',
  'baguette-outline', 'baguette-fill', 'right-fist',
  'eye-right', 'eye-left', 'face', 'body',
]
layers.sort((a, b) => FRONT_TO_BACK.indexOf(a.nm) - FRONT_TO_BACK.indexOf(b.nm))
// nulls (zenek-root, bag-root) have no paint order requirement; push last
for (const nm of ['bag-root', 'zenek-root']) {
  const l = layers.find((x) => x.nm === nm)
  layers.splice(layers.indexOf(l), 1)
  layers.push(l)
}

// ── Seam assertion: every animated p/a/s/r/o must match at t=0 and t=T ─────
function firstLast(prop) {
  if (!prop || !prop.a) return null
  const ks = prop.k
  return [ks[0].s, ks[ks.length - 1].s]
}
let seamOk = true
for (const l of layers) {
  for (const key of ['p', 'a', 's', 'r', 'o']) {
    const fl = firstLast(l.ks[key])
    if (!fl) continue
    const [f, la] = fl
    for (let i = 0; i < f.length; i++) {
      if (Math.abs((f[i] ?? 0) - (la[i] ?? 0)) > 1e-6) { seamOk = false; console.error(`SEAM MISMATCH ${l.nm}.${key}[${i}]: ${f[i]} vs ${la[i]}`) }
    }
  }
  // shape tracks (body/face/eyes) are dense-sampled ending exactly at t=T
  for (const grp of l.shapes?.[0]?.it ?? []) {
    if (grp.ty !== 'sh' || !grp.ks?.a) continue
    const ks = grp.ks.k
    const a = ks[0].s[0], b = ks[ks.length - 1].s[0]
    if (a.v.length !== b.v.length) { seamOk = false; console.error(`SEAM SHAPE VERT COUNT ${l.nm}`); continue }
    for (let i = 0; i < a.v.length; i++) {
      if (Math.hypot(a.v[i][0] - b.v[i][0], a.v[i][1] - b.v[i][1]) > 1e-3) { seamOk = false; console.error(`SEAM SHAPE MISMATCH ${l.nm} vertex ${i}`) }
    }
  }
}
console.log(seamOk ? 'ALL ANIMATED PROPERTIES SEAMLESS (t=0 === t=T)' : 'SEAM CHECK FAILED — see above')

const doc = {
  v: '5.9.0', fr: FPS, ip: 0, op: T, w: W, h: H, nm: 'Loop Zenek — Our (pgjh)',
  ddd: 0,
  slots: { inkColor: { p: { a: 0, k: [...hexToRgb1(INK), 1] } } },
  assets: [], layers, markers: [],
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT, JSON.stringify(doc, (k, v) => (typeof v === 'number' ? +v.toFixed(3) : v)))
console.log(`Wrote ${OUT} — ${layers.length} layers, ${T}f @ ${FPS}fps (${(T / FPS).toFixed(1)}s loop)`)
