#!/usr/bin/env node
/**
 * Generates the Lottie JSON for live-better-t2vl — "live. better." handwritten
 * entrance. Source: assets/live-better-t2vl.svg (20 filled brush-stroke paths,
 * two lines of monoline script, per-path radial gradients).
 *
 * Technique: matte-wipe write-on over untouched source artwork (see
 * skills/text-to-lottie/references/recipe-typography.md, "Handwritten Write-On
 * Over Gradient Artwork"). Every path keeps its exact source fill (solid or
 * radial gradient, converted per svg-compatibility.md's userSpaceOnUse
 * radialGradient formula) — the reveal lives entirely in a soft-edge gradient
 * matte swept left-to-right per letter-unit, never in the paint.
 *
 * The 20 source paths were mapped by rendering each path in isolation against
 * the full word (scripts are throwaway; see conversation) into 13 writing
 * units in left-to-right ductus order: l, i, v, e, "." , b, e, t, t, [tt
 * crossbar], e, r, "." — letters that self-cross (l, i, b, e, r) are built from
 * 2 source paths but revealed as one atomic unit per the brief ("treat each
 * whole letter as one unit"). The "tt" crossbar is one shared brush stroke
 * across both stems in the source — rather than fragment it, it is its own
 * tiny unit that sweeps right after the second t, exactly like a hand crossing
 * both stems in one pass.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SVG_FILE = join(__dirname, '../assets/live-better-t2vl.svg')
const OUT_DIR = join(__dirname, '../public/projects/live-better-t2vl/scene-1')
const OUT = join(OUT_DIR, 'lottie.json')

const W = 575, H = 374, FPS = 60

// ── SVG intake ─────────────────────────────────────────────────────────────
const svg = readFileSync(SVG_FILE, 'utf8')

function parseAttrs(tag) {
  const attrs = {}
  for (const m of tag.matchAll(/([\w-]+)="([^"]*)"/g)) attrs[m[1]] = m[2]
  return attrs
}

const SRC_PATHS = [...svg.matchAll(/<path\b([^>]*)\/>/g)].map((m) => {
  const attrs = parseAttrs(m[1])
  const fillUrl = attrs.fill.match(/^url\(#(.+)\)$/)
  return {
    d: attrs.d,
    evenodd: attrs['fill-rule'] === 'evenodd',
    solid: fillUrl ? null : attrs.fill,
    gradId: fillUrl ? fillUrl[1] : null,
  }
})

const GRADIENTS = {}
for (const m of svg.matchAll(/<radialGradient\b([^>]*)>([\s\S]*?)<\/radialGradient>/g)) {
  const attrs = parseAttrs(m[1])
  const id = attrs.id
  const gt = attrs.gradientTransform.match(
    /translate\(([^)]+)\)\s*rotate\(([^)]+)\)\s*scale\(([^)]+)\)/,
  )
  const [tx, ty] = gt[1].trim().split(/\s+/).map(Number)
  const rot = Number(gt[2].trim())
  const [sx, sy] = gt[3].trim().split(/\s+/).map(Number)
  const stops = [...m[2].matchAll(/<stop\b([^/]*)\/>/g)].map((sm) => {
    const sa = parseAttrs(sm[1])
    return {
      offset: sa.offset !== undefined ? Number(sa.offset) : 0,
      color: sa['stop-color'],
      opacity: sa['stop-opacity'] !== undefined ? Number(sa['stop-opacity']) : 1,
    }
  })
  GRADIENTS[id] = { tx, ty, rot, sx, sy, stops }
}

// ── SVG path → Lottie bezier (M L C Z only, matches this source) ───────────
function parsePath(d) {
  const RE = /([MLCZmlcz])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g
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
    if (V?.length > 0) segs.push({ v: [...V], i: [...I], o: [...O], c: cl })
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

const SEGS = SRC_PATHS.map((p) => parsePath(p.d)[0])

function segBBox(seg) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const n = seg.v.length
  for (let k = 0; k < n; k++) {
    const pts = [seg.v[k], [seg.v[k][0] + seg.o[k][0], seg.v[k][1] + seg.o[k][1]], [seg.v[k][0] + seg.i[k][0], seg.v[k][1] + seg.i[k][1]]]
    for (const [x, y] of pts) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x)
      minY = Math.min(minY, y); maxY = Math.max(maxY, y)
    }
  }
  return { minX, minY, maxX, maxY }
}
function bboxUnion(...boxes) {
  return {
    minX: Math.min(...boxes.map((b) => b.minX)),
    minY: Math.min(...boxes.map((b) => b.minY)),
    maxX: Math.max(...boxes.map((b) => b.maxX)),
    maxY: Math.max(...boxes.map((b) => b.maxY)),
  }
}

// ── Writing units, left-to-right ductus order ───────────────────────────────
const UNITS = [
  { nm: 'l', paths: [1, 0] },
  { nm: 'i', paths: [2, 3] },
  { nm: 'v', paths: [4] },
  { nm: 'e1', paths: [5, 6] },
  { nm: 'period1', paths: [7] },
  { nm: 'b', paths: [11, 10] },
  { nm: 'e2', paths: [9, 8] },
  { nm: 't1', paths: [14] },
  { nm: 't2', paths: [17] },
  { nm: 'tt-cross', paths: [13] },
  { nm: 'e3', paths: [12, 16] },
  { nm: 'r', paths: [19, 15] },
  { nm: 'period2', paths: [18] },
]

for (const u of UNITS) u.bbox = bboxUnion(...u.paths.map((i) => segBBox(SEGS[i])))

// ── Timing: brisk, heavily overlapping stagger — whole write in ~1s ────────
const OVERLAP = 0.62 // fraction of previous unit's draw the next one starts into
let t = 0
for (const u of UNITS) {
  const width = u.bbox.maxX - u.bbox.minX
  const isDot = u.nm.startsWith('period')
  u.dur = isDot ? 6 : Math.round(Math.min(16, Math.max(8, width / 13)))
  u.start = Math.round(t)
  t = u.start + u.dur * (1 - OVERLAP)
}
const WRITE_END = Math.max(...UNITS.map((u) => u.start + u.dur))
const HOLD = 45
const FRAMES = Math.round(WRITE_END) + HOLD

// ── Lottie helpers ───────────────────────────────────────────────────────────
const sk = (k) => ({ a: 0, k })
function hexToRgb1(hex) {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]
}
const GREEN = hexToRgb1('#22E243')

function pathShape(seg, nm) {
  return { ty: 'sh', nm, ks: sk({ v: seg.v, i: seg.i, o: seg.o, c: seg.c }) }
}

function fillFor(pathIdx) {
  const src = SRC_PATHS[pathIdx]
  const r = src.evenodd ? 2 : 1
  if (src.solid) return { ty: 'fl', nm: 'fill', c: sk(GREEN), o: sk(100), r }
  const g = GRADIENTS[src.gradId]
  const rad = (a) => (a * Math.PI) / 180
  const s = [g.tx, g.ty]
  const e = [g.tx + g.sx * Math.cos(rad(g.rot)), g.ty + g.sx * Math.sin(rad(g.rot))]
  const colorArr = [], alphaArr = []
  for (const st of g.stops) {
    const [cr, cg, cb] = hexToRgb1(st.color)
    colorArr.push(st.offset, cr, cg, cb)
    alphaArr.push(st.offset, st.opacity)
  }
  return {
    ty: 'gf',
    nm: 'gradient',
    o: sk(100),
    r,
    t: 2,
    s: sk(s),
    e: sk(e),
    g: { p: g.stops.length, k: sk([...colorArr, ...alphaArr]) },
  }
}

function letterGroup(pathIdx) {
  return {
    ty: 'gr',
    nm: `path-${pathIdx}`,
    it: [
      pathShape(SEGS[pathIdx], `p${pathIdx}`),
      fillFor(pathIdx),
      { ty: 'tr', p: sk([0, 0]), a: sk([0, 0]), s: sk([100, 100]), r: sk(0), o: sk(100) },
    ],
  }
}

// Handwriting-ease: quick confident acceleration into a settled landing —
// every letter "arrives" rather than drifting to a stop.
const EASE_O = { x: [0.3], y: [0] }
const EASE_I = { x: [0.15], y: [1] }

function matteLayer(nm, ind, unit) {
  const { minX, maxX } = unit.bbox
  const cy = (unit.bbox.minY + unit.bbox.maxY) / 2
  const width = maxX - minX
  const band = Math.max(9, width * 0.13)
  const sStart = minX - band, sEnd = maxX
  const eStart = minX, eEnd = maxX + band
  return {
    ty: 4, nm, ind, ddd: 0, sr: 1, ao: 0,
    ip: 0, op: FRAMES, st: 0, bm: 0, td: 1,
    ks: { o: sk(100), r: sk(0), s: sk([100, 100, 100]), a: sk([0, 0, 0]), p: sk([0, 0, 0]) },
    shapes: [
      {
        ty: 'gr',
        nm: 'matte',
        it: [
          {
            ty: 'sh',
            nm: 'matte-rect',
            ks: sk({ v: [[0, 0], [W, 0], [W, H], [0, H]], i: [[0, 0], [0, 0], [0, 0], [0, 0]], o: [[0, 0], [0, 0], [0, 0], [0, 0]], c: true }),
          },
          {
            ty: 'gf',
            nm: 'matte-grad',
            t: 1,
            o: sk(100),
            r: 1,
            g: { p: 2, k: sk([0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0]) },
            s: {
              a: 1,
              k: [
                { t: unit.start, s: [sStart, cy], o: EASE_O, i: EASE_I },
                { t: unit.start + unit.dur, s: [sEnd, cy] },
              ],
            },
            e: {
              a: 1,
              k: [
                { t: unit.start, s: [eStart, cy], o: EASE_O, i: EASE_I },
                { t: unit.start + unit.dur, s: [eEnd, cy] },
              ],
            },
          },
          { ty: 'tr', p: sk([0, 0]), a: sk([0, 0]), s: sk([100, 100]), r: sk(0), o: sk(100) },
        ],
      },
    ],
  }
}

function letterLayer(nm, ind, unit) {
  return {
    ty: 4, nm, ind, ddd: 0, sr: 1, ao: 0,
    ip: 0, op: FRAMES, st: 0, bm: 0, tt: 1,
    ks: { o: sk(100), r: sk(0), s: sk([100, 100, 100]), a: sk([0, 0, 0]), p: sk([0, 0, 0]) },
    shapes: unit.paths.map((idx) => letterGroup(idx)),
  }
}

const layers = []
let ind = 1
for (const u of UNITS) {
  layers.push(matteLayer(`${u.nm}__matte`, ind++, u))
  layers.push(letterLayer(u.nm, ind++, u))
}

const doc = {
  v: '5.9.0',
  fr: FPS,
  ip: 0,
  op: FRAMES,
  w: W,
  h: H,
  nm: 'live-better-t2vl',
  ddd: 0,
  assets: [],
  layers,
  markers: [],
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT, JSON.stringify(doc))
console.log(`Wrote ${OUT}`)
console.log(`FRAMES=${FRAMES} (${(FRAMES / FPS).toFixed(2)}s) write ends ~${WRITE_END.toFixed(0)}f`)
UNITS.forEach((u) => console.log(`  ${u.nm.padEnd(10)} start=${u.start} dur=${u.dur} width=${(u.bbox.maxX - u.bbox.minX).toFixed(0)}`))
