#!/usr/bin/env node
/**
 * Generates the INTRO+LOOP Lottie for "live-onboarding-companion-uj7l.svg" —
 * a live onboarding companion: the mascot lounges in a deck chair, sunglasses
 * on, drink in paw, while a speech bubble above it says its line once, over an
 * idle that is ALREADY RUNNING when the scene starts.
 * Output: public/projects/live-onboarding-companion-uj7l/scene-1/lottie.json
 *
 * Source SVG groups mapped to layers:
 *  - "Tooltip/Compact" rect -> bubble plate (rc primitive, slotted size)
 *  - baked "font" glyph path -> REPLACED with a native ty:5 text layer
 *    (slot bubble.text), per recipe-companion-bubble.md
 *  - Ellipse 2421 (r4, nearest mouth) / Ellipse 2420 (r8) -> the two trail
 *    circles; brief says "smallest first" so 2421 pops before 2420 (same
 *    coordinates/roles as companion-hug.svg's trail pair).
 *  - Group 13308 -> chair + mascot + drink:
 *      Rectangle 767              -> chair-seat (the big white fabric sweep)
 *      Vector 263/267/266/265     -> chair-leg-back-a/b/c + chair-leg-front
 *        (263/267/266 painted BEFORE the seat = back legs; 265 painted AFTER
 *        the seat = the front leg — confirms the crossed-leg depth read)
 *      Group 1734 (Fill 12 dark blob, Fill 14 white patch, Rectangle 765/766
 *        dark lenses, Vector 258/259/260/261 white shine slashes, Vector 262
 *        bridge) -> the mascot's head (dark body + white face patch, same
 *        bbox as companion-hug.svg's body/face) wearing sunglasses on top.
 *        Rectangle 765 = left lens (smaller x), 766 = right lens.
 *      Ellipse 116                -> paw (peeks out, painted BEHIND
 *        everything, same "peeking from behind" idiom as companion-hug's paw)
 *      Rectangle 768/769, Line 161, Vector 269, Vector 268 -> the drink
 *        cluster (glass outline, dark drink fill, straw, glass shine, paper
 *        umbrella) — painted LAST (in front of the mascot), held out by the
 *        paw.
 *
 * ============================================================================
 * v3: LIVING IDLE (motion-taste.md "Living idles — the Rive-grade bar") —
 * architecture ported from scripts/build-loop-zenek-our-pexy.mjs: evalTrack
 * (dense cubic-bezier track evaluation) + tileCycle-style forward tiling,
 * combined with THIS file's own echo technique (recipe-companion-bubble.md)
 * for backward extension into [0, T). See docs/live-onboarding-companion-eh0n
 * -animation.md's "v4 living idle" section for the clock table and the
 * derivation chain (which elements are DENSE-SAMPLED FROM which tracks).
 * ============================================================================
 *
 * Idle-from-frame-0: every idle motion is one continuous track spanning the
 * WHOLE composition [0, op] — never a hump confined to [T, op]. Since a
 * clock's period divides IDLE (=op-T) exactly, rests recur every period, so
 * the SAME per-cycle generator sampled at (t - period), (t - 2*period), ...
 * validly fills [0, T) with the tail of notional earlier cycles.
 *
 * Rig: "head-rig" carries the primary BREATHE clock (translate along the
 * chair's own tilt axis + rotate + scale, dense-sampled combining the
 * breathe envelope with a secondary DETAIL clock's micro-wobble) — amplitude
 * now reads at arm's length (9px / 4deg / 3% scale), not the old 3px/2deg
 * placed-not-living version. "chair-seat" is DERIVED from the SAME breathe
 * envelope (squash + bulge, zero lag — a direct response to the body's
 * weight, not an independent wiggle); the leg struts stay a true steady
 * island (unparented, unanimated). "drink-rig"/"trailing-rig" keep the v3
 * sip arc + anticipation + overshoot verbatim from the previous pass; NEW
 * this pass, "drink-fill" (the liquid) gets its own small DRAG rotation
 * derived from the same dragRun() generator that already drives
 * straw/umbrella, reduced amplitude and a beat further lagged ("liquid
 * sloshes when the glass moves"). "glint" is now its own tiled GLINT clock
 * (3x/loop) instead of a single per-loop occurrence, phased clear of the
 * breathe/detail/sip peaks so it reads as its own beat.
 */
import { writeFileSync, mkdirSync, copyFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../public/projects/live-onboarding-companion-uj7l/scene-1')
const OUT = join(OUT_DIR, 'lottie.json')

const W = 240, H = 240, FPS = 60
const T = 90          // 1.5s intro — "nothing here is in a rush"
const IDLE = 180       // 3.0s idle — "longest, laziest period of the set"
const OP = T + IDLE     // 270 total

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

// ── Raw path data lifted from live-onboarding-companion-uj7l.svg (viewBox 0 0 240 240) ──
const SVG_PATHS = {
  chairSeat: 'M144.546 104.949H225.352C225.352 104.949 224.539 157.48 200.948 186.142C177.357 214.804 158.376 195.344 158.376 195.344C158.376 195.344 144.275 207.252 123.938 207.252C103.601 207.252 88.6875 195.344 88.6875 195.344C88.6875 195.344 124.209 191.109 138.852 176.197C153.495 161.286 144.546 104.949 144.546 104.949Z',
  legBackA: 'M158.582 195.539L205.048 225.996',
  legBackB: 'M93.7637 196.32L139.839 225.996',
  legBackC: 'M151.553 105.344L85.1728 225.999',
  legFront: 'M225.742 105.344L158.972 225.999',
  headDark: 'M155.269 98.5928C181.755 105.548 197.588 132.657 190.634 159.144C183.679 185.63 156.57 201.464 130.083 194.509C103.597 187.554 87.763 160.444 94.7177 133.958C101.673 107.472 128.782 91.638 155.269 98.5928Z',
  headFace: 'M103.54 124.656C99.4482 138.945 112.832 144.97 130.269 150.028L132.582 150.688C150.066 155.584 164.62 157.525 168.711 143.237C172.893 128.635 161.695 112.639 143.699 107.507C125.703 102.378 107.723 110.055 103.54 124.656Z',
  lensLeft: 'M93.0663 121.72C93.3771 118.688 93.5325 117.173 94.0664 116.051C95.1633 113.748 97.3991 112.199 99.9411 111.981C101.178 111.875 102.652 112.262 105.6 113.036L115.015 115.508C118.064 116.309 119.589 116.709 120.632 117.433C122.777 118.921 123.946 121.454 123.687 124.051C123.561 125.314 122.876 126.734 121.507 129.575C120.54 131.579 120.057 132.581 119.404 133.323C118.067 134.839 116.154 135.722 114.133 135.755C113.144 135.772 112.068 135.489 109.916 134.924L100.502 132.452C98.2729 131.867 97.1583 131.574 96.2857 131.054C94.5007 129.989 93.264 128.204 92.8944 126.159C92.7138 125.159 92.8313 124.013 93.0663 121.72Z',
  shineLeftA: 'M105.505 116.377L96.8923 121.408',
  shineLeftB: 'M112.325 118.169L97.0867 127.069',
  lensRight: 'M130.848 131.642C131.158 128.61 131.314 127.094 131.848 125.973C132.945 123.67 135.18 122.12 137.722 121.903C138.96 121.797 140.434 122.184 143.381 122.958L152.796 125.43C155.846 126.231 157.37 126.631 158.414 127.355C160.558 128.842 161.727 131.376 161.468 133.973C161.342 135.236 160.657 136.656 159.288 139.496C158.322 141.501 157.839 142.503 157.185 143.244C155.848 144.76 153.935 145.643 151.914 145.677C150.926 145.693 149.85 145.411 147.698 144.846L138.283 142.374C136.054 141.788 134.94 141.496 134.067 140.975C132.282 139.911 131.045 138.126 130.676 136.081C130.495 135.081 130.613 133.935 130.848 131.642Z',
  shineRightA: 'M142.762 126.161L134.674 131.33',
  shineRightB: 'M150.11 128.092L134.346 136.855',
  bridge: 'M121.857 124.599C122.845 124.111 125.546 123.324 128.443 124.085C131.34 124.845 133.306 126.857 133.926 127.768',
  glass: 'M76.6324 140.041L78.5929 172.338L62.5589 175.264L52.9857 144.356L76.6324 140.041Z',
  drinkFill: 'M73.6903 152.678L74.9965 170.063L65.1032 171.868L59.1365 152.678L73.6903 152.678Z',
  straw: 'M53.8328 133.505L61.1667 154.188',
  glassShine: 'M71.6848 153.506L72.6171 138.038C72.8935 133.453 76.2653 129.649 80.7844 128.824',
  umbrella: 'M44.4438 143.002L52.6897 133.322L64.7096 134.781C63.7704 135.996 60.6213 138.936 55.5377 140.977C50.4542 143.018 46.0236 143.177 44.4438 143.002Z',
}
const PAW = { cx: 78.8309, cy: 156.3, r: 12.6903 }

// ── Lottie builder helpers (house pattern) ──────────────────────────────────
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
  // Symmetric slow-start/slow-end — for a short segment bounded by genuine
  // stops on BOTH ends (unlike travelBalanced's 1.0/0.0 control extremes,
  // which front-load into a mid-segment speed spike when compressed into a
  // handful of frames; unlike settleSoft's fast-out start, wrong for leaving
  // a standstill).
  easeInOut: [0.42, 0, 0.58, 1],
}

function kf(t, value, easeOut, spatial, hold) {
  const k = { t, s: Array.isArray(value) ? value : [value] }
  if (hold) {
    // Held keyframe (Lottie `h:1`): the value stays FLAT until the next
    // keyframe's time, then jumps instantly — no o/i, nothing to interpolate
    // out of. Robust under Duration retiming, unlike a same-value-close-
    // together-keyframes fake ramp (see motion-taste.md's wrapped-drift
    // lesson): the jump is a real hold flag, not a 1-frame illusion.
    k.h = 1
  } else if (easeOut) {
    const [x1, y1, x2, y2] = easeOut
    k.o = { x: [x1], y: [y1] }
    k.i = { x: [x2], y: [y2] }
  }
  if (spatial) {
    if (spatial.to) k.to = spatial.to
    if (spatial.ti) k.ti = spatial.ti
  }
  return k
}

// Plain range track: keyframes exactly where authored, no forced t=0 —
// Skottie holds a property at its first keyframe's value for every earlier
// frame (and at its last keyframe's value for every later frame), which is
// exactly "at rest, then one event, then at rest" for free. Points may carry
// `to`/`ti` (spatial bezier handles) to bow a position's PATH into an arc —
// independent of `ease`, which only shapes speed along that path. A point
// with `hold: true` becomes a held keyframe (see kf()) instead of easing
// into the next one — for a value that must snap while invisible/at-rest
// rather than glide across a gap toward a genuinely different value.
function animProp(points) {
  const keys = points.map((p, idx) => {
    const isLast = idx === points.length - 1
    const spatial = (p.to || p.ti) ? { to: p.to, ti: p.ti } : null
    return kf(p.t, p.v, isLast ? null : (EASE[p.ease] || EASE.linear), spatial, p.hold)
  })
  return { a: 1, k: keys }
}

// ── Living-idle architecture (ported from build-loop-zenek-our-pexy.mjs's
// evalTrack/tileCycle, combined with this file's own echo technique) ───────
// A cubic-bezier EASE anchor gives x(s)/y(s) parametrically; evalTrack finds
// s such that x(s) = the requested time-fraction, then returns y(s) — the
// same "real cubic-bezier easing" the .o/.i keyframe fields describe, but
// callable at an arbitrary t instead of only at authored keyframes. This is
// what lets coupled/derived properties (chair squash, liquid slosh, a
// combined head rotation) come from EVALUATING a track, not copying it.
function bezierEaseFn(x1, y1, x2, y2) {
  return (t) => {
    const bx = (s) => { const m = 1 - s; return 3 * m * m * s * x1 + 3 * m * s * s * x2 + s * s * s }
    const by = (s) => { const m = 1 - s; return 3 * m * m * s * y1 + 3 * m * s * s * y2 + s * s * s }
    let lo = 0, hi = 1
    for (let k = 0; k < 30; k++) { const mid = (lo + hi) / 2; if (bx(mid) < t) lo = mid; else hi = mid }
    return by((lo + hi) / 2)
  }
}
// points: [{t,v,ease}] covering [0, total), plus an implicit final point at
// (total, finalValue). Returns the scalar value at arbitrary frame `t`.
function evalTrack(points, finalValue, total, t) {
  const all = [...points, { t: total, v: finalValue }]
  let seg = all.length - 2
  for (let k = 0; k < all.length - 1; k++) { if (t >= all[k].t && t <= all[k + 1].t) { seg = k; break } }
  const a = all[seg], b = all[seg + 1]
  const frac = (t - a.t) / ((b.t - a.t) || 1)
  const [x1, y1, x2, y2] = EASE[a.ease] || EASE.linear
  const eased = bezierEaseFn(x1, y1, x2, y2)(frac)
  return a.v + (b.v - a.v) * eased
}

// Forward-tile one cycle's local points (t in [0, period)) numCycles times
// starting at `startAt`, closing with one final keyframe at rest.
function tileForward(localPoints, period, numCycles, startAt, restValue) {
  const out = []
  for (let c = 0; c < numCycles; c++) for (const p of localPoints) out.push({ t: startAt + c * period + p.t, v: p.v, ease: p.ease })
  out.push({ t: startAt + numCycles * period, v: restValue })
  return out
}
// Echo the SAME local points backward from `startAt` into [0, startAt) by
// repeating the cycle at (startAt - period), (startAt - 2*period), ... until
// a cycle can no longer contribute any t >= 0 points — generalizes the
// recipe's echo technique to periods that don't evenly divide T. Relies on
// each cycle resting at both its own local 0 and local `period` (a short
// active window, flat before/after) so a cycle cut off mid-way at t=0 still
// joins cleanly, per player-contract.md's seam-plateau lesson.
function echoBackward(localPoints, period, startAt) {
  const echoed = []
  let cycleStart = startAt - period
  while (cycleStart + period > 0) {
    for (const p of localPoints) { const t = cycleStart + p.t; if (t >= 0) echoed.push({ t, v: p.v, ease: p.ease }) }
    cycleStart -= period
  }
  echoed.sort((a, b) => a.t - b.t)
  return echoed
}
// Full [0, op] track for a periodic clock: explicit t:0 rest (unless the
// echo already supplies one), the echoed tail, the tiled real cycles, and
// the closing rest at op.
function livingTrack(localPoints, period, restValue) {
  const echoed = echoBackward(localPoints, period, T)
  const real = tileForward(localPoints, period, IDLE / period, T, restValue)
  const head = echoed.length && echoed[0].t === 0 ? [] : [{ t: 0, v: restValue, ease: 'linear' }]
  return [...head, ...echoed, ...real]
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
function pushLayer({ nm, shapes, ks, parent, ty, textData, w, h, refId, tt, td }) {
  const l = { ddd: 0, ind: ind, nm, sr: 1, ks, ao: 0, ip: 0, op: OP, st: 0, bm: 0 }
  if (ty === 5) { l.ty = 5; l.t = textData }
  else if (refId) { l.ty = 0; l.refId = refId; l.w = w; l.h = h }
  else if (ty === 3) { l.ty = 3 }
  else { l.ty = 4; l.shapes = shapes }
  if (parent) l.parent = parent
  if (tt) l.tt = tt
  if (td) l.td = 1
  layers.push(l)
  ind++
  return l.ind
}

function staticShapeLayer(nm, d, paintItems, parent) {
  const subs = parsePath(d)
  const items = subs.map((s, i) => shapeFromSubpath(s, `${nm}-${i}`))
  const shapes = [group(nm, [...items, ...paintItems])]
  pushLayer({ nm, shapes, ks: baseTransform(), parent })
}

// ============================================================
// BUBBLE — plate (slotted size) + native text, one entrance unit
//
// Stage safety (motion-taste.md "Render-Aware Motion"): the plate must clear
// BOTH stage edges by >=16px at bubble.size's autoFit `max`, not just the
// default. Stage is 240x240; recentered to the true stage-center X=120 (was
// 102, which left only 86px of half-width before the LEFT edge violated the
// margin) so max[0] is symmetric and maximal. Vertically, PLATE the plate so
// its max[1]=73 (3 lines) clears the top margin AND the mascot's head (top
// at y=98.6, computed below) — centerY=54 gives top=17.5 (>=16 with a 1.5px
// buffer) and bottom=90.5 (8.1px clear of the head). Trail circles move down
// with it into the (now much tighter) gap between the plate and the head.
// ============================================================
const PLATE_DEFAULT_W = 176, PLATE_DEFAULT_H = 35, PLATE_R = 17.5
const PLATE_CX = 120
const PLATE_CENTER_Y = 54
const PLATE_TOP = PLATE_CENTER_Y - PLATE_DEFAULT_H / 2   // 36.5
const PLATE_BOTTOM = PLATE_CENTER_Y + PLATE_DEFAULT_H / 2 // 71.5

// ZEN tooltip standard: Nunito BOLD 15px, line-height 19.
const FONT_SIZE = 15
const LINE_HEIGHT = 19
// Baseline placed by measurement (recipe-companion-bubble.md #2), not the
// generic cap-height guess: start at plateCenterY + fontSize*0.36, then
// verified against rendered ink bounds vs plate bounds (see docs) — settled
// on this value once top/bottom insets matched within 1px.
const BASELINE_LOCAL = 5.41 // px below the plate's local center (y=0)

const DEFAULT_STRING = 'Almost time to relax'
function textDoc(str) {
  return {
    s: FONT_SIZE,
    f: 'Nunito-Bold',
    t: str,
    j: 2,
    tr: 0,
    lh: LINE_HEIGHT,
    ls: 0,
    fc: hexToRgb1('#222222'),
  }
}

// Bubble pop-in: grows from the trail (anchor pinned at plate bottom-center),
// a lazy, unhurried overshoot — bigger and slower than a snappy pop, fully
// settled well before T=90. "Nothing here is in a rush."
const BUBBLE_POP = [
  { t: 28, v: 0, ease: 'entranceSharp' },
  { t: 58, v: 112, ease: 'settleSoft' },
  { t: 82, v: 100 },
]
const BUBBLE_OPACITY = [
  { t: 28, v: 0, ease: 'entranceSharp' },
  { t: 44, v: 100 },
]

const bubbleAnchorInd = pushLayer({
  nm: 'bubble-anchor',
  ty: 3,
  ks: {
    a: { a: 0, k: [0, PLATE_DEFAULT_H / 2, 0] },
    p: { a: 0, k: [PLATE_CX, PLATE_BOTTOM, 0] },
    s: animProp(BUBBLE_POP.map((p) => ({ ...p, v: [p.v, p.v, 100] }))),
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
  ks.o = animProp(BUBBLE_OPACITY)
  pushLayer({ nm: 'bubble-plate', shapes, ks, parent: bubbleAnchorInd })
}
{
  const doc = textDoc(DEFAULT_STRING)
  // Text layers here don't inherit an ancestor's animated scale (confirmed in
  // companion-hug.svg's build) — duplicate the pop as the text's OWN scale,
  // pivoting at its own local origin (a=[0,0], the baseline-start point) so
  // the pivot itself never drifts under scale; POSITION (not anchor) is what
  // carries the measured baseline offset below the plate's local center — an
  // anchor==position pair would cancel to net-zero regardless of the value
  // (that was the old bug: text always landed dead-center, ink-high).
  const ks = baseTransform({ a: [0, 0, 0], p: [0, BASELINE_LOCAL, 0] })
  ks.s = animProp(BUBBLE_POP.map((p) => ({ ...p, v: [p.v, p.v, 100] })))
  ks.o = animProp(BUBBLE_OPACITY)
  const textData = {
    d: { k: [{ s: doc, t: 0 }], sid: 'bubble.text' },
    p: {},
    m: { g: 1, a: { a: 0, k: [0, 0] } },
    a: [],
  }
  pushLayer({ nm: 'bubble-text', ty: 5, textData, ks, parent: bubbleAnchorInd })
}

// ============================================================
// TRAIL — Ellipse 2421 (smallest, nearest the head) pops first, then 2420.
// Repositioned into the gap between the recentered/lowered bubble and the
// mascot's head (see bubble section above).
// ============================================================
function trailCircle(nm, cx, cy, r, points) {
  const shapes = [group(nm, [
    { ty: 'el', nm: `${nm}-el`, p: { a: 0, k: [0, 0] }, s: { a: 0, k: [r * 2, r * 2] } },
    strokeItem('#222222', 1.5),
  ])]
  const ks = baseTransform({ p: [cx, cy, 0] })
  ks.s = animProp(points.map((p) => ({ ...p, v: [p.v, p.v, 100] })))
  ks.o = animProp(points.map((p) => ({ t: p.t, v: p.v > 0 ? 100 : 0, ease: p.ease })))
  pushLayer({ nm, shapes, ks })
}
trailCircle('trail-small', 132, 90, 4, [{ t: 0, v: 0, ease: 'entranceSharp' }, { t: 10, v: 112, ease: 'settleSoft' }, { t: 20, v: 100 }])
trailCircle('trail-large', 120, 79, 8, [{ t: 8, v: 0, ease: 'entranceSharp' }, { t: 20, v: 114, ease: 'settleSoft' }, { t: 32, v: 100 }])

// ============================================================
// CHAIR — legs stay a true steady island: unparented, unanimated. The seat
// (fabric, not the rigid struts) now FLEXES, derived from the SAME breathe
// envelope head-rig uses (defined further below, evaluated here) — see the
// "the world responds" block after head-rig.
// ============================================================
staticShapeLayer('chair-leg-back-a', SVG_PATHS.legBackA, [strokeItem('#222222', 2.0532)])
staticShapeLayer('chair-leg-back-b', SVG_PATHS.legBackB, [strokeItem('#222222', 2.0532)])
staticShapeLayer('chair-leg-back-c', SVG_PATHS.legBackC, [strokeItem('#222222', 2.0532)])
staticShapeLayer('chair-leg-front', SVG_PATHS.legFront, [strokeItem('#222222', 2.0532)])

// ============================================================
// LIVING IDLE CLOCKS — 4 shared periods, all exact divisors of IDLE=180,
// non-trivial ratios (90:60:180:36, i.e. 15:10:30:6 reduced — not 1:2:4).
// Every element binds to one; peaks land on different beats so the loop
// never reads as one metronome (see docs for the exact peak-frame table).
// ============================================================
const CLOCK_BREATHE = 90  // primary recline+breathe — 2 cycles/loop
const CLOCK_GLINT = 60    // sunglass glint sweep — 3 cycles/loop
const CLOCK_SIP = IDLE    // almost-sip gesture — 1 cycle/loop (unchanged v3 mechanism)
const CLOCK_DETAIL = 36   // secondary head micro-life — 5 cycles/loop

// ============================================================
// HEAD + SUNGLASSES rig — BREATHE (primary) + DETAIL (secondary) clocks,
// dense-sampled and SUMMED (the zenek-script technique: derive a combined
// property by evaluating two independent tracks at the same t, not by
// hand-merging their keyframes) since one layer property can only carry one
// authored track. Amplitude now reads at arm's length: 9px position travel
// (3.75% of the 240 comp), 4deg rotation, 3% scale — the old 3px/2deg pass
// was imperceptible, the defect this rebuild kills.
// ============================================================
const headBbox = bboxOf(parsePath(SVG_PATHS.headDark))
const headPivot = [(headBbox[0] + headBbox[2]) / 2, headBbox[3]] // bottom-center — contact base with the chair

// Tilt axis derived from the long crossing leg (legBackC): the chair's own
// recline direction, not a guessed vertical.
const AXIS_FROM = [151.553, 105.344], AXIS_TO = [85.1728, 225.999]
const axisDx = AXIS_TO[0] - AXIS_FROM[0], axisDy = AXIS_TO[1] - AXIS_FROM[1]
const axisMag = Math.hypot(axisDx, axisDy)
const axisUnit = [axisDx / axisMag, axisDy / axisMag]
const RECLINE_DIST = 9    // px, "sinking deeper" — reads at arm's length (was 3, imperceptible)
const RECLINE_ROT_DEG = 4 // "easing back" (was 2)
const BREATHE_SCALE_AMP = 3 // % scale swell at the peak of the breathe (chest expand)
const DETAIL_ROT_DEG = 1.6  // secondary micro-wobble riding the primary breathe

// Breathe envelope: 0 at rest, 1 at peak, local to ONE 90f cycle — every
// consumer (head position/rotation/scale, chair-seat squash) scales this
// SAME normalized track by its own amplitude, rather than hand-authoring
// independent curves per property.
const BREATHE_POINTS = [
  { t: 0, v: 0, ease: 'travelBalanced' },
  { t: 38, v: 1, ease: 'travelBalanced' },
]
const breatheEnvelope = (t) => evalTrack(BREATHE_POINTS, 0, CLOCK_BREATHE, ((t % CLOCK_BREATHE) + CLOCK_BREATHE) % CLOCK_BREATHE)

// Detail envelope: a short, snappier secondary hump — peaks at local t=16 of
// its 36f cycle (absolute peaks 106/142/178/214/250), clear of breathe's
// peaks (128/218) and glint's (114/174/234) so no two clocks land in unison.
const DETAIL_POINTS = [
  { t: 0, v: 0, ease: 'entranceSharp' },
  { t: 16, v: 1, ease: 'settleSoft' },
  { t: 26, v: 0, ease: 'settleSoft' },
]
const detailEnvelope = (t) => evalTrack(DETAIL_POINTS, 0, CLOCK_DETAIL, ((t % CLOCK_DETAIL) + CLOCK_DETAIL) % CLOCK_DETAIL)

const HEAD_SAMPLE_STEP = 6 // matches the zenek script's own dense-sample cadence
const headPosPoints = [], headRotPoints = [], headScalePoints = []
for (let t = 0; t <= OP; t += HEAD_SAMPLE_STEP) {
  const breathe = breatheEnvelope(t)
  const detail = detailEnvelope(t)
  const off = [axisUnit[0] * RECLINE_DIST * breathe, axisUnit[1] * RECLINE_DIST * breathe]
  headPosPoints.push({ t, v: [headPivot[0] + off[0], headPivot[1] + off[1], 0], ease: 'linear' })
  headRotPoints.push({ t, v: RECLINE_ROT_DEG * breathe + DETAIL_ROT_DEG * detail, ease: 'linear' })
  const sc = 100 + BREATHE_SCALE_AMP * breathe
  headScalePoints.push({ t, v: [sc, sc, 100], ease: 'linear' })
}
if (headPosPoints[headPosPoints.length - 1].t !== OP) {
  const breathe = breatheEnvelope(OP), detail = detailEnvelope(OP)
  const off = [axisUnit[0] * RECLINE_DIST * breathe, axisUnit[1] * RECLINE_DIST * breathe]
  headPosPoints.push({ t: OP, v: [headPivot[0] + off[0], headPivot[1] + off[1], 0] })
  headRotPoints.push({ t: OP, v: RECLINE_ROT_DEG * breathe + DETAIL_ROT_DEG * detail })
  headScalePoints.push({ t: OP, v: [100 + BREATHE_SCALE_AMP * breathe, 100 + BREATHE_SCALE_AMP * breathe, 100] })
}

const headRigInd = pushLayer({
  nm: 'head-rig',
  ty: 3,
  ks: {
    a: { a: 0, k: [headPivot[0], headPivot[1], 0] },
    p: animProp(headPosPoints),
    r: animProp(headRotPoints),
    s: animProp(headScalePoints),
    o: { a: 0, k: 100 },
  },
})

staticShapeLayer('head-dark', SVG_PATHS.headDark, [fillItem('#222222')], headRigInd)
staticShapeLayer('head-face', SVG_PATHS.headFace, [fillItem('#FFFFFF')], headRigInd)
staticShapeLayer('sunglass-lens-left', SVG_PATHS.lensLeft, [fillItem('#222222')], headRigInd)
staticShapeLayer('sunglass-shine-left-a', SVG_PATHS.shineLeftA, [strokeItem('#FFFFFF', 2.0532, 100, 'Stroke', 2, 1)], headRigInd)
staticShapeLayer('sunglass-shine-left-b', SVG_PATHS.shineLeftB, [strokeItem('#FFFFFF', 2.0532, 100, 'Stroke', 2, 1)], headRigInd)
staticShapeLayer('sunglass-lens-right', SVG_PATHS.lensRight, [fillItem('#222222')], headRigInd)
staticShapeLayer('sunglass-shine-right-a', SVG_PATHS.shineRightA, [strokeItem('#FFFFFF', 2.0532, 100, 'Stroke', 2, 1)], headRigInd)
staticShapeLayer('sunglass-shine-right-b', SVG_PATHS.shineRightB, [strokeItem('#FFFFFF', 2.0532, 100, 'Stroke', 2, 1)], headRigInd)
staticShapeLayer('sunglass-bridge', SVG_PATHS.bridge, [strokeItem('#222222', 2.0532, 100, 'Stroke', 2, 1)], headRigInd)

// ── THE WORLD RESPONDS #1 — chair-seat flexes on the body's down-beat,
// derived from the SAME breatheEnvelope (zero lag: a direct reaction to
// weight, not an independent wiggle). Pivoted at the seat's own top-center
// (the mascot's contact point) so it reads as sinking, not shrinking evenly;
// a slight X bulge alongside the Y compress gives a squash-stretch "give".
// ============================================================
{
  const seatBbox = bboxOf(parsePath(SVG_PATHS.chairSeat))
  const seatPivot = [(seatBbox[0] + seatBbox[2]) / 2, seatBbox[1]]
  const SEAT_SQUASH_PCT = 3 // Y-scale reduction at peak compression (a few px over ~102px seat height)
  const SEAT_BULGE_PCT = 1  // X-scale bulge, conservation-of-volume feel
  const seatScalePoints = []
  for (let t = 0; t <= OP; t += HEAD_SAMPLE_STEP) {
    const breathe = breatheEnvelope(t)
    seatScalePoints.push({ t, v: [100 + SEAT_BULGE_PCT * breathe, 100 - SEAT_SQUASH_PCT * breathe, 100], ease: 'linear' })
  }
  if (seatScalePoints[seatScalePoints.length - 1].t !== OP) {
    const breathe = breatheEnvelope(OP)
    seatScalePoints.push({ t: OP, v: [100 + SEAT_BULGE_PCT * breathe, 100 - SEAT_SQUASH_PCT * breathe, 100] })
  }
  const subs = parsePath(SVG_PATHS.chairSeat)
  const items = subs.map((s, i) => shapeFromSubpath(s, `chair-seat-${i}`))
  const shapes = [group('chair-seat', [...items, fillItem('#FFFFFF'), strokeItem('#222222', 2.0532)])]
  const ks = baseTransform({ a: [seatPivot[0], seatPivot[1], 0], p: [seatPivot[0], seatPivot[1], 0] })
  ks.s = animProp(seatScalePoints)
  pushLayer({ nm: 'chair-seat', shapes, ks })
}

// ── GLINT — its own tiled clock (CLOCK_GLINT=60, 3x/loop), a track matte
// clipped to the right lens, independent of the (never separately animated)
// baked shine slashes. Active window is local t in [12, 36] of each 60f
// cycle (24f active, 36f rest) so echo/tiling stay flat-bounded per
// livingTrack()'s rest-at-both-ends requirement.
// ============================================================
{
  const lensSub = parsePath(SVG_PATHS.lensRight)
  const lensCenter = bboxCenter(bboxOf(lensSub))
  const angle = -25 * Math.PI / 180 // matches the shine slashes' diagonal
  const cosA = Math.cos(angle), sinA = Math.sin(angle)
  const sweep = 22
  const leftPos = [lensCenter[0] - sweep * cosA, lensCenter[1] - sweep * sinA]
  const midPos = lensCenter
  const rightPos = [lensCenter[0] + sweep * cosA, lensCenter[1] + sweep * sinA]

  const GLINT_POS_LOCAL = [
    { t: 12, v: leftPos, ease: 'settleSoft' },
    { t: 24, v: midPos, ease: 'travelBalanced' },
    { t: 36, v: rightPos, ease: 'linear' },
  ]
  const GLINT_OP_LOCAL = [
    { t: 12, v: 0, ease: 'settleSoft' },
    { t: 24, v: 34, ease: 'travelBalanced' },
    { t: 36, v: 0, ease: 'linear' },
  ]
  // Position never rests at ONE constant value the way opacity rests at 0 —
  // its cycle sweeps leftPos -> midPos -> rightPos and (while invisible)
  // must jump back to leftPos for the next sweep. Two distinct bugs, both
  // now fixed:
  //  1. restValue must match GLINT_POS_LOCAL's OWN last point (t:36 ->
  //     rightPos), not the sweep's start (leftPos) — that's the value the
  //     track actually closes on every cycle and at t=0/op.
  //  2. Even with (1) fixed, nothing marked WHERE the track holds flat: a
  //     real keyframe at rightPos (cycle end) followed by a real keyframe
  //     at leftPos (next cycle's start) with no keyframe between them
  //     means Lottie interpolates the WHOLE invisible gap between them —
  //     so value(t) for any t inside that gap (including t=90, which has
  //     no keyframe of its own) is some arbitrary point on that glide, not
  //     the resting rightPos. This didn't show up in a T-vs-op PIXEL diff
  //     (glint is opacity:0 at both, so the wrong position never rendered)
  //     but fails a genuine per-property audit, which is the actual
  //     contract ("every animated property matches at T and op", not just
  //     "renders the same"). Fix: mark every rightPos-valued point HELD —
  //     the value snaps flat until the moment the next cycle's leftPos
  //     keyframe is reached, instead of drifting toward it. Held only ever
  //     changes what happens LEAVING a keyframe, so the visible sweep
  //     itself (arriving at rightPos via midPos's own ease) is untouched.
  const restPos = [rightPos[0], rightPos[1], 0]
  const glintPosPoints = livingTrack(GLINT_POS_LOCAL.map((p) => ({ ...p, v: [p.v[0], p.v[1], 0] })), CLOCK_GLINT, restPos)
    .map((p) => (p.v[0] === restPos[0] && p.v[1] === restPos[1]) ? { ...p, hold: true } : p)
  const glintOpPoints = livingTrack(GLINT_OP_LOCAL, CLOCK_GLINT, 0)

  // matte source: the lens silhouette, filled solid (invisible, td-only).
  {
    const items = lensSub.map((s, i) => shapeFromSubpath(s, `glint__matte-${i}`))
    const shapes = [group('glint__matte', [...items, fillItem('#FFFFFF')])]
    pushLayer({ nm: 'glint__matte', shapes, ks: baseTransform(), parent: headRigInd, td: true })
  }
  // glint bar: a soft diagonal streak, matted to the lens above.
  {
    const shapes = [group('glint-bar', [
      { ty: 'rc', nm: 'glint-rect', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [46, 7] }, r: { a: 0, k: 3.5 } },
      fillItem('#FFFFFF'),
    ], { r: -25 })]
    const ks = baseTransform()
    ks.p = animProp(glintPosPoints)
    ks.o = animProp(glintOpPoints)
    pushLayer({ nm: 'glint', shapes, ks, parent: headRigInd, tt: 1 })
  }
}

// ============================================================
// DRINK CLUSTER — glass/drink/paw/shine lift toward the face once per cycle
// in an ARC (spatial tangents bow the path, never a straight diagonal),
// bracketed by a small anticipation dip before the rise and a springy
// overshoot-then-settle past the top. Straw + umbrella are DRAG, not a
// time-shifted copy: they're parented directly to drink-rig so their base
// travels with the glass at zero lag, and carry only their OWN local
// rotation — a lag-then-overshoot-then-decay curve, pivoted at their base
// (in-glass end) so the free tip bends more than the root. The umbrella
// gets one more small extra rock a beat after that (secondary motion riding
// secondary motion). UNCHANGED from the v3 fluidity pass (kept verbatim per
// this pass's brief) except NEW: drink-fill (the liquid) below gets its own
// small drag-derived slosh. Every run below is authored TWICE per cycle: an
// "echo" (the tail of the previous, notional cycle, filling [0, T) so the
// drink is already alive under the entrance) and the "real" occurrence
// inside [T, op] — same relative shape both times.
// ============================================================
const DRINK_OFFSET = [3, -6] // px, toward the face and up — the settled sip height
const OVERSHOOT = DRINK_OFFSET.map((v) => v * 1.35) // springy overshoot past the sip height, Skottie-safe settle-back
const ANTICIPATE_OFFSET = [-1, 2] // px, small counter-dip opposite the raise, before it starts
const ANTICIPATE_LEAD = 8 // frames the flat-rest plateau holds before the lean begins
const SIP_OFFSETS = { anticipate: -4, riseStart: 0, overshoot: 28, peak: 36, hold: 55, rest: 72 } // relative to each run's own rest-start

// Arc handles: departure from rest leans mostly vertical (up first), arrival
// into the overshoot leans mostly horizontal (curving in toward the face) —
// a bowed path, not the straight diagonal a plain 2-key tween would give.
// The return leg (hold -> rest) gets its own, independently-authored bow
// rather than the up-arc simply mirrored.
const RISE_TO = [0, DRINK_OFFSET[1] * 0.55, 0]
const RISE_TI = [OVERSHOOT[0] * -0.5, 0, 0]
const FALL_TO = [DRINK_OFFSET[0] * -0.4, 0, 0]
const FALL_TI = [0, DRINK_OFFSET[1] * -0.5, 0]

function sipRun(cycleStart) {
  const abs = (rel) => cycleStart + rel
  return [
    // Explicit flat-rest plateau before the lean: without this, the FIRST
    // point of the run would be the non-zero ANTICIPATE_OFFSET itself, so
    // the entire (long) inter-cycle gap back to the previous rest becomes a
    // slow drift toward it instead of a true hold at [0,0] — breaking the
    // loop seam, since T falls inside that drift rather than on a flat 0.
    { t: abs(SIP_OFFSETS.anticipate) - ANTICIPATE_LEAD, v: [0, 0], ease: 'easeInOut' },
    // Departs the rest hold with exitAccelerate (slow start, matching a
    // standstill) and ends fast — flowing straight into riseStart's own
    // fast-start entranceSharp rather than decelerating to near-zero right
    // at that pass-through pose (riseStart is a waypoint, not a stop).
    { t: abs(SIP_OFFSETS.anticipate), v: ANTICIPATE_OFFSET, ease: 'exitAccelerate' }, // lean back a touch before the reach
    { t: abs(SIP_OFFSETS.riseStart), v: [0, 0], ease: 'entranceSharp', to: RISE_TO }, // snappy attack into the rise, arcing up first
    // easeInOut (not travelBalanced) for this short bounce-back: bounded by
    // a genuine stop on both ends (the overshoot extremum, then a dead hold
    // at 'peak' since the next segment doesn't move), travelBalanced's
    // extreme control points compress into a mid-segment speed spike here.
    { t: abs(SIP_OFFSETS.overshoot), v: OVERSHOOT, ease: 'easeInOut', ti: RISE_TI }, // past the target, arriving from the side
    { t: abs(SIP_OFFSETS.peak), v: DRINK_OFFSET, ease: 'travelBalanced' }, // bounce back to true height
    // easeInOut again: hold and rest are both genuine stops, so this leg
    // needs a slow launch AND a slow landing — settleSoft's fast-out start
    // reads as an instant launch off the hold.
    { t: abs(SIP_OFFSETS.hold), v: DRINK_OFFSET, ease: 'easeInOut', to: FALL_TO }, // contented hold, then leaves sideways first
    { t: abs(SIP_OFFSETS.rest), v: [0, 0], ease: 'settleSoft', ti: FALL_TI }, // arcs back down to rest
  ]
}

const SIP_REAL_START = T + 70 // 160
const SIP_ECHO_START = SIP_REAL_START - IDLE // -20 — the previous cycle's tail

// Idle-from-frame-0: drop echoed points at negative t; an explicit t:0 rest
// anchors playback cleanly instead of snapping to the first surviving value.
const drinkPoints = [
  { t: 0, v: [0, 0], ease: 'entranceSharp' },
  ...sipRun(SIP_ECHO_START).filter((p) => p.t > 0),
  ...sipRun(SIP_REAL_START),
]

// Drag: the straw+umbrella's OWN local rotation, riding a drink-rig parent
// that already carries their translation at zero lag (they move exactly
// when the glass moves — no shifted copy). Rotation lags the glass's own
// beats by DRAG_LAG frames (inertia catching up), overshoots past center as
// the glass settles, then decays a beat after the glass itself is at rest.
const DRAG_LAG = 2
function dragRun(cycleStart) {
  const abs = (rel) => cycleStart + rel
  return [
    { t: abs(SIP_OFFSETS.riseStart), v: 0, ease: 'entranceSharp' },
    { t: abs(SIP_OFFSETS.overshoot) + DRAG_LAG, v: -6, ease: 'easeInOut' },
    { t: abs(SIP_OFFSETS.peak) + DRAG_LAG, v: 3, ease: 'easeInOut' },
    { t: abs(SIP_OFFSETS.hold) + DRAG_LAG + 4, v: -1, ease: 'easeInOut' },
    { t: abs(SIP_OFFSETS.rest) + DRAG_LAG + 6, v: 0, ease: 'settleSoft' },
  ]
}
const DRAG_SETTLE_END = SIP_OFFSETS.rest + DRAG_LAG + 6 // 80 — when the drag rotation fully resolves back to 0

const dragPoints = [
  { t: 0, v: 0, ease: 'entranceSharp' },
  ...dragRun(SIP_ECHO_START).filter((p) => p.t > 0),
  ...dragRun(SIP_REAL_START),
]

// Umbrella's own extra rock, a beat after the shared drag resolves —
// secondary motion riding secondary motion.
function rockRun(startAt) {
  return [
    { t: startAt, v: 0, ease: 'entranceSharp' },
    { t: startAt + 4, v: 2, ease: 'travelBalanced' },
    { t: startAt + 10, v: -1, ease: 'travelBalanced' },
    { t: startAt + 18, v: 0 },
  ]
}
const umbrellaRockPoints = [
  ...rockRun(SIP_ECHO_START + DRAG_SETTLE_END + 2),
  ...rockRun(SIP_REAL_START + DRAG_SETTLE_END + 2),
]

// THE WORLD RESPONDS #2a — the liquid sloshes when the glass moves: DERIVED
// from the SAME dragRun() generator that already drives straw/umbrella (not
// a hand-authored independent curve), reduced amplitude and a beat further
// lagged than them — the liquid is the innermost, softest reaction in the
// chain glass -> straw/umbrella -> liquid.
const LIQUID_GAIN = 0.45
const LIQUID_EXTRA_LAG = 3
function liquidRun(cycleStart) {
  return dragRun(cycleStart).map((p) => ({ ...p, t: p.t + LIQUID_EXTRA_LAG, v: p.v * LIQUID_GAIN }))
}
const liquidPoints = [
  { t: 0, v: 0, ease: 'entranceSharp' },
  ...liquidRun(SIP_ECHO_START).filter((p) => p.t > 0),
  ...liquidRun(SIP_REAL_START),
]

const drinkRigInd = pushLayer({
  nm: 'drink-rig',
  ty: 3,
  ks: {
    a: { a: 0, k: [0, 0, 0] },
    p: animProp(drinkPoints),
    r: { a: 0, k: 0 },
    s: { a: 0, k: [100, 100, 100] },
    o: { a: 0, k: 100 },
  },
})

// trailing-rig is parented DIRECTLY to drink-rig (not an independent null
// with duplicated keyframes) so straw+umbrella inherit the glass's exact
// translation with zero lag; its own anchor/position sit at a fixed pivot —
// the cluster's base (in-glass end, max-y), not its bbox center — so the
// only authored motion here (rotation) bends the free tip more than the
// root, the "drag" read. Anchor and position both at the pivot cancel to a
// net-zero base transform (r:0 stays pure translation-from-parent), same
// idiom as head-rig's contact-base pivot.
const trailingBbox = bboxOf([...parsePath(SVG_PATHS.straw), ...parsePath(SVG_PATHS.umbrella)])
const trailingPivot = [(trailingBbox[0] + trailingBbox[2]) / 2, trailingBbox[3]]
const trailingRigInd = pushLayer({
  nm: 'trailing-rig',
  ty: 3,
  ks: {
    a: { a: 0, k: [trailingPivot[0], trailingPivot[1], 0] },
    p: { a: 0, k: [trailingPivot[0], trailingPivot[1], 0] },
    r: animProp(dragPoints),
    s: { a: 0, k: [100, 100, 100] },
    o: { a: 0, k: 100 },
  },
  parent: drinkRigInd,
})

staticShapeLayer('glass', SVG_PATHS.glass, [fillItem('#FFFFFF'), strokeItem('#222222', 2.0532)], drinkRigInd)
{
  // drink-fill (the liquid): rides drink-rig's translation via parenting,
  // plus its own small slosh rotation (liquidPoints, above) pivoted at its
  // own center — "the world responds" #2a.
  const subs = parsePath(SVG_PATHS.drinkFill)
  const c = bboxCenter(bboxOf(subs))
  const items = subs.map((s, i) => shapeFromSubpath(s, `drink-fill-${i}`))
  const shapes = [group('drink-fill', [...items, fillItem('#222222'), strokeItem('#222222', 2.0532)])]
  const ks = baseTransform({ a: [c[0], c[1], 0], p: [c[0], c[1], 0] })
  ks.r = animProp(liquidPoints)
  pushLayer({ nm: 'drink-fill', shapes, ks, parent: drinkRigInd })
}
staticShapeLayer('glass-shine', SVG_PATHS.glassShine, [strokeItem('#222222', 2.0532, 100, 'Stroke', 2, 1)], drinkRigInd)
{
  const shapes = [group('paw', [
    { ty: 'el', nm: 'paw-el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [PAW.r * 2, PAW.r * 2] } },
    fillItem('#222222'),
  ])]
  const ks = baseTransform({ p: [PAW.cx, PAW.cy, 0] })
  pushLayer({ nm: 'paw', shapes, ks, parent: drinkRigInd })
}
staticShapeLayer('straw', SVG_PATHS.straw, [strokeItem('#222222', 2.0532, 100, 'Stroke', 1, 1)], trailingRigInd)
{
  // umbrella: rides trailing-rig's shared drag rotation, plus its own extra
  // own-center rock a beat later (character-rig's "own-center" idiom).
  const subs = parsePath(SVG_PATHS.umbrella)
  const c = bboxCenter(bboxOf(subs))
  const items = subs.map((s, i) => shapeFromSubpath(s, `umbrella-${i}`))
  const shapes = [group('umbrella', [...items, fillItem('#FFFFFF'), strokeItem('#222222', 2.0532, 100, 'Stroke', 2, 1)])]
  const ks = {
    a: { a: 0, k: [c[0], c[1], 0] },
    p: { a: 0, k: [c[0], c[1], 0] },
    s: { a: 0, k: [100, 100, 100] },
    r: animProp(umbrellaRockPoints),
    o: { a: 0, k: 100 },
  }
  pushLayer({ nm: 'umbrella', shapes, ks, parent: trailingRigInd })
}

// ============================================================
// Reorder to front-to-back paint order.
// ============================================================
const FRONT_TO_BACK = [
  'bubble-plate', 'bubble-text', 'bubble-anchor',
  'trail-large', 'trail-small',
  'umbrella', 'glass-shine', 'straw', 'drink-fill', 'glass',
  'sunglass-bridge', 'sunglass-shine-right-b', 'sunglass-shine-right-a',
  'glint__matte', 'glint', 'sunglass-lens-right',
  'sunglass-shine-left-b', 'sunglass-shine-left-a', 'sunglass-lens-left',
  'head-face', 'head-dark',
  'head-rig', 'drink-rig', 'trailing-rig',
  'chair-leg-front', 'chair-seat', 'chair-leg-back-c', 'chair-leg-back-b', 'chair-leg-back-a',
  'paw',
]
layers.sort((a, b) => FRONT_TO_BACK.indexOf(a.nm) - FRONT_TO_BACK.indexOf(b.nm))

const doc = {
  v: '5.9.0', fr: FPS, ip: 0, op: OP, w: W, h: H, nm: 'Live Onboarding Companion',
  ddd: 0,
  assets: [],
  layers,
  markers: [
    { cm: 'intro', tm: 0, dr: T },
    { cm: 'loop', tm: T, dr: OP - T },
  ],
  fonts: { list: [{ fName: 'Nunito-Bold', fFamily: 'Nunito', fStyle: 'Bold', ascent: 75 }] },
  slots: {
    'bubble.text': { p: { k: [{ s: textDoc(DEFAULT_STRING), t: 0 }] } },
    'bubble.size': { p: { a: 0, k: [PLATE_DEFAULT_W, PLATE_DEFAULT_H] } },
  },
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT, JSON.stringify(doc))
const totalKeyframes = layers.reduce((sum, l) => {
  let n = 0
  for (const prop of ['p', 'r', 's', 'o']) {
    const v = l.ks && l.ks[prop]
    if (v && v.a === 1) n += v.k.length
  }
  return sum + n
}, 0)
console.log(`Wrote ${OUT} — ${layers.length} layers, ${totalKeyframes} animated keyframes, ${OP}f @ ${FPS}fps (intro ${T}f / loop ${OP - T}f)`)

copyFileSync(join(__dirname, '../assets/fonts/Nunito.ttf'), join(OUT_DIR, 'Nunito.ttf'))
copyFileSync(join(__dirname, '../assets/fonts/Nunito-Bold.ttf'), join(OUT_DIR, 'Nunito-Bold.ttf'))
console.log(`Copied Nunito.ttf + Nunito-Bold.ttf into ${OUT_DIR}`)

// max is REQUIRED (recipe-companion-bubble.md #3): max[0] is the widest
// plate that clears both stage edges by >=16px given the plate's recentered
// x-position (120): 240/2 - 16 = 104 half-width each side -> 208. max[1]=73
// is 3 lines (2 x 19 line-height + 1 x 19 baseline row... i.e. 3*19 + 2*8
// padY = 73), the tallest the layout has real vertical headroom for (see
// PLATE_CENTER_Y's derivation above and the stage-safety render check).
const AUTOFIT_MAX = [208, 73]

const controls = {
  controls: [
    { sid: 'bubble.text', label: 'Bubble text' },
    { sid: 'bubble.size', label: 'Bubble size', autoFit: { text: 'bubble.text', padding: [16, 8], min: [90, 35], max: AUTOFIT_MAX } },
  ],
  layerControls: [
    { target: 'head-rig', kind: 'amount', property: 'position', label: 'Recline depth', description: 'How deeply the mascot sinks back into the chair each breath.' },
    { target: 'drink-rig', kind: 'amount', property: 'position', label: 'Sip lift', description: 'How far the drink rises toward the mascot each cycle.' },
    { target: 'bubble-anchor', kind: 'amount', property: 'scale', label: 'Bubble pop', description: 'How much the speech bubble overshoots as it arrives.' },
  ],
}
writeFileSync(join(OUT_DIR, 'controls.json'), JSON.stringify(controls, null, 2))
console.log(`Wrote ${join(OUT_DIR, 'controls.json')}`)
