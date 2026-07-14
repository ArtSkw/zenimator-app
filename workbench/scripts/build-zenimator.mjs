#!/usr/bin/env node
/**
 * Builds public/projects/zenimator/scene-1/lottie.json from the ZENimator
 * source SVG. Icon (icon-body + icon-dot) is animated on its own as a
 * trace-then-slide; the wordmark letters are hand-choreographed to draw on
 * letter by letter, brisk and uniform, overlapping the tail of the icon's
 * slide.
 *
 * Every shape is the exact, already-solid source path at every frame — never
 * a stroke or outline standing in for it. Progressive reveal is done with a
 * Merge Paths "Intersect" modifier: the true glyph path is clipped against a
 * second, animated region (a growing rectangle for letters; a rotating pie
 * wedge, baked frame-by-frame, for the icon's circular draw-on). Two earlier
 * approaches were tried and rejected: trimming the filled path directly
 * produces a straight "chord" cut across the shape once the trim endpoints
 * are far apart, and drawing with a stroke-then-crossfade shows a rounded
 * stroke silhouette that doesn't match the letterform until it swaps. Both
 * read as a wrong/rough intermediate shape. Intersect-clipping never does —
 * it only ever shows a sub-region of the correct, final geometry.
 *
 * The two letters with a counter/hole ("a", "o") are two subpaths that must
 * share one fill for the hole to subtract via nonzero winding; Merge Paths
 * combines shapes pairwise in list order, so intersecting [outer, hole, rect]
 * would clip the hole against the outer first and lose the letterform. For
 * just those two, the exact glyph (hole intact) materializes with a quick
 * opacity fade instead — still the exact shape at every frame, never a wrong
 * silhouette, just varying alpha.
 *
 * A soft/feathered reveal edge was attempted and rejected. A true gradient
 * fill doesn't work here — this Skottie build silently fails to render
 * anything once a "gf" shape's start/end points are animated (confirmed with
 * an isolated before/after test, a real player limitation). A stepped-opacity
 * approximation (a handful of thin slivers fading 88%→15%) was tried next,
 * but every step is a hard-edged rectangle, so it reads as visible stripes
 * rather than a blur, and the innermost sliver ends up sitting inside the
 * settled glyph forever (Lottie holds the last keyframe), leaving a
 * permanent faint bar at each glyph's edge. Both are real artifacts, not a
 * rendering fluke. The edge is intentionally crisp instead, which also suits
 * this brand mark's clean geometric style — but see slantRectKS() below for
 * a dynamic diagonal cut instead of a flat vertical one, and the comment on
 * radialRevealGroup() for why the icon's sweep starts/ends where it does.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SVG_PATH = join(__dirname, '../assets/zenimator-logo-for-animation.svg')
const OUT_DIR = join(__dirname, '../public/projects/zenimator/scene-1')

const FR = 60
const EASE_INOUT = { o: { x: [0.42], y: [0] }, i: { x: [0.58], y: [1] } } // symmetric ease-in-out, everywhere

// ---------- SVG path parsing (M, L, H, V, C, Z only — verified above) ----------

function parsePathData(d) {
  const tokens = d.match(/[MLHVCZ]|-?\d*\.?\d+(?:e-?\d+)?/gi)
  let idx = 0
  let cur = [0, 0]
  const subpaths = []
  let sp = null

  function newVert(pt) {
    return { pt, i: [0, 0], o: [0, 0] }
  }
  function closeAndPush() {
    if (!sp) return
    if (sp.closed && sp.verts.length > 1) {
      const first = sp.verts[0]
      const last = sp.verts[sp.verts.length - 1]
      const dx = Math.abs(last.pt[0] - first.pt[0])
      const dy = Math.abs(last.pt[1] - first.pt[1])
      if (dx < 1e-4 && dy < 1e-4) {
        first.i = last.i
        sp.verts.pop()
      }
    }
    subpaths.push(sp)
  }

  while (idx < tokens.length) {
    const t = tokens[idx]
    if (/^[MLHVCZ]$/i.test(t)) {
      const cmd = t.toUpperCase()
      idx++
      if (cmd === 'M') {
        closeAndPush()
        const x = parseFloat(tokens[idx++]), y = parseFloat(tokens[idx++])
        cur = [x, y]
        sp = { closed: false, verts: [newVert(cur)] }
      } else if (cmd === 'L') {
        const x = parseFloat(tokens[idx++]), y = parseFloat(tokens[idx++])
        cur = [x, y]
        sp.verts.push(newVert(cur))
      } else if (cmd === 'H') {
        const x = parseFloat(tokens[idx++])
        cur = [x, cur[1]]
        sp.verts.push(newVert(cur))
      } else if (cmd === 'V') {
        const y = parseFloat(tokens[idx++])
        cur = [cur[0], y]
        sp.verts.push(newVert(cur))
      } else if (cmd === 'C') {
        const x1 = parseFloat(tokens[idx++]), y1 = parseFloat(tokens[idx++])
        const x2 = parseFloat(tokens[idx++]), y2 = parseFloat(tokens[idx++])
        const x = parseFloat(tokens[idx++]), y = parseFloat(tokens[idx++])
        const prev = sp.verts[sp.verts.length - 1]
        prev.o = [x1 - prev.pt[0], y1 - prev.pt[1]]
        cur = [x, y]
        const v = newVert(cur)
        v.i = [x2 - x, y2 - y]
        sp.verts.push(v)
      } else if (cmd === 'Z') {
        sp.closed = true
      }
    } else {
      idx++
    }
  }
  closeAndPush()
  return subpaths
}

function bbox(subpaths) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const sp of subpaths) {
    for (const v of sp.verts) {
      minX = Math.min(minX, v.pt[0]); maxX = Math.max(maxX, v.pt[0])
      minY = Math.min(minY, v.pt[1]); maxY = Math.max(maxY, v.pt[1])
    }
  }
  return { minX, minY, maxX, maxY }
}

function bboxCenter(subpaths) {
  const b = bbox(subpaths)
  return [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2]
}

// ---------- Lottie shape builders ----------

function pathShapes(subpaths) {
  return subpaths.map((sp, i) => ({
    ty: 'sh',
    nm: `path${i}`,
    ks: {
      a: 0,
      k: {
        c: true,
        i: sp.verts.map(v => v.i),
        o: sp.verts.map(v => v.o),
        v: sp.verts.map(v => v.pt),
      },
    },
  }))
}

function staticTransform() {
  return {
    ty: 'tr',
    p: { a: 0, k: [0, 0] },
    a: { a: 0, k: [0, 0] },
    s: { a: 0, k: [100, 100] },
    r: { a: 0, k: 0 },
    o: { a: 0, k: 100 },
  }
}

function popTransform(center, start, end) {
  return {
    ty: 'tr',
    p: { a: 0, k: center },
    a: { a: 0, k: center },
    s: {
      a: 1,
      k: [
        { t: start, s: [0, 0], e: [100, 100], o: EASE_INOUT.o, i: EASE_INOUT.i },
        { t: end, s: [100, 100] },
      ],
    },
    r: { a: 0, k: 0 },
    o: { a: 0, k: 100 },
  }
}

function fillShape(opacityProp) {
  return { ty: 'fl', c: { sid: 'brandColor' }, o: opacityProp, r: 1 }
}

function mergeIntersect() {
  return { ty: 'mm', mm: 4, nm: 'intersect' }
}

function rectKS(x0, y0, x1, y1) {
  return { c: true, v: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], i: [[0, 0], [0, 0], [0, 0], [0, 0]], o: [[0, 0], [0, 0], [0, 0], [0, 0]] }
}

// A parallelogram whose leading edge is slanted (top pushed ahead of
// bottom) instead of a plain vertical cut — reads as a dynamic diagonal
// wipe rather than a flat guillotine edge.
function slantRectKS(x0, y0, x1, y1, edgeX, slant) {
  return {
    c: true,
    v: [[x0, y0], [edgeX + slant, y0], [edgeX - slant, y1], [x0, y1]],
    i: [[0, 0], [0, 0], [0, 0], [0, 0]],
    o: [[0, 0], [0, 0], [0, 0], [0, 0]],
  }
}

function opacityKF(start, end, from, to) {
  return {
    a: 1,
    k: [
      { t: start, s: [from], e: [to], o: EASE_INOUT.o, i: EASE_INOUT.i },
      { t: end, s: [to] },
    ],
  }
}

function popGroup(nm, subpaths, { start, end }) {
  const center = bboxCenter(subpaths)
  return {
    ty: 'gr',
    nm: `${nm}-pop`,
    it: [...pathShapes(subpaths), fillShape({ a: 0, k: 100 }), popTransform(center, start, end)],
  }
}

// Draws a single-subpath glyph on by clipping its exact, already-solid path
// against a region that grows left-to-right — the true geometry is what's
// on screen at every frame, just progressively more of it. A 2-keyframe tween
// is safe here because every vertex of the reveal shape moves in a straight
// line (simple linear growth), so Skottie's normal shape interpolation
// reproduces it exactly.
//
// The leading edge is slanted rather than a plain vertical cut — a dynamic
// diagonal wipe reads as more considered/premium than a flat guillotine
// edge straight down the glyph.
function wipeRevealGroup(nm, subpaths, { start, end }) {
  const b = bbox(subpaths)
  const slant = Math.min(2.2, (b.maxY - b.minY) * 0.3)
  // margin must clear the slant on both edges, or the leading corner (at
  // rest, before start) still exposes a sliver, and the trailing corner (at
  // rest, after end) still clips a bit of the glyph — both confirmed bugs.
  const margin = slant + 1
  const y0 = b.minY - margin, y1 = b.maxY + margin
  const x0 = b.minX - margin, x1 = b.maxX + margin
  const rectShape = {
    ty: 'sh',
    nm: 'reveal',
    ks: {
      a: 1,
      k: [
        { t: start, s: [slantRectKS(x0, y0, x1, y1, x0, slant)], e: [slantRectKS(x0, y0, x1, y1, x1, slant)], o: EASE_INOUT.o, i: EASE_INOUT.i },
        { t: end, s: [slantRectKS(x0, y0, x1, y1, x1, slant)] },
      ],
    },
  }
  return [
    {
      ty: 'gr',
      nm,
      it: [...pathShapes(subpaths), rectShape, mergeIntersect(), fillShape({ a: 0, k: 100 }), staticTransform()],
    },
  ]
}

// Compound glyphs with a counter/hole ("a"/"o") can't go through the
// intersect-reveal above — Merge Paths combines shapes pairwise in list
// order, so clipping [outer, hole, rect] would clip the hole against the
// outer contour first and lose the letterform. Instead the exact glyph
// (hole intact, via its normal shared fill) materializes with a quick
// opacity fade — still only ever the correct silhouette, just at partial
// alpha, never a wrong intermediate shape.
function fadeRevealGroup(nm, subpaths, { start, end }) {
  return {
    ty: 'gr',
    nm,
    it: [...pathShapes(subpaths), fillShape(opacityKF(start, end, 0, 100)), staticTransform()],
  }
}

// ---------- Baked angular reveal (icon) ----------

// Evaluate a CSS-style cubic-bezier easing curve at t in [0,1] (bisection on
// the x-parameter, since Lottie's o/i control points are given the same way).
function easeBezierProgress(x1, y1, x2, y2, t) {
  function bez(a, b, u) {
    const mu = 1 - u
    return 3 * mu * mu * u * a + 3 * mu * u * u * b + u * u * u
  }
  let lo = 0, hi = 1
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (bez(x1, x2, mid) < t) lo = mid
    else hi = mid
  }
  const u = (lo + hi) / 2
  return bez(y1, y2, u)
}

function pieWedgeKS(center, radius, startDeg, sweepDeg, segments) {
  const v = [center]
  for (let s = 0; s <= segments; s++) {
    const deg = startDeg + (sweepDeg * s) / segments
    const rad = (deg * Math.PI) / 180
    v.push([center[0] + radius * Math.cos(rad), center[1] + radius * Math.sin(rad)])
  }
  const zeros = v.map(() => [0, 0])
  return { c: true, v, i: zeros, o: zeros }
}

// Bake one keyframe per frame from `start` to `end`, sampling valueFn at the
// eased progress for that frame (and the next, for the "e" side of the pair).
// Needed for anything that doesn't move in a straight line per-vertex (like a
// rotating wedge) — a plain 2-keyframe tween would interpolate each vertex
// independently and "inflate" rather than sweep.
function bakeKeyframes(start, end, valueFn) {
  const progressAt = f => easeBezierProgress(EASE_INOUT.o.x[0], EASE_INOUT.o.y[0], EASE_INOUT.i.x[0], EASE_INOUT.i.y[0], (f - start) / (end - start))
  const keys = []
  for (let f = start; f <= end; f++) {
    const val = valueFn(progressAt(f))
    if (f === end) keys.push({ t: f, s: [val] })
    else keys.push({ t: f, s: [val], e: [valueFn(progressAt(f + 1))] })
  }
  return { a: 1, k: keys }
}

// The icon is drawn on as a rotating pie wedge (baked one keyframe per
// frame, eased) intersected with the true icon path — a genuine circular
// "clock wipe" of the exact silhouette, never a stroke standing in for it.
//
// startDeg/sweepDeg are tuned (not the default full 0-360 sweep) to match
// this specific mark's geometry: the icon is a "C" ring with a small hook
// tail near the top and a rounded, thicker lobe on the right, with the gap
// between them (where the separate dot sits) spanning roughly -85 to 0.
// Starting the sweep well before the lobe (-50) and ending just past the
// tail (292, equivalent to -68) means the reveal begins at the bold lobe and
// finishes with the hook tail as the very last thing drawn, instead of
// starting mid-tail as a disconnected-looking floating sliver (the original
// -90/360 default did exactly that, since -90 sits right inside the tail).
// The starting angle needs real margin past the lobe's own edge vertex
// (-37.9° in the source path) — the bezier curve there bulges further out
// than the vertex angle alone suggests, so -40 (barely past the vertex)
// still sliced a visible flat facet through the lobe; -50 clears it.
function radialRevealGroup(nm, subpaths, { start, end, startDeg = -50, sweepDeg = 342, segments = 48 }) {
  const b = bbox(subpaths)
  const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2
  const radius = Math.hypot(b.maxX - b.minX, b.maxY - b.minY) // generously covers the bbox at any angle
  const shapeKS = bakeKeyframes(start, end, p => pieWedgeKS([cx, cy], radius, startDeg, Math.max(p * sweepDeg, 0.01), segments))
  return [
    {
      ty: 'gr',
      nm,
      it: [...pathShapes(subpaths), { ty: 'sh', nm: 'reveal', ks: shapeKS }, mergeIntersect(), fillShape({ a: 0, k: 100 }), staticTransform()],
    },
  ]
}

// ---------- Read source SVG ----------

const svg = readFileSync(SVG_PATH, 'utf8')
const rawPaths = {}
for (const m of svg.matchAll(/<path id="([^"]+)" d="([^"]+)"/g)) {
  rawPaths[m[1]] = parsePathData(m[2])
}

const iconBody = rawPaths['icon-body']
const iconDot = rawPaths['icon-dot']
const allIconVerts = [...iconBody, ...iconDot]
const iconCenter = bboxCenter(allIconVerts) // ~[12.035, 12]

const CANVAS_W = 135, CANVAS_H = 24
const canvasCenter = [CANVAS_W / 2, CANVAS_H / 2] // [67.5, 12]

const OP = 133 // total composition length in frames (entrance ~98f / 1.63s + a settled hold)

// ---------- Icon layer ----------

const ICON_TRACE_START = 0
const ICON_TRACE_END = 27
const ICON_DOT_START = 26
const ICON_DOT_END = 36
const ICON_SLIDE_START = 27
const ICON_SLIDE_END = 48

const iconShapes = [
  popGroup('icon-dot', iconDot, { start: ICON_DOT_START, end: ICON_DOT_END }),
  ...radialRevealGroup('icon-body', iconBody, { start: ICON_TRACE_START, end: ICON_TRACE_END }),
]

const iconLayer = {
  ty: 4,
  nm: 'icon',
  ip: 0,
  op: OP,
  st: 0,
  ks: {
    o: { a: 0, k: 100 },
    r: { a: 0, k: 0 },
    a: { a: 0, k: [iconCenter[0], iconCenter[1], 0] },
    s: { a: 0, k: [100, 100, 100] },
    p: {
      a: 1,
      k: [
        {
          t: ICON_SLIDE_START,
          s: [canvasCenter[0], canvasCenter[1], 0],
          e: [iconCenter[0], iconCenter[1], 0],
          o: { x: [...EASE_INOUT.o.x, EASE_INOUT.o.x[0]], y: [...EASE_INOUT.o.y, EASE_INOUT.o.y[0]] },
          i: { x: [...EASE_INOUT.i.x, EASE_INOUT.i.x[0]], y: [...EASE_INOUT.i.y, EASE_INOUT.i.y[0]] },
        },
        { t: ICON_SLIDE_END, s: [iconCenter[0], iconCenter[1], 0] },
      ],
    },
  },
  shapes: iconShapes,
}

// ---------- Wordmark layer ----------

// Brisk, uniform stagger (7f step, 9f trace) — no pauses between letters.
// The last letter ("r") gets a touch more time so the whole entrance settles
// rather than stopping abruptly; timing itself is the same ease-in-out as
// everything else.
const LETTER_ORDER = [
  { key: 'letter-Z', type: 'wipe', start: 38, end: 45 },
  { key: 'letter-E', type: 'wipe', start: 44, end: 51 },
  { key: 'letter-N', type: 'wipe', start: 50, end: 57 },
  { key: 'letter-i-stem', type: 'wipe', start: 56, end: 62 },
  { key: 'letter-i-dot', type: 'pop', start: 59, end: 65 },
  { key: 'letter-m', type: 'wipe', start: 62, end: 69 },
  { key: 'letter-a', type: 'fade', start: 67, end: 75 },
  { key: 'letter-t', type: 'wipe', start: 73, end: 80 },
  { key: 'letter-o', type: 'fade', start: 79, end: 86 },
  { key: 'letter-r', type: 'wipe', start: 85, end: 98 },
]

const wordmarkShapes = []
for (const spec of LETTER_ORDER) {
  const subpaths = rawPaths[spec.key]
  if (spec.type === 'wipe') {
    wordmarkShapes.push(...wipeRevealGroup(spec.key, subpaths, { start: spec.start, end: spec.end }))
  } else if (spec.type === 'fade') {
    wordmarkShapes.push(fadeRevealGroup(spec.key, subpaths, { start: spec.start, end: spec.end }))
  } else {
    wordmarkShapes.push(popGroup(spec.key, subpaths, { start: spec.start, end: spec.end }))
  }
}

const wordmarkLayer = {
  ty: 4,
  nm: 'wordmark',
  ip: 0,
  op: OP,
  st: 0,
  ks: {
    o: { a: 0, k: 100 },
    r: { a: 0, k: 0 },
    a: { a: 0, k: [0, 0, 0] },
    s: { a: 0, k: [100, 100, 100] },
    p: { a: 0, k: [0, 0, 0] },
  },
  shapes: wordmarkShapes,
}

// ---------- Composition ----------

const lottie = {
  v: '5.7.0',
  fr: FR,
  ip: 0,
  op: OP,
  w: CANVAS_W,
  h: CANVAS_H,
  nm: 'ZENimator Logo Entrance',
  slots: {
    brandColor: { p: { a: 0, k: [0, 0, 0, 1] } },
  },
  assets: [],
  layers: [wordmarkLayer, iconLayer],
}

const controls = {
  controls: [{ sid: 'brandColor', label: 'Brand color' }],
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(join(OUT_DIR, 'lottie.json'), JSON.stringify(lottie, null, 2))
writeFileSync(join(OUT_DIR, 'controls.json'), JSON.stringify(controls, null, 2))
console.log(`Wrote ${join(OUT_DIR, 'lottie.json')}`)
console.log(`icon center: ${iconCenter}, canvas center: ${canvasCenter}`)
