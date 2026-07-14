#!/usr/bin/env node
/**
 * Generates the Lottie JSON for entry-3s-tender-hi0q — a phone (face,
 * band-aid, dots) resting on a pillow, breathing gently while a green ribbon
 * hand-draws itself around it. Source: assets/entry-3s-tender-hi0q.svg.
 *
 * Source-geometry reading (confirmed by parsing every subpath's bbox/
 * endpoints — see conversation): the SVG encodes the ribbon's front/behind
 * crossings through PAINT ORDER, not layout. path[0] (gradient
 * paint0_linear, drawn first = behind pillow+phone) contains two ribbon
 * strips, each built the same way Illustrator brush-strokes export: a long
 * "body" subpath plus two small rounded "cap" subpaths at its ends.
 *   Strip A (behind): subpaths 0,1,4 — right cap ~(224,164) is the loose
 *     tail (falls past the gradient's fade stop → renders ~transparent, this
 *     IS the "soft gradient tail on the right" from the brief), left cap
 *     ~(64.5,142).
 *   Strip B (behind): subpaths 2,3,5 — right cap ~(178.5,104), left cap
 *     ~(59.2,93.3) — the source's ribbon terminus.
 * path[12] (solid green, drawn LAST = in front of everything) is Strip C:
 * left cap ~(64.5,134.7) sits right on top of Strip A's left cap, and its
 * right cap ~(178.5,96.1) sits right on top of Strip B's right cap. So the
 * physical ribbon threads tail → Strip A (behind) → Strip C (front, wrap +
 * climb) → Strip B (behind again) → end, exactly the brief's route, and the
 * leaf+dot accent (paths 10,11, solid green) sit right at Strip B's end
 * point — they decorate the spot where the ribbon's tip lands.
 *
 * Technique: matte-wipe draw-on (see live-better-nqa3's "handwritten
 * write-on over gradient artwork" — fill stays untouched, the reveal lives
 * in a soft-edge two-stop gradient matte), generalized from that recipe's
 * fixed left-to-right sweep to an arbitrary axis per strip (the vector
 * between its two caps), so each segment draws along its own diagonal
 * instead of a flat directional wipe.
 *
 * The phone (rects, screen, face, band-aid, its threads, its dots) is one
 * shape layer so its breathing sway (layer-level rotation + a whisper of
 * vertical position) moves every one of those details as a single rigid
 * body, pivoting at the point where the phone rests on the pillow. The
 * pillow and its dip/fold under the phone never move.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SVG_FILE = join(__dirname, '../assets/entry-3s-tender-hi0q.svg')
const OUT_DIR = join(__dirname, '../public/projects/entry-3s-tender-hi0q/scene-1')
const OUT = join(OUT_DIR, 'lottie.json')

const W = 256, H = 257, FPS = 60, FRAMES = 180 // 3.0s

// ── SVG intake ─────────────────────────────────────────────────────────────
const svg = readFileSync(SVG_FILE, 'utf8')

function parseAttrs(tag) {
  const attrs = {}
  for (const m of tag.matchAll(/([\w-]+)="([^"]*)"/g)) attrs[m[1]] = m[2]
  return attrs
}

const SRC_PATHS = [...svg.matchAll(/<path\b([^>]*)\/>/g)].map((m) => {
  const a = parseAttrs(m[1])
  const fillUrl = a.fill && a.fill.match(/^url\(#(.+)\)$/)
  return {
    d: a.d,
    fillSolid: fillUrl || a.fill === 'none' ? null : a.fill,
    gradId: fillUrl ? fillUrl[1] : null,
    stroke: a.stroke,
    strokeWidth: a['stroke-width'] ? Number(a['stroke-width']) : 1,
    lc: a['stroke-linecap'] === 'round' ? 2 : 1,
    lj: a['stroke-linejoin'] === 'round' ? 2 : 1,
  }
})

const SRC_RECTS = [...svg.matchAll(/<rect\b([^>]*)\/>/g)].map((m) => {
  const a = parseAttrs(m[1])
  const mm = a.transform.match(/matrix\(([^)]+)\)/)
  return {
    width: Number(a.width),
    height: Number(a.height),
    rx: a.rx ? Number(a.rx) : 0,
    fill: a.fill,
    stroke: a.stroke,
    strokeWidth: a['stroke-width'] ? Number(a['stroke-width']) : 1,
    matrix: mm[1].trim().split(/[\s,]+/).map(Number),
  }
})

const SRC_CIRCLES = [...svg.matchAll(/<circle\b([^>]*)\/>/g)].map((m) => {
  const a = parseAttrs(m[1])
  const mm = a.transform.match(/matrix\(([^)]+)\)/)
  return {
    cx: Number(a.cx), cy: Number(a.cy), r: Number(a.r), fill: a.fill,
    matrix: mm[1].trim().split(/[\s,]+/).map(Number),
  }
})

const GRADIENTS = {}
for (const m of svg.matchAll(/<linearGradient\b([^>]*)>([\s\S]*?)<\/linearGradient>/g)) {
  const a = parseAttrs(m[1])
  const stops = [...m[2].matchAll(/<stop\b([^/]*)\/>/g)].map((sm) => {
    const sa = parseAttrs(sm[1])
    return {
      offset: sa.offset !== undefined ? Number(sa.offset) : 0,
      color: sa['stop-color'],
      opacity: sa['stop-opacity'] !== undefined ? Number(sa['stop-opacity']) : 1,
    }
  })
  GRADIENTS[a.id] = { x1: Number(a.x1), y1: Number(a.y1), x2: Number(a.x2), y2: Number(a.y2), stops }
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

const SEGS = SRC_PATHS.map((p) => parsePath(p.d))

// ── Lottie helpers ───────────────────────────────────────────────────────────
const sk = (k) => ({ a: 0, k })
function hexToRgb1(color) {
  if (color === 'white') return [1, 1, 1]
  if (color === 'black') return [0, 0, 0]
  const h = color.replace('#', '')
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]
}
const DARK = hexToRgb1('#222222')
const WHITE = [1, 1, 1]
const GREEN = hexToRgb1('#22E243')

function pathShape(seg, nm) {
  return { ty: 'sh', nm, ks: sk({ v: seg.v, i: seg.i, o: seg.o, c: seg.c }) }
}
const identityTr = () => ({ ty: 'tr', p: sk([0, 0]), a: sk([0, 0]), s: sk([100, 100]), r: sk(0), o: sk(100) })

// Reflection+rotation decomposition for this source's rect/circle
// transforms: every matrix(a,b,c,d,e,f) here satisfies a=-d, b=c (a mirror
// composed with a rotation), so it reduces to scale [-100,100] + rotation.
function decomposeMatrix([a, b, , d, e, f]) {
  const rot = (Math.atan2(-b, d) * 180) / Math.PI
  return { rot, pos: [e, f] }
}

function rectGroup(nm, rect) {
  const { rot, pos } = decomposeMatrix(rect.matrix)
  const it = [{ ty: 'rc', nm: 'rect', p: sk([rect.width / 2, rect.height / 2]), s: sk([rect.width, rect.height]), r: sk(rect.rx) }]
  if (rect.fill && rect.fill !== 'none') it.push({ ty: 'fl', nm: 'fill', o: sk(100), r: 1, c: sk(hexToRgb1(rect.fill)) })
  if (rect.stroke) it.push({ ty: 'st', nm: 'stroke', o: sk(100), w: sk(rect.strokeWidth), c: sk(hexToRgb1(rect.stroke)), lc: 2, lj: 2 })
  it.push({ ty: 'tr', p: sk(pos), a: sk([0, 0]), s: sk([-100, 100]), r: sk(rot), o: sk(100) })
  return { ty: 'gr', nm, it }
}

function circleGroup(nm, circle) {
  const { rot, pos } = decomposeMatrix(circle.matrix)
  const it = [
    { ty: 'el', nm: 'circle', p: sk([circle.cx, circle.cy]), s: sk([circle.r * 2, circle.r * 2]) },
    { ty: 'fl', nm: 'fill', o: sk(100), r: 1, c: sk(hexToRgb1(circle.fill)) },
    { ty: 'tr', p: sk(pos), a: sk([0, 0]), s: sk([-100, 100]), r: sk(rot), o: sk(100) },
  ]
  return { ty: 'gr', nm, it }
}

function multiSegGroup(nm, segs, fillItem) {
  return { ty: 'gr', nm, it: [...segs.map((s, i) => pathShape(s, `${nm}-${i}`)), fillItem, identityTr()] }
}

function strokeSegGroup(nm, seg, stroke, width, lc, lj) {
  return {
    ty: 'gr', nm,
    it: [pathShape(seg, `${nm}-path`), { ty: 'st', nm: 'stroke', o: sk(100), w: sk(width), c: sk(hexToRgb1(stroke)), lc, lj }, identityTr()],
  }
}

// ── Layer construction (each entry gets 1 explicit ind for track-matte pairing) ──
let ind = 1
const layers = []

// -- Ribbon: three hand-drawn strips, each strip is its own content layer
// paired with its own diagonal matte-wipe layer directly above it.
const p0 = SEGS[0] // ribbon-behind compound path (Strip A + Strip B)
const p12 = SEGS[12] // ribbon-front compound path (Strip C)
const gradDef = Object.values(GRADIENTS)[0]
const ribbonGradFill = () => {
  const colorArr = [], alphaArr = []
  for (const st of gradDef.stops) {
    const [r, g, b] = hexToRgb1(st.color)
    colorArr.push(st.offset, r, g, b)
    alphaArr.push(st.offset, st.opacity)
  }
  return {
    ty: 'gf', nm: 'gradient', t: 1, o: sk(100), r: 1,
    s: sk([gradDef.x1, gradDef.y1]), e: sk([gradDef.x2, gradDef.y2]),
    g: { p: gradDef.stops.length, k: sk([...colorArr, ...alphaArr]) },
  }
}
const ribbonSolidFill = () => ({ ty: 'fl', nm: 'fill', o: sk(100), r: 1, c: { a: 0, k: GREEN, sid: 'accentColor' } })

function segCentroid(seg) {
  let sx = 0, sy = 0
  for (const [x, y] of seg.v) { sx += x; sy += y }
  return [sx / seg.v.length, sy / seg.v.length]
}
function projectRange(segs, origin, u) {
  let minP = Infinity, maxP = -Infinity
  for (const seg of segs) {
    for (let k = 0; k < seg.v.length; k++) {
      const [vx, vy] = seg.v[k]
      const [ox, oy] = seg.o[k]
      const [ix, iy] = seg.i[k]
      for (const [x, y] of [[vx, vy], [vx + ox, vy + oy], [vx + ix, vy + iy]]) {
        const proj = (x - origin[0]) * u[0] + (y - origin[1]) * u[1]
        if (proj < minP) minP = proj
        if (proj > maxP) maxP = proj
      }
    }
  }
  return { minP, maxP }
}

// Gentle, unhurried draw — no snap, just a hand moving with intent.
const EASE_DRAW_O = { x: [0.35], y: [0] }
const EASE_DRAW_I = { x: [0.3], y: [1] }

function matteLayer(nm, layerInd, segs, from, to, start, dur) {
  const dx = to[0] - from[0], dy = to[1] - from[1]
  const len = Math.hypot(dx, dy)
  const u = [dx / len, dy / len]
  const { minP, maxP } = projectRange(segs, from, u)
  const band = Math.max(10, (maxP - minP) * 0.16)
  const pt = (proj) => [from[0] + u[0] * proj, from[1] + u[1] * proj]
  const sStart = pt(minP - band), sEnd = pt(maxP)
  const eStart = pt(minP), eEnd = pt(maxP + band)
  return {
    ty: 4, nm, ind: layerInd, ddd: 0, sr: 1, ao: 0, ip: 0, op: FRAMES, st: 0, bm: 0, td: 1,
    ks: { o: sk(100), r: sk(0), s: sk([100, 100, 100]), a: sk([0, 0, 0]), p: sk([0, 0, 0]) },
    shapes: [{
      ty: 'gr', nm: 'matte',
      it: [
        { ty: 'sh', nm: 'matte-rect', ks: sk({ v: [[0, 0], [W, 0], [W, H], [0, H]], i: [[0, 0], [0, 0], [0, 0], [0, 0]], o: [[0, 0], [0, 0], [0, 0], [0, 0]], c: true }) },
        {
          ty: 'gf', nm: 'matte-grad', t: 1, o: sk(100), r: 1,
          g: { p: 2, k: sk([0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0]) },
          s: { a: 1, k: [{ t: start, s: sStart, o: EASE_DRAW_O, i: EASE_DRAW_I }, { t: start + dur, s: sEnd }] },
          e: { a: 1, k: [{ t: start, s: eStart, o: EASE_DRAW_O, i: EASE_DRAW_I }, { t: start + dur, s: eEnd }] },
        },
        identityTr(),
      ],
    }],
  }
}

function ribbonContentLayer(nm, layerInd, segs, fillItem) {
  return {
    ty: 4, nm, ind: layerInd, ddd: 0, sr: 1, ao: 0, ip: 0, op: FRAMES, st: 0, bm: 0, tt: 1,
    ks: { o: sk(100), r: sk(0), s: sk([100, 100, 100]), a: sk([0, 0, 0]), p: sk([0, 0, 0]) },
    shapes: [multiSegGroup('ribbon', segs, fillItem)],
  }
}

// Strip A (behind, tail on the right → passing behind the phone)
const stripA = { segs: [p0[0], p0[1], p0[4]], from: segCentroid(p0[0]), to: segCentroid(p0[1]) }
// Strip C (front, emerging + wrapping across + climbing)
const stripC = { segs: [p12[0], p12[1], p12[2]], from: segCentroid(p12[0]), to: segCentroid(p12[1]) }
// Strip B (behind again, finishing exactly where the source ribbon ends)
const stripB = { segs: [p0[2], p0[3], p0[5]], from: segCentroid(p0[2]), to: segCentroid(p0[3]) }

const RIBBON_START = 20
const DUR_A = 44, DUR_C = 33, DUR_B = 33
const T_A = RIBBON_START
const T_C = T_A + DUR_A
const T_B = T_C + DUR_C
const RIBBON_END = T_B + DUR_B // 130

// Topmost: Strip C's matte + content (renders in front of the whole scene)
const ribbonFrontMatte = matteLayer('ribbon-wrap__matte', ind++, stripC.segs, stripC.from, stripC.to, T_C, DUR_C)
const ribbonFrontContent = ribbonContentLayer('ribbon-wrap', ind++, stripC.segs, ribbonSolidFill())
layers.push(ribbonFrontMatte, ribbonFrontContent)

// -- Leaf + dot accent: pop in together right as the ribbon lands.
const leafSeg = SEGS[10][0], dotSeg = SEGS[11][0]
const accentAnchor = [51.75, 96.65]
const POP_START = RIBBON_END - 2
const POP_DUR = 20
const EASE_POP_O = { x: [0.3], y: [0] }
const EASE_POP_I = { x: [0.2], y: [1] }
const accentLayer = {
  ty: 4, nm: 'leaf-dot-accent', ind: ind++, ddd: 0, sr: 1, ao: 0, ip: 0, op: FRAMES, st: 0, bm: 0,
  ks: {
    o: { a: 1, k: [{ t: POP_START, s: [0], o: EASE_POP_O, i: EASE_POP_I }, { t: POP_START + 10, s: [100] }] },
    r: sk(0),
    s: {
      a: 1,
      k: [
        { t: POP_START, s: [0, 0, 100], o: EASE_POP_O, i: EASE_POP_I },
        { t: POP_START + 14, s: [108, 108, 100], o: EASE_POP_O, i: EASE_POP_I },
        { t: POP_START + POP_DUR, s: [100, 100, 100] },
      ],
    },
    a: sk([accentAnchor[0], accentAnchor[1], 0]),
    p: sk([accentAnchor[0], accentAnchor[1], 0]),
  },
  shapes: [
    multiSegGroup('leaf', [leafSeg], { ty: 'fl', nm: 'fill', o: sk(100), r: 1, c: { a: 0, k: GREEN, sid: 'accentColor' } }),
    multiSegGroup('dot', [dotSeg], { ty: 'fl', nm: 'fill', o: sk(100), r: 1, c: { a: 0, k: GREEN, sid: 'accentColor' } }),
  ],
}
layers.push(accentLayer)

// -- Pillow fold: the crease the phone presses into the pillow, layered
// over the phone's lower edge (static, matches source paint order exactly).
const foldFillSeg = SEGS[8][0]
const foldStrokeSegs = SEGS[9]
layers.push({
  ty: 4, nm: 'pillow-fold', ind: ind++, ddd: 0, sr: 1, ao: 0, ip: 0, op: FRAMES, st: 0, bm: 0,
  ks: { o: sk(100), r: sk(0), s: sk([100, 100, 100]), a: sk([0, 0, 0]), p: sk([0, 0, 0]) },
  shapes: [
    ...foldStrokeSegs.map((seg, i) => strokeSegGroup(`pillow-fold-crease-${i}`, seg, SRC_PATHS[9].stroke, SRC_PATHS[9].strokeWidth, 2, 2)),
    multiSegGroup('pillow-fold-fill', [foldFillSeg], { ty: 'fl', nm: 'fill', o: sk(100), r: 1, c: sk(WHITE) }),
  ],
})

// -- Phone: rects, screen, face, band-aid + threads, dots — one rigid body
// that breathes (sway + a whisper of vertical rise), pivoting where it
// rests on the pillow.
const dotGroups = SRC_CIRCLES.map((c, i) => circleGroup(`dot-${i}`, c))
const threadGroups = [5, 6, 7].map((pi, i) => strokeSegGroup(`bandaid-thread-${i}`, SEGS[pi][0], SRC_PATHS[pi].stroke, SRC_PATHS[pi].strokeWidth, 2, 1))
const bandaidRectGroups = [3, 4].map((ri, i) => rectGroup(`bandaid-${i}`, SRC_RECTS[ri]))
const faceGroups = [2, 3, 4].map((pi, i) => multiSegGroup(`face-mark-${i}`, SEGS[pi], { ty: 'fl', nm: 'fill', o: sk(100), r: 1, c: sk(DARK) }))
const screenRect = rectGroup('phone-screen', SRC_RECTS[2])
const bodyRect = rectGroup('phone-body', SRC_RECTS[1])
const shadowRect = rectGroup('phone-shadow', SRC_RECTS[0])

const PHONE_PIVOT = [130, 175] // where the phone rests on the pillow

// Damped breathing: two decaying cycles, settling to rest by the final
// frame — never a metronome, a breath that's winding down as the scene ends.
const EASE_BREATH_O = { x: [0.42], y: [0] }
const EASE_BREATH_I = { x: [0.58], y: [1] }
function breathTrack(times, values) {
  return times.map((t, i) => (i < times.length - 1 ? { t, s: values[i], o: EASE_BREATH_O, i: EASE_BREATH_I } : { t, s: values[i] }))
}
const BREATH_T = [0, 20, 40, 60, 80, 100, 120, 140, 160, 179]
const BREATH_ROT = [0, 1.5, 0, -1.2, 0, 0.8, 0, -0.4, 0, 0]
const BREATH_DY = [0, -1.1, 0, 0.85, 0, -0.55, 0, 0.3, 0, 0]

const phoneLayer = {
  ty: 4, nm: 'phone', ind: ind++, ddd: 0, sr: 1, ao: 0, ip: 0, op: FRAMES, st: 0, bm: 0,
  ks: {
    o: sk(100),
    r: { a: 1, k: breathTrack(BREATH_T, BREATH_ROT.map((v) => [v])) },
    s: sk([100, 100, 100]),
    a: sk([PHONE_PIVOT[0], PHONE_PIVOT[1], 0]),
    p: { a: 1, k: breathTrack(BREATH_T, BREATH_DY.map((dy) => [PHONE_PIVOT[0], PHONE_PIVOT[1] + dy, 0])) },
  },
  shapes: [...dotGroups, ...threadGroups, ...bandaidRectGroups, ...faceGroups, screenRect, bodyRect, shadowRect],
}
layers.push(phoneLayer)

// -- Pillow: the base the phone rests on, never moves.
layers.push({
  ty: 4, nm: 'pillow', ind: ind++, ddd: 0, sr: 1, ao: 0, ip: 0, op: FRAMES, st: 0, bm: 0,
  ks: { o: sk(100), r: sk(0), s: sk([100, 100, 100]), a: sk([0, 0, 0]), p: sk([0, 0, 0]) },
  shapes: [{
    ty: 'gr', nm: 'pillow-body',
    it: [
      pathShape(SEGS[1][0], 'pillow-path'),
      { ty: 'fl', nm: 'fill', o: sk(100), r: 1, c: sk(WHITE) },
      { ty: 'st', nm: 'stroke', o: sk(100), w: sk(SRC_PATHS[1].strokeWidth), c: sk(hexToRgb1(SRC_PATHS[1].stroke)), lc: 2, lj: 2 },
      identityTr(),
    ],
  }],
})

// -- Ribbon behind: Strip B (finishes at the source's ribbon end) then
// Strip A (starts at the tail) — both sit at the very back, matching the
// source's paint order (behind the pillow and the phone).
const ribbonBehindBMatte = matteLayer('ribbon-finish__matte', ind++, stripB.segs, stripB.from, stripB.to, T_B, DUR_B)
const ribbonBehindBContent = ribbonContentLayer('ribbon-finish', ind++, stripB.segs, ribbonGradFill())
const ribbonBehindAMatte = matteLayer('ribbon-tail__matte', ind++, stripA.segs, stripA.from, stripA.to, T_A, DUR_A)
const ribbonBehindAContent = ribbonContentLayer('ribbon-tail', ind++, stripA.segs, ribbonGradFill())
layers.push(ribbonBehindBMatte, ribbonBehindBContent, ribbonBehindAMatte, ribbonBehindAContent)

// ── Document ─────────────────────────────────────────────────────────────
const doc = {
  v: '5.9.0',
  fr: FPS,
  ip: 0,
  op: FRAMES,
  w: W,
  h: H,
  nm: 'entry-3s-tender-hi0q',
  ddd: 0,
  assets: [],
  layers,
  markers: [],
  slots: {
    accentColor: { p: { a: 0, k: [...GREEN, 1] } },
  },
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT, JSON.stringify(doc))
console.log(`Wrote ${OUT}`)
console.log(`FRAMES=${FRAMES} (${(FRAMES / FPS).toFixed(2)}s)`)
console.log(`Ribbon: A[${T_A},${T_A + DUR_A}] C[${T_C},${T_C + DUR_C}] B[${T_B},${T_B + DUR_B}] accent pop @${POP_START}`)

const controls = {
  controls: [{ sid: 'accentColor', label: 'Ribbon & accent color' }],
  layerControls: [
    { target: 'phone', kind: 'amount', property: 'rotation', label: 'Breathing sway', description: 'How far the phone gently sways and rises as it breathes.' },
    { target: 'leaf-dot-accent', kind: 'amount', property: 'scale', label: 'Accent pop', description: 'How much the leaf and dot bounce in once the ribbon finishes.' },
  ],
}
writeFileSync(join(OUT_DIR, 'controls.json'), JSON.stringify(controls, null, 2))
console.log(`Wrote ${join(OUT_DIR, 'controls.json')}`)
