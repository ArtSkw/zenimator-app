#!/usr/bin/env node
/**
 * Generates the INTRO+LOOP Lottie for "live-onboarding-companion-mqmh.svg" —
 * a live onboarding companion: the mascot lounges in a deck chair, sunglasses
 * on, drink in paw, while a speech bubble above it says its line once, over an
 * idle that is ALREADY RUNNING when the scene starts.
 * Source SVG is pixel-identical to live-onboarding-companion-ire9.svg (same
 * rig, same brief, different project slug) — ported wholesale from
 * scripts/build-live-onboarding-companion-ire9.mjs (the reference build after
 * its velocity-audit fix); see docs/live-onboarding-companion-ire9-animation.md
 * for the full rig writeup and the mood retune / smoothness fix / velocity
 * audit before/after.
 * Output: public/projects/live-onboarding-companion-mqmh/scene-1/lottie.json
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
 * v7 MOOD RETUNE (motion-taste.md "Mood governs the system"): a vertical
 * position bob on a lounging character reads as squats/sit-ups regardless of
 * easing. "head-rig" no longer translates at all (position is static, a==p,
 * "no net translation at rest") — its PRIMARY motion is now a slow hammock
 * SWAY (rotation only, about the seat-contact pivot, a couple of degrees,
 * one full back-and-forth per 3s loop). BREATHE moved entirely into the
 * silhouette morph (below) — softened and slowed to a single cycle per
 * loop, no more rig-level scale. "chair-seat" is DERIVED from BOTH breathe
 * (squash+bulge, unchanged mechanism) AND the new sway (a small extra flex
 * at each sway extreme); the leg struts stay a true steady island
 * (unparented, unanimated). Trail circles gained their own small "gentle
 * float" (see CLOCK_FLOAT near T/IDLE/OP) — the one deliberate exception to
 * "one-shot elements hold perfectly still," per this pass's mood brief.
 * "drink-rig"/"trailing-rig" keep the v3 sip arc + anticipation + overshoot
 * verbatim — the loop's one remaining snappy accent. "glint" keeps its own
 * tiled GLINT clock (3x/loop), phased clear of the sway/breathe/sip peaks.
 *
 * v8 SMOOTHNESS FIX (motion-taste.md "Bake smooth, not stepped — and keep a
 * calm spectrum clean", written from measuring THIS scene): the sway used to
 * be summed with a DETAIL clock (5x its frequency) riding it, which beat —
 * plateaued and briefly reversed direction near rest and near the sway's own
 * apexes, reading as a robotic/elderly stop-start. DETAIL is gone; rotation
 * is now swayEnvelope ALONE, one clean sine, verified reversal-free except
 * at the two true apexes. Every dense-sampled track (rotation, silhouette
 * morphs, chair-seat squash, straw flex, trail float) also moved from a 6f
 * to a 2f sampling step — a slow curve baked as 6f-linear segments is a
 * visible polyline (velocity jumps every sample); 2f is fine-grained enough
 * to be indistinguishable from the true curve at 60fps.
 * See docs/live-onboarding-companion-ire9-animation.md for the mood retune
 * and smoothness fix's full before/after and verification.
 */
import { writeFileSync, mkdirSync, copyFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../public/projects/live-onboarding-companion-mqmh/scene-1')
const OUT = join(OUT_DIR, 'lottie.json')

const W = 240, H = 240, FPS = 60
const T = 90          // 1.5s intro — "nothing here is in a rush"
const IDLE = 180       // 3.0s idle — "longest, laziest period of the set"
const OP = T + IDLE     // 270 total

// Trail-circle gentle float (mood retune) — declared early so the trail
// section below (which runs before the main clock table further down) can
// use it. A small, slow, boundary-matched Y bob, distinct from the one-shot
// entrance pop: since the envelope is a pure function of t % CLOCK_FLOAT and
// both T=90 and op=270 reduce to the same phase (90 mod 90 = 0, 270 mod 90 =
// 0), the seam holds by construction exactly like every other living-idle
// track here.
const CLOCK_FLOAT = 90 // 2 cycles/loop
const FLOAT_AMOUNT = 2 // px, "gentle" — well under the primary-motion floor, appropriate for a tertiary detail
// Velocity-audit fix: was a 2-point `evalTrack` chain with `travelBalanced`
// easing (the same singularity documented elsewhere in this file) — fixed
// with `waypointCurve`'s smootherstep chain (defined further below, hoisted)
// instead, true stop-to-stop waypoints at rest(0)/peak(45)/rest(90).
const FLOAT_WAYPOINTS = [
  { t: 0, v: 0 },
  { t: 45, v: 1 },
  { t: 90, v: 0 },
]
const floatEnvelope = (t) => waypointCurve(((t % CLOCK_FLOAT) + CLOCK_FLOAT) % CLOCK_FLOAT, FLOAT_WAYPOINTS)

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

// ── Raw path data lifted from live-onboarding-companion-eh0n.svg (viewBox 0 0 240 240) ──
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
// tileCycle, combined with this file's own echo technique) ─────────────────
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

// motion-taste.md "Living idles — key exactly on the loop boundaries": every
// animated track needs an EXPLICIT keyframe AT T and AT op with EQUAL
// values, never merely a segment that spans across them — a spanning
// segment (echo's tail before T, the next real cycle's first point after
// T, nothing keyed exactly on T) makes the value AT T an interpolation that
// only matches the value AT op by coincidence, a leak invisible to
// endpoint/keyframe-value checks and to eyeballs, caught only by
// pixel-diffing rendered frames T and op. Inserts a `restValue` keyframe at
// whichever boundary doesn't already have an explicit key (no-op at a
// boundary that does) — safe to call even where a span already happens to
// be value-flat (the common case here), since it turns that flatness from
// an incidental fact into a guaranteed one, robust against a future edit to
// amplitude/timing quietly breaking the coincidence.
function keyOnBoundaries(points, restValue) {
  const out = [...points]
  if (!out.some((p) => p.t === T)) out.push({ t: T, v: restValue, ease: 'linear' })
  if (!out.some((p) => p.t === OP)) out.push({ t: OP, v: restValue })
  out.sort((a, b) => a.t - b.t)
  return out
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

// ── SILHOUETTE MORPHS (motion-taste.md "Living idles — the silhouette
// breathes — morphs, not just transforms") — a shape layer whose path track
// is ANIMATED (`ks:{a:1,k:[...]}`, same vertex count/order on every key)
// rather than static. `animProp` already handles this: `kf()`'s `s` field is
// `Array.isArray(value)?value:[value]`, and a Lottie shape VALUE is a plain
// (non-array) `{c,v,i,o}` object, so passing shape objects as `points[].v`
// produces exactly the `{t,s:[{c,v,i,o}],o,i}` keyframe shape Lottie expects
// — no separate shape-specific keyframe builder needed.
function animatedShapeLayer(nm, shapePoints, paintItems, parent) {
  const shapeItem = { ty: 'sh', nm: `${nm}-path`, ks: animProp(shapePoints) }
  const shapes = [group(nm, [shapeItem, ...paintItems])]
  pushLayer({ nm, shapes, ks: baseTransform(), parent })
}

// Squash/bulge a subpath's vertices (and their relative in/out handles) by
// scaling `scaleAlong` along `axisUnit` and 1/scaleAlong perpendicular to it,
// about `pivot` — an anisotropic scale about a point, which is an affine map
// and therefore exact on bezier curves (no per-segment approximation), and
// area-conserving BY CONSTRUCTION since scaleAlong * (1/scaleAlong) = 1
// exactly (well inside the rule's ±2% tolerance). Vertices further from
// `pivot` move more than vertices near it — "bulge proportional to distance
// from" the planted edge — for free, since linear scaling about a point is
// already proportional to distance from that point. Using the SAME pivot
// (headPivot, the contact-base point head-rig already pivots on) and the
// SAME axis (axisUnit, the chair's own recline direction) keeps the morph
// geometrically coherent with the existing rigid recline motion instead of
// squashing along an arbitrary/unrelated axis.
function squashSubpath(sp, pivot, axisUnit, scaleAlong) {
  const perpUnit = [-axisUnit[1], axisUnit[0]]
  const scalePerp = 1 / scaleAlong
  const xformPoint = ([x, y]) => {
    const dx = x - pivot[0], dy = y - pivot[1]
    const along = dx * axisUnit[0] + dy * axisUnit[1]
    const across = dx * perpUnit[0] + dy * perpUnit[1]
    const na = along * scaleAlong, nc = across * scalePerp
    return [pivot[0] + na * axisUnit[0] + nc * perpUnit[0], pivot[1] + na * axisUnit[1] + nc * perpUnit[1]]
  }
  const xformDelta = ([dx, dy]) => {
    const along = dx * axisUnit[0] + dy * axisUnit[1]
    const across = dx * perpUnit[0] + dy * perpUnit[1]
    const na = along * scaleAlong, nc = across * scalePerp
    return [na * axisUnit[0] + nc * perpUnit[0], na * axisUnit[1] + nc * perpUnit[1]]
  }
  return {
    c: sp.closed,
    v: sp.v.map(xformPoint),
    i: sp.i.map(xformDelta),
    o: sp.o.map(xformDelta),
  }
}

// ============================================================
// BUBBLE — plate (slotted size) + native text, one entrance unit
//
// Stage safety (motion-taste.md "Render-Aware Motion"): the plate must clear
// BOTH stage edges by the rule's own "~3% of the min dimension" margin at
// bubble.size's autoFit `max`, not just the default — that's 3% of THIS
// 240x240 stage's 240px min dimension = 7.2px, not the "~16px at 512"
// example value a prior pass copied verbatim (16px is what 3% comes out to
// at a 512 composition; applied literally to a 240 stage it overstates the
// real margin by more than 2x). Stage is 240x240; recentered to the true
// stage-center X=120 (was 102, which left only 86px of half-width before the
// LEFT edge violated the margin) so max[0] is symmetric and maximal.
//
// Vertical position is source-derived, not stage-safety-derived: restoring
// the SVG's authored plate-to-trail and trail-to-trail gaps (see TRAIL below)
// pins centerY at 44.5 (top=27, bottom=62 at rest). Checked against the
// corrected 7.2px margin at bubble.size's autoFit max (73, 3 lines):
// top-at-max = 44.5 - 73/2 = 8.0 (clears 7.2 with a 0.8px buffer); the old
// centerY=54 was pushed low specifically to satisfy the mis-scaled 16px
// figure and had nothing to do with clearing the head or the trail — that's
// what compressed the plate-to-trail gap to ~0 in the first place.
// ============================================================
const PLATE_DEFAULT_W = 176, PLATE_DEFAULT_H = 35, PLATE_R = 17.5
const PLATE_CX = 120
const PLATE_CENTER_Y = 44.5
const PLATE_TOP = PLATE_CENTER_Y - PLATE_DEFAULT_H / 2   // 27
const PLATE_BOTTOM = PLATE_CENTER_Y + PLATE_DEFAULT_H / 2 // 62

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
    s: animProp(keyOnBoundaries(BUBBLE_POP.map((p) => ({ ...p, v: [p.v, p.v, 100] })), [100, 100, 100])),
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
  ks.o = animProp(keyOnBoundaries(BUBBLE_OPACITY, 100))
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
  const ks = baseTransform({ a: [0, 0, 0] })
  // .textPos slot (recipe-companion-bubble.md #3): text-doc `ls` (baseline
  // shift) is silently ignored by Skottie, so multi-line vertical centering
  // has no other working mechanism — tools rebind this slot's y by
  // -(lines-1)*lh/2 when they wrap the string, while the default (this
  // single-line calibrated value) renders identically to before. `internal:
  // true` in controls.json keeps it out of any text-editing UI.
  ks.p = { a: 0, k: [0, BASELINE_LOCAL, 0], sid: 'bubble.textPos' }
  ks.s = animProp(keyOnBoundaries(BUBBLE_POP.map((p) => ({ ...p, v: [p.v, p.v, 100] })), [100, 100, 100]))
  ks.o = animProp(keyOnBoundaries(BUBBLE_OPACITY, 100))
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
//
// Source geometry is LAW for rest placement (assets/live-onboarding-
// companion-ire9.svg): plate rect x=14 y=14 w=176 h=35 (bottom edge y=49);
// Ellipse 2420 (trail-large) cx=102 cy=66 r=8 (top edge y=58) — an authored
// GAP of exactly 9px between the plate bottom and the large trail circle;
// Ellipse 2421 (trail-small) cx=114 cy=84 r=4 (top edge y=80, bottom-of-
// trail-large=74) — a second authored gap of 6px. X offsets from the
// plate's own center (source cx=102) are already reproduced by the existing
// trail-circle x's (120 = same as plate center, 132 = +12) — only the two Y
// gaps had been compressed (to ~0px and ~-1px respectively — touching/
// overlapping) by the earlier stage-safety pass that pushed the plate's
// centerY down to 54 without moving the trail circles to match. Restored
// here by pinning PLATE_CENTER_Y (see BUBBLE section above) so that, with
// trail-large left at its existing y=79, the plate-to-trail-large gap comes
// out to exactly 9px — the gap this pass verifies. Reproducing the SECOND
// gap (trail-large-to-trail-small, 6px) exactly is not geometrically
// possible here: the full source span (gap1 9 + trail-large diam 16 + gap2
// 6 + trail-small diam 8 = 39px) needs more headroom than exists between a
// margin-safe plate position and the head (~37.4px at best, independent of
// how the group is arranged — see the corrected-margin math in the BUBBLE
// section). Rendering with the exact 6px gap2 confirmed the conflict
// visibly: trail-small's dark stroke landed ON the head's dark fill and
// disappeared. Trail-small is placed at y=92.5 instead — gap2 compressed to
// 1.5px — which keeps a clean 2.1px clearance from the head and a visibly
// distinct (if tighter-than-source) trail-to-trail gap.
// ============================================================
// floatPhase offsets trail-small vs trail-large into the SAME CLOCK_FLOAT
// cycle so they bob out of lockstep (motion-taste: "different details should
// peak at DIFFERENT beats") — mood retune's "trail circles: gentle float
// only". The float is a dense-sampled continuous track spanning [0, OP], the
// same idiom as every other living-idle property in this file: it's inert
// (invisible) before the circle's own entrance settle since scale/opacity
// are still 0 then, and its boundary values at T/op match by construction
// (CLOCK_FLOAT=90 divides both T=90 and op=270 exactly).
function trailCircle(nm, cx, cy, r, points, floatPhase = 0) {
  const shapes = [group(nm, [
    { ty: 'el', nm: `${nm}-el`, p: { a: 0, k: [0, 0] }, s: { a: 0, k: [r * 2, r * 2] } },
    strokeItem('#222222', 1.5),
  ])]
  const posPoints = []
  for (let t = 0; t <= OP; t += 2) posPoints.push({ t, v: [cx, cy - FLOAT_AMOUNT * floatEnvelope(t + floatPhase), 0], ease: 'linear' })
  if (posPoints[posPoints.length - 1].t !== OP) posPoints.push({ t: OP, v: [cx, cy - FLOAT_AMOUNT * floatEnvelope(OP + floatPhase), 0] })
  const ks = baseTransform({ p: [cx, cy, 0] })
  ks.p = animProp(posPoints)
  ks.s = animProp(keyOnBoundaries(points.map((p) => ({ ...p, v: [p.v, p.v, 100] })), [100, 100, 100]))
  ks.o = animProp(keyOnBoundaries(points.map((p) => ({ t: p.t, v: p.v > 0 ? 100 : 0, ease: p.ease })), 100))
  pushLayer({ nm, shapes, ks })
}
trailCircle('trail-small', 132, 92.5, 4, [{ t: 0, v: 0, ease: 'entranceSharp' }, { t: 10, v: 112, ease: 'settleSoft' }, { t: 20, v: 100 }], 20)
trailCircle('trail-large', 120, 79, 8, [{ t: 8, v: 0, ease: 'entranceSharp' }, { t: 20, v: 114, ease: 'settleSoft' }, { t: 32, v: 100 }], 0)

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
// LIVING IDLE CLOCKS — mood retune (motion-taste.md "Mood governs the
// system"): a vertical body bob on a deck-chair lounger reads as squats, a
// gym verb on a scene that's supposed to be pure vacation stillness. The
// PRIMARY motion is now a slow hammock SWAY (rotation only, about the seat
// contact point) instead of a position bob; BREATHE moves to the silhouette
// morph alone, softened and slowed. Periods: SWAY/BREATHE/SIP share IDLE=180
// (1 cycle/loop each — the "whole loop" option, the only period that both
// clears the 4-6s calm-mood target as closely as this contract's fixed
// IDLE allows AND keeps the boundary-key math exact); GLINT/DETAIL/FLOAT
// keep shorter, non-unison-phased periods so nothing lands on the same beat.
// ============================================================
const CLOCK_SWAY = IDLE    // primary hammock sway (rotation only) — 1 cycle/loop, ~3s
const CLOCK_BREATHE = IDLE // silhouette breath morph — 1 cycle/loop (was 90/2-per-loop; slowed)
const CLOCK_GLINT = 60     // sunglass glint sweep — 3 cycles/loop
const CLOCK_SIP = IDLE     // almost-sip gesture — 1 cycle/loop (unchanged v3 mechanism)
// CLOCK_FLOAT (trail-circle gentle float, 90f/2-per-loop) is declared near
// T/IDLE/OP above since the trail section runs before this comment block.
// (No more CLOCK_DETAIL: the old secondary micro-wobble summed into rotation
// is gone — see the smoothness-fix note above head-rig's rotation build.)

// ============================================================
// HEAD + SUNGLASSES rig — mood retune: PRIMARY is now a slow hammock SWAY
// (rotation only, about the seat-contact pivot) instead of a position bob —
// a vertical body oscillation on a lounging character reads as squats/sit-ups
// regardless of easing (motion-taste.md "Mood governs the system"). Position
// is now STATIC (anchor == position, intentionally: "no net translation at
// rest" per player-contract.md) so the body's y stays at 0px, well inside
// the ~1-2px ceiling. Breathe moves entirely into the silhouette morph
// below — no rigid rig-level scale anymore, so "chest expand" reads as a
// true shape deformation, not a puffing-up of the whole head+sunglasses rig.
//
// SMOOTHNESS FIX (motion-taste.md "Bake smooth, not stepped — and keep a
// calm spectrum clean", written from measuring this exact scene): rotation
// used to be SWAY_ROT_DEG*sway + DETAIL_ROT_DEG*detail, summed from two
// clocks 5x apart in frequency (180f vs 36f). Measured dense samples showed
// the composite plateauing and briefly REVERSING direction near rest and
// near the sway's own apexes — detail's higher-frequency wobble (even at a
// nominally "secondary" 40%-of-primary amplitude) interferes with the
// primary sway across most of the cycle, because with a 5:1 frequency ratio
// there's no single phase alignment that keeps detail's own peaks/troughs
// away from every point where sway's slope is small (near rest AND near its
// apexes). That interference IS the "stop-start"/robotic read. Fix: rotation
// is now driven by swayEnvelope ALONE — ONE clean low-frequency sine, no
// secondary summed in. Verified by scanning the dense-sampled track for
// direction reversals at 1-frame resolution: with sway alone, the ONLY two
// reversals in the whole 180f cycle are the two true apexes themselves (one
// frame past each peak, which motion-taste explicitly allows) — zero
// reversals anywhere else, i.e. the swell/shrink is monotonic between
// apexes as required. The old DETAIL clock/points/envelope are removed
// entirely since rotation was their only consumer.
// ============================================================
const headBbox = bboxOf(parsePath(SVG_PATHS.headDark))
const headPivot = [(headBbox[0] + headBbox[2]) / 2, headBbox[3]] // bottom-center — contact base with the chair

// Tilt axis derived from the long crossing leg (legBackC): the chair's own
// recline direction, not a guessed vertical. Still used by the silhouette
// morph below (squash/bulge axis) even though the rig no longer translates
// along it.
const AXIS_FROM = [151.553, 105.344], AXIS_TO = [85.1728, 225.999]
const axisDx = AXIS_TO[0] - AXIS_FROM[0], axisDy = AXIS_TO[1] - AXIS_FROM[1]
const axisMag = Math.hypot(axisDx, axisDy)
const axisUnit = [axisDx / axisMag, axisDy / axisMag]
const SWAY_ROT_DEG = 2      // "a couple of degrees" — hammock sway, the ONLY rotation signal now

// Sway envelope: a full bidirectional cycle (rest -> +peak -> rest -> -peak
// -> rest) across ONE 180f/3s loop — "whole loop" period, hammock-like: a
// real pendulum swings fastest through center and slows to a genuine stop at
// each extreme, which is exactly a sine's own velocity profile (cos, max at
// the zero-crossing, zero at the peak) — so this is a direct trig function,
// not a cubic-bezier keyframe chain. That choice is deliberate, found while
// fixing the smoothness bug this file's v8 header documents: a 4-point
// travelBalanced-eased approximation of this same shape (rest->peak->rest->
// -peak->rest, one segment per quarter) turned out to have its OWN hidden
// defect — travelBalanced's control points (1.00,.49,.00,.55) give it a
// provably infinite d(value)/d(time) at each segment's exact temporal
// midpoint (bx'(0.5)=0 while by'(0.5)!=0 — confirmed by hand-deriving the
// bezier's component derivatives), which bakes a genuine, non-artifactual
// velocity SPIKE into the middle of every segment — measured as a 4-9x
// jump in per-frame delta versus its neighbors when dense-sampled. That
// spike is a real property of the curve, not a sampling error, so no amount
// of finer sampling fixes it; only a different curve does. A true sine has
// no such singularity anywhere, so it's both simpler and provably correct.
const swayEnvelope = (t) => -Math.sin((2 * Math.PI * (t - T)) / CLOCK_SWAY)

// Breathe envelope: 0 at rest, 1 at peak, local to ONE 180f/3s cycle (slowed
// from the old 90f/2-per-loop) — every consumer (silhouette morph, chair-seat
// squash) scales this SAME normalized track by its own (now softer)
// amplitude, rather than hand-authoring independent curves per property.
//
// Velocity-audit fix: this used to be a 2-point `evalTrack` chain with
// `travelBalanced` easing — the SAME curve documented above (and in
// motion-taste.md) as having a provable mid-segment velocity singularity,
// present at ANY segment length. Auditing it alone (dense 1-frame samples,
// max / median-while-moving) measured a 16.7x spike — this drives the
// silhouette morphs and chair-seat squash below, so that spike would have
// shipped as a hidden lurch in BOTH. Fixed the same way as the drink
// gesture: `waypointCurve`'s smootherstep chain (defined further below,
// hoisted) — true stop-to-stop waypoints at rest(0)/peak(76)/rest(180), no
// bezier time-remapping, so the singularity is structurally impossible.
const BREATHE_WAYPOINTS = [
  { t: 0, v: 0 },
  { t: 76, v: 1 },
  { t: 180, v: 0 },
]
const breatheEnvelope = (t) => waypointCurve(((t % CLOCK_BREATHE) + CLOCK_BREATHE) % CLOCK_BREATHE, BREATHE_WAYPOINTS)

// HEAD_SAMPLE_STEP: 2f (was 6f) — smoothness fix's SAMPLING half. A slow
// sine baked as linear segments every 6 frames is a visible polyline
// (velocity jumps at every sample, reads as robotic); 2f is the coarsest
// step motion-taste.md's rule calls "indistinguishable from the curve at
// 60fps," so every dense-sampled track below (rotation, silhouette morphs,
// chair-seat squash, straw flex) now uses this finer cadence.
const HEAD_SAMPLE_STEP = 2
const headRotPoints = []
for (let t = 0; t <= OP; t += HEAD_SAMPLE_STEP) {
  headRotPoints.push({ t, v: SWAY_ROT_DEG * swayEnvelope(t), ease: 'linear' })
}
if (headRotPoints[headRotPoints.length - 1].t !== OP) {
  headRotPoints.push({ t: OP, v: SWAY_ROT_DEG * swayEnvelope(OP) })
}

const headRigInd = pushLayer({
  nm: 'head-rig',
  ty: 3,
  ks: {
    a: { a: 0, k: [headPivot[0], headPivot[1], 0] },
    p: { a: 0, k: [headPivot[0], headPivot[1], 0] }, // a == p intentionally: no net translation at rest
    r: animProp(headRotPoints),
    s: { a: 0, k: [100, 100, 100] },
    o: { a: 0, k: 100 },
  },
})

// THE SILHOUETTE BREATHES — mood retune: breath now lives ENTIRELY here (the
// rig's old rigid scale-up is gone), softened and slowed to match the calm
// register. Body squashes wide-and-low into the down-beat (breathe=1,
// "sinking deeper") and draws tall-and-narrow at the top (breathe=0, rest),
// anchored at headPivot (the SAME contact-base point head-rig's rotation
// pivots on — "the planted edge stays planted, the top does the travel")
// along axisUnit (the chair's own recline axis, still used as the morph's
// axis even though the rig no longer translates along it), so the deform
// reads as one coherent motion with the sway rather than a second, unrelated
// wobble. Face patch gets the IDENTICAL deform (same pivot/axis/scale-at-t)
// so it rides the deforming mass rather than sliding over it as a rigid
// overlay. Driven by breatheEnvelope alone (the "breath" clock) per the
// rule's own "Body path: breath deformation" naming. Dense-sampled every
// HEAD_SAMPLE_STEP (2f, the smoothness fix's cadence) like every other
// living-idle track; t=0..OP in steps of 2 lands exactly on T=90 and op=270
// (both even), and breatheEnvelope is an exact-period function (t%180), so
// the value AT T and AT op is the SAME function call on the SAME reduced
// phase (90) — no separate keyOnBoundaries needed, the seam is exact by
// construction (verified by pixel diff, see docs).
const BODY_SQUASH = 0.035 // 3.5% at peak (was 4.5%, softened) — scalePerp = 1/scaleAlong conserves area exactly
const headDarkBase = parsePath(SVG_PATHS.headDark)[0]
const headFaceBase = parsePath(SVG_PATHS.headFace)[0]
function bodyShapeAt(baseSp, t) {
  const scaleAlong = 1 - BODY_SQUASH * breatheEnvelope(t)
  return squashSubpath(baseSp, headPivot, axisUnit, scaleAlong)
}
function denseShapeTrack(baseSp) {
  const pts = []
  for (let t = 0; t <= OP; t += HEAD_SAMPLE_STEP) pts.push({ t, v: bodyShapeAt(baseSp, t), ease: 'linear' })
  if (pts[pts.length - 1].t !== OP) pts.push({ t: OP, v: bodyShapeAt(baseSp, OP) })
  return pts
}
animatedShapeLayer('head-dark', denseShapeTrack(headDarkBase), [fillItem('#222222')], headRigInd)
animatedShapeLayer('head-face', denseShapeTrack(headFaceBase), [fillItem('#FFFFFF')], headRigInd)
staticShapeLayer('sunglass-lens-left', SVG_PATHS.lensLeft, [fillItem('#222222')], headRigInd)
staticShapeLayer('sunglass-shine-left-a', SVG_PATHS.shineLeftA, [strokeItem('#FFFFFF', 2.0532, 100, 'Stroke', 2, 1)], headRigInd)
staticShapeLayer('sunglass-shine-left-b', SVG_PATHS.shineLeftB, [strokeItem('#FFFFFF', 2.0532, 100, 'Stroke', 2, 1)], headRigInd)
staticShapeLayer('sunglass-lens-right', SVG_PATHS.lensRight, [fillItem('#222222')], headRigInd)
staticShapeLayer('sunglass-shine-right-a', SVG_PATHS.shineRightA, [strokeItem('#FFFFFF', 2.0532, 100, 'Stroke', 2, 1)], headRigInd)
staticShapeLayer('sunglass-shine-right-b', SVG_PATHS.shineRightB, [strokeItem('#FFFFFF', 2.0532, 100, 'Stroke', 2, 1)], headRigInd)
staticShapeLayer('sunglass-bridge', SVG_PATHS.bridge, [strokeItem('#222222', 2.0532, 100, 'Stroke', 2, 1)], headRigInd)

// ── THE WORLD RESPONDS #1 — chair-seat flexes in response to BOTH living
// signals now: the breathe envelope (zero lag: a direct reaction to weight,
// unchanged mechanism, now softer since breatheEnvelope itself softened) AND
// the new primary sway (a small extra X bulge scaled by |sway|, since a
// hammock-style seat gives a little as weight rocks side to side — this is
// the "chair flexing subtly in response" the mood retune asks for on the
// sway specifically). Pivoted at the seat's own top-center (the mascot's
// contact point) so it reads as sinking, not shrinking evenly.
// ============================================================
{
  const seatBbox = bboxOf(parsePath(SVG_PATHS.chairSeat))
  const seatPivot = [(seatBbox[0] + seatBbox[2]) / 2, seatBbox[1]]
  const SEAT_SQUASH_PCT = 2      // Y-scale reduction at peak compression (softened from 3)
  const SEAT_BULGE_PCT = 0.7     // X-scale bulge from breathe, conservation-of-volume feel (softened from 1)
  const SEAT_SWAY_BULGE_PCT = 0.6 // extra X-scale give from the hammock sway, peaks at both sway extremes
  const seatScalePoints = []
  for (let t = 0; t <= OP; t += HEAD_SAMPLE_STEP) {
    const breathe = breatheEnvelope(t)
    const swayFlex = Math.abs(swayEnvelope(t))
    seatScalePoints.push({ t, v: [100 + SEAT_BULGE_PCT * breathe + SEAT_SWAY_BULGE_PCT * swayFlex, 100 - SEAT_SQUASH_PCT * breathe, 100], ease: 'linear' })
  }
  if (seatScalePoints[seatScalePoints.length - 1].t !== OP) {
    const breathe = breatheEnvelope(OP)
    const swayFlex = Math.abs(swayEnvelope(OP))
    seatScalePoints.push({ t: OP, v: [100 + SEAT_BULGE_PCT * breathe + SEAT_SWAY_BULGE_PCT * swayFlex, 100 - SEAT_SQUASH_PCT * breathe, 100] })
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
  //  3. That fix still left the ECHO side merely APPROACHING T rather than
  //     KEYING on it (motion-taste.md's newer "key exactly on the loop
  //     boundaries" rule) — livingTrack's tiled/real side already keys
  //     exactly on `op` (its own closing bookend), but the echo's last
  //     point can land anywhere in [0, T), never necessarily AT T itself.
  //     keyOnBoundaries() closes that gap explicitly; applied BEFORE the
  //     hold-mapping below so a newly-inserted T-point (value = restPos)
  //     gets marked held too, same as every other rightPos-valued point.
  const restPos = [rightPos[0], rightPos[1], 0]
  const glintPosPoints = keyOnBoundaries(
    livingTrack(GLINT_POS_LOCAL.map((p) => ({ ...p, v: [p.v[0], p.v[1], 0] })), CLOCK_GLINT, restPos),
    restPos,
  ).map((p) => (p.v[0] === restPos[0] && p.v[1] === restPos[1]) ? { ...p, hold: true } : p)
  const glintOpPoints = keyOnBoundaries(livingTrack(GLINT_OP_LOCAL, CLOCK_GLINT, 0), 0)

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
// in an ARC, bracketed by a small anticipation dip before the rise and a
// springy overshoot-then-settle past the top. Straw + umbrella are DRAG, not
// a time-shifted copy: they're parented directly to drink-rig so their base
// travels with the glass at zero lag, and carry only their OWN local
// rotation. The umbrella gets one more small extra rock a beat after that.
// drink-fill (the liquid) gets its own small drag-derived slosh.
//
// SMOOTHNESS FIX (motion-taste.md "The velocity audit — run it on EVERY hero
// track, not just the cycles", written from measuring THIS scene): this
// gesture used to be sparse pose-to-pose Lottie keyframes stitched from
// SEVEN different named easing anchors per cycle (including travel-balanced
// — the very curve documented elsewhere in this file as having a provable
// mid-segment velocity singularity) plus a raw linear boundary segment from
// keyOnBoundaries. Dense-sampling that track at 1-frame steps measured a
// 10.8x speed spike (median-while-moving 0.342 px/f, max 3.682 px/f) — the
// hand visibly lurched then crawled. Same defect on umbrella's rock and
// drink-fill's slosh (travel-balanced again, plus more sparse mixed keys).
//
// Fix: every track below is now driven by `waypointCurve` — a handful of
// TRUE stop-to-stop waypoints (zero velocity at each one, via smootherstep:
// 6t^5-15t^4+10t^3, whose own first AND second derivative are zero at its
// ends) instead of named per-segment Lottie eases. There is no bezier
// time-remapping step at all — `t` drives the shape directly — so the
// travel-balanced-style singularity is structurally impossible here. The
// rise and return legs still ARC (not a straight chord) via an optional
// perpendicular Hann-shaped bow on the relevant segment (zero slope at both
// of ITS ends too, so it never reintroduces a velocity mismatch at the
// waypoint it bows away from). Every envelope is authored TWICE per cycle,
// same as before: an "echo" occurrence (the tail of the previous, notional
// cycle, filling [0, T) so the drink is already alive under the entrance)
// and the "real" occurrence inside [T, op] — concatenated into one sorted
// waypoint list per track and evaluated continuously, then dense-sampled at
// HEAD_SAMPLE_STEP (2f) into Lottie keyframes with plain linear connectors
// (exactly the sway fix's technique) — no keyOnBoundaries needed, since the
// flat regions before/after each occurrence already evaluate to the SAME
// rest value at both T and op by construction, and T/op are themselves
// explicit sample points (both multiples of the 2f step).
// ============================================================
function smootherstep(u) {
  const c = Math.max(0, Math.min(1, u))
  return c * c * c * (c * (c * 6 - 15) + 10)
}
// Hann-shaped bump: 0 at u=0/1, peak at u=0.5, ZERO derivative at both ends
// (like smootherstep) — adding it to a segment never reintroduces a
// velocity mismatch at the waypoint it bows away from.
function hannBow(u) {
  const c = Math.max(0, Math.min(1, u))
  return (1 - Math.cos(2 * Math.PI * c)) / 2
}
// waypoints: [{t, v (number or [x,y]), bowNext?}], sorted by t, flat before
// the first and after the last. `bowNext` on a waypoint perpendicular-bows
// the segment STARTING there (vector waypoints only).
function waypointCurve(t, waypoints) {
  if (t <= waypoints[0].t) return waypoints[0].v
  const last = waypoints[waypoints.length - 1]
  if (t >= last.t) return last.v
  let seg = waypoints.length - 2
  for (let k = 0; k < waypoints.length - 1; k++) { if (t >= waypoints[k].t && t <= waypoints[k + 1].t) { seg = k; break } }
  const a = waypoints[seg], b = waypoints[seg + 1]
  const u = (t - a.t) / ((b.t - a.t) || 1)
  const e = smootherstep(u)
  const isVec = Array.isArray(a.v)
  const av = isVec ? a.v : [a.v]
  const bv = isVec ? b.v : [b.v]
  const out = av.map((a0, i) => a0 + (bv[i] - a0) * e)
  if (a.bowNext && isVec && out.length === 2) {
    const dx = bv[0] - av[0], dy = bv[1] - av[1]
    const len = Math.hypot(dx, dy) || 1
    const perp = [-dy / len, dx / len]
    const bow = a.bowNext * hannBow(u)
    out[0] += perp[0] * bow
    out[1] += perp[1] * bow
  }
  return isVec ? out : out[0]
}

const DRINK_OFFSET = [3, -6] // px, toward the face and up — the settled sip height
const OVERSHOOT = DRINK_OFFSET.map((v) => v * 1.35) // springy overshoot past the sip height
const ANTICIPATE_OFFSET = [-1, 2] // px, small counter-dip opposite the raise, before it starts
const ANTICIPATE_LEAD = 8 // frames the flat-rest plateau holds before the lean begins
const SIP_OFFSETS = { anticipate: -4, overshoot: 28, peak: 36, hold: 55, rest: 72 } // relative to each run's own rest-start
const RISE_BOW_AMT = 2.5   // px, perpendicular bow on the anticipate->overshoot rise — an arc, not a straight diagonal
const RETURN_BOW_AMT = 1.8 // px, its own smaller bow on the hold->rest return

// One coherent stop-to-stop waypoint chain per cycle occurrence: rest ->
// dip -> overshoot -> settle to true height -> hold -> rest. No separate
// "riseStart" pass-through pose (the old design's mid-flight [0,0] stop) —
// the anticipate->overshoot segment now sweeps smoothly THROUGH that region
// on its own arc instead of forcing an artificial stop there.
function sipWaypoints(cycleStart) {
  const abs = (rel) => cycleStart + rel
  return [
    { t: abs(SIP_OFFSETS.anticipate - ANTICIPATE_LEAD), v: [0, 0] },
    { t: abs(SIP_OFFSETS.anticipate), v: ANTICIPATE_OFFSET, bowNext: RISE_BOW_AMT },
    { t: abs(SIP_OFFSETS.overshoot), v: OVERSHOOT },
    { t: abs(SIP_OFFSETS.peak), v: DRINK_OFFSET },
    { t: abs(SIP_OFFSETS.hold), v: DRINK_OFFSET, bowNext: RETURN_BOW_AMT },
    { t: abs(SIP_OFFSETS.rest), v: [0, 0] },
  ]
}

const SIP_REAL_START = T + 70 // 160
const SIP_ECHO_START = SIP_REAL_START - IDLE // -20 — the previous cycle's tail

const sipAllPoints = [...sipWaypoints(SIP_ECHO_START), ...sipWaypoints(SIP_REAL_START)].sort((a, b) => a.t - b.t)
const sipEnvelope = (t) => waypointCurve(t, sipAllPoints)

const drinkPosPoints = []
for (let t = 0; t <= OP; t += HEAD_SAMPLE_STEP) drinkPosPoints.push({ t, v: [...sipEnvelope(t), 0], ease: 'linear' })
if (drinkPosPoints[drinkPosPoints.length - 1].t !== OP) drinkPosPoints.push({ t: OP, v: [...sipEnvelope(OP), 0] })

// Drag: the straw+umbrella's OWN local rotation, riding a drink-rig parent
// that already carries their translation at zero lag (they move exactly
// when the glass moves — no shifted copy). Rotation lags the glass's own
// lean by DRAG_LAG frames (inertia catching up), overshoots past center as
// the glass settles, then decays a beat after the glass itself is at rest.
//
// Segment durations are PACED PROPORTIONALLY to their own value swing
// (duration ∝ |Δv|, ~0.22°/f throughout) rather than inheriting the glass's
// own beat spacing verbatim — the velocity audit caught why: the old timing
// packed a 9° swing (-6 -> 3) into just 8 frames right next to a 42-frame
// 6° swing, a 16.5x speed ratio between the two even with a perfectly
// smooth (non-singular) easing curve in both. A smootherstep segment's OWN
// peak speed is `|Δv|/duration × 1.875` (the shape's derivative at its
// midpoint) — matching that ratio across every segment, not just avoiding a
// bezier singularity, is what actually keeps a multi-beat gesture reading
// as ONE continuous motion instead of lurch-then-crawl.
const DRAG_LAG = 2 // frames after the glass begins its own lean before drag starts reacting
function dragWaypoints(cycleStart) {
  const abs = (rel) => cycleStart + rel
  return [
    { t: abs(SIP_OFFSETS.anticipate - ANTICIPATE_LEAD + DRAG_LAG), v: 0 },  // -10
    { t: abs(17), v: -6 },  // 27f for a 6° swing (~0.22°/f)
    { t: abs(57), v: 3 },   // 40f for a 9° swing (~0.225°/f)
    { t: abs(75), v: -1 },  // 18f for a 4° swing (~0.22°/f)
    { t: abs(80), v: 0 },   // 5f for a 1° swing (~0.2°/f)
  ]
}
const DRAG_SETTLE_END = 80 // when the drag rotation fully resolves back to 0

const dragAllPoints = [...dragWaypoints(SIP_ECHO_START), ...dragWaypoints(SIP_REAL_START)].sort((a, b) => a.t - b.t)
const dragEnvelope = (t) => waypointCurve(t, dragAllPoints)

const dragRotPoints = []
for (let t = 0; t <= OP; t += HEAD_SAMPLE_STEP) dragRotPoints.push({ t, v: dragEnvelope(t), ease: 'linear' })
if (dragRotPoints[dragRotPoints.length - 1].t !== OP) dragRotPoints.push({ t: OP, v: dragEnvelope(OP) })

// Umbrella's own extra rock, a beat after the shared drag resolves —
// secondary motion riding secondary motion. Same pace-proportional timing
// as dragWaypoints (durations ∝ |Δv|, ~0.29-0.33°/f) so this doesn't
// reintroduce the audit's speed-ratio defect at a smaller scale.
function rockWaypoints(startAt) {
  return [
    { t: startAt, v: 0 },
    { t: startAt + 7, v: 2 },   // 7f for a 2° swing (~0.29°/f)
    { t: startAt + 17, v: -1 }, // 10f for a 3° swing (~0.3°/f)
    { t: startAt + 20, v: 0 },  // 3f for a 1° swing (~0.33°/f)
  ]
}
const rockAllPoints = [...rockWaypoints(SIP_ECHO_START + DRAG_SETTLE_END + 2), ...rockWaypoints(SIP_REAL_START + DRAG_SETTLE_END + 2)].sort((a, b) => a.t - b.t)
const rockEnvelope = (t) => waypointCurve(t, rockAllPoints)

const rockRotPoints = []
for (let t = 0; t <= OP; t += HEAD_SAMPLE_STEP) rockRotPoints.push({ t, v: rockEnvelope(t), ease: 'linear' })
if (rockRotPoints[rockRotPoints.length - 1].t !== OP) rockRotPoints.push({ t: OP, v: rockEnvelope(OP) })

// THE WORLD RESPONDS #2a — the liquid sloshes when the glass moves: DERIVED
// from the SAME dragEnvelope that already drives straw/umbrella (not a
// hand-authored independent curve), reduced amplitude and a beat further
// lagged than them — the liquid is the innermost, softest reaction in the
// chain glass -> straw/umbrella -> liquid.
const LIQUID_GAIN = 0.45
const LIQUID_EXTRA_LAG = 3
const liquidEnvelope = (t) => dragEnvelope(t - LIQUID_EXTRA_LAG) * LIQUID_GAIN

const liquidRotPoints = []
for (let t = 0; t <= OP; t += HEAD_SAMPLE_STEP) liquidRotPoints.push({ t, v: liquidEnvelope(t), ease: 'linear' })
if (liquidRotPoints[liquidRotPoints.length - 1].t !== OP) liquidRotPoints.push({ t: OP, v: liquidEnvelope(OP) })

const drinkRigInd = pushLayer({
  nm: 'drink-rig',
  ty: 3,
  ks: {
    a: { a: 0, k: [0, 0, 0] },
    p: animProp(drinkPosPoints),
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
    r: animProp(dragRotPoints),
    s: { a: 0, k: [100, 100, 100] },
    o: { a: 0, k: 100 },
  },
  parent: drinkRigInd,
})

staticShapeLayer('glass', SVG_PATHS.glass, [fillItem('#FFFFFF'), strokeItem('#222222', 2.0532)], drinkRigInd)
{
  // drink-fill (the liquid): rides drink-rig's translation via parenting,
  // plus its own small slosh rotation (liquidRotPoints, above) pivoted at
  // its own center — "the world responds" #2a.
  const subs = parsePath(SVG_PATHS.drinkFill)
  const c = bboxCenter(bboxOf(subs))
  const items = subs.map((s, i) => shapeFromSubpath(s, `drink-fill-${i}`))
  const shapes = [group('drink-fill', [...items, fillItem('#222222'), strokeItem('#222222', 2.0532)])]
  const ks = baseTransform({ a: [c[0], c[1], 0], p: [c[0], c[1], 0] })
  ks.r = animProp(liquidRotPoints)
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
// STRAW FLEXES instead of hinging rigidly: the base path is a straight
// 2-vertex line (start/end, no curve) — subdivided here into 3 vertices
// (start, mid, end) so the MIDPOINT can bow sideways while both ends stay
// fixed (contract: same vertex count/order on every key, including rest —
// at bow=0 the extra midpoint sits exactly on the original straight line, so
// the rest shape is visually identical to before). Bow amount is DERIVED
// from dragEnvelope — the SAME continuous function that already drives
// straw+umbrella's rigid drag rotation — evaluated directly (a plain
// function call, not a sparse-track resample) and scaled down, so the flex
// is phase-locked to the sip-drag beat for free (the "the world responds"
// idiom already used for drink-fill's slosh) rather than a hand-authored
// second curve that could drift out of sync.
const STRAW_BOW_GAIN = 0.5 // px of midpoint lateral bow per "degree" of the drag envelope
{
  const strawBase = parsePath(SVG_PATHS.straw)[0] // {closed:false, v:[start,end], i:[[0,0],[0,0]], o:[[0,0],[0,0]]}
  const [strawStart, strawEnd] = strawBase.v
  const strawMid = [(strawStart[0] + strawEnd[0]) / 2, (strawStart[1] + strawEnd[1]) / 2]
  const dx = strawEnd[0] - strawStart[0], dy = strawEnd[1] - strawStart[1]
  const strawLen = Math.hypot(dx, dy)
  const strawUnit = [dx / strawLen, dy / strawLen]
  const strawPerp = [-strawUnit[1], strawUnit[0]]
  const handleLen = strawLen * 0.18 // small tangent handles so the bow reads as a curve, not a hard kink
  function strawShapeAt(t) {
    const bow = dragEnvelope(t) * STRAW_BOW_GAIN
    const mid = [strawMid[0] + strawPerp[0] * bow, strawMid[1] + strawPerp[1] * bow]
    return {
      c: false,
      v: [strawStart, mid, strawEnd],
      i: [[0, 0], [-strawUnit[0] * handleLen, -strawUnit[1] * handleLen], [0, 0]],
      o: [[0, 0], [strawUnit[0] * handleLen, strawUnit[1] * handleLen], [0, 0]],
    }
  }
  const strawShapePoints = []
  for (let t = 0; t <= OP; t += HEAD_SAMPLE_STEP) strawShapePoints.push({ t, v: strawShapeAt(t), ease: 'linear' })
  if (strawShapePoints[strawShapePoints.length - 1].t !== OP) strawShapePoints.push({ t: OP, v: strawShapeAt(OP) })
  animatedShapeLayer('straw', strawShapePoints, [strokeItem('#222222', 2.0532, 100, 'Stroke', 1, 1)], trailingRigInd)
}
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
    r: animProp(rockRotPoints),
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
    // recipe-companion-bubble.md #3: the only working multi-line vertical-
    // centering mechanism (text-doc `ls` is silently ignored by Skottie).
    // Default matches bubble-text's own calibrated single-line position, so
    // the file renders identically to before unless a tool overrides it.
    'bubble.textPos': { p: { a: 0, k: [0, BASELINE_LOCAL, 0] } },
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
    // Layout plumbing, not an editable field (recipe-companion-bubble.md
    // #3): tools shift its y by -(lines-1)*lh/2 when they wrap bubble.text
    // onto multiple lines, since Skottie ignores text-doc `ls`.
    { sid: 'bubble.textPos', label: 'Bubble text position', internal: true },
  ],
  layerControls: [
    { target: 'head-rig', kind: 'amount', property: 'rotation', label: 'Hammock sway', description: 'How far the mascot gently rocks side to side each cycle.' },
    { target: 'drink-rig', kind: 'amount', property: 'position', label: 'Sip lift', description: 'How far the drink rises toward the mascot each cycle.' },
    { target: 'bubble-anchor', kind: 'amount', property: 'scale', label: 'Bubble pop', description: 'How much the speech bubble overshoots as it arrives.' },
  ],
}
writeFileSync(join(OUT_DIR, 'controls.json'), JSON.stringify(controls, null, 2))
console.log(`Wrote ${join(OUT_DIR, 'controls.json')}`)
