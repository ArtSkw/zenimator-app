#!/usr/bin/env node
/**
 * Generates the INTRO+LOOP Lottie for "live-onboarding-companion-zkti.svg" —
 * a live onboarding companion: the mascot lounges in a deck chair, sunglasses
 * on, drink in paw, while a speech bubble above it says its line once, then
 * settles into an endless vacation-idle: a slow recline breath plus one
 * contented almost-sip per cycle.
 * Source SVG is pixel-identical to live-onboarding-companion-eh0n.svg (same
 * rig, same brief, different project slug) — see
 * docs/live-onboarding-companion-eh0n-animation.md for the full rig writeup.
 * Output: public/projects/live-onboarding-companion-zkti/scene-1/lottie.json
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
 * Rig: "head-rig" null (pivot at the head's bottom-center — its contact base
 * with the chair) carries the idle recline: position translates along the
 * chair's own tilt axis (derived from the long crossing leg's direction) and
 * a small rotation, "sinking deeper and easing back." "drink-rig" null lifts
 * glass/drink/paw/shine a few pixels toward the face once per cycle (the
 * almost-sip); "trailing-rig" carries straw+umbrella through the same lift,
 * offset +2 frames (the brief's "~2 frames of lag"). The chair (seat + all
 * four legs) is a steady island — unparented, unanimated, "it's furniture."
 * A subtle one-pass glint sweeps the right lens once per cycle via a track
 * matte, clipped to the lens shape, independent of the (never separately
 * animated) baked shine slashes.
 */
import { writeFileSync, mkdirSync, copyFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../public/projects/live-onboarding-companion-zkti/scene-1')
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

// Plain range track: keyframes exactly where authored, no forced t=0 —
// Skottie holds a property at its first keyframe's value for every earlier
// frame (and at its last keyframe's value for every later frame), which is
// exactly "at rest, then one event, then at rest" for free.
function animProp(points) {
  const keys = points.map((p, idx) => {
    const isLast = idx === points.length - 1
    return kf(p.t, p.v, isLast ? null : (EASE[p.ease] || EASE.linear))
  })
  return { a: 1, k: keys }
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
// ============================================================
const PLATE_DEFAULT_W = 176, PLATE_DEFAULT_H = 35, PLATE_R = 17.5
const PLATE_CX = 102, PLATE_TOP = 14, PLATE_BOTTOM = 49 // = 14 + 35

const FONT_SIZE = 15
const CAP_EM = 0.7 // fallback cap-height ratio (player-contract "Vector Text Vertical Placement")
const BASELINE_LOCAL = (CAP_EM * FONT_SIZE) / 2 // baseline below plate's local center

const DEFAULT_STRING = 'Almost time to relax'
function textDoc(str) {
  return {
    s: FONT_SIZE,
    f: 'Nunito',
    t: str,
    j: 2,
    tr: 0,
    lh: Math.round(FONT_SIZE * 1.25),
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
  // pivoting at its own baseline point, riding on the parent's position
  // offset (which DOES compose correctly through parenting).
  const ks = baseTransform({ a: [0, BASELINE_LOCAL, 0], p: [0, BASELINE_LOCAL, 0] })
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
// TRAIL — Ellipse 2421 (smallest, nearest the head) pops first, then 2420
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
trailCircle('trail-small', 114, 84, 4, [{ t: 0, v: 0, ease: 'entranceSharp' }, { t: 10, v: 112, ease: 'settleSoft' }, { t: 20, v: 100 }])
trailCircle('trail-large', 102, 66, 8, [{ t: 8, v: 0, ease: 'entranceSharp' }, { t: 20, v: 114, ease: 'settleSoft' }, { t: 32, v: 100 }])

// ============================================================
// CHAIR — steady island: seat + all four legs, never move ("it's furniture")
// ============================================================
staticShapeLayer('chair-leg-back-a', SVG_PATHS.legBackA, [strokeItem('#222222', 2.0532)])
staticShapeLayer('chair-leg-back-b', SVG_PATHS.legBackB, [strokeItem('#222222', 2.0532)])
staticShapeLayer('chair-leg-back-c', SVG_PATHS.legBackC, [strokeItem('#222222', 2.0532)])
staticShapeLayer('chair-seat', SVG_PATHS.chairSeat, [fillItem('#FFFFFF'), strokeItem('#222222', 2.0532)])
staticShapeLayer('chair-leg-front', SVG_PATHS.legFront, [strokeItem('#222222', 2.0532)])

// ============================================================
// HEAD + SUNGLASSES rig — idle recline along the chair's own tilt axis
// ============================================================
const headBbox = bboxOf(parsePath(SVG_PATHS.headDark))
const headPivot = [(headBbox[0] + headBbox[2]) / 2, headBbox[3]] // bottom-center — contact base with the chair

// Tilt axis derived from the long crossing leg (legBackC): the chair's own
// recline direction, not a guessed vertical.
const AXIS_FROM = [151.553, 105.344], AXIS_TO = [85.1728, 225.999]
const axisDx = AXIS_TO[0] - AXIS_FROM[0], axisDy = AXIS_TO[1] - AXIS_FROM[1]
const axisMag = Math.hypot(axisDx, axisDy)
const axisUnit = [axisDx / axisMag, axisDy / axisMag]
const RECLINE_DIST = 3 // px, "a touch deeper"
const reclineOffset = [axisUnit[0] * RECLINE_DIST, axisUnit[1] * RECLINE_DIST]
const RECLINE_ROT_DEG = 2 // "easing back"

// The recline is a period-IDLE hump (rest -> peak -> rest) that must run for
// the WHOLE composition, not just the loop segment, so the mascot is already
// breathing under the intro (never frozen waiting for the bubble). Frame 0
// sits half a period before T, which lands it on the SAME phase as the
// mid-idle peak (T + IDLE/2) — so the composition opens already reclined and
// eases up to rest by T, then the loop repeats that exact hump from T to OP.
const RECLINE_T = [
  { t: 0, v: reclineOffset, rot: RECLINE_ROT_DEG, ease: 'travelBalanced' },
  { t: T, v: [0, 0], rot: 0, ease: 'travelBalanced' },
  { t: T + Math.round(IDLE / 2), v: reclineOffset, rot: RECLINE_ROT_DEG, ease: 'travelBalanced' },
  { t: OP, v: [0, 0], rot: 0 },
]

const headRigInd = pushLayer({
  nm: 'head-rig',
  ty: 3,
  ks: {
    a: { a: 0, k: [headPivot[0], headPivot[1], 0] },
    p: animProp(RECLINE_T.map((p) => ({ t: p.t, v: [headPivot[0] + p.v[0], headPivot[1] + p.v[1], 0], ease: p.ease }))),
    r: animProp(RECLINE_T.map((p) => ({ t: p.t, v: p.rot, ease: p.ease }))),
    s: { a: 0, k: [100, 100, 100] },
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

// ── Glint: one slow pass across the right lens per cycle, clipped to the lens
// via track matte. Independent of (never reuses) the baked shine slashes.
{
  const lensSub = parsePath(SVG_PATHS.lensRight)
  const lensCenter = bboxCenter(bboxOf(lensSub))
  const angle = -25 * Math.PI / 180 // matches the shine slashes' diagonal
  const cosA = Math.cos(angle), sinA = Math.sin(angle)
  const sweep = 22
  const leftPos = [lensCenter[0] - sweep * cosA, lensCenter[1] - sweep * sinA]
  const midPos = lensCenter
  const rightPos = [lensCenter[0] + sweep * cosA, lensCenter[1] + sweep * sinA]

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
    ks.p = animProp([
      { t: T + 15, v: [leftPos[0], leftPos[1], 0], ease: 'settleSoft' },
      { t: T + 35, v: [midPos[0], midPos[1], 0], ease: 'travelBalanced' },
      { t: T + 55, v: [rightPos[0], rightPos[1], 0] },
    ])
    ks.o = animProp([
      { t: T + 15, v: 0, ease: 'settleSoft' },
      { t: T + 35, v: 34, ease: 'travelBalanced' },
      { t: T + 55, v: 0 },
    ])
    pushLayer({ nm: 'glint', shapes, ks, parent: headRigInd, tt: 1 })
  }
}

// ============================================================
// PAW — peeks from behind everything, rides with the drink cluster
// ============================================================
// (created after drink-rig below, since it's parented to it)

// ============================================================
// DRINK CLUSTER — glass/drink/paw/shine lift toward the face once per cycle;
// straw + umbrella ride the same lift with ~2 frames of lag.
// ============================================================
const DRINK_OFFSET = [3, -6] // px, toward the face and up
const DRINK_START = T + 70, DRINK_PEAK = T + 100, DRINK_REST = T + 130
const LAG = 2

const drinkRigInd = pushLayer({
  nm: 'drink-rig',
  ty: 3,
  ks: {
    a: { a: 0, k: [0, 0, 0] },
    p: animProp([
      { t: DRINK_START, v: [0, 0, 0], ease: 'settleSoft' },
      { t: DRINK_PEAK, v: [DRINK_OFFSET[0], DRINK_OFFSET[1], 0], ease: 'travelBalanced' },
      { t: DRINK_REST, v: [0, 0, 0] },
    ]),
    r: { a: 0, k: 0 },
    s: { a: 0, k: [100, 100, 100] },
    o: { a: 0, k: 100 },
  },
})
const trailingRigInd = pushLayer({
  nm: 'trailing-rig',
  ty: 3,
  ks: {
    a: { a: 0, k: [0, 0, 0] },
    p: animProp([
      { t: DRINK_START + LAG, v: [0, 0, 0], ease: 'settleSoft' },
      { t: DRINK_PEAK + LAG, v: [DRINK_OFFSET[0], DRINK_OFFSET[1], 0], ease: 'travelBalanced' },
      { t: DRINK_REST + LAG, v: [0, 0, 0] },
    ]),
    r: { a: 0, k: 0 },
    s: { a: 0, k: [100, 100, 100] },
    o: { a: 0, k: 100 },
  },
})

staticShapeLayer('glass', SVG_PATHS.glass, [fillItem('#FFFFFF'), strokeItem('#222222', 2.0532)], drinkRigInd)
staticShapeLayer('drink-fill', SVG_PATHS.drinkFill, [fillItem('#222222'), strokeItem('#222222', 2.0532)], drinkRigInd)
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
staticShapeLayer('umbrella', SVG_PATHS.umbrella, [fillItem('#FFFFFF'), strokeItem('#222222', 2.0532, 100, 'Stroke', 2, 1)], trailingRigInd)

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
  fonts: { list: [{ fName: 'Nunito', fFamily: 'Nunito', fStyle: 'Regular', ascent: 75 }] },
  slots: {
    'bubble.text': { p: { k: [{ s: textDoc(DEFAULT_STRING), t: 0 }] } },
    'bubble.size': { p: { a: 0, k: [PLATE_DEFAULT_W, PLATE_DEFAULT_H] } },
  },
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT, JSON.stringify(doc))
console.log(`Wrote ${OUT} — ${layers.length} layers, ${OP}f @ ${FPS}fps (intro ${T}f / loop ${OP - T}f)`)

copyFileSync(join(__dirname, '../assets/fonts/Nunito.ttf'), join(OUT_DIR, 'Nunito.ttf'))
console.log(`Copied Nunito.ttf into ${OUT_DIR}`)

const controls = {
  controls: [
    { sid: 'bubble.text', label: 'Bubble text' },
    { sid: 'bubble.size', label: 'Bubble size', autoFit: { text: 'bubble.text', padding: [17, 11], min: [90, 40] } },
  ],
  layerControls: [
    { target: 'head-rig', kind: 'amount', property: 'position', label: 'Recline depth', description: 'How deeply the mascot sinks back into the chair each breath.' },
    { target: 'drink-rig', kind: 'amount', property: 'position', label: 'Sip lift', description: 'How far the drink rises toward the mascot each cycle.' },
    { target: 'bubble-anchor', kind: 'amount', property: 'scale', label: 'Bubble pop', description: 'How much the speech bubble overshoots as it arrives.' },
  ],
}
writeFileSync(join(OUT_DIR, 'controls.json'), JSON.stringify(controls, null, 2))
console.log(`Wrote ${join(OUT_DIR, 'controls.json')}`)
