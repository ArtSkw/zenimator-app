#!/usr/bin/env node
/**
 * Generates a seamlessly-looping Lottie JSON for "loop-4s-zenek-1yoi.svg" —
 * Zenek's head close-up: a dark head circle, a white face patch, two dark
 * eye dots, a magnifying-glass (handle + lens ring) worn over the left eye,
 * and a hatch-mark ground shadow beneath.
 *
 * Diffed against every previously-shipped Zenek scene (svg-compatibility.md's
 * intake gate) — different viewBox (256x256), a plain head-only composition
 * with no badge/gears/pen, a hand-drawn hatch shadow instead of an ellipse.
 * No path data matches; this is a full rebuild, not a port. Motion constants
 * and rig topology are re-derived from the CURRENT motion-taste.md /
 * recipe-character-rig.md, not copied from any prior build script.
 *
 * Rig:
 *   zenek-position (root null): the vertical drift only. ANCHOR = HEAD CENTER.
 *   zenek-bounce (null, child of zenek-position): the squash/stretch BOUNCE
 *     only, phase-locked to the same driver as the drift, same ANCHOR. Split
 *     from zenek-position so the bounce's non-uniform scale reaches the
 *     HEAD/FACE/EYES but NOT the magnifying glass — a rigid handheld lens
 *     does not squash with the body, and the brief is explicit the glass
 *     "should not morph but keep its original circular shape". head / face
 *     are children of zenek-bounce with no own transform — "his whole head,
 *     face... moving as one" (brief) — and inherit both the drift and bounce.
 *   glass-rig (null, child of zenek-position — NOT zenek-bounce, so it never
 *     inherits the non-uniform squash): the magnifying glass (handle + lens)
 *     is a HELD object, not welded décor — it carries its own softened,
 *     reduced-amplitude copy of the eye saccade (same timing/ease as
 *     eyes-rig — motion-taste's "reduced amplitude on the same timing"
 *     follower technique, never a time-shifted duplicate), so it tracks
 *     Zenek's sight direction while still riding the head's float. handle/
 *     lens sit on this ONE null with no transform of their own, so they stay
 *     a single rigid, undistorted assembly relative to EACH OTHER while the
 *     assembly as a whole answers the gaze.
 *   eyes-rig (null, child of zenek-bounce): saccade position offset shared by
 *     both eyes ("his two eyes glide together"). Explicit hold-move-hold
 *     keyframes (a saccade is a ballistic accent, not a cycle to dense-sample).
 *   eye-left / eye-right (children of eyes-rig): own transform pivots at each
 *     eye's own bbox center (a==p, no net translation) so blink SCALE has a
 *     correct pivot per motion-taste's "scale pivots on its artwork".
 *   hatch-shadow: the "steady island" — UNPARENTED, position never animates.
 *     Its scaleX (width) and fill gray (light/dark) are a DERIVED response to
 *     the same float driver, negated so it widens+lightens exactly when the
 *     head rises and tightens+darkens when it sinks, and reads 0 offset from
 *     the source width/color at rest (driver==0 at t==0), per motion-taste's
 *     "a derived response's rest value must equal the source pose".
 *
 * Timing: T = 240f @ 60fps = 4.0s, matches the brief's "~4s" and the float's
 * "slow... cycle" (one float/breathe cycle spans the whole loop, so its
 * period trivially divides the repeatable span). The single searching
 * sequence (left -> pause -> right+up -> pause -> center) and both blink
 * events land inside this one pass and return to rest exactly at t=240,
 * which is what closes the loop (no tiling needed for the saccade/blinks).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SLUG = 'loop-4s-zenek-1yoi'
const OUT_DIR = join(__dirname, `../public/projects/${SLUG}/scene-1`)
const OUT = join(OUT_DIR, 'lottie.json')

const W = 256, H = 256, FPS = 60
const T = 240 // 4.0s seamless loop

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

// ── Extract path `d`s straight from the source SVG, by document order ──────
const svgText = readFileSync(join(__dirname, `../assets/${SLUG}.svg`), 'utf8')
const pathTags = [...svgText.matchAll(/<path\b[^>]*\/>/g)].map((m) => m[0])
const attr = (tag, name) => { const m = new RegExp(`${name}="([^"]*)"`).exec(tag); return m ? m[1] : null }
const ds = pathTags.map((t) => attr(t, 'd'))
if (ds.length !== 8) throw new Error(`expected 8 <path> tags in ${SLUG}.svg, found ${ds.length}`)
// ds[0] = the <mask>'s own rect path — a bbox-only crop, no visual effect; skipped.
const D = { head: ds[1], face: ds[2], eyeLeft: ds[3], eyeRight: ds[4], handle: ds[5], lens: ds[6], hatch: ds[7] }

// ── Lottie builder helpers ──────────────────────────────────────────────────
const hexToRgb1 = (hex) => {
  hex = hex.replace('#', '')
  return [parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255]
}
const EASE = {
  linear: [0, 0, 1, 1],
  entranceSharp: [0.20, 0.75, 0.34, 0.94],
  settleSoft: [0.00, 0.65, 0.51, 0.99],
}
function staticProp(v) { return { a: 0, k: v } }
function shapeFromSubpath(sp, nm) { return { ty: 'sh', nm, ks: { a: 0, k: { c: sp.closed, v: sp.v, i: sp.i, o: sp.o } } } }
function fillItem(colorHex, opacity = 100, nm = 'Fill') {
  const [cr, cg, cb] = hexToRgb1(colorHex)
  return { ty: 'fl', nm, o: staticProp(opacity), c: staticProp([cr, cg, cb, 1]), r: 1 }
}
function fillItemAnimatedColor(colorProp, opacity = 100, nm = 'Fill') {
  return { ty: 'fl', nm, o: staticProp(opacity), c: colorProp, r: 1 }
}
function strokeItem(colorHex, width, opacity = 100, nm = 'Stroke') {
  const [cr, cg, cb] = hexToRgb1(colorHex)
  return { ty: 'st', nm, o: staticProp(opacity), w: staticProp(width), c: staticProp([cr, cg, cb, 1]), lc: 2, lj: 2 }
}
function groupTransform({ p = [0, 0], a = [0, 0], s = [100, 100], r = 0, o = 100 } = {}) {
  return { ty: 'tr', p: staticProp(p), a: staticProp(a), s: staticProp(s), r: staticProp(r), o: staticProp(o), sk: staticProp(0), sa: staticProp(0) }
}
function group(nm, items, transform) { return { ty: 'gr', nm, it: [...items, groupTransform(transform)] } }
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
  return { a: staticProp(a), p: staticProp(p), s: staticProp(s), r: staticProp(0), o: staticProp(o) }
}
function shapeLayer({ nm, ind, parent, shapes, ks }) {
  const l = { ddd: 0, ind, ty: 4, nm, sr: 1, ks, ao: 0, ip: 0, op: T, st: 0, bm: 0, shapes }
  if (parent != null) l.parent = parent
  return l
}
function nullLayer({ nm, ind, parent, ks }) {
  const l = { ddd: 0, ind, ty: 3, nm, sr: 1, ks, ao: 0, ip: 0, op: T, st: 0, bm: 0 }
  if (parent != null) l.parent = parent
  return l
}

// Dense-sample a continuous driver (sine cycles) at 2-frame steps — a linear
// polyline at this spacing is indistinguishable from the curve at 60fps
// (motion-taste, "Bake smooth, not stepped"), which is what a hand-derived
// bezier approximation of a sine risks getting wrong (motion-taste's
// travel-balanced singularity note: derive back-and-forth motion from a real
// sin/cos call, never a bezier fit).
function denseAnimProp(fn, step = 2) {
  const keys = []
  for (let t = 0; t <= T; t += step) keys.push({ t, v: fn(t) })
  if (keys[keys.length - 1].t !== T) keys.push({ t: T, v: fn(T) })
  return {
    a: 1,
    k: keys.map((k, idx) => idx === keys.length - 1
      ? { t: k.t, s: k.v }
      : { t: k.t, s: k.v, o: { x: [0], y: [0] }, i: { x: [1], y: [1] } }),
  }
}
function denseAnimColor(fn, step = 2) {
  const keys = []
  for (let t = 0; t <= T; t += step) keys.push({ t, g: fn(t) })
  if (keys[keys.length - 1].t !== T) keys.push({ t: T, g: fn(T) })
  return {
    a: 1,
    k: keys.map((k, idx) => {
      const v = [k.g, k.g, k.g, 1]
      return idx === keys.length - 1
        ? { t: k.t, s: v }
        : { t: k.t, s: v, o: { x: [0], y: [0] }, i: { x: [1], y: [1] } }
    }),
  }
}
// Sparse, eased keyframes for one-shot/hold-move-hold tracks (a saccade, a
// blink) — these are accents, not cycles, so real bezier segments between a
// few named points are the right tool, not dense sampling.
function sparseAnimProp(points) {
  return {
    a: 1,
    k: points.map((p, idx) => {
      const isLast = idx === points.length - 1
      const k = { t: p.t, s: p.v }
      if (!isLast) { const [x1, y1, x2, y2] = EASE[p.ease] || EASE.linear; k.o = { x: [x1], y: [y1] }; k.i = { x: [x2], y: [y2] } }
      return k
    }),
  }
}

// ============================================================
// Shared float driver: one sine cycle spans the whole 4s loop — "a slow
// balloon-eased cycle" (brief). Sine already eases to zero velocity at its
// extrema (the balloon "hangs" at top/bottom) and is singularity-free for
// back-and-forth motion, unlike a bezier approximation (motion-taste).
// f(0) = f(T) = 0 exactly, so every track built from it closes the loop.
// ============================================================
const floatDriver = (t) => Math.sin((2 * Math.PI * t) / T)

const HEAD = parsePath(D.head)
const HEAD_CENTER = bboxCenter(bboxOf(HEAD))

const FLOAT_AMP = 3        // px half-amplitude -> ~6px peak-to-peak, per brief
const BOUNCE_AMP_Y = 2.5   // % half-amplitude, vertical stretch/squash -> ~5% p2p
const BOUNCE_AMP_X = 1.2   // % half-amplitude, cross-axis (volume-preserving-ish)

const zenekPos = (t) => [HEAD_CENTER[0], HEAD_CENTER[1] - FLOAT_AMP * floatDriver(t), 0]
// Squash/stretch BOUNCE, phase-locked to the SAME driver as the drift (the
// "effort" — the moment of tightest squash — lands exactly at the low point
// of the float, not on an independent clock): stretches tall+narrow at the
// top of the rise, squashes short+wide at the bottom.
const zenekScale = (t) => [100 - BOUNCE_AMP_X * floatDriver(t), 100 + BOUNCE_AMP_Y * floatDriver(t), 100]

// Shadow response: DERIVED from the same driver, so it is exactly 0 offset
// from the source width/gray at t=0 (driver==0) — "a derived response's rest
// value must equal the source pose" (motion-taste). Wider+lighter as the
// driver goes positive (head rises); tighter+darker as it goes negative.
const SHADOW_SCALE_AMP = 8      // % half-amplitude width swing
const SHADOW_GRAY_BASE = 0xdf / 255
const SHADOW_GRAY_AMP = 0.08
const shadowScaleX = (t) => 100 + SHADOW_SCALE_AMP * floatDriver(t)
const shadowGray = (t) => SHADOW_GRAY_BASE + SHADOW_GRAY_AMP * floatDriver(t)

// ── Saccade timeline (explicit hold-move-hold; a saccade is a ballistic
// accent, not a cycle) ──────────────────────────────────────────────────────
// 0-15 hold center | 15-27 -> look left | 27-72 hold (quick blink here)
// 72-88 -> look right+up | 88-140 hold (double blink here) | 140-158 -> back
// to center | 158-240 long calm hold, closing exactly on t=0's rest value.
const SAC_X = 5, SAC_Y_UP = -2.5
const SACCADE_POINTS = [
  { t: 0, v: [0, 0, 0], ease: 'linear' },
  { t: 15, v: [0, 0, 0], ease: 'entranceSharp' },
  { t: 27, v: [-SAC_X, 0, 0], ease: 'linear' },
  { t: 72, v: [-SAC_X, 0, 0], ease: 'entranceSharp' },
  { t: 88, v: [SAC_X, SAC_Y_UP, 0], ease: 'linear' },
  { t: 140, v: [SAC_X, SAC_Y_UP, 0], ease: 'settleSoft' },
  { t: 158, v: [0, 0, 0], ease: 'linear' },
  { t: 240, v: [0, 0, 0] },
]

// The magnifying glass follows the SAME saccade timeline at reduced
// amplitude — a softened "held object" copy, correlated with sight
// direction but not a rigid 1:1 lock, so it reads as being carried rather
// than glued to the eyes.
const GLASS_FOLLOW_RATIO = 0.5
const scalePoints = (points, ratio) => points.map((p) => ({ ...p, v: p.v.map((x) => x * ratio) }))
const GLASS_POINTS = scalePoints(SACCADE_POINTS, GLASS_FOLLOW_RATIO)

// ── Blink timeline — own-center scaleY dip to a true ZERO (gate 17), snap
// shut faster than it opens (motion-taste, "A blink CLOSES, and it is fast").
// Landed only inside the two saccade holds, clear of every saccade edge by
// >=12 frames. Both eyes share identical timing (natural synchronized blink).
// ============================================================
function blinkEvent(center, close, hold, open) {
  return [
    { t: center - close, v: [100, 100, 100], ease: 'entranceSharp' },
    { t: center, v: [106, 0, 100], ease: 'linear' },
    { t: center + hold, v: [106, 0, 100], ease: 'settleSoft' },
    { t: center + hold + open, v: [100, 100, 100], ease: 'linear' },
  ]
}
const EYE_SCALE_POINTS = [
  { t: 0, v: [100, 100, 100], ease: 'linear' },
  ...blinkEvent(45, 2, 1, 3),     // quick blink, mid pause-1 (27..72)
  ...blinkEvent(104, 3, 2, 5),    // soft double-blink, first, mid pause-2 (88..140)
  ...blinkEvent(120, 3, 2, 5),    // soft double-blink, second
  { t: 240, v: [100, 100, 100] },
]
// Keep it sorted and end-anchored (belt-and-suspenders for the loop-close
// assertion below and for the player's monotonic-t requirement).
EYE_SCALE_POINTS.sort((a, b) => a.t - b.t)

// ── Sanity: every animated track must close the loop exactly ───────────────
function assertClose(name, a, b) {
  const av = Array.isArray(a) ? a : [a], bv = Array.isArray(b) ? b : [b]
  for (let i = 0; i < av.length; i++) if (Math.abs(av[i] - bv[i]) > 1e-6) throw new Error(`${name} does not close the loop: t=0 -> ${av}, t=${T} -> ${bv}`)
}
assertClose('zenek position', zenekPos(0), zenekPos(T))
assertClose('zenek scale', zenekScale(0), zenekScale(T))
assertClose('shadow scaleX', shadowScaleX(0), shadowScaleX(T))
assertClose('shadow gray', shadowGray(0), shadowGray(T))
assertClose('saccade', SACCADE_POINTS[0].v, SACCADE_POINTS[SACCADE_POINTS.length - 1].v)
assertClose('glass position', GLASS_POINTS[0].v, GLASS_POINTS[GLASS_POINTS.length - 1].v)
assertClose('eye scale', EYE_SCALE_POINTS[0].v, EYE_SCALE_POINTS[EYE_SCALE_POINTS.length - 1].v)

// ============================================================
// Layers
// ============================================================
const ZENEK_POS_IND = 50, EYES_RIG_IND = 51, GLASS_RIG_IND = 52, ZENEK_BOUNCE_IND = 53
let ind = 1
const layers = []

// -- head, face: rigid children of zenek-bounce, no own transform --
{
  const sp = HEAD[0]
  layers.push(shapeLayer({
    nm: 'head', ind: ind++, parent: ZENEK_BOUNCE_IND,
    shapes: [group('head', [shapeFromSubpath(sp, 'head-path'), fillItem('#222222')])],
    ks: baseTransform(),
  }))
}
{
  const sp = parsePath(D.face)[0]
  layers.push(shapeLayer({
    nm: 'face', ind: ind++, parent: ZENEK_BOUNCE_IND,
    shapes: [group('face', [shapeFromSubpath(sp, 'face-path'), fillItem('#FFFFFF')])],
    ks: baseTransform(),
  }))
}
// -- handle, lens: the magnifying glass, a held assembly on glass-rig --
{
  const subs = parsePath(D.handle)
  const shapes = subs.map((sp, i) => shapeFromSubpath(sp, `handle-path-${i}`))
  layers.push(shapeLayer({
    nm: 'handle', ind: ind++, parent: GLASS_RIG_IND,
    shapes: [group('handle', [...shapes, fillItem('#FFFFFF')])],
    ks: baseTransform(),
  }))
}
{
  const sp = parsePath(D.lens)[0]
  layers.push(shapeLayer({
    nm: 'lens', ind: ind++, parent: GLASS_RIG_IND,
    shapes: [group('lens', [shapeFromSubpath(sp, 'lens-path'), strokeItem('#222222', 3)])],
    ks: baseTransform(),
  }))
}

// -- eyes: children of eyes-rig, own center pivot for the blink scale --
for (const [nm, key] of [['eye-left', 'eyeLeft'], ['eye-right', 'eyeRight']]) {
  const sp = parsePath(D[key])[0]
  const c = bboxCenter(bboxOf([sp]))
  const ks = baseTransform({ a: [c[0], c[1], 0], p: [c[0], c[1], 0] })
  ks.s = sparseAnimProp(EYE_SCALE_POINTS)
  layers.push(shapeLayer({
    nm, ind: ind++, parent: EYES_RIG_IND,
    shapes: [group(nm, [shapeFromSubpath(sp, `${nm}-path`), fillItem('#222222')])],
    ks,
  }))
}

// -- hatch-shadow: the steady island, unparented, position never animates --
{
  const subs = parsePath(D.hatch)
  const c = bboxCenter(bboxOf(subs))
  const shapes = subs.map((sp, i) => shapeFromSubpath(sp, `hatch-path-${i}`))
  const ks = baseTransform({ a: [c[0], c[1], 0], p: [c[0], c[1], 0] })
  ks.s = denseAnimProp((t) => [shadowScaleX(t), 100, 100])
  layers.push(shapeLayer({
    nm: 'hatch-shadow', ind: ind++,
    shapes: [group('hatch-shadow', [...shapes, fillItemAnimatedColor(denseAnimColor(shadowGray))])],
    ks,
  }))
}

// -- rig nulls --
// zenek-position carries only the drift; zenek-bounce (nested under it)
// carries only the squash/stretch. Splitting them lets glass-rig ride the
// drift without inheriting the non-uniform scale that would ovalize the
// lens's circular geometry.
{
  const ks = baseTransform({ a: [HEAD_CENTER[0], HEAD_CENTER[1], 0] })
  ks.p = denseAnimProp(zenekPos)
  layers.push(nullLayer({ nm: 'zenek-position', ind: ZENEK_POS_IND, ks }))
}
{
  const ks = baseTransform({ a: [HEAD_CENTER[0], HEAD_CENTER[1], 0], p: [HEAD_CENTER[0], HEAD_CENTER[1], 0] })
  ks.s = denseAnimProp(zenekScale)
  layers.push(nullLayer({ nm: 'zenek-bounce', ind: ZENEK_BOUNCE_IND, parent: ZENEK_POS_IND, ks }))
}
{
  const ks = baseTransform()
  ks.p = sparseAnimProp(SACCADE_POINTS)
  layers.push(nullLayer({ nm: 'eyes-rig', ind: EYES_RIG_IND, parent: ZENEK_BOUNCE_IND, ks }))
}
{
  const ks = baseTransform()
  ks.p = sparseAnimProp(GLASS_POINTS)
  layers.push(nullLayer({ nm: 'glass-rig', ind: GLASS_RIG_IND, parent: ZENEK_POS_IND, ks }))
}

// Front-to-back paint order, matching the source SVG's own paint order
// (later <path>s paint on top; layers[0] is frontmost in this player).
const FRONT_TO_BACK = ['hatch-shadow', 'lens', 'handle', 'eye-right', 'eye-left', 'face', 'head']
layers.sort((a, b) => {
  const ia = FRONT_TO_BACK.indexOf(a.nm), ib = FRONT_TO_BACK.indexOf(b.nm)
  if (ia === -1 && ib === -1) return 0
  if (ia === -1) return 1
  if (ib === -1) return -1
  return ia - ib
})

const doc = {
  v: '5.9.0', fr: FPS, ip: 0, op: T, w: W, h: H, nm: 'Loop — Zenek Float & Search',
  ddd: 0,
  assets: [],
  layers,
  markers: [{ cm: 'loop', tm: 0, dr: T }],
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT, JSON.stringify(doc))
console.log(`Wrote ${OUT} — ${layers.length} layers, ${T}f @ ${FPS}fps (${(T / FPS).toFixed(1)}s loop)`)

// ── controls.json — layer knobs + declared relative-motion exceptions ──────
const controls = {
  layerControls: [
    { target: 'zenek-position', kind: 'amount', property: 'position', label: 'Float height', description: 'How far Zenek drifts up and down each loop.' },
    { target: 'zenek-bounce', kind: 'amount', property: 'scale', label: 'Body bounce', description: 'How much Zenek squashes and stretches as he floats.' },
    { target: 'eyes-rig', kind: 'amount', property: 'position', label: 'Glance distance', description: "How far Zenek's eyes travel when he looks around." },
    { target: 'glass-rig', kind: 'amount', property: 'position', label: 'Glass follow', description: "How closely the magnifying glass tracks Zenek's gaze." },
    { target: 'hatch-shadow', kind: 'amount', property: 'scale', label: 'Shadow breathe', description: 'How much the shadow widens as Zenek rises.' },
  ],
  motionExceptions: [
    { a: 'eye', b: 'face', reason: "brief: 'his two eyes glide together in small, curious saccades' — the eyes travel within the face during glances, welded only to the float, not to the face's own (static) position" },
    { a: 'eye', b: 'head', reason: 'same saccade motion relative to the head mass — see the face exception above' },
    { a: 'eye', b: 'lens', reason: "brief: 'his magnifying glass also moves in his paw, according to his sight direction' — the glass now follows the eye at a softened half amplitude (held-object secondary motion), so a small relative drift between eye and lens is intentional, not a rig defect" },
  ],
}
writeFileSync(join(OUT_DIR, 'controls.json'), JSON.stringify(controls, null, 2))
console.log(`Wrote ${join(OUT_DIR, 'controls.json')}`)
