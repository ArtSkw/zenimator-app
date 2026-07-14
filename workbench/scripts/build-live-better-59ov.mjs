#!/usr/bin/env node
/**
 * Builds public/projects/live-better-59ov/scene-1/lottie.json from the
 * "live better" script-lettering SVG — a continuous handwritten draw-on.
 *
 * The source is 20 separate filled paths (no ids, no strokes — each glyph
 * stroke is already a solid calligraphic fill, some with a small entry/exit
 * tail rendered as its own path). Read them by document order from the SVG
 * itself rather than transcribing coordinates, per the SVG-compatibility
 * guidance to parse programmatically.
 *
 * Grouped by eye (confirmed by isolating + highlighting each path over the
 * full artwork) into 13 letter-units in reading order:
 *   live:   l(0+1) i(3, +dot 2) v(4) e(5+6) .(7)
 *   better: b(10+11) e(8+9) t(14) t(17) ‾(13 shared crossbar) e(12+16) r(15+19) .(18)
 * Multi-path letters (main stroke + entry/exit tail) reveal on the same
 * timing window so they read as one unit, never as separate fragments.
 *
 * Reveal technique is the proven one from build-zenimator.mjs: clip the
 * exact, already-solid glyph path against a second animated region with a
 * Merge Paths "Intersect" (never a stroke/trim standing in for the fill).
 * Each component gets its OWN copy of the reveal rectangle in its OWN group
 * — intersect combines every preceding shape in a group pairwise in list
 * order, so two different glyph paths can never share one intersect stack
 * (confirmed pitfall, see svg-compatibility.md and build-allset.mjs).
 * Dots/periods pop (scale+opacity) instead of wiping — a real pen doesn't
 * "draw" a dot left-to-right.
 *
 * Letters wipe left-to-right on a brisk 5-frame stagger with 9-frame traces
 * (60fps) — heavy overlap, no pauses, phrase fully written by ~frame 59
 * (~1s), matching the brief. Final frame matches the source SVG exactly.
 *
 * Layer paint order mirrors the source SVG's document order exactly (later
 * elements paint on top), rather than grouping by letter, since stacking
 * varies per letter and isn't a simple main-over-tail rule throughout.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SVG_PATH = join(__dirname, '../assets/live-better-59ov.svg')
const OUT_DIR = join(__dirname, '../public/projects/live-better-59ov/scene-1')

const FR = 60
const OP = 100 // ~1s brisk write-on (0-59) + settle hold to a clean still
const EASE_INOUT = { o: { x: [0.42], y: [0] }, i: { x: [0.58], y: [1] } }
const EASE = {
  entranceSharp: { o: { x: [0.20], y: [0.75] }, i: { x: [0.34], y: [0.94] } },
  settleSoft: { o: { x: [0.00], y: [0.65] }, i: { x: [0.51], y: [0.99] } },
}
const INK = [0x22 / 255, 0xe2 / 255, 0x43 / 255]

// ---------- SVG path parsing (M, C, Z — verified sufficient for this SVG) ----------

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
      if (Math.abs(last.pt[0] - first.pt[0]) < 1e-4 && Math.abs(last.pt[1] - first.pt[1]) < 1e-4) {
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
  for (const sp of subpaths) for (const v of sp.verts) {
    minX = Math.min(minX, v.pt[0]); maxX = Math.max(maxX, v.pt[0])
    minY = Math.min(minY, v.pt[1]); maxY = Math.max(maxY, v.pt[1])
  }
  return { minX, minY, maxX, maxY }
}
function bboxCenter(subpaths) {
  const b = bbox(subpaths)
  return [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2]
}

// Vertex-only bbox understates a cursive glyph's true extent — control handles
// on these sweeping strokes bulge up to ~8px past their vertices (confirmed by
// sampling). A wipe mask sized from vertices alone leaves the "closed" rect's
// edge inside the curve's real silhouette, so a sliver of ink shows before the
// letter's start frame and clips a sliver at its end frame. Sample the cubics.
function curveBbox(subpaths) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const bez = (p0, p1, p2, p3, t) => {
    const mt = 1 - t
    return [
      mt * mt * mt * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t * t * t * p3[0],
      mt * mt * mt * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t * t * t * p3[1],
    ]
  }
  for (const sp of subpaths) {
    const verts = sp.verts
    const n = verts.length
    const segCount = sp.closed ? n : n - 1
    for (let k = 0; k < segCount; k++) {
      const a = verts[k], b = verts[(k + 1) % n]
      const p0 = a.pt, p1 = [a.pt[0] + a.o[0], a.pt[1] + a.o[1]], p2 = [b.pt[0] + b.i[0], b.pt[1] + b.i[1]], p3 = b.pt
      for (let s = 0; s <= 24; s++) {
        const pt = bez(p0, p1, p2, p3, s / 24)
        minX = Math.min(minX, pt[0]); maxX = Math.max(maxX, pt[0])
        minY = Math.min(minY, pt[1]); maxY = Math.max(maxY, pt[1])
      }
    }
  }
  return { minX, minY, maxX, maxY }
}

// ---------- Lottie shape builders ----------

function pathShapes(subpaths) {
  return subpaths.map((sp, i) => ({
    ty: 'sh',
    nm: `path${i}`,
    ks: { a: 0, k: { c: true, i: sp.verts.map(v => v.i), o: sp.verts.map(v => v.o), v: sp.verts.map(v => v.pt) } },
  }))
}
function staticTransform() {
  return { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } }
}
function popTransform(center, start, end) {
  return {
    ty: 'tr',
    p: { a: 0, k: center },
    a: { a: 0, k: center },
    s: {
      a: 1,
      k: [
        { t: start, s: [0, 0], e: [118, 118], o: EASE.entranceSharp.o, i: EASE.entranceSharp.i },
        { t: start + Math.round((end - start) * 0.7), s: [118, 118], e: [100, 100], o: EASE.settleSoft.o, i: EASE.settleSoft.i },
        { t: end, s: [100, 100] },
      ],
    },
    r: { a: 0, k: 0 },
    o: { a: 0, k: 100 },
  }
}
function fillItem() {
  return { ty: 'fl', nm: 'ink', c: { sid: 'inkColor' }, o: { a: 0, k: 100 }, r: 1 }
}
function opacityKF(start, end, from, to) {
  return { a: 1, k: [{ t: start, s: [from], e: [to], o: EASE_INOUT.o, i: EASE_INOUT.i }, { t: end, s: [to] }] }
}
function mergeIntersect() {
  return { ty: 'mm', mm: 4, nm: 'intersect' }
}
function slantRectKS(x0, y0, x1, y1, edgeX, slant) {
  return { c: true, v: [[x0, y0], [edgeX + slant, y0], [edgeX - slant, y1], [x0, y1]], i: [[0, 0], [0, 0], [0, 0], [0, 0]], o: [[0, 0], [0, 0], [0, 0], [0, 0]] }
}

// Clips the exact glyph path against a rectangle that grows left-to-right —
// the true geometry is on screen at every frame, just progressively more of
// it (see build-zenimator.mjs for the fuller rationale on why this beats
// trimming a filled path or crossfading a stroke stand-in).
function wipeRevealGroup(nm, subpaths, { start, end }) {
  const b = curveBbox(subpaths)
  const slant = Math.min(2.2, (b.maxY - b.minY) * 0.3)
  const margin = slant + 1
  const y0 = b.minY - margin, y1 = b.maxY + margin
  const x0 = b.minX - margin, x1 = b.maxX + margin
  const rectShape = {
    ty: 'sh', nm: 'reveal',
    ks: {
      a: 1,
      k: [
        { t: start, s: [slantRectKS(x0, y0, x1, y1, x0, slant)], e: [slantRectKS(x0, y0, x1, y1, x1, slant)], o: EASE_INOUT.o, i: EASE_INOUT.i },
        { t: end, s: [slantRectKS(x0, y0, x1, y1, x1, slant)] },
      ],
    },
  }
  return { ty: 'gr', nm, it: [...pathShapes(subpaths), rectShape, mergeIntersect(), fillItem(), staticTransform()] }
}

// Dots/periods pop into place (scale + opacity) rather than wiping — a pen
// taps a dot, it doesn't draw one left-to-right.
function popGroup(nm, subpaths, { start, end }) {
  const center = bboxCenter(subpaths)
  return { ty: 'gr', nm, it: [...pathShapes(subpaths), fillItem(), popTransform(center, start, end)] }
}

function layer({ nm, ind, group }) {
  return {
    ddd: 0, ind, ty: 4, nm, sr: 1,
    ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] }, p: { a: 0, k: [0, 0, 0] } },
    ao: 0, shapes: [group], ip: 0, op: OP, st: 0, bm: 0,
  }
}

// ---------- Read source SVG paths (document order = paint order) ----------

const svg = readFileSync(SVG_PATH, 'utf8')
const W = Number(svg.match(/width="(\d+)"/)[1])
const H = Number(svg.match(/height="(\d+)"/)[1])
const rawPathEls = svg.match(/<path[^>]*\/>/g)
const PATHS = rawPathEls.map((el) => parsePathData(el.match(/d="([^"]+)"/)[1]))

// ---------- Timing: 11 brisk overlapping wipe slots (5f stagger, 9f trace) ----------
const STEP = 5, TRACE = 9
const slot = (k) => ({ start: k * STEP, end: k * STEP + TRACE })
const SLOT = {
  l: slot(0), iBody: slot(1), v: slot(2), e1live: slot(3), b: slot(4),
  e1better: slot(5), t1: slot(6), t2: slot(7), crossbar: slot(8), e2better: slot(9), r: slot(10),
}

// path index -> { key: letter-unit name, type, timing }
const PLAN = {
  0: { key: 'l-main', type: 'wipe', t: SLOT.l },
  1: { key: 'l-tail', type: 'wipe', t: SLOT.l },
  2: { key: 'i-dot', type: 'pop', t: { start: 12, end: 18 } },
  3: { key: 'i-body', type: 'wipe', t: SLOT.iBody },
  4: { key: 'v', type: 'wipe', t: SLOT.v },
  5: { key: 'e-live-tail', type: 'wipe', t: SLOT.e1live },
  6: { key: 'e-live-main', type: 'wipe', t: SLOT.e1live },
  7: { key: 'period-1', type: 'pop', t: { start: 22, end: 28 } },
  8: { key: 'e1-main', type: 'wipe', t: SLOT.e1better },
  9: { key: 'e1-tail', type: 'wipe', t: SLOT.e1better },
  10: { key: 'b-main', type: 'wipe', t: SLOT.b },
  11: { key: 'b-tail', type: 'wipe', t: SLOT.b },
  12: { key: 'e2-main', type: 'wipe', t: SLOT.e2better },
  13: { key: 'tt-crossbar', type: 'wipe', t: SLOT.crossbar },
  14: { key: 't1', type: 'wipe', t: SLOT.t1 },
  15: { key: 'r-stem', type: 'wipe', t: SLOT.r },
  16: { key: 'e2-tail', type: 'wipe', t: SLOT.e2better },
  17: { key: 't2', type: 'wipe', t: SLOT.t2 },
  18: { key: 'period-2', type: 'pop', t: { start: 57, end: 64 } },
  19: { key: 'r-tail', type: 'wipe', t: SLOT.r },
}

// ---------- Build one layer per source path, painted in source doc order ----------

let ind = 1
const layers = []
for (let i = 0; i < PATHS.length; i++) {
  const spec = PLAN[i]
  const subpaths = PATHS[i]
  const group = spec.type === 'wipe'
    ? wipeRevealGroup(spec.key, subpaths, spec.t)
    : popGroup(spec.key, subpaths, spec.t)
  layers.push({ i, l: layer({ nm: spec.key, ind: ind++, group }) })
}
// Later SVG elements paint on top; Lottie layers array index 0 = frontmost.
layers.sort((a, b) => b.i - a.i)
const finalLayers = layers.map((x) => x.l)

const lottie = {
  v: '5.9.0', fr: FR, ip: 0, op: OP, w: W, h: H, nm: 'Live Better Entrance',
  ddd: 0,
  slots: { inkColor: { p: { a: 0, k: [...INK, 1] } } },
  assets: [],
  layers: finalLayers,
  markers: [],
}
const controls = { controls: [{ sid: 'inkColor', label: 'Ink color' }] }

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(join(OUT_DIR, 'lottie.json'), JSON.stringify(lottie))
writeFileSync(join(OUT_DIR, 'controls.json'), JSON.stringify(controls, null, 2))
console.log(`Wrote ${join(OUT_DIR, 'lottie.json')} — ${finalLayers.length} layers, ${OP}f @ ${FR}fps, canvas ${W}x${H}`)
