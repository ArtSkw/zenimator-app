#!/usr/bin/env node
/**
 * Generates the seamless LOOP for loop-calm-architectural-0uv9.svg — a calm
 * line-art architectural scene on a 256×256 viewBox: a white building with a
 * curved facade, two dark floor bands, three round window dials, two boxes
 * (one holding a dark hill-like silhouette), a ground line, a round tree with
 * a curved trunk, two gull marks and a grey diagonal-hatch cloud behind them.
 * Output: public/projects/loop-calm-architectural-0uv9/scene-1/lottie.json
 *
 * Rig (every constant derived from the brief's mood — "calm, quiet,
 * natural" — against the current references, nothing ported):
 *
 *  - LOOP = 720f @60fps (12s). Every clock divides it: tree sway 180f (4×),
 *    silhouette breath 240f (3×), wingbeats 120f / 90f (6× / 8×), bird wander
 *    harmonics 1–5 cycles per loop, cloud 1 lap per loop. A `loop` marker
 *    spans the whole comp so check-loop-seam pixel-diffs frame 0 vs 720.
 *  - STATIC by brief ("stay completely static"): building, ground line, both
 *    floor bands, the three window dials, both boxes. Decal logic too — they
 *    are the architecture everything else moves against.
 *  - TREE — one assembly pivoting at the trunk's base (34.98, 229.33), which
 *    sits on the ground line, so the root never slides. `tree` null carries
 *    the sway θ(t), period 180f: the wind pushes it right to +2.5° and it
 *    springs back to −0.75° (all the left air the crown has — the whole tree
 *    stays inside the frame), a skewed two-harmonic wave, starting at the
 *    source pose.
 *    Trunk rides the null rigidly. Crown rides it too, plus Δ(t) =
 *    θ(t+LEAD) − θ(t) about the SAME pivot, so the crown's world angle is
 *    θ(t+LEAD): the crown leads the trunk by LEAD frames exactly as the brief
 *    asks (declared as a motionException — the brief outranks the weld gate).
 *  - BIRDS — genuinely free elements with clear air. Each wanders on its own
 *    sum of whole-loop harmonics (different frequencies and signs per bird so
 *    they never move in sync); every term is a sine, so both start AND end on
 *    the source position. Meaning = flight: each carries a slow wingbeat as a
 *    real path morph (each wing rotates about the body vertex, tips rise
 *    together), its amplitude breathing on a 2-cycle envelope so the flight
 *    alternates between soaring and gentle flapping.
 *  - HATCH CLOUD — tiled ambient scroll (recipe-camera-scene-motion "Ambient
 *    Scroll"): two copies one CANVAS WIDTH (256px) apart on a single linear
 *    leftward translation of exactly one lap per loop. Copy 0 slips off the
 *    left edge while copy 1 glides in from the right and lands on the source
 *    spot at frame 720 — no teleport anywhere in the data.
 *  - SILHOUETTE — a whisper of vertical breath: scaleY 100 ± 5 anchored at
 *    its own base (bottom-centre on the box floor), so the base contact never
 *    slides and only the top outline rises ~0.8px. sx stays 100 (non-uniform,
 *    shape changes, not a zoom).
 */
import { writeFileSync, mkdirSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SLUG = 'loop-calm-architectural-0uv9'
const OUT_DIR = join(__dirname, `../public/projects/${SLUG}/scene-1`)
const SVG = readFileSync(join(__dirname, `../assets/${SLUG}.svg`), 'utf8')

const W = 256, H = 256, FPS = 60, LOOP = 720
const TAU = Math.PI * 2

// ── SVG path → Lottie bezier (geometry only) ────────────────────────────────
function parsePath(d) {
  const RE = /([MLHVCZmlhvcz])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g
  const tokens = []
  let m
  while ((m = RE.exec(d))) tokens.push(m[1] ? { c: m[1] } : { n: parseFloat(m[2]) })
  let i = 0
  const nums = (n) => { const out = []; for (let k = 0; k < n; k++) out.push(tokens[i++].n); return out }
  const subs = []
  let cur = null, cx = 0, cy = 0, sx = 0, sy = 0, last = null
  const push = (x, y) => cur.push({ pt: [x, y], in: [0, 0], out: [0, 0] })
  const finish = (c) => ({ c: c.closed, v: c.map((x) => x.pt), i: c.map((x) => x.in), o: c.map((x) => x.out) })
  while (i < tokens.length) {
    let cmd
    if (tokens[i].c) { cmd = tokens[i].c; i++; last = cmd } else cmd = last === 'M' ? 'L' : last
    switch (cmd) {
      case 'M': { if (cur) subs.push(finish(cur)); const [x, y] = nums(2); cur = []; cur.closed = false; push(x, y); cx = sx = x; cy = sy = y; break }
      case 'L': { const [x, y] = nums(2); push(x, y); cx = x; cy = y; break }
      case 'H': { const [x] = nums(1); push(x, cy); cx = x; break }
      case 'V': { const [y] = nums(1); push(cx, y); cy = y; break }
      case 'C': {
        const [x1, y1, x2, y2, x, y] = nums(6)
        const v = cur[cur.length - 1]
        v.out = [x1 - v.pt[0], y1 - v.pt[1]]
        cur.push({ pt: [x, y], in: [x2 - x, y2 - y], out: [0, 0] })
        cx = x; cy = y; break
      }
      case 'Z': case 'z': {
        cur.closed = true
        const f = cur[0], l = cur[cur.length - 1]
        if (cur.length > 1 && Math.hypot(l.pt[0] - f.pt[0], l.pt[1] - f.pt[1]) < 1e-6) { f.in = l.in; cur.pop() }
        cx = sx; cy = sy; break
      }
      default: throw new Error('Unhandled command ' + cmd)
    }
  }
  if (cur) subs.push(finish(cur))
  return subs
}

// Paths in document order (back → front), read straight from the asset.
const P = [...SVG.matchAll(/<path ([^>]*)\/>/g)].map((m) => ({
  d: /\sd="([^"]+)"/.exec(' ' + m[1])[1],
  fill: /fill="([^"]+)"/.exec(m[1])?.[1],
  stroke: /stroke="([^"]+)"/.exec(m[1])?.[1],
}))
if (P.length !== 25) throw new Error(`expected 25 paths, got ${P.length}`)

// ── Lottie helpers ──────────────────────────────────────────────────────────
const rgb = (hex) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255)
const INK = [...rgb('#222222'), 1]
const HATCH = [...rgb('#DFDFDF'), 1]
const WHITE = [1, 1, 1, 1]
const LIN = { o: { x: [0], y: [0] }, i: { x: [1], y: [1] } }

const stat = (k) => ({ a: 0, k })
const baked = (fn, step = 2) => {
  const k = []
  for (let t = 0; t <= LOOP; t += step) {
    const v = fn(t)
    k.push({ t, s: Array.isArray(v) ? v : [v], ...(t < LOOP ? LIN : {}) })
  }
  return { a: 1, k }
}
const shapeOf = (sp) => ({ c: sp.c, v: sp.v, i: sp.i, o: sp.o })
const pathItems = (subs) => subs.map((sp, n) => ({ ty: 'sh', nm: `path-${n}`, ks: stat(shapeOf(sp)) }))
const fillItem = (col, sid, r = 1) => ({ ty: 'fl', nm: 'fill', c: { a: 0, k: col, ...(sid ? { sid } : {}) }, o: stat(100), r })
const strokeItem = () => ({ ty: 'st', nm: 'stroke', c: { a: 0, k: INK, sid: 'inkColor' }, o: stat(100), w: stat(2), lc: 2, lj: 2, ml: 4 })
const trItem = () => ({ ty: 'tr', p: stat([0, 0]), a: stat([0, 0]), s: stat([100, 100]), r: stat(0), o: stat(100) })
const group = (nm, items) => ({ ty: 'gr', nm, it: [...items, trItem()] })
const ks = (o = {}) => ({ o: stat(100), r: stat(0), p: stat([0, 0, 0]), a: stat([0, 0, 0]), s: stat([100, 100, 100]), ...o })

let IND = 0
const layers = [] // back → front; reversed at the end (layers[0] = front)
function shapeLayer(nm, groups, transform = {}, extra = {}) {
  const l = { ddd: 0, ind: ++IND, ty: 4, nm, sr: 1, ks: ks(transform), ao: 0, shapes: groups, ip: 0, op: LOOP, st: 0, bm: 0, ...extra }
  layers.push(l)
  return l
}
function nullLayer(nm, transform) {
  const l = { ddd: 0, ind: ++IND, ty: 3, nm, sr: 1, ks: ks(transform), ao: 0, ip: 0, op: LOOP, st: 0, bm: 0 }
  layers.push(l)
  return l
}
// A stroked source path (optionally also filled from its twin fill path).
const inkGroup = (nm, d, fill) => group(nm, [
  ...pathItems(parsePath(d)),
  ...(fill ? [fillItem(fill.col, fill.sid, fill.r)] : []),
  strokeItem(),
])

// ── Motion functions (all periods divide LOOP) ──────────────────────────────
const harm = (t, terms) => terms.reduce((s, [amp, cyc]) => s + amp * Math.sin(TAU * cyc * t / LOOP), 0)

// Tree: ±2.5° over 3s, crown leads by a couple of frames.
// The crown has only ~1.66px of air on the left at rest, so the lean is
// asymmetric: the wind pushes it right the full 2.5° and it springs back just
// past upright (−0.75° moves the crown's left edge ~1.2px — still inside).
// Shape: sin x − 0.25·sin 2x — a slower push, a quicker spring back (the
// first two sawtooth harmonics), velocity-continuous everywhere. Normalised to
// [LEAN_L, LEAN_R] and phased so frame 0 is the source pose, rising rightward.
const LEAN_R = 2.5, LEAN_L = -0.75, SWAY_P = 180, LEAD = 2
const PIVOT = [34.9757, 229.333] // trunk base, on the ground line
const gust = (x) => Math.sin(x) - 0.25 * Math.sin(2 * x)
const [G_MIN, G_MAX] = (() => { let lo = Infinity, hi = -Infinity; for (let n = 0; n < 3600; n++) { const g = gust(TAU * n / 3600); lo = Math.min(lo, g); hi = Math.max(hi, g) } return [lo, hi] })()
const leanOf = (x) => LEAN_L + (LEAN_R - LEAN_L) * (gust(x) - G_MIN) / (G_MAX - G_MIN)
const PHASE = (() => { // the upright crossing on the rightward push
  for (let n = 0; n < 36000; n++) { const x = TAU * n / 36000; if (leanOf(x) <= 0 && leanOf(x + TAU / 36000) > 0) return x }
  throw new Error('no upright crossing')
})()
const theta = (t) => leanOf(TAU * t / SWAY_P + PHASE)

// Birds: independent wandering paths (px) — different harmonics per bird.
const BIRDS = {
  'bird-large': {
    d: P[10].d,
    x: [[4.0, 1], [1.4, 3]], y: [[-2.8, 2], [1.1, 5]],
    flapP: 120, flapDeg: 9, envCyc: 2,
  },
  'bird-small': {
    d: P[11].d,
    x: [[-3.4, 2], [1.2, 5]], y: [[2.4, 3], [-1.0, 1]],
    flapP: 90, flapDeg: 11, envCyc: 3,
  },
}

// Wingbeat morph: each wing rotates about the body vertex (index 1); tips rise
// together (left wing +a, right wing −a in y-down screen space).
const rot = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]
function flapShape(sp, a) {
  const b = sp.v[1]
  const around = (p, ang) => { const r = rot([p[0] - b[0], p[1] - b[1]], ang); return [b[0] + r[0], b[1] + r[1]] }
  return {
    c: false,
    v: [around(sp.v[0], a), b, around(sp.v[2], -a)],
    i: [rot(sp.i[0], a), rot(sp.i[1], a), rot(sp.i[2], -a)],
    o: [rot(sp.o[0], a), rot(sp.o[1], -a), rot(sp.o[2], -a)],
  }
}

// ── Build layers, back → front ──────────────────────────────────────────────
// Hatch cloud: tiled one canvas width apart, one lap per loop, leftward.
const LAP = W, LAPS = 1
const cloudSubs = parsePath(P[0].d)
for (let n = 0; n < 2; n++) {
  shapeLayer(`hatch-cloud-${n}`, [group('hatch', [...pathItems(cloudSubs), fillItem(HATCH, 'hatchTint')])], {
    p: { a: 1, k: [
      { t: 0, s: [n * LAP, 0, 0], ...LIN },
      { t: LOOP, s: [n * LAP - LAPS * LAP, 0, 0] },
    ] },
  })
}

shapeLayer('ground-line', [inkGroup('ground', P[1].d)])
shapeLayer('building', [group('building', [
  ...pathItems(parsePath(P[2].d)), fillItem(WHITE, null, 2),
]), inkGroup('building-outline', P[3].d)].reverse())
shapeLayer('floor-band-upper', [inkGroup('band', P[5].d, { col: INK, sid: 'inkColor', r: 2 })])
shapeLayer('floor-band-lower', [inkGroup('band', P[7].d, { col: INK, sid: 'inkColor', r: 2 })])

// Tree assembly.
const tree = nullLayer('tree', { a: stat([...PIVOT, 0]), p: stat([...PIVOT, 0]), r: baked(theta) })
shapeLayer('tree-crown', [inkGroup('crown', P[8].d)], {
  a: stat([...PIVOT, 0]), p: stat([...PIVOT, 0]),
  r: baked((t) => theta(t + LEAD) - theta(t)),
}, { parent: tree.ind })
shapeLayer('tree-trunk', [inkGroup('trunk', P[9].d)], {
  a: stat([...PIVOT, 0]), p: stat([...PIVOT, 0]),
}, { parent: tree.ind })

// Birds.
for (const [nm, b] of Object.entries(BIRDS)) {
  const base = parsePath(b.d)[0]
  const flap = (t) => {
    const env = 0.7 + 0.3 * Math.sin(TAU * b.envCyc * t / LOOP)
    return (b.flapDeg * Math.PI / 180) * env * Math.sin(TAU * t / b.flapP) // pure sine: the envelope already varies the rhythm
  }
  const sh = { a: 1, k: [] }
  for (let t = 0; t <= LOOP; t += 3) sh.k.push({ t, s: [flapShape(base, flap(t))], ...(t < LOOP ? LIN : {}) })
  shapeLayer(nm, [group('gull', [{ ty: 'sh', nm: 'gull-path', ks: sh }, strokeItem()])], {
    p: baked((t) => [harm(t, b.x), harm(t, b.y), 0]),
  })
}

// Window dials (circle + cross each), boxes.
const dial = (n, i0) => shapeLayer(`window-dial-${n}`, [
  inkGroup('ring', P[i0].d), inkGroup('vertical', P[i0 + 1].d), inkGroup('horizontal', P[i0 + 2].d),
].reverse())
dial(1, 12); dial(2, 15); dial(3, 18)
shapeLayer('box-tall', [inkGroup('box', P[21].d)])
shapeLayer('box-wide', [inkGroup('box', P[22].d)])

// Silhouette: breath anchored at its base on the box floor.
const SIL_BASE = [148.11, 213.272]
shapeLayer('box-silhouette', [group('silhouette', [
  ...pathItems(parsePath(P[23].d)), fillItem(INK, 'inkColor'), strokeItem(),
])], {
  a: stat([...SIL_BASE, 0]), p: stat([...SIL_BASE, 0]),
  s: baked((t) => [100, 100 + 5 * Math.sin(TAU * 3 * t / LOOP), 100], 4),
})

// ── Write ───────────────────────────────────────────────────────────────────
const doc = {
  v: '5.12.2', fr: FPS, ip: 0, op: LOOP, w: W, h: H, nm: 'Calm architectural loop', ddd: 0,
  assets: [],
  markers: [{ cm: 'loop', tm: 0, dr: LOOP }],
  slots: { inkColor: { p: { a: 0, k: INK } }, hatchTint: { p: { a: 0, k: HATCH } } },
  layers: layers.slice().reverse(),
}
mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(join(OUT_DIR, 'lottie.json'), JSON.stringify(doc, (k, v) => (typeof v === 'number' ? +v.toFixed(3) : v)))

const controls = {
  controls: [
    { sid: 'inkColor', label: 'Line ink' },
    { sid: 'hatchTint', label: 'Cloud hatch tint' },
  ],
  parameters: [
    { id: 'inkColor', kind: 'color', sid: 'inkColor', label: 'Line ink', description: 'Every outline, the floor bands and the silhouette.' },
    { id: 'hatchTint', kind: 'color', sid: 'hatchTint', label: 'Cloud hatch tint', description: 'The grey diagonal hatch of the drifting cloud.' },
  ],
  layerControls: [
    { target: 'tree', kind: 'amount', property: 'rotation', label: 'Tree sway', description: 'How far the tree leans in the wind.' },
    { target: 'bird-large', kind: 'amount', property: 'position', label: 'Bird wander', description: 'How far the larger bird roams on its flight path.' },
    { target: 'box-silhouette', kind: 'amount', property: 'scale', label: 'Silhouette breath', description: 'How much the dark shape in the box rises and settles.' },
  ],
  motionExceptions: [
    { layer: 'bird-large', reason: "brief: 'each drifts on its own slow wandering path — rising, dipping and shifting a few pixels left and right on gentle arcs … returning to their start by the loop's end' — a free bird's wander, not a streaming field" },
    { layer: 'bird-small', reason: "brief: 'each drifts on its own slow wandering path — rising, dipping and shifting a few pixels left and right on gentle arcs, never in sync with each other' — a free bird's wander, not a streaming field" },
    { a: 'tree-crown', b: 'tree-trunk', reason: "brief: 'with the crown leading the trunk by a couple of frames so it feels organic' — crown angle = trunk angle 2f ahead, same pivot" },
  ],
}
writeFileSync(join(OUT_DIR, 'controls.json'), JSON.stringify(controls, null, 2) + '\n')
console.log(`wrote ${SLUG}: ${layers.length} layers, ${LOOP}f @${FPS}fps`)
