#!/usr/bin/env node
/**
 * live-better-4sen — "live. better." handwritten cursive entrance.
 * Source: assets/live-better-4sen.svg (byte-identical to live-better-nqa3.svg /
 * live-better-t2vl.svg — 20 filled brush-stroke paths, 575x374, per-path
 * solid/radial fills). The path->letter mapping and the matte-wipe write-on
 * technique (references/recipe-typography.md, "Handwritten Write-On Over
 * Gradient Artwork") are geometry carried forward from build-live-better-
 * nqa3.mjs's verified grouping. Every beat time, and the split of the i-dot /
 * period / tail-dot into their own ink-tap pops (decoupled from their
 * letter's sweep) rather than a uniform stagger, is re-derived from THIS
 * run's brief, which stages five explicit beats instead of a house cadence.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SVG_FILE = join(__dirname, '../assets/live-better-4sen.svg')
const OUT_DIR = join(__dirname, '../public/projects/live-better-4sen/scene-1')
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

// ── Writing units — path indices resolved from the brief's own paintN→role
// map (paint0..paint13 appear in the SVG in strict numeric doc order, so
// each gradient-filled path's index is unambiguous; the 6 solid paths fill
// the rest). Grouping matches the verified nqa3/t2vl mapping, but i-dot,
// period and the tail-tip dot are pulled OUT of their letter's sweep unit —
// this brief stages them as separate ink-tap pops (beats 2 and 4), not part
// of the continuous stroke. ─────────────────────────────────────────────────
const WIPE_UNITS = [
  { nm: 'letter-l',          paths: [1, 0],   beat: 1 },
  { nm: 'letter-i-stem',     paths: [3],      beat: 1 },
  { nm: 'letter-v',          paths: [4],      beat: 1 },
  { nm: 'letter-e-live',     paths: [5, 6],   beat: 1 },
  { nm: 'letter-b',          paths: [11, 10], beat: 3 },
  { nm: 'letter-e-better-1', paths: [9, 8],   beat: 3 },
  { nm: 'letter-t1',         paths: [14],     beat: 3 },
  { nm: 'letter-t2',         paths: [17],     beat: 3 },
  { nm: 'letter-e-better-2', paths: [12, 16], beat: 3 },
  { nm: 'letter-r',          paths: [19, 15], beat: 3 },
  { nm: 't-crossbar',        paths: [13],     beat: 4 },
]
// Ink taps: no matte, no travel — timed straight off the brief's beat 2 (i-dot
// then period, "a beat later") and beat 4 ("as [the crossbar] lands").
const POP_UNITS = [
  { nm: 'i-dot',       paths: [2],  start: 42,  dur: 9 },
  { nm: 'period-live', paths: [7],  start: 51,  dur: 9 },
  { nm: 'r-tail-dot',  paths: [18], start: 118, dur: 12 },
]

for (const u of [...WIPE_UNITS, ...POP_UNITS]) u.bbox = bboxUnion(...u.paths.map((i) => segBBox(SEGS[i])))

// ── Beat timing (frames @ 60fps), lifted directly from the brief's own beats
// rather than a house stagger: beat 1 "live" unbroken sweep 0.0-0.8s, beat 3
// "better" unbroken sweep 0.9-1.8s (a fresh pen-down, not a continuation of
// beat 1), beat 4 crossbar dash ~1.7-2.0s overlapping beat 3's landing, beat
// 5 settled hold to 2.5s. ────────────────────────────────────────────────────
const OVERLAP = 0.72 // heavy overlap = "one unbroken pass, the pen never lifts"
function packBeat(units, beatStart, beatEnd) {
  let t = 0
  for (const u of units) {
    const width = u.bbox.maxX - u.bbox.minX
    u.rawDur = Math.min(16, Math.max(8, width / 13))
    u.rawStart = t
    t = u.rawStart + u.rawDur * (1 - OVERLAP)
  }
  const rawEnd = Math.max(...units.map((u) => u.rawStart + u.rawDur))
  const scale = (beatEnd - beatStart) / rawEnd
  for (const u of units) {
    u.start = beatStart + u.rawStart * scale
    u.dur = u.rawDur * scale
  }
}
packBeat(WIPE_UNITS.filter((u) => u.beat === 1), 0, 48)
packBeat(WIPE_UNITS.filter((u) => u.beat === 3), 54, 108)
const crossbar = WIPE_UNITS.find((u) => u.beat === 4)
crossbar.start = 100
crossbar.dur = 20

const FRAMES = 150 // 2.5s — settle complete by ~130f, clean hold through op

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

// Most glyphs share ONE ramp; the odd one-off does not. Bind the shared one so
// a single control retints the whole word instead of offering a knob per
// letter — and memoise per gradient id so every glyph references the same
// object rather than an equal copy.
// Figma emits one gradient DEFINITION PER SHAPE, so thirteen letters carry
// thirteen distinct ids holding identical stops. Keying by id would bind one
// letter; key by the ramp's CONTENT so every glyph painted the same way shares
// one object — and one control retints the whole word.
const rampKey = (g) => JSON.stringify(g.stops)
const RAMP_USES = {}
for (const p of SRC_PATHS) {
  if (p.solid || !p.gradId) continue
  const k = rampKey(GRADIENTS[p.gradId])
  RAMP_USES[k] = (RAMP_USES[k] ?? 0) + 1
}
const LETTERING_KEY = Object.keys(RAMP_USES).sort((a, b) => RAMP_USES[b] - RAMP_USES[a])[0]
const RAMPS = {}
function rampFor(gradId) {
  const g = GRADIENTS[gradId]
  const key = rampKey(g)
  if (!RAMPS[key]) {
    const colorArr = [], alphaArr = []
    for (const st of g.stops) {
      const [cr, cg, cb] = hexToRgb1(st.color)
      colorArr.push(st.offset, cr, cg, cb)
      alphaArr.push(st.offset, st.opacity)
    }
    RAMPS[key] = {
      p: g.stops.length,
      k: sk([...colorArr, ...alphaArr]),
      ...(key === LETTERING_KEY ? { sid: 'letteringRamp' } : {}),
    }
  }
  return RAMPS[key]
}

function fillFor(pathIdx) {
  const src = SRC_PATHS[pathIdx]
  const r = src.evenodd ? 2 : 1
  if (src.solid) return { ty: 'fl', nm: 'fill', c: sk(GREEN), o: sk(100), r }
  const g = GRADIENTS[src.gradId]
  const rad = (a) => (a * Math.PI) / 180
  const s = [g.tx, g.ty]
  const e = [g.tx + g.sx * Math.cos(rad(g.rot)), g.ty + g.sx * Math.sin(rad(g.rot))]
  return {
    ty: 'gf', nm: 'gradient', o: sk(100), r, t: 2,
    s: sk(s), e: sk(e),
    g: rampFor(src.gradId),
  }
}

function strokeGroup(pathIdx) {
  return {
    ty: 'gr', nm: `stroke-${pathIdx}`,
    it: [
      pathShape(SEGS[pathIdx], `p${pathIdx}`),
      fillFor(pathIdx),
      { ty: 'tr', p: sk([0, 0]), a: sk([0, 0]), s: sk([100, 100]), r: sk(0), o: sk(100) },
    ],
  }
}

// Handwriting-ease: quick confident acceleration into a settled landing —
// every stroke "arrives" rather than drifting to a stop.
const SWEEP_O = { x: [0.3], y: [0] }
const SWEEP_I = { x: [0.15], y: [1] }

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
        ty: 'gr', nm: 'matte',
        it: [
          { ty: 'sh', nm: 'matte-rect', ks: sk({ v: [[0, 0], [W, 0], [W, H], [0, H]], i: [[0, 0], [0, 0], [0, 0], [0, 0]], o: [[0, 0], [0, 0], [0, 0], [0, 0]], c: true }) },
          {
            ty: 'gf', nm: 'matte-grad', t: 1, o: sk(100), r: 1,
            g: { p: 2, k: sk([0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0]) },
            s: { a: 1, k: [
              { t: unit.start, s: [sStart, cy], o: SWEEP_O, i: SWEEP_I },
              { t: unit.start + unit.dur, s: [sEnd, cy] },
            ] },
            e: { a: 1, k: [
              { t: unit.start, s: [eStart, cy], o: SWEEP_O, i: SWEEP_I },
              { t: unit.start + unit.dur, s: [eEnd, cy] },
            ] },
          },
          { ty: 'tr', p: sk([0, 0]), a: sk([0, 0]), s: sk([100, 100]), r: sk(0), o: sk(100) },
        ],
      },
    ],
  }
}

function wipeLayer(nm, ind, unit) {
  return {
    ty: 4, nm, ind, ddd: 0, sr: 1, ao: 0,
    ip: 0, op: FRAMES, st: 0, bm: 0, tt: 1,
    ks: { o: sk(100), r: sk(0), s: sk([100, 100, 100]), a: sk([0, 0, 0]), p: sk([0, 0, 0]) },
    shapes: unit.paths.map((idx) => strokeGroup(idx)),
  }
}

// Ink taps: no matte, no travel — a quick scale pop pivoting on the mark's
// OWN geometry. These paths carry absolute canvas coordinates (not origin-
// space), so the pivot is anchor = the mark's own bbox center, with position
// pinned to the same point (net-zero translation, the pivot is the point) —
// never anchor=[0,0] over absolute geometry, which would paint it at the
// canvas corner. Overshoot: entrance-sharp in, settle-soft landing.
const POP_IN_O = { x: [0.2], y: [0.75] }
const POP_IN_I = { x: [0.34], y: [0.94] }
const POP_SETTLE_O = { x: [0], y: [0.65] }
const POP_SETTLE_I = { x: [0.51], y: [0.99] }

function popLayer(nm, ind, unit) {
  const cx = (unit.bbox.minX + unit.bbox.maxX) / 2
  const cy = (unit.bbox.minY + unit.bbox.maxY) / 2
  const peak = unit.start + unit.dur * 0.55
  const end = unit.start + unit.dur
  return {
    ty: 4, nm, ind, ddd: 0, sr: 1, ao: 0,
    ip: 0, op: FRAMES, st: 0, bm: 0,
    ks: {
      o: sk(100), r: sk(0),
      s: { a: 1, k: [
        { t: unit.start, s: [0, 0, 100], o: POP_IN_O, i: POP_IN_I },
        { t: peak, s: [115, 115, 100], o: POP_SETTLE_O, i: POP_SETTLE_I },
        { t: end, s: [100, 100, 100] },
      ] },
      a: sk([cx, cy, 0]), p: sk([cx, cy, 0]),
    },
    shapes: unit.paths.map((idx) => strokeGroup(idx)),
  }
}

// ── Assemble layers. Array order is back-to-front (later = painted on top),
// confirmed against the shipped nqa3/t2vl renders — the crossbar is pushed
// after both t-stems so it draws over them, per the brief. ──────────────────
const layers = []
let ind = 1
for (const u of WIPE_UNITS.filter((x) => x.beat === 1)) {
  layers.push(matteLayer(`${u.nm}__matte`, ind++, u))
  layers.push(wipeLayer(u.nm, ind++, u))
  if (u.nm === 'letter-i-stem') {
    const dot = POP_UNITS.find((p) => p.nm === 'i-dot')
    layers.push(popLayer(dot.nm, ind++, dot))
  }
  if (u.nm === 'letter-e-live') {
    const per = POP_UNITS.find((p) => p.nm === 'period-live')
    layers.push(popLayer(per.nm, ind++, per))
  }
}
for (const u of WIPE_UNITS.filter((x) => x.beat === 3)) {
  layers.push(matteLayer(`${u.nm}__matte`, ind++, u))
  layers.push(wipeLayer(u.nm, ind++, u))
}
layers.push(matteLayer(`${crossbar.nm}__matte`, ind++, crossbar))
layers.push(wipeLayer(crossbar.nm, ind++, crossbar))
const tailDot = POP_UNITS.find((p) => p.nm === 'r-tail-dot')
layers.push(popLayer(tailDot.nm, ind++, tailDot))

const doc = {
  v: '5.9.0', fr: FPS, ip: 0, op: FRAMES, w: W, h: H, nm: 'live-better-4sen',
  ddd: 0, assets: [], layers, markers: [],
  // Published so the sid resolves in every renderer, not just Skottie.
  slots: { letteringRamp: { p: RAMPS[LETTERING_KEY] } },
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT, JSON.stringify(doc))
console.log(`Wrote ${OUT}`)
console.log(`FRAMES=${FRAMES} (${(FRAMES / FPS).toFixed(2)}s)`)
;[...WIPE_UNITS, ...POP_UNITS]
  .sort((a, b) => a.start - b.start)
  .forEach((u) => console.log(`  ${u.nm.padEnd(18)} start=${u.start.toFixed(1)} dur=${u.dur.toFixed(1)} end=${(u.start + u.dur).toFixed(1)}`))
