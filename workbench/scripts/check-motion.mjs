#!/usr/bin/env node
/**
 * check-motion.mjs — mechanical audit of a built scene's RIGID relationships.
 *
 *   node scripts/check-motion.mjs <slug> [scene-1]
 *
 * Prose rules kept getting rationalized away ("this element is a floating
 * prop", "gate N/A by construction") while the render still showed parts
 * sliding off a character. This measures the built lottie.json instead of
 * asking, and exits non-zero when it finds a violation:
 *
 * FAILS the build (exit 1) on:
 *   1. CONTACT SLIDE — layers whose ink touches must keep a constant relative
 *      transform. Measured exactly: for a contact point P, compare where each
 *      layer's own world matrix carries P over time. Welded parts move it
 *      identically; the slide is the distance between them. No opinion.
 *   2. MATTE CANCELS THE FLOAT / OCCUPANT HITS THE EDGE — a matte-clipped
 *      occupant needs per-SIDE clearance greater than its drift, or the clip
 *      pins it still (0 clearance) or shaves it against the container's line.
 *   3. OCCUPANT TOO STILL — an occupant under ~3px relative to its shell does
 *      not read as being inside it.
 *   4. SCALE DIVORCE — an occupant that skips its shell's breathe swell makes
 *      the shell look like it inflates around a fixed-size face.
 *   5. INVENTED FILL — every colour must appear in the source artwork; a rig
 *      re-parents and re-times shapes, it never repaints them.
 *
 * REPORTS without failing (judgement stays with the designer): each rig's
 * period and its correlation to the subject's own track (a backdrop claiming
 * parallax should correlate ±0.9 or better — near zero means an independent
 * clock wearing a parallax comment), and the occupant's drift axes.
 *
 * Exit 2 means the scene could not be audited (missing or unreadable), which
 * is a setup failure rather than a motion verdict.
 *
 * It measures rather than guesses intent: a genuinely free element simply has
 * no contact pair, and a deliberate joint is a one-line documented exception.
 */
import { readFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const slug = process.argv[2]
const scene = process.argv[3] && process.argv[3].startsWith('scene') ? process.argv[3] : 'scene-1'
if (!slug) {
  console.error('usage: node scripts/check-motion.mjs <slug> [scene-1]')
  process.exit(2)
}
const path = join(__dirname, `../public/projects/${slug}/${scene}/lottie.json`)
if (!existsSync(path)) {
  console.error(`no scene at ${path}`)
  process.exit(2)
}
// Exit 1 means "motion violations"; a scene that won't parse is a SETUP
// failure, so it shares exit 2 with "no scene here" and says so plainly
// instead of spilling a stack trace into the run's activity feed.
let doc
try {
  doc = JSON.parse(readFileSync(path, 'utf8'))
} catch (e) {
  console.error(`${path} is not valid JSON — the build script did not produce a readable scene.\n  ${e.message}`)
  process.exit(2)
}
if (!Array.isArray(doc.layers)) {
  console.error(`${path} has no layers array — nothing to audit.`)
  process.exit(2)
}

// ── Property evaluation ──────────────────────────────────────────────────────
// Build scripts bake dense samples, so linear interpolation between adjacent
// keys is accurate to well under the thresholds below.
function evalProp(p, t, fallback) {
  if (!p) return fallback
  if (!p.a) return p.k
  const ks = p.k
  if (!Array.isArray(ks) || !ks.length) return fallback
  if (t <= ks[0].t) return ks[0].s ?? fallback
  const last = ks[ks.length - 1]
  if (t >= last.t) return last.s ?? ks[ks.length - 2]?.e ?? fallback
  for (let i = 0; i < ks.length - 1; i++) {
    if (t >= ks[i].t && t <= ks[i + 1].t) {
      const a = ks[i].s, b = ks[i + 1].s ?? ks[i].e
      if (!a) return b ?? fallback
      if (!b) return a
      const span = ks[i + 1].t - ks[i].t
      const u = span === 0 ? 0 : (t - ks[i].t) / span
      return a.map((v, j) => v + ((b[j] ?? v) - v) * u)
    }
  }
  return last.s ?? fallback // unreachable for sorted keys; kept as a guard
}

// ── 2D affine matrices as [a,b,c,d,e,f] (x' = ax+cy+e, y' = bx+dy+f) ─────────
const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
]
const apply = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]]
function invert(m) {
  const det = m[0] * m[3] - m[1] * m[2]
  if (!det) return [1, 0, 0, 1, 0, 0]
  const [a, b, c, d, e, f] = m
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det]
}
function localMatrix(ks, t) {
  const a = evalProp(ks?.a, t, [0, 0, 0])
  const p = evalProp(ks?.p, t, [0, 0, 0])
  const s = evalProp(ks?.s, t, [100, 100, 100])
  const r = ((evalProp(ks?.r, t, [0]))[0] ?? 0) * Math.PI / 180
  const cos = Math.cos(r), sin = Math.sin(r)
  const sx = (s[0] ?? 100) / 100, sy = (s[1] ?? 100) / 100
  // translate(p) · rotate(r) · scale(s) · translate(-a)
  const T = [1, 0, 0, 1, p[0] ?? 0, p[1] ?? 0]
  const R = [cos, sin, -sin, cos, 0, 0]
  const S = [sx, 0, 0, sy, 0, 0]
  const A = [1, 0, 0, 1, -(a[0] ?? 0), -(a[1] ?? 0)]
  return mul(mul(mul(T, R), S), A)
}

const byInd = new Map(doc.layers.map((l) => [l.ind, l]))
/** Guards the parent walks against a cyclic layer graph. */
const MAX_PARENT_DEPTH = 12
function worldMatrix(layer, t, seen = 0) {
  const m = localMatrix(layer.ks, t)
  if (layer.parent == null || seen > MAX_PARENT_DEPTH) return m
  const parent = byInd.get(layer.parent)
  return parent ? mul(worldMatrix(parent, t, seen + 1), m) : m
}

// ── Local-space bbox from shape geometry (approximate, enough for contact) ───
function collectPoints(items, out) {
  for (const it of items ?? []) {
    if (it.ty === 'gr') collectPoints(it.it, out)
    else if (it.ty === 'sh') {
      const path = it.ks?.a ? it.ks.k?.[0]?.s : it.ks?.k
      for (const v of path?.v ?? []) out.push(v)
    } else if (it.ty === 'el' || it.ty === 'rc') {
      const c = evalProp(it.p, 0, [0, 0])
      const s = evalProp(it.s, 0, [0, 0])
      out.push([c[0] - s[0] / 2, c[1] - s[1] / 2], [c[0] + s[0] / 2, c[1] + s[1] / 2])
    }
  }
  return out
}
function bboxOf(layer) {
  const pts = collectPoints(layer.shapes, [])
  if (!pts.length) return null
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const [x, y] of pts) {
    if (x < x0) x0 = x; if (y < y0) y0 = y
    if (x > x1) x1 = x; if (y > y1) y1 = y
  }
  return { x0, y0, x1, y1 }
}

// ── Sampling window: the idle segment when the scene declares one ────────────
const loopMarker = doc.markers?.find((m) => m?.cm === 'loop' && typeof m.tm === 'number')
const t0 = loopMarker ? loopMarker.tm : (doc.ip ?? 0)
const t1 = doc.op ?? 0
const SAMPLES = 28
const times = Array.from({ length: SAMPLES }, (_, i) => t0 + ((t1 - t0) * i) / (SAMPLES - 1))

const shapeLayers = doc.layers.filter((l) => l.ty === 4 && !l.td)
const world = new Map()
for (const l of doc.layers) world.set(l.ind, times.map((t) => worldMatrix(l, t)))
const boxes = new Map()
for (const l of shapeLayers) {
  const b = bboxOf(l)
  if (b) boxes.set(l.ind, b)
}
// World-space bbox at rest, for contact detection.
const worldBox = new Map()
for (const [ind, b] of boxes) {
  const m = world.get(ind)[0]
  const corners = [[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1]].map((p) => apply(m, p))
  worldBox.set(ind, {
    x0: Math.min(...corners.map((c) => c[0])), x1: Math.max(...corners.map((c) => c[0])),
    y0: Math.min(...corners.map((c) => c[1])), y1: Math.max(...corners.map((c) => c[1])),
  })
}

const CONTACT_GAP = 3      // px — touching or overlapping in the artwork
const SLIDE_LIMIT = 0.75   // px — anything above this reads as a part coming loose

// Contact is decided on real GEOMETRY, not bounding boxes: two diagonally
// placed elements (a moon up-right, a helmet down-left) can have overlapping
// AABBs with clear air between the actual ink, and calling that a contact
// would flood the report with false failures — the fastest way to get a
// checker ignored.
const localPts = new Map()
for (const l of shapeLayers) {
  const pts = collectPoints(l.shapes, [])
  if (pts.length) {
    const step = Math.max(1, Math.floor(pts.length / 160)) // cap the pair cost
    localPts.set(l.ind, pts.filter((_, i) => i % step === 0))
  }
}
const worldPts = new Map()
for (const [ind, pts] of localPts) {
  const m = world.get(ind)[0]
  worldPts.set(ind, pts.map((p) => apply(m, p)))
}
function minDistance(indA, indB) {
  const A = worldPts.get(indA), B = worldPts.get(indB)
  if (!A || !B) return Infinity
  let best = Infinity
  for (const a of A) for (const b of B) {
    const d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2
    if (d < best) { best = d; if (best === 0) return 0 }
  }
  return Math.sqrt(best)
}

/** Max distance between where each layer's own motion carries a shared point. */
function maxSlide(indA, indB, point) {
  const A = world.get(indA), B = world.get(indB)
  const a0 = invert(A[0]), b0 = invert(B[0])
  let worst = 0
  for (let i = 1; i < times.length; i++) {
    const pa = apply(A[i], apply(a0, point))
    const pb = apply(B[i], apply(b0, point))
    worst = Math.max(worst, Math.hypot(pa[0] - pb[0], pa[1] - pb[1]))
  }
  return worst
}

// ── Declared exceptions ──────────────────────────────────────────────────────
// Rigid welds are the DEFAULT, not the only truth: a bending joint, a shadow
// answering the body, a glint sweeping a lens are all relative motion the
// other gates positively require. This gate was calibrated on a rigid suit
// and, applied to an articulated character, condemned that craft. So a build
// may DECLARE intended relative motion in its controls.json:
//
//   "motionExceptions": [
//     { "a": "fist", "b": "bicep", "reason": "elbow joint bends on the flex" }
//   ]
//
// Each entry needs a reason — the point is to make the intent explicit and
// reviewable, not to hand out a blanket mute.
const ctrlPath = join(__dirname, `../public/projects/${slug}/${scene}/controls.json`)
let exceptions = []
if (existsSync(ctrlPath)) {
  try {
    const raw = JSON.parse(readFileSync(ctrlPath, 'utf8'))
    if (Array.isArray(raw.motionExceptions)) {
          exceptions = raw.motionExceptions.filter((e) => e && typeof e.reason === 'string'
        && ((typeof e.a === 'string' && typeof e.b === 'string') || typeof e.layer === 'string'))
    }
  } catch { /* a malformed controls.json simply declares nothing */ }
}
/** Layer-scoped exception: { "layer": "eye", "reason": "..." } — for rules
 *  about ONE element (a deliberate squint) rather than a pair's relationship. */
const declaredLayer = (nm) => exceptions.find((e) => e.layer && typeof e.layer === 'string'
  && nm.toLowerCase().includes(e.layer.toLowerCase()))
const declared = (nmA, nmB) => exceptions.find((e) => {
  if (!e.a || !e.b) return false
  const hit = (x, y) => x.toLowerCase().includes(e.a.toLowerCase()) && y.toLowerCase().includes(e.b.toLowerCase())
  return hit(nmA, nmB) || hit(nmB, nmA)
})

const OCCUPANT_RE = /occupant/i
const isOccupant = (l) => OCCUPANT_RE.test(l?.nm ?? '')
/** Peak-to-peak of a sampled signal. */
const p2p = (a) => Math.max(...a) - Math.min(...a)
const OCCUPANT_MIN = 3     // px — below this the inside-the-shell float doesn't read
/** A violation plus the fix that ACTUALLY addresses it. One shared closing
 *  line used to be printed for every failure, so an invented fill or a scale
 *  divorce was answered with "weld the parts" — advice the agent reads and
 *  acts on, costing a whole write→run→look→fix cycle on the wrong thing. */
const failures = []
const fail = (message, fix) => failures.push({ message, fix })
const allowed = []
const occupantSlides = []
const pairs = []
const inds = [...worldBox.keys()]
for (let i = 0; i < inds.length; i++) {
  for (let j = i + 1; j < inds.length; j++) {
    const A = worldBox.get(inds[i]), B = worldBox.get(inds[j])
    // Cheap AABB reject first, then the exact geometry test.
    const gapX = Math.max(A.x0 - B.x1, B.x0 - A.x1)
    const gapY = Math.max(A.y0 - B.y1, B.y0 - A.y1)
    if (gapX > CONTACT_GAP || gapY > CONTACT_GAP) continue
    if (minDistance(inds[i], inds[j]) > CONTACT_GAP) continue // AABBs met, ink didn't
    // Contact point: centre of the overlapping/adjacent region.
    const px = (Math.max(A.x0, B.x0) + Math.min(A.x1, B.x1)) / 2
    const py = (Math.max(A.y0, B.y0) + Math.min(A.y1, B.y1)) / 2
    const nmA = byInd.get(inds[i]).nm, nmB = byInd.get(inds[j]).nm
    const slide = maxSlide(inds[i], inds[j], [px, py])
    const okDecl = declared(nmA, nmB)
    pairs.push({ a: nmA, b: nmB, slide, declared: !!okDecl })
    // An OCCUPANT is the one contact that must NOT hold: it is the character
    // inside the shell, and the matte is what keeps it contained. So the rule
    // inverts rather than exempting — gate 15 fails when it does not move.
    if (isOccupant({ nm: nmA }) || isOccupant({ nm: nmB })) {
      occupantSlides.push({ pair: `${nmA} ↔ ${nmB}`, slide })
      continue
    }
    if (okDecl) { allowed.push(`${nmA} ↔ ${nmB}: ${slide.toFixed(2)}px — declared: ${okDecl.reason}`); continue }
    if (slide > SLIDE_LIMIT) {
      fail(`CONTACT SLIDE  ${nmA} ↔ ${nmB}: ${slide.toFixed(2)}px (limit ${SLIDE_LIMIT})`,
        'Weld them: same rig, no relative track of their own (same period at a different phase still slides). If the motion IS intended — a bending joint, a shadow answering the body, a glint sweeping a surface — declare it in controls.json: motionExceptions: [{ a, b, reason }].')
    }
  }
}

// ── Foreign clocks ───────────────────────────────────────────────────────────
// A track's period, read from its own values: the gap between successive
// maxima of the sampled signal over the idle window.
function periodOf(layer) {
  const ks = layer.ks
  const sig = []
  const N = 240
  for (let i = 0; i < N; i++) {
    const t = t0 + ((t1 - t0) * i) / (N - 1)
    const p = evalProp(ks?.p, t, [0, 0, 0])
    const r = evalProp(ks?.r, t, [0])
    sig.push((p?.[0] ?? 0) + (p?.[1] ?? 0) * 1.7 + (r?.[0] ?? 0) * 13)
  }
  const peaks = []
  for (let i = 1; i < N - 1; i++) if (sig[i] > sig[i - 1] && sig[i] >= sig[i + 1]) peaks.push(i)
  if (peaks.length < 2) return null
  const gaps = []
  for (let i = 1; i < peaks.length; i++) gaps.push(peaks[i] - peaks[i - 1])
  const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length
  return (mean / (N - 1)) * (t1 - t0)
}
/** Sampled world-x/y of a layer, for comparing one track's shape to another's. */
function signal(layer) {
  const W = world.get(layer.ind)
  return W.map((m) => apply(m, [0, 0]))
}
function correlation(a, b, axis) {
  const xs = a.map((p) => p[axis]), ys = b.map((p) => p[axis])
  const mx = xs.reduce((s, v) => s + v, 0) / xs.length
  const my = ys.reduce((s, v) => s + v, 0) / ys.length
  let num = 0, dx = 0, dy = 0
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : 0
}

// Free elements (no contact pair) MAY carry their own clock — that is the
// satellite rule — so a differing period is reported, never failed. What the
// report exists to expose is fake "derived parallax": a real one is a scalar
// multiple of the subject's own track, so |correlation| ≈ 1. Anything less is
// an independent clock wearing a parallax comment.
const contacted = new Set(pairs.flatMap((p) => [p.a, p.b]))
// Period is only extractable when a track completes >1 cycle in the window —
// a once-per-loop backdrop drift yields none, and that is exactly the track
// most likely to be a fake parallax, so correlation is reported for EVERY
// animated rig whether or not its period could be measured.
const animated = doc.layers.filter((l) => (l.ks?.p?.a || l.ks?.r?.a) && l.ty === 3)
const periods = animated.map((l) => ({ l, nm: l.nm, period: periodOf(l) }))
if (periods.some((p) => p.period)) {
  // The scene's clock belongs to the SUBJECT — the rig carrying the most
  // layers — not to whichever period happens to be most numerous among props.
  const subtreeSize = (ind) => doc.layers.filter((l) => {
    let cur = l, hops = 0
    while (cur && hops++ < MAX_PARENT_DEPTH) { if (cur.ind === ind) return true; cur = byInd.get(cur.parent) }
    return false
  }).length
  const lead = periods.filter((p) => p.period).map((p) => ({ ...p, size: subtreeSize(p.l.ind) }))
    .sort((a, b) => b.size - a.size)[0]
  const primary = Math.round(lead.period)
  console.log(`\nScene clock: ${primary}f (from ${lead.nm})`)
  const leadSig = signal(lead.l)
  for (const { l, nm, period } of periods) {
    if (l.ind === lead.l.ind) continue
    const cx = correlation(signal(l), leadSig, 0), cy = correlation(signal(l), leadSig, 1)
    const worst = Math.abs(Math.abs(cx) > Math.abs(cy) ? cx : cy)
    const derived = worst > 0.9
    const free = !contacted.has(nm)
    console.log(
      `  ${nm}: period ${period ? period.toFixed(0) + 'f' : '>window (once per loop)'} · correlation to ${lead.nm} ${(cx < 0 || cy < 0 ? '-' : '+')}${worst.toFixed(2)}` +
      `  ${derived ? '(derived from the scene clock)' : free ? '(independent clock — fine for a FREE element, NOT for a backdrop claiming parallax)' : '(independent clock)'}`,
    )
  }
}

// A matte the SAME shape as the mass it clips cancels the drift exactly: the
// visible edge is pinned by the static matte and a uniform fill has no
// interior detail to reveal the shift, so a measured 7px float renders as
// nothing at all. The matte must be the CONTAINER's opening — bigger than the
// occupant, which is what gives it room to move (observed: a scene where the
// visor hole was used for both, and the face sat dead still while the
// transform said otherwise).
for (let i = 0; i < doc.layers.length; i++) {
  const matted = doc.layers[i]
  if (!matted.tt || !isOccupant(matted)) continue
  const matte = doc.layers.slice(0, i).reverse().find((l) => l.td)
  if (!matte) continue
  const mb = bboxOf(matted), tb = bboxOf(matte)
  if (!mb || !tb) continue
  const area = (b) => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0)
  const slackX = (tb.x1 - tb.x0) - (mb.x1 - mb.x0)
  const slackY = (tb.y1 - tb.y0) - (mb.y1 - mb.y0)
  const need = occupantSlides.length ? Math.max(...occupantSlides.map((o) => o.slide)) : OCCUPANT_MIN
  // Slack is shared between the two sides, so what the occupant actually has
  // to travel into is HALF of it. Comparing the total was too generous: a mass
  // with 7.2px of total slack and a 4.8px drift has only 3.6px per side, so it
  // runs into the container's edge and gets shaved against the border strokes
  // — exactly the "black body clashing with the suit lines" report.
  const perX = slackX / 2, perY = slackY / 2
  console.log(`\nOccupant clip: ${matted.nm} inside ${matte.nm} — clearance ${perX.toFixed(1)}px/side × ${perY.toFixed(1)}px/side, drift ${need.toFixed(1)}px, area ratio ${(area(tb) / (area(mb) || 1)).toFixed(2)}`)
  if (perX <= 0.5 && perY <= 0.5) {
    fail(
      `MATTE CANCELS THE FLOAT  ${matted.nm} fills its own matte (${matte.nm}): ` +
      `${perX.toFixed(1)}px/side of clearance. The clip pins the visible edge, so the motion renders as nothing.`,
      'Matte with the CONTAINER (the larger shape the feature sits in); the occupant is the smaller feature. Both must already exist in the artwork.',
    )
  } else if (perX < need || perY < need) {
    fail(
      `OCCUPANT HITS THE EDGE  ${matted.nm} drifts ${need.toFixed(1)}px inside ${matte.nm} but has only ` +
      `${perX.toFixed(1)}px/side × ${perY.toFixed(1)}px/side of clearance — it reaches the container's ` +
      `boundary and is shaved against its outline.`,
      'Usually the wrong element is the occupant: it should be the FACE (the shape the eyes sit on), not the mass it sits in — that mass stays welded to the shell. Otherwise reduce the drift to fit the room the artwork gives it.',
    )
  }
}

// ── Invented fills ───────────────────────────────────────────────────────────
// Every colour on screen must come from the artwork. Rigs are re-parenting and
// re-timing existing shapes, never repainting them — a new colour means a
// layer was invented to make the rig work (observed: a grey plate slid behind
// a shrunken face to manufacture matte slack, giving it a halo the designer
// never drew). Matte sources are exempt: their fill is an alpha channel.
// Multi-artwork scenes (v1.2 `svgs`) store sources as <slug>.svg, <slug>-2.svg…
// — a colour is legitimate if ANY attached file carries it, so scan them all.
const srcPaths = []
for (let i = 0; i < 12; i++) {
  const p = join(__dirname, `../assets/${i === 0 ? `${slug}.svg` : `${slug}-${i + 1}.svg`}`)
  if (!existsSync(p)) break
  srcPaths.push(p)
}
if (srcPaths.length) {
  const svg = srcPaths.map((p) => readFileSync(p, 'utf8')).join('\n')
  const sourceFills = new Set()
  // Named colours are ordinary in exported SVG ("white" outnumbers hex in
  // some exports), so a hex-only scan would call the artwork's own white an
  // invention — the fastest way to make this check untrustworthy.
  const NAMED = { white: '#FFFFFF', black: '#000000', red: '#FF0000', gray: '#808080', grey: '#808080' }
  for (const m of svg.matchAll(/(?:fill|stroke)\s*[:=]\s*["']?\s*(#[0-9a-fA-F]{3,8}|[a-zA-Z]+)/g)) {
    const raw = m[1]
    if (/^#/.test(raw)) {
      let hex = raw.toUpperCase()
      if (hex.length === 4) hex = '#' + [...hex.slice(1)].map((c) => c + c).join('')
      sourceFills.add(hex.slice(0, 7))
    } else if (NAMED[raw.toLowerCase()]) {
      sourceFills.add(NAMED[raw.toLowerCase()])
    }
  }
  const toHex = (k) => '#' + k.slice(0, 3)
    .map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase()
  const seen = new Map()
  const walkFills = (items, layerName) => {
    for (const it of items ?? []) {
      if (it.ty === 'gr') walkFills(it.it, layerName)
      else if ((it.ty === 'fl' || it.ty === 'st') && it.c) {
        const k = it.c.a ? it.c.k?.[0]?.s : it.c.k
        if (Array.isArray(k)) seen.set(toHex(k), layerName)
      }
    }
  }
  for (const l of doc.layers) if (l.ty === 4 && !l.td) walkFills(l.shapes, l.nm)
  const invented = [...seen.entries()].filter(([hex]) => !sourceFills.has(hex))
  if (sourceFills.size && invented.length) {
    for (const [hex, layerName] of invented) {
      fail(`INVENTED FILL  ${hex} on "${layerName}" appears nowhere in the source artwork — the rig repainted it instead of re-using its shapes`,
        'Re-use an existing subpath and its authored fill. Never add a backing plate or recolour to manufacture room for a rig.')
    }
  }
}

// Gate 15, mechanically: an occupant that exists must READ against its shell.
if (occupantSlides.length) {
  const best = occupantSlides.sort((a, b) => b.slide - a.slide)[0]
  console.log(`\nOccupant float: ${best.slide.toFixed(2)}px relative (${best.pair})`)
  if (best.slide < OCCUPANT_MIN) {
    fail(`OCCUPANT TOO STILL  ${best.pair}: ${best.slide.toFixed(2)}px relative to its shell (needs ≥ ${OCCUPANT_MIN}px to read)`,
      'Raise the occupant\'s own drift, or check you picked the FACE (the shape the eyes sit on) rather than the eyes alone.')
  }
}

// ── Scale divorce ────────────────────────────────────────────────────────────
// The occupant is INSIDE the body, so it must ride the body's full transform —
// breathe/scale swell included. Parenting it above (outside) that swell makes
// the shell appear to inflate and deflate around a fixed-size face, which
// reads as the suit growing rather than the character breathing.
{
  const scaleTrack = (ind) => world.get(ind).map((m) => Math.hypot(m[0], m[1]))
  for (const occ of doc.layers.filter((l) => l.ty === 4 && isOccupant(l))) {
    let root = occ, hops = 0
    while (root.parent != null && hops++ < MAX_PARENT_DEPTH) { const p = byInd.get(root.parent); if (!p) break; root = p }
    // The shell: the biggest non-occupant shape sharing that root.
    const kin = doc.layers.filter((l) => {
      if (l.ty !== 4 || l.td || isOccupant(l) || !boxes.has(l.ind)) return false
      let cur = l, h = 0
      while (cur && h++ < MAX_PARENT_DEPTH) { if (cur.ind === root.ind) return true; cur = byInd.get(cur.parent) }
      return false
    })
    if (!kin.length) continue
    const areaOf = (l) => { const b = boxes.get(l.ind); return (b.x1 - b.x0) * (b.y1 - b.y0) }
    const shell = kin.sort((a, b) => areaOf(b) - areaOf(a))[0]
    const shellSwell = p2p(scaleTrack(shell.ind)), occSwell = p2p(scaleTrack(occ.ind))
    if (shellSwell > 0.005) {
      console.log(`\nBreathe inheritance: ${shell.nm} swells ${(shellSwell * 100).toFixed(1)}%, ${occ.nm} ${(occSwell * 100).toFixed(1)}%`)
      if (occSwell < shellSwell * 0.5) {
        fail(
          `SCALE DIVORCE  ${occ.nm} does not ride ${shell.nm}'s breathe (${(occSwell * 100).toFixed(1)}% vs ` +
          `${(shellSwell * 100).toFixed(1)}%): the shell inflates around a fixed-size occupant, so the suit ` +
          `appears to grow instead of the character breathing.`,
          'Nest the occupant UNDER the breathe/scale null — its own drift belongs inside that inherited scale, never beside it.',
        )
      }
    }
  }
}

// ── Blinks close ─────────────────────────────────────────────────────────────
// A lid is a shutter: the eye must be GONE for a beat. Parked at 15-20% it
// reads as a squint — and the readable-accent floor (gate 6), written for
// oscillations the eye must track, is what pushes a rig to stretch and
// shallow a blink until it becomes one.
const EYE_RE = /\beye|pupil|lid\b/i
for (const eye of doc.layers.filter((l) => EYE_RE.test(l.nm ?? '') && l.ks?.s?.a)) {
  // Read the KEYFRAMES, not the sample grid: a blink is 6-10 frames wide and
  // the coarse grid used elsewhere strides straight over it (measured: it
  // reported 64% for a dip authored at 18%).
  const ys = (eye.ks.s.k ?? []).map((k) => k?.s?.[1]).filter((v) => typeof v === 'number')
  if (!ys.length) continue
  const lo = Math.min(...ys), hi = Math.max(...ys)
  if (hi - lo < 5) continue // no blink authored on this layer
  const ok = declaredLayer(eye.nm)
  console.log(`\nBlink: ${eye.nm} closes to ${lo.toFixed(0)}% of its height`)
  if (lo > 10 && !ok) {
    fail(
      `BLINK NEVER CLOSES  ${eye.nm} bottoms out at ${lo.toFixed(0)}% height — a visible slit reads as a squint, not a blink`,
      'Dip scaleY to 0 so the eye vanishes for a beat, ~6-8 frames total (snap shut in 2-3, hold 1-2, open 3-4). Blinks are exempt from the readable-accent floor. A deliberate squint may declare { layer, reason } in controls.json.',
    )
  } else if (ok) {
    allowed.push(`${eye.nm} holds at ${lo.toFixed(0)}% — declared: ${ok.reason}`)
  }
}

// ── Scale pivots ON its artwork ──────────────────────────────────────────────
// Any layer whose SCALE animates pivots at its ANCHOR — and the anchor must
// sit on the layer's own geometry. A misplaced anchor turns every scale
// change into travel: a pop slides in along the anchor-to-artwork ray, a
// breathe wanders. The classic authoring slip is anchor = position over
// origin-space geometry — the two cancel and the artwork paints at the
// canvas corner instead of its home. Seen live TWICE (a checkmark's pen-down
// dot, then a thought-trail bubble parked at the corner); this gate exists
// so there is no third. Rotation-only layers are exempt — an external
// rotation pivot is a legitimate pendulum, and the house pattern carries
// those on nulls anyway.
for (const l of shapeLayers) {
  const s = l.ks?.s
  if (s?.a !== 1) continue
  const keys = (s.k ?? []).map((k) => k?.s).filter(Array.isArray)
  if (!keys.length) continue
  const bb = bboxOf(l)
  if (!bb) continue
  const a = evalProp(l.ks.a, 0, [0, 0])
  const padX = (bb.x1 - bb.x0) * 0.5 + 12, padY = (bb.y1 - bb.y0) * 0.5 + 12
  const onArtwork = a[0] >= bb.x0 - padX && a[0] <= bb.x1 + padX && a[1] >= bb.y0 - padY && a[1] <= bb.y1 + padY
  const ok = declaredLayer(l.nm ?? '')
  const isPop = Math.min(...keys.map((v) => Math.max(Math.abs(v[0] ?? 100), Math.abs(v[1] ?? 100)))) <= 15
  if (!onArtwork && !ok) {
    fail(
      `${isPop ? 'POP' : 'SCALE'} PIVOTS OFF THE ARTWORK  ${l.nm} animates scale around anchor (${a[0].toFixed(0)}, ${a[1].toFixed(0)}) but its geometry spans (${bb.x0.toFixed(0)}..${bb.x1.toFixed(0)}, ${bb.y0.toFixed(0)}..${bb.y1.toFixed(0)}) — every scale change becomes travel${isPop ? '; the pop slides in from the anchor instead of growing in place' : ''}`,
      "Anchor scale on the layer's own artwork: geometry at shape-space origin takes anchor [0,0] with only the position carrying it home; absolute geometry takes anchor = its own center. Anchor = position over origin-space shapes cancels the transform and paints the artwork at the canvas corner. A deliberate remote pivot may declare { layer, reason } in controls.json.",
    )
  } else if (ok && !onArtwork) {
    allowed.push(`${l.nm} scales around a remote anchor — declared: ${ok.reason}`)
  }
}

// ── Draw-ons follow the pen ──────────────────────────────────────────────────
// A hand-drawn tick is HANDWRITING: the stroke travels left to right, pen-down
// to pen-up. Source exports routinely author the path from the RIGHT tip, and
// a straight trim then draws the tick backwards — instantly wrong to anyone
// who has watched a checkbox. The reveal's origin (path start for e:0→100,
// path end for s:100→0) must not sit right of where the reveal finishes.
const TICK_RE = /check|tick|tail/i
function firstTrim(items) {
  for (const it of items ?? []) {
    if (it.ty === 'tm') return it
    if (it.ty === 'gr') { const t = firstTrim(it.it); if (t) return t }
  }
  return null
}
function firstPathVerts(items) {
  for (const it of items ?? []) {
    if (it.ty === 'sh') { const p = it.ks?.a ? it.ks.k?.[0]?.s : it.ks?.k; if (p?.v?.length) return p.v }
    if (it.ty === 'gr') { const v = firstPathVerts(it.it); if (v) return v }
  }
  return null
}
for (const l of doc.layers.filter((x) => x.ty === 4 && TICK_RE.test(x.nm ?? ''))) {
  // A ring/circle sweep has no handwriting order — either direction reads as
  // drawing. The pen rule governs the tick STROKE itself.
  if (/ring|circle|oval|halo|loop/i.test(l.nm ?? '')) continue
  const tm = firstTrim(l.shapes)
  if (!tm) continue
  const eAnim = tm.e?.a === 1, sAnim = tm.s?.a === 1
  if (!eAnim && !sAnim) continue
  const v = firstPathVerts(l.shapes)
  if (!v || v.length < 2) continue
  const fromStart = eAnim && !sAnim
  const origin = fromStart ? v[0] : v[v.length - 1]
  const finish = fromStart ? v[v.length - 1] : v[0]
  const ok = declaredLayer(l.nm ?? '')
  if (origin[0] > finish[0] + 8 && !ok) {
    fail(
      `DRAW-ON AGAINST THE PEN  ${l.nm} reveals from (${origin[0].toFixed(0)}, ${origin[1].toFixed(0)}) toward (${finish[0].toFixed(0)}, ${finish[1].toFixed(0)}) — right to left, backwards handwriting`,
      'Reverse the path (vertices reversed, in/out tangents swapped) so trim-from-start IS pen order: a tick draws left to right, always. A deliberate reverse reveal may declare { layer, reason } in controls.json.',
    )
  } else if (ok && origin[0] > finish[0] + 8) {
    allowed.push(`${l.nm} reveals right-to-left — declared: ${ok.reason}`)
  }
}

// ── A steady drift never reverses ────────────────────────────────────────────
// An ambient field (clouds, waves, traffic, rain) streams ONE way at constant
// speed until the brief brakes it. Reported twice from the field as "it goes
// left to right and then back, chaotically" — which is either an oscillation
// authored instead of a scroll, or a wrap teleport that a resampling consumer
// landed inside and DREW. Both look identical on screen and both are caught
// here: measure net travel per direction, excluding legal offscreen wraps.
const AMBIENT_RE = /cloud|wave|traffic|rain|sky|skyline|star|snow|leaf|bubble-bg|backdrop|parallax/i
for (const l of shapeLayers.filter((x) => AMBIENT_RE.test(x.nm ?? ''))) {
  const p = l.ks?.p
  if (p?.a !== 1) continue
  const k = (p.k ?? []).filter((x) => Array.isArray(x?.s))
  if (k.length < 3) continue
  let fwd = 0, back = 0, netSign = 0
  const steps = []
  for (let i = 1; i < k.length; i++) {
    const dx = k[i].s[0] - k[i - 1].s[0]
    const dt = k[i].t - k[i - 1].t
    // A wrap is a big move in ~no time; it is not travel, it is a jump.
    if (dt < 1.5 && Math.abs(dx) > 40) continue
    steps.push(dx)
    netSign += dx
  }
  if (!steps.length) continue
  const dir = Math.sign(netSign) || 1
  for (const dx of steps) { if (Math.sign(dx) === dir) fwd += Math.abs(dx); else back += Math.abs(dx) }
  if (fwd < 8) continue // essentially still — a different gate's business
  const ratio = back / fwd
  const ok = declaredLayer(l.nm ?? '')
  console.log(`\nAmbient drift: ${l.nm} travels ${fwd.toFixed(0)}px ${dir < 0 ? 'left' : 'right'}, ${back.toFixed(0)}px back (${(ratio * 100).toFixed(0)}%)`)
  if (ratio > 0.15 && !ok) {
    fail(
      `AMBIENT DRIFT REVERSES  ${l.nm} travels ${fwd.toFixed(0)}px ${dir < 0 ? 'left' : 'right'} but ${back.toFixed(0)}px back the other way — a steady stream became an oscillation`,
      'Author an ambient scroll by TILING copies one lap apart on a single linear translation (recipe-camera-scene-motion, "Ambient Scroll") — one direction, constant speed, from the frame the brief starts it until the beat that brakes it to a stop.',
    )
  } else if (ok && ratio > 0.15) {
    allowed.push(`${l.nm} reverses — declared: ${ok.reason}`)
  }
}

// ── Tiles sit at least a canvas apart ────────────────────────────────────────
// Spacing a scrolling field by the artwork's OWN width is the intuitive choice
// and it duplicates the picture: three copies of the same cloud share a 375px
// canvas at a 139px lap, and the sky stops reading as the drawing that was
// handed over. The valid window is [W, W + fieldWidth] — the lower bound keeps
// it sparse, the upper bound keeps a gap from opening. Parallax comes from
// SPEED, never from giving one depth layer a shorter lap.
function tiledAmbientGroups() {
  const groups = new Map()
  for (const l of shapeLayers) {
    const m = /^(.*?)-(-?\d+)$/.exec(l.nm ?? '')
    if (!m || !AMBIENT_RE.test(m[1]) || l.ks?.p?.a !== 1) continue
    if (!groups.has(m[1])) groups.set(m[1], [])
    groups.get(m[1]).push({ layer: l, i: Number(m[2]) })
  }
  for (const tiles of groups.values()) tiles.sort((a, b) => a.i - b.i)
  return groups
}
{
  const W = doc.w ?? 0
  for (const [base, tiles] of tiledAmbientGroups()) {
    if (tiles.length < 2 || !W) continue
    const x = (t, l) => evalProp(l.ks.p, t, [0, 0])[0]
    const lap = Math.abs((x(0, tiles[1].layer) - x(0, tiles[0].layer)) / (tiles[1].i - tiles[0].i))
    if (!Number.isFinite(lap) || lap < 1) continue
    const bb = bboxOf(tiles[0].layer)
    const fieldW = bb ? bb.x1 - bb.x0 : 0
    const ok = declaredLayer(base)
    const perScreen = W / lap
    console.log(`\nAmbient tiling: ${base} lap ${lap.toFixed(0)}px on a ${W}px canvas (${perScreen.toFixed(1)} copies per screen, artwork ${fieldW.toFixed(0)}px)`)
    if (lap < W - 1 && !ok) {
      fail(
        `AMBIENT TILES TOO DENSE  ${base} repeats every ${lap.toFixed(0)}px on a ${W}px canvas — ${perScreen.toFixed(1)} copies of the same artwork share the screen, which reads as duplicated art, not as a sky`,
        `Space tiles a full canvas apart (lap = ${W}), not by the field's own width. The valid window is [${W}, ${(W + fieldW).toFixed(0)}] — the lower bound keeps the field sparse, the upper keeps a gap from opening. Parallax comes from SPEED (the lap-count ratio), never from a shorter lap on one depth layer.`,
      )
    } else if (fieldW > 0 && lap > W + fieldW + 1 && !ok) {
      fail(
        `AMBIENT TILING LEAVES A GAP  ${base} repeats every ${lap.toFixed(0)}px but its artwork is only ${fieldW.toFixed(0)}px wide on a ${W}px canvas — the field empties out between copies`,
        `Bring the lap back inside [${W}, ${(W + fieldW).toFixed(0)}]; lap = ${W} is the default.`,
      )
    } else if (ok && (lap < W - 1 || (fieldW > 0 && lap > W + fieldW + 1))) {
      allowed.push(`${base} tiles at ${lap.toFixed(0)}px — declared: ${ok.reason}`)
    }
  }
}

// ── A field that stops, stops ON its source position ─────────────────────────
// A sequence built from several source artworks is meant to END on the last
// one. When an ambient field brakes to a halt under the payoff, every tile
// must come to rest a whole number of laps from where the artwork drew it —
// otherwise the final frame is the right composition with the sky in the
// wrong place, which reads as "close, but not the source file".
//
// Landing there needs TWO conditions, and satisfying only the first is the
// trap: deriving speed from the loop span closes the loop but says nothing
// about where the field stops. The brake's distance-time must ALSO be a whole
// multiple of that span. (Measured on a generated scene that closed its loop
// perfectly and still rested 106px and 135px off source.)
{
  const tiled = new Map()
  for (const l of shapeLayers) {
    const m = /^(.*?)-(-?\d+)$/.exec(l.nm ?? '')
    if (!m || !AMBIENT_RE.test(m[1]) || l.ks?.p?.a !== 1) continue
    if (!tiled.has(m[1])) tiled.set(m[1], [])
    tiled.get(m[1]).push({ layer: l, i: Number(m[2]) })
  }
  const last = doc.op ?? 0
  for (const [base, tiles] of tiled) {
    if (tiles.length < 2) continue
    tiles.sort((a, b) => a.i - b.i)
    const x = (t, l) => evalProp(l.ks.p, t, [0, 0])[0]
    const lap = (x(0, tiles[1].layer) - x(0, tiles[0].layer)) / (tiles[1].i - tiles[0].i)
    if (!Number.isFinite(lap) || Math.abs(lap) < 1) continue
    // Only fields that actually come to rest: still drifting at the end means
    // there is no resting position to be right or wrong about.
    const speedAtEnd = Math.abs(x(last, tiles[0].layer) - x(last - 2, tiles[0].layer)) / 2
    if (speedAtEnd > 0.05) continue
    let off = Infinity
    for (const t of tiles) {
      const r = ((x(last, t.layer) % lap) + Math.abs(lap)) % Math.abs(lap)
      off = Math.min(off, r, Math.abs(lap) - r)
    }
    const ok = declaredLayer(base)
    console.log(`\nAmbient rest: ${base} halts ${off.toFixed(1)}px from its source position (lap ${Math.abs(lap).toFixed(0)}px)`)
    if (off > 2 && !ok) {
      fail(
        `AMBIENT RESTS OFF-SOURCE  ${base} comes to rest ${off.toFixed(1)}px from where the artwork drew it — the final frame is not the source composition`,
        'Two conditions, not one: speed = laps x lap / loopSpan closes the repeatable segment, and the brake\'s DISTANCE-TIME (for a cubic brake, decelStart + decelDur/3) must be a whole multiple of that same loopSpan so the field halts on a lap boundary. Size the loop span from where the sky stops — loopSpan = distanceTime / k — rather than picking it first. See recipe-camera-scene-motion, "Ambient Scroll".',
      )
    } else if (ok && off > 2) {
      allowed.push(`${base} rests ${off.toFixed(1)}px off source — declared: ${ok.reason}`)
    }
  }
}

// ── Wrap teleports happen offscreen ──────────────────────────────────────────
// An ambient field (clouds, traffic, waves) wraps by TELEPORTING back across
// the canvas between two near-coincident keys. Legitimate only while nobody
// can see it: at BOTH keys the layer's artwork must sit fully outside the
// frame, else the jump flashes across the picture for a frame.
{
  const wraps = []
  for (const l of shapeLayers) {
    const p = l.ks?.p
    if (p?.a !== 1) continue
    const k = p.k ?? []
    const bb = bboxOf(l)
    if (!bb) continue
    for (let i = 1; i < k.length; i++) {
      if (!Array.isArray(k[i]?.s) || !Array.isArray(k[i - 1]?.s)) continue
      const dt = k[i].t - k[i - 1].t
      if (dt > 1.5) continue
      const jump = Math.hypot(k[i].s[0] - k[i - 1].s[0], k[i].s[1] - k[i - 1].s[1])
      if (jump < 40) continue
      let visible = false
      for (const tEval of [k[i - 1].t, k[i].t]) {
        const m = worldMatrix(l, tEval)
        const xs = [], ys = []
        for (const [x, y] of [[bb.x0, bb.y0], [bb.x1, bb.y0], [bb.x0, bb.y1], [bb.x1, bb.y1]]) {
          const q = apply(m, [x, y]); xs.push(q[0]); ys.push(q[1])
        }
        if (Math.max(...xs) > 0 && Math.min(...xs) < (doc.w ?? 0) && Math.max(...ys) > 0 && Math.min(...ys) < (doc.h ?? 0)) visible = true
      }
      if (visible && !declaredLayer(l.nm ?? '')) {
        fail(
          `WRAP TELEPORTS IN VIEW  ${l.nm} jumps ${jump.toFixed(0)}px in ${dt.toFixed(2)}f at t=${k[i].t.toFixed(1)} while its artwork is inside the frame`,
          'A wrap teleport is legal only fully offscreen: keep drifting until the artwork clears the frame edge (plus margin), teleport there, and re-enter from beyond the far edge. Better: author the scroll by TILING and have no teleport at all (recipe-camera-scene-motion, "Ambient Scroll").',
        )
        break
      }
      // Offscreen is not enough on its own: a jump left INTERPOLATABLE can be
      // drawn by anything that resamples or rescales time (a duration or speed
      // control, a player running on display refresh). A hold key makes that
      // impossible — or drop the teleport entirely and tile.
      if (!visible && k[i - 1].h !== 1 && !declaredLayer(l.nm ?? '')) {
        fail(
          `WRAP IS INTERPOLATABLE  ${l.nm} jumps ${jump.toFixed(0)}px at t=${k[i].t.toFixed(1)} across a ${dt.toFixed(2)}f gap with smooth interpolation — a consumer that resamples or rescales time will DRAW the sweep across the canvas`,
          'Tile the field instead of teleporting it (recipe-camera-scene-motion, "Ambient Scroll") — no jump, nothing to interpolate. If a teleport is truly unavoidable, mark the pre-jump keyframe as a HOLD key (h: 1).',
        )
        break
      }
      if (!visible) wraps.push(`${l.nm} wraps at t=${k[i].t.toFixed(1)} (${jump.toFixed(0)}px, offscreen, hold key)`)
    }
  }
  if (wraps.length) console.log(`\nOffscreen wraps: ${wraps.length}\n  ` + wraps.slice(0, 6).join('\n  '))
}

// Axis split, reported whether or not the occupant touches anything: the
// shell already travels 2D, so an occupant with real amplitude on BOTH axes
// compounds two ellipses and reads as swimming rather than as a body settling
// inside its suit.
{
  const rig = doc.layers.find((l) => l.ty === 3 && isOccupant(l) && l.ks?.p?.a)
  if (rig) {
    const xs = [], ys = []
    for (const t of times) { const p = evalProp(rig.ks.p, t, [0, 0, 0]); xs.push(p[0]); ys.push(p[1]) }
    const [ax, ay] = [p2p(xs), p2p(ys)]
    console.log(`\nOccupant drift axes (${rig.nm}): ${ax.toFixed(1)}px horizontal × ${ay.toFixed(1)}px vertical` +
      (Math.min(ax, ay) > 1.5
        ? '\n  → 2D drift beneath a 2D shell reads as swimming; a single axis (vertical) reads as buoyancy'
        : '  — single-axis, reads as buoyancy'))
  }
}

console.log(`\nContact pairs checked: ${pairs.length}`)
if (allowed.length) {
  console.log(`Declared exceptions (${allowed.length}):`)
  for (const a of allowed) console.log('  ok   ' + a)
}
for (const p of pairs.sort((x, y) => y.slide - x.slide).slice(0, 12)) {
  const verdict = p.declared ? 'decl' : p.slide > SLIDE_LIMIT ? 'FAIL' : 'ok  '
  console.log(`  ${verdict} ${p.slide.toFixed(2)}px  ${p.a} ↔ ${p.b}`)
}

if (failures.length) {
  console.error(`\n${failures.length} violation(s):`)
  for (const f of failures) {
    console.error('  ' + f.message)
    console.error('    → ' + f.fix)
  }
  process.exit(1)
}
console.log('\nAll contacts hold, every occupant reads, and no colour was invented.')
