#!/usr/bin/env node
/**
 * Three illustrations, one seamless scene (waiting -> confirmation -> celebration).
 *   asset 1: Confirmation-Pending.svg  — a clock badge (waiting)
 *   asset 2: Confirmation-Checked.svg  — a checkmark scribble (confirmation)
 *   asset 3: AllSet.svg                — Zenek celebrating (payoff, endless loop)
 *
 * KIND: intro-loop. Beats 1-3 are the one-shot intro [0..T]; the mascot's
 * bounce is the endless loop [T..op]. Geometry for the mascot assembly
 * (body/belly/eyes/arms/shadow/sparkles/swoosh/spark/ribbon) follows the
 * lineage in docs/allset-celebration-animation.md and its n2ie/74j8
 * successors (parser, stroke-to-fill, stacked-alpha sweep, low-pivot rig).
 *
 * THIS RUN (slug three-illustrations-one-3ndo): the three source SVGs are
 * near-identical (md5-diffed and line-diffed before authoring — every
 * differing digit is sub-0.01px export noise, e.g. tickE's endpoint
 * 198.044 vs 198.045, confirmed by rendering: no visible effect) to the
 * paymentconfirmation-story-three-{0dot,4obq,zezm,h3oo,6v93} field tests.
 * `-0dot`'s script (the most recently re-derived sibling, itself carrying a
 * fix over `-4obq`) was used as the geometry/technique reference, per
 * "porting is not authoring": every path constant below was RE-EXTRACTED
 * from THIS run's own `assets/three-illustrations-one-3ndo{,-2,-3}.svg`
 * (grep'd by element id, not hand-copied from a prior script), and this
 * brief's own text was compared clause by clause against the references —
 * not assumed from the slug or file similarity:
 *   - "The two badge artworks are NOT the same geometry — build one badge
 *     from the first and hold it, never crossfade" — confirmed: asset 2's
 *     own badge ring (`Stroke 6`, 1.39256px, single ring, 257x256 viewBox)
 *     is genuinely different geometry from asset 1's badge (double ring,
 *     2.26667px, 256x256) — asset 2 contributes ONLY its checkmark path
 *     (`Stroke 8`) to the scene, brought into asset 1's own stroke-weight
 *     family; asset 2's own ring/disc/pattern are never built.
 *   - "Only the body and its white face morph" — matches zezm's
 *     `eyeCounterScale()` design exactly: the eyes are children of
 *     mascot-root but counter-scale so their drawn arcs never squash or
 *     stretch; only bodyOutline/belly inherit the parent's squash-stretch.
 *   - ticks are DECAL by default (motion-taste's inline rule) — this brief
 *     never asks for a per-tick reaction, so none is added.
 *   - air-flow marks trail the descent only ("air-flow marks trail each
 *     fall") — matches zezm's design; nothing during the rise.
 *   - "the first firework bursts the moment he lands" — matches `-0dot`'s
 *     shipped fix: sparkle cluster A's whole period anchors at `LAND_END`,
 *     not `T`, so a burst starts on the landing frame itself, per
 *     chapterization's "accents tied to an event fire AT the event."
 *   - "the pale ribbon left to right, straight on into the bright swoosh,
 *     the spark last like the pen lifting" and "The mascot rises into view
 *     while the pen is still drawing" — matches the one-continuous-pen
 *     ribbon-then-swoosh-then-spark sequence, overlapping the mascot's rise
 *     per chapterization's "an arrival must not eclipse a gesture that is
 *     still drawing."
 *   - timeline: this brief gives no explicit per-beat seconds (unlike
 *     `-0dot`'s brief), only "about a turn and a half" for beat 1 and
 *     "~216 frames" for the loop. BEAT1/2/3 = 72/104/96 (T=272) are REUSED
 *     from the field-tested sibling scenes as the reasonable default for
 *     the same described content (mechanical wait -> accelerating handoff
 *     with an exit cascade -> celebration entrance) — not blindly copied:
 *     re-checked against this brief's own pacing language (steady/
 *     mechanical wait, an accelerating handoff, a cascade, a launch) and
 *     found consistent.
 * This run's own preamble additionally asks to read
 * `references/recipe-companion-bubble.md` and honor its bubble HARD CONTRACT
 * — but the brief's actual beat-by-beat text never stages a speech bubble,
 * tooltip, or any text layer; the whole three-chapter story is badge/check/
 * mascot only. Per "the brief outranks every gate," the companion-bubble
 * items (bubble text layer, autoFit, `.textPos` slot, house entrance
 * constants) are inapplicable by construction — declared here rather than
 * silently skipped. Only the recipe's section 1 ("Intro + Loop" markers,
 * idle-alive-from-frame-0) applies, and it does.
 *
 * ONE GENUINE DEFECT FOUND AND FIXED while re-deriving, not carried forward:
 * `-0dot`'s own header comment CLAIMED "the punctuated check stamp" was
 * shipped (quoting motion-taste's "a completed gesture gets punctuation" —
 * "when the pen lifts, the finished check stamps home" is this brief's own
 * words for the same rule), but its `checkLyr` had NO scale track at all —
 * a flat trim-draw with no stamp-settle on completion. The claim was false;
 * the code never matched the comment. Fixed here: `checkStampAnim()` gives
 * the finished check a 2-3% overshoot-and-settle on its OWN bbox center
 * (gate 18's scale-pivot rule — the check has no p/a override, so an
 * un-pivoted scale would paint it at the canvas corner), keyed a few frames
 * after the trim reaches 100% and fully settled before the badge pop starts.
 *
 * Per "porting is not authoring," every constant below was re-checked against
 * this run's own brief text and the CURRENT skill references before shipping
 * (player-contract.md's opacity-does-not-cascade/precomp note and Export
 * Compatibility section, motion-taste's Aliveness Contract gates 1-19 plus
 * its "completed gesture gets punctuation" clause — the one this run actually
 * fixed, chapterization's Grounded Handoffs checklist plus its "arrival must
 * not eclipse a drawing gesture" and "accents tied to an event fire AT the
 * event" clauses) — not carried on the strength of the prior scripts' git
 * history or their own doc claims.
 *
 * Output: public/projects/three-illustrations-one-3ndo/scene-1/lottie.json
 */
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SLUG = 'three-illustrations-one-3ndo'
const OUT_DIR = join(__dirname, `../public/projects/${SLUG}/scene-1`)
const OUT = join(OUT_DIR, 'lottie.json')

const W = 257, H = 256, FPS = 60

const BLACK = [0.1333, 0.1333, 0.1333, 1]   // #222222 — shared by badge + mascot line art
const WHITE = [1, 1, 1, 1]
const SHADOW_C = [0.8745, 0.8745, 0.8745, 1] // #DFDFDF
const GREEN = [0.1333, 0.8863, 0.2627, 1]    // #22E243
const GREEN2 = [0.1216, 0.8863, 0.2627, 1]   // #1FE243 (ribbon gradient)

// ── SVG path -> Lottie bezier (M L H V C Z only — confirmed by scanning the three source svgs) ──
function parsePath(d) {
  const RE = /([MLHVCZmlhvcz])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g
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
    if (V?.length > 0) {
      if (V.length > 1) {
        const [fx, fy] = V[0], [lx, ly] = V[V.length - 1]
        if (Math.abs(lx - fx) < 0.01 && Math.abs(ly - fy) < 0.01) {
          const ii = I.pop(); O.pop(); V.pop()
          I[0] = ii
          cl = true
        }
      }
      segs.push({ v: [...V], i: [...I], o: [...O], c: cl })
    }
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
    } else if (cmd === 'H') {
      while (idx < tok.length && typeof tok[idx] === 'number') {
        cx = n()
        V.push([cx, cy]); I.push([0, 0]); O.push([0, 0])
      }
    } else if (cmd === 'V') {
      while (idx < tok.length && typeof tok[idx] === 'number') {
        cy = n()
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

function bbox(segs) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const seg of segs) for (const [x, y] of seg.v) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x)
    minY = Math.min(minY, y); maxY = Math.max(maxY, y)
  }
  return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY }
}
function bboxUnion(...boxes) {
  const minX = Math.min(...boxes.map(b => b.minX)), maxX = Math.max(...boxes.map(b => b.maxX))
  const minY = Math.min(...boxes.map(b => b.minY)), maxY = Math.max(...boxes.map(b => b.maxY))
  return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY }
}

// ── Easing anchors (o = departure, i = arrival) ──
const EASE = {
  linear:        { o: { x: [0.00], y: [0.00] }, i: { x: [1.00], y: [1.00] } },
  settleSoft:    { o: { x: [0.00], y: [0.65] }, i: { x: [0.51], y: [0.99] } },
  travelBal:     { o: { x: [1.00], y: [0.49] }, i: { x: [0.00], y: [0.55] } },
  expressivePop: { o: { x: [0.94], y: [0.75] }, i: { x: [0.34], y: [0.94] } },
  entranceSharp: { o: { x: [0.20], y: [0.75] }, i: { x: [0.34], y: [0.94] } },
  exitAccelerate:{ o: { x: [1.00], y: [0.02] }, i: { x: [0.54], y: [0.42] } },
}
// Evaluate a single cubic-bezier EASE curve at progress p in [0,1] (x1,y1,x2,y2 form).
function bezierEase(x1, y1, x2, y2, p) {
  if (p <= 0) return 0
  if (p >= 1) return 1
  let u = p
  for (let iter = 0; iter < 8; iter++) {
    const mu = 1 - u
    const x = 3 * mu * mu * u * x1 + 3 * mu * u * u * x2 + u * u * u
    const dx = 3 * mu * mu * x1 + 6 * mu * u * (x2 - x1) + 3 * u * u * (1 - x2)
    if (Math.abs(dx) < 1e-6) break
    u -= (x - p) / dx
    u = Math.min(1, Math.max(0, u))
  }
  const mu = 1 - u
  return 3 * mu * mu * u * y1 + 3 * mu * u * u * y2 + u * u * u
}

// ── Lottie property helpers ──
const sk = k => ({ a: 0, k })
function anim(kfs, defaultEase = EASE.settleSoft) {
  return {
    a: 1,
    k: kfs.map((kf, idx) => {
      if (idx === kfs.length - 1) return { t: kf.t, s: kf.s, ...(kf.h ? { h: 1 } : {}) }
      const e = kf.ease || defaultEase
      return { t: kf.t, s: kf.s, i: e.i, o: e.o, ...(kf.h ? { h: 1 } : {}) }
    })
  }
}
// Sort keyframes by time and drop any that fail to strictly advance — the
// shared ascending-keyframe guard (Skottie silently stops animating a
// property whose keyframes go backwards; docs/allset lineage).
function sortedByT(kfs) {
  kfs.sort((a, b) => a.t - b.t)
  const out = []
  for (const k of kfs) { if (!out.length || k.t > out[out.length - 1].t) out.push(k) }
  return out
}
function makeKs({ p, a, s, r, o }) {
  return {
    p: p ?? sk([0, 0, 0]),
    a: a ?? sk([0, 0, 0]),
    s: s ?? sk([100, 100, 100]),
    r: r ?? sk(0),
    o: o ?? sk(100)
  }
}
function shapeLayer(nm, ind, parent, shapes, ksOverrides = {}, extra = {}) {
  return {
    ty: 4, nm, ind,
    ip: 0, op: OP, st: 0, sr: 1,
    ...(parent != null ? { parent } : {}),
    ks: makeKs(ksOverrides),
    shapes,
    ...extra,
  }
}
function nullLayer(nm, ind, parent, ksOverrides = {}) {
  return {
    ty: 3, nm, ind,
    ip: 0, op: OP, st: 0, sr: 1,
    w: 100, h: 100,
    ...(parent != null ? { parent } : {}),
    ks: makeKs(ksOverrides),
  }
}
const fill = (c, fillRule) => ({ ty: 'fl', c: sk(c), o: sk(100), ...(fillRule === 'evenodd' ? { r: 2 } : {}) })
const strokeStyle = (c, w, lc = 2, lj = 2, o = 100) => ({ ty: 'st', c: sk(c), o: sk(o), w: sk(w), lc, lj })
function pathShape(seg) { return { ty: 'sh', ks: sk(seg) } }
function trimShape(sAnimOrNum, eAnimOrNum, o = 0) {
  return { ty: 'tm', s: typeof sAnimOrNum === 'number' ? sk(sAnimOrNum) : sAnimOrNum,
    e: typeof eAnimOrNum === 'number' ? sk(eAnimOrNum) : eAnimOrNum, o: sk(o) }
}
function group(items, nm = '', trOverrides = {}) {
  return {
    ty: 'gr', nm,
    it: [
      ...items,
      { ty: 'tr', p: sk([0, 0]), a: sk([0, 0]), s: sk([100, 100]), r: sk(0), o: sk(100), ...trOverrides }
    ]
  }
}

// Flatten a thick self-crossing stroked bezier into ONE filled polygon (caps
// baked into the same contour) — a live thick self-crossing stroke corrupts
// unrelated layers in this Skottie build (docs/allset-celebration-animation.md).
//
// `tubeBuilder` additionally exposes `.at(p)`: the SAME polygon truncated at
// pen-progress p with a CONSTANT vertex count (points past the pen collapse
// onto the pen position), so the tube can be keyframed as a real handwriting
// draw-on. A flattened polygon cannot use a trim path, and constant vertex
// count is the Skottie shape-interpolation contract — this is how a
// stroke-to-fill shape gets drawn like a pen instead of wiped like a mask.
// Arc length of a bezier subpath — used to give the pen ONE speed across two
// artworks (the green line's two halves are drawn one after another, so a
// length-proportional duration is what stops the hand changing gear mid-stroke).
function pathLength(seg, samplesPerCurve = 40) {
  const n = seg.v.length, count = seg.c ? n : n - 1
  let total = 0, prev = null
  for (let idx = 0; idx < count; idx++) {
    const p0 = seg.v[idx], p3 = seg.v[(idx + 1) % n]
    const p1 = [p0[0] + seg.o[idx][0], p0[1] + seg.o[idx][1]]
    const p2 = [p3[0] + seg.i[(idx + 1) % n][0], p3[1] + seg.i[(idx + 1) % n][1]]
    for (let sIdx = 0; sIdx <= samplesPerCurve; sIdx++) {
      const t = sIdx / samplesPerCurve, mt = 1 - t
      const x = mt*mt*mt*p0[0] + 3*mt*mt*t*p1[0] + 3*mt*t*t*p2[0] + t*t*t*p3[0]
      const y = mt*mt*mt*p0[1] + 3*mt*mt*t*p1[1] + 3*mt*t*t*p2[1] + t*t*t*p3[1]
      if (prev) total += Math.hypot(x - prev[0], y - prev[1])
      prev = [x, y]
    }
  }
  return total
}

function tubeBuilder(seg, width, samplesPerCurve = 20, capSteps = 10) {
  const n = seg.v.length
  const segCount = seg.c ? n : n - 1
  const raw = []
  for (let idx = 0; idx < segCount; idx++) {
    const p0 = seg.v[idx]
    const p3 = seg.v[(idx + 1) % n]
    const p1 = [p0[0] + seg.o[idx][0], p0[1] + seg.o[idx][1]]
    const p2 = [p3[0] + seg.i[(idx + 1) % n][0], p3[1] + seg.i[(idx + 1) % n][1]]
    for (let s = 0; s < samplesPerCurve; s++) {
      const t = s / samplesPerCurve, mt = 1 - t
      raw.push([
        mt * mt * mt * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t * t * t * p3[0],
        mt * mt * mt * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t * t * t * p3[1],
      ])
    }
  }
  if (!seg.c) raw.push(seg.v[n - 1])
  const pts = []
  for (const p of raw) {
    if (pts.length === 0 || Math.hypot(p[0] - pts[pts.length - 1][0], p[1] - pts[pts.length - 1][1]) > 0.05) pts.push(p)
  }
  const pn = pts.length
  const r = width / 2
  const normals = pts.map((p, idx) => {
    const prev = pts[Math.max(0, idx - 1)]
    const next = pts[Math.min(pn - 1, idx + 1)]
    const dx = next[0] - prev[0], dy = next[1] - prev[1]
    const len = Math.hypot(dx, dy) || 1
    return [-dy / len, dx / len]
  })
  const left = pts.map((p, idx) => [p[0] + normals[idx][0] * r, p[1] + normals[idx][1] * r])
  const right = pts.map((p, idx) => [p[0] - normals[idx][0] * r, p[1] - normals[idx][1] * r])
  const capArc = (center, fromVec) => {
    const a0 = Math.atan2(fromVec[1], fromVec[0])
    const out = []
    for (let s = 1; s < capSteps; s++) {
      const a = a0 - Math.PI * (s / capSteps)
      out.push([center[0] + Math.cos(a) * r, center[1] + Math.sin(a) * r])
    }
    return out
  }
  const startNeg = [-normals[0][0], -normals[0][1]]
  const startCap = capArc(pts[0], startNeg)
  return {
    // p in [0,1] -> the tube drawn up to the pen position, constant vertices.
    at(p) {
      const cut = Math.max(1, Math.min(pn - 1, Math.round(p * (pn - 1))))
      const L = left.map((q, idx) => (idx <= cut ? q : left[cut]))
      const R = right.map((q, idx) => (idx <= cut ? q : right[cut]))
      const endCap = capArc(pts[cut], normals[cut])
      const poly = [...L, ...endCap, ...R.reverse(), ...startCap]
      const zeros = poly.map(() => [0, 0])
      return { v: poly, i: zeros, o: zeros, c: true }
    },
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE GEOMETRY — three assets, structural lookup (not group-trust; see the
// craft notes: artwork 1's grouping strands a tick and the inner ring outside
// their sibling groups, plus an invisible white stroke).
// ═══════════════════════════════════════════════════════════════════════════

// ── Asset 1: Confirmation-Pending (badge) — path `d` re-extracted this run
// from assets/three-illustrations-one-3ndo.svg by element id (grep, not
// hand-copied from a prior script). ──
const A1 = {
  outerDisc: "M128.4 1.07031C198.769 1.07042 255.903 57.9478 255.903 128.001C255.903 198.06 198.769 254.936 128.4 254.937C58.0345 254.937 0.903567 198.06 0.90332 128.001C0.90332 57.9477 58.0344 1.07031 128.4 1.07031Z",
  whiteDisc: "M128.976 21.6562C188.302 21.6564 236.463 69.5661 236.463 128.576C236.463 187.589 188.302 235.499 128.976 235.499C69.6497 235.499 21.4861 187.589 21.4858 128.576C21.4858 69.566 69.6495 21.6562 128.976 21.6562Z",
  mainRing: "M128.404 43C175.631 43 213.97 81.3415 213.97 128.567C213.97 175.792 175.631 214.133 128.404 214.133C81.1784 214.133 42.8367 175.792 42.8367 128.567C42.8367 81.3415 81.1784 43 128.404 43Z",
  innerRing: "M128.404 50.0703C171.73 50.0703 206.903 85.2453 206.903 128.57C206.903 171.895 171.73 207.07 128.404 207.07C85.0786 207.07 49.9033 171.895 49.9033 128.57C49.9033 85.2453 85.0786 50.0703 128.404 50.0703Z",
  hub: "M129.537 122.336C132.978 122.336 135.77 125.128 135.77 128.569C135.77 132.01 132.978 134.803 129.537 134.803C126.095 134.803 123.303 132.01 123.303 128.569C123.303 125.128 126.095 122.336 129.537 122.336Z",
  hand: "M134.638 123.829L164.67 93.7969",
  tail: "M124.395 134.07L118.067 140.399",
  tickE: "M198.044 128.56H207.17",
  tickN: "M129.536 50.9297V60.0561",
  tickS: "M129.536 197.07V206.197",
  tickW: "M51.9033 128.56H61.0285",
  tickSW: "M81.0939 177.008L74.6409 183.461",
  tickSE: "M184.431 183.461L177.979 177.008",
  tickNW: "M81.0939 80.1249L74.6409 73.6719",
  tickNE: "M176 80.1249L182.453 73.6719",
}
// ── Asset 2: Confirmation-Checked — badge geometry here is NOT the same as
// asset 1's (brief: "The two badge artworks are NOT the same geometry —
// build one badge from the first and hold it, never crossfade"): asset 2's
// own ring (`Stroke 6`, 1.39256px, single ring) and disc/pattern are never
// built. Only the checkmark path (`Stroke 8`) is used, reversed to pen order
// and brought into the badge's own stroke-weight family. ──
const A2 = {
  // authored top-right -> valley -> left tip; reversed: left tip -> valley -> top-right.
  checkRaw: "M222.329 6.6875L126.989 176.665L85.8547 103.332",
}
// ── Asset 3: AllSet (the mascot) — re-extracted from
// assets/three-illustrations-one-3ndo-3.svg. ──
const A3 = {
  swoosh: "M173.397 112.727C172.778 115.006 164.733 119.271 146.486 125.743C81.6081 148.753 103.547 160.481 138.591 149.603C173.635 138.725 172.932 133.97 140.753 151.96C108.575 169.949 98.1526 191.146 140.623 171.344C183.093 151.542 222.176 147.777 222.176 147.777",
  spark: "M254.691 142.855C252.765 144.711 249.704 144.663 247.848 142.737C245.993 140.811 246.042 137.75 247.969 135.894C249.895 134.038 252.956 134.087 254.812 136.013C256.667 137.939 256.618 140.999 254.691 142.855ZM234.633 136.602L219.156 138.74L221.891 157.132C225.536 156.718 228.783 156.072 229.61 153.524C230.601 150.463 232.963 149.454 235.816 148.767C238.646 148.091 242.112 144.969 240.88 140.729C240.041 137.861 237.314 136.283 234.622 136.59L234.633 136.602Z",
  ribbon: "M198.121 112.942C198.121 112.942 150.913 131.444 119.175 136.98C38.924 150.978 10.3887 103.664 10.3887 103.664",
  sparkleA: "M78.2682 79.7117L69.8723 65.1695M66.4685 59.274L63.5186 54.1645M86.2103 93.4677L94.6063 108.01M98.01 113.905L100.96 119.015M74.2972 86.5894L57.5052 86.5894M50.6977 86.5894H44.7979M90.1813 86.589L106.973 86.589M113.781 86.589H119.681M78.2682 93.4677L69.8723 108.01M66.4685 113.905L63.5186 119.015M86.2103 79.7112L94.6063 65.169M98.01 59.2735L100.96 54.1641",
  sparkleB: "M165.54 69.1029V47.4747M165.54 42.6451V36.7656M165.54 82.4186L165.54 104.047M165.54 108.876V114.756M171.881 76.0778H193.509M198.339 76.0778H204.218M159.2 76.0778H137.148M132.223 76.0778H126.229M171.047 72.5816L189.951 61.6673M194.172 59.2301L199.311 56.2631M160.034 78.9394L141.13 89.8538M136.909 92.2909L131.77 95.2579M168.719 81.2662L179.634 100.17M182.071 104.392L185.038 109.531M162.361 70.2544L151.447 51.3502M149.01 47.1289L146.043 41.9899M168.719 70.2544L179.634 51.3502M182.071 47.1289L185.038 41.9899M162.361 81.2662L151.447 100.17M149.01 104.392L146.043 109.531M171.047 78.9394L189.951 89.8538M194.172 92.2909L199.311 95.2579M160.034 72.5816L141.13 61.6673M136.909 59.2301L131.77 56.2631",
  sparkleC: "M117.455 30.283L111.642 36.0957M104.169 43.5693L98.3563 49.3819M98.356 30.283L104.169 36.0957M97.6924 39.5772H101.215M115.106 39.5772H118.629M108.161 50.0456V46.5226M108.161 32.6324V29.1094M111.643 43.5693L117.455 49.3819",
  arms: "M114.048 117.152C114.048 102.188 102.101 96.8525 98.3887 95.9246M133.953 115.064C133.397 99.7525 142.352 94.0686 147.455 93.1406",
  bodyOutline: "M122.839 218.084C149.795 223.437 175.988 205.924 181.342 178.967C186.695 152.011 169.182 125.818 142.225 120.465C115.268 115.111 89.0757 132.624 83.7223 159.581C78.3689 186.538 95.8819 212.73 122.839 218.084",
  belly: "M169.649 159.287C166.524 173.914 151.823 172.945 133.989 169.2L131.63 168.694C113.831 164.785 100.024 159.632 103.149 145.004C106.343 130.055 123.818 121.134 142.181 125.077C160.543 129.022 172.841 144.337 169.649 159.287",
  eye1: "M136.18 141.967C135.443 140.401 134.377 139.48 132.15 139.037C129.922 138.595 128.384 138.999 127.306 140.204",
  eye2: "M149.833 144.678C149.096 143.112 148.031 142.191 145.803 141.748C143.575 141.306 142.037 141.71 140.959 142.915",
}
const SHADOW_D = [
  'M151.271 227.701C151.683 227.725 152.094 227.75 152.501 227.775L135.052 245.175C134.617 245.178 134.18 245.18 133.742 245.181L151.271 227.701Z',
  'M148.143 227.537L130.457 245.174C130.025 245.171 129.594 245.166 129.165 245.161L146.896 227.479C147.314 227.497 147.729 227.518 148.143 227.537Z',
  'M155.582 227.987C155.988 228.018 156.393 228.045 156.794 228.077L139.711 245.112C139.27 245.121 138.826 245.131 138.381 245.139L155.582 227.987Z',
  'M143.724 227.359L125.924 245.109C125.497 245.101 125.071 245.093 124.646 245.083L142.458 227.322C142.881 227.334 143.304 227.346 143.724 227.359Z',
  'M161.017 228.45L144.437 244.983C143.99 244.999 143.541 245.013 143.089 245.027L159.826 228.339C160.226 228.376 160.623 228.412 161.017 228.45Z',
  'M137.959 227.224C138.388 227.23 138.816 227.238 139.242 227.246L121.449 244.988C121.028 244.974 120.609 244.957 120.192 244.94L137.959 227.224Z',
  'M165.164 228.899L149.238 244.78C148.785 244.803 148.329 244.822 147.871 244.843L163.997 228.764C164.389 228.808 164.778 228.854 165.164 228.899Z',
  'M134.7 227.191L117.038 244.804C116.622 244.783 116.209 244.761 115.797 244.739L133.401 227.188C133.835 227.188 134.268 227.189 134.7 227.191Z',
  'M169.227 229.432L154.127 244.487C153.666 244.519 153.201 244.548 152.733 244.577L168.084 229.27C168.47 229.322 168.851 229.377 169.227 229.432Z',
  'M112.69 244.556C112.279 244.529 111.87 244.505 111.464 244.477L128.778 227.212C129.217 227.207 129.657 227.199 130.099 227.195L112.69 244.556Z',
  'M108.406 244.243C108.002 244.21 107.601 244.177 107.203 244.143L124.093 227.3C124.537 227.288 124.982 227.278 125.429 227.269L108.406 244.243Z',
  'M173.191 230.063L159.118 244.097C158.647 244.139 158.172 244.176 157.693 244.216L172.078 229.872C172.454 229.935 172.825 229.999 173.191 230.063Z',
  'M104.191 243.863C103.794 243.823 103.401 243.781 103.01 243.739L119.336 227.46C119.786 227.441 120.238 227.425 120.692 227.408L104.191 243.863Z',
  'M175.957 230.588C176.323 230.663 176.681 230.739 177.033 230.816L164.236 243.577C163.753 243.632 163.264 243.685 162.77 243.737L175.957 230.588Z',
  'M100.053 243.405C99.6637 243.358 99.2785 243.307 98.897 243.258L114.498 227.701C114.955 227.675 115.416 227.649 115.879 227.624L100.053 243.405Z',
  'M179.684 231.455C180.035 231.548 180.375 231.641 180.706 231.736L169.514 242.896C169.016 242.968 168.509 243.041 167.995 243.111L179.684 231.455Z',
  'M96.0024 242.86C95.6211 242.804 95.2451 242.744 94.8735 242.686L109.569 228.032C110.035 227.996 110.505 227.961 110.978 227.928L96.0024 242.86Z',
  'M183.19 232.542C183.518 232.663 183.83 232.785 184.125 232.909L175.047 241.962C174.526 242.064 173.991 242.164 173.443 242.262L183.19 232.542Z',
  'M92.0542 242.214C91.682 242.146 91.3163 242.077 90.9565 242.008L104.532 228.471C105.007 228.424 105.487 228.38 105.972 228.335L92.0542 242.214Z',
  'M88.2339 241.439C87.8738 241.358 87.5218 241.275 87.1782 241.191L99.3521 229.052C99.841 228.99 100.337 228.931 100.838 228.872L88.2339 241.439Z',
  'M186.293 234.03C186.575 234.218 186.821 234.406 187.03 234.598L181.091 240.519C180.522 240.688 179.92 240.854 179.288 241.017L186.293 234.03Z',
  'M84.5864 240.493C84.244 240.391 83.9136 240.287 83.5952 240.182L93.9849 229.821C94.4904 229.739 95.006 229.66 95.5308 229.58L84.5864 240.493Z',
  'M81.2114 239.275C80.8982 239.135 80.6057 238.993 80.3345 238.85L88.2905 230.916C88.8268 230.795 89.381 230.675 89.9526 230.559L81.2114 239.275Z',
  'M78.4351 237.46C78.2007 237.19 78.0382 236.918 77.9536 236.641L81.7339 232.87C82.3503 232.616 83.0353 232.366 83.7856 232.124L78.4351 237.46Z',
]

const P1 = Object.fromEntries(Object.entries(A1).map(([k, d]) => [k, parsePath(d)]))
const CHECK_SEG_RAW = parsePath(A2.checkRaw)[0]
// Reverse pen order: vertices reversed, in/out tangents swapped (straight
// segments here, so i/o stay [0,0], but keep the swap for correctness).
const CHECK_SEG = {
  v: [...CHECK_SEG_RAW.v].reverse(),
  i: [...CHECK_SEG_RAW.o].reverse(),
  o: [...CHECK_SEG_RAW.i].reverse(),
  c: false,
}
const P3 = Object.fromEntries(Object.entries(A3).map(([k, d]) => [k, parsePath(d)]))
const SHADOW_SEGS = SHADOW_D.map(d => parsePath(d)[0])

// ═══════════════════════════════════════════════════════════════════════════
// TIMELINE
// ═══════════════════════════════════════════════════════════════════════════
const BEAT1 = 72   // 1.2s — waiting
const BEAT2 = 104  // 1.73s — confirmation: the exit cascade clears the face
                   // BEFORE the check draws, plus a real hold on the result
const BEAT3 = 96   // 1.6s — celebration entrance (brief: "~1.5s")
const T = BEAT1 + BEAT2 + BEAT3   // 272 — intro/loop boundary
const LOOP = 216                   // brief: "roughly 216 frames"
const OP = T + LOOP                // 488

// Beat 1: hand sweep
const SWEEP_DEG = 540               // "about a turn and a half"
// Beat 2: hand acceleration handoff
const HANDOFF = BEAT1 + 40          // 112
// Exit cascade, round 3. The pin must be GONE before the check's line reaches
// the middle of the face — the previous cut kept it alive to frame 146 while
// the check drew from 112, and the two reading at once is what looked buggy.
// Order: hand collapses into the pin (112-122) -> ticks pull in (114-128) ->
// the pin, having swallowed the hand, pulses and scales out (122-136). The
// check starts 6f after the handoff so the eye follows one thing at a time.
const HAND_RETRACT_START = HANDOFF          // 112
const HAND_RETRACT_END = HANDOFF + 8        // 120
const HUB_EXIT_START = HAND_RETRACT_END     // 120
const HUB_EXIT_END = HANDOFF + 20           // 132
const TICK_RETRACT_START = HANDOFF + 2      // 114
const TICK_RETRACT_END = TICK_RETRACT_START + 14 // 128
// The check's pen goes down as the pin starts leaving — a baton pass, so the
// eye moves from the collapsing clock to the new stroke instead of watching
// them coexist. The pin is fully gone at 132, while the pen is still out at
// the far left tip; the check's line only reaches the middle of the face
// long after.
const CHECK_START = HUB_EXIT_START + 4      // 124
const CHECK_DRAW = 40                       // frames to draw the check
const CHECK_END = CHECK_START + CHECK_DRAW  // 164 — then a 12f hold to POP_START
// Beat 3: badge pop + mascot jump entrance
const POP_START = BEAT1 + BEAT2             // 176
const POP_END = POP_START + 30              // 206 — clear the stage before the
                                            // green stroke is well underway,
                                            // so the two never read at once
const ANTIC_START = POP_START               // 176
const ANTIC_END = ANTIC_START + 10          // 186
const RISE_END = ANTIC_END + 50             // 236 — overshoot peak
const LAND_END = RISE_END + 22              // 258 — settle
// T = 272 -> 14f hold after settle, per player-contract ("a few frames after it settles")

// Loop beat grid (matches the all-set lineage's proven math: BEAT*4 = LOOP)
const LBEAT = LOOP / 4              // 54
const LANDINGS = [0, LBEAT, LBEAT * 2, LBEAT * 3, LBEAT * 4].map(x => x + T)   // T,T+54,...,T+216=OP
const PEAKS = [LBEAT * 0.5, LBEAT * 1.5, LBEAT * 2.5, LBEAT * 3.5].map(x => x + T)
const LEAN_SIGNS = [-1, 1, -1, 1]

console.log(`T=${T} OP=${OP} LANDINGS=${LANDINGS} PEAKS=${PEAKS}`)

// ═══════════════════════════════════════════════════════════════════════════
// BADGE RIG (artwork 1, geometry only — artwork 2 contributes just the check
// path, brought into the badge's own stroke-weight family). One object, built
// once: everything parents to badge-root so the pop/breathe apply uniformly.
// ═══════════════════════════════════════════════════════════════════════════
const badgeBox = bbox(P1.outerDisc)
const BADGE_C = [badgeBox.cx, badgeBox.cy]
const hubBox = bbox(P1.hub)
const HUB_C = [hubBox.cx, hubBox.cy]
const TICKS = ['tickE', 'tickN', 'tickS', 'tickW', 'tickSW', 'tickSE', 'tickNW', 'tickNE']

// Hand rest angle, exactly as drawn (frame 0 = artwork 1, unmodified).
const handV = P1.hand[0].v
const HAND_A0 = Math.atan2(handV[1][1] - HUB_C[1], handV[1][0] - HUB_C[0]) * 180 / Math.PI
// Check's long arm direction (valley -> top-right tip, in the REVERSED/pen-order path).
const checkV = CHECK_SEG.v // [leftTip, valley, topRight]
const CHECK_ARM_ANGLE = Math.atan2(checkV[2][1] - checkV[1][1], checkV[2][0] - checkV[1][0]) * 180 / Math.PI

// r(t): hand's rotation DELTA from its drawn rest angle. Piecewise: linear
// sweep through beat 1, then an accelerating (exit-accelerate) sweep through
// the handoff — re-derived every run from the actual angle geometry, never
// hard-pinned, so it always lands exactly on the check's long arm.
function normDeg(a) { let x = a % 360; if (x < 0) x += 360; return x }
const baseAtBeat1End = normDeg(HAND_A0 + SWEEP_DEG)
let extra = normDeg(CHECK_ARM_ANGLE) - baseAtBeat1End
if (extra < 0) extra += 360

// SPEED CONTINUITY AT THE HANDOFF (field-tested fix). The first cut ran the
// wait at 540deg/72f = 7.5deg/f and then eased the remaining `extra` degrees
// over 40f with an accelerate curve — whose start slope is ~0, so the hand
// visibly STALLED at frame 72 before speeding up again. Two things fix it:
//   1. Add whole extra TURNS until the handoff's average speed genuinely
//      exceeds the wait's, so "the sweep accelerates" is true of the geometry
//      and not just the easing label.
//   2. Solve the departure tangent so the handoff leaves at exactly the
//      wait's own angular speed: for a cubic-bezier ease the normalized start
//      slope is y1/x1, so y1 = x1 * (v_in / v_avg). Continuous by
//      construction, re-derived every run from the real geometry.
const HANDOFF_DUR = HANDOFF - BEAT1
const V_IN = SWEEP_DEG / BEAT1
let handoffDelta = extra
while (handoffDelta / HANDOFF_DUR < V_IN * 1.35) handoffDelta += 360
const V_AVG = handoffDelta / HANDOFF_DUR
const SPIN_X1 = 0.36
const SPIN_UP = {
  o: { x: [SPIN_X1], y: [+(SPIN_X1 * (V_IN / V_AVG)).toFixed(4)] },
  i: { x: [0.74], y: [0.52] },   // still climbing at the end: it whips into the pin
}
const HANDOFF_TOTAL_ROTATION = SWEEP_DEG + handoffDelta
console.log(`sweep ${V_IN.toFixed(2)}deg/f -> handoff avg ${V_AVG.toFixed(2)}deg/f (start slope ${(V_IN / V_AVG).toFixed(3)}), delta ${handoffDelta.toFixed(1)}deg`)
console.log(`hand rest ${HAND_A0.toFixed(1)}deg -> check arm ${normDeg(CHECK_ARM_ANGLE).toFixed(1)}deg, total sweep ${HANDOFF_TOTAL_ROTATION.toFixed(1)}deg`)

function handRotationAnim() {
  const kfs = [
    { t: 0, s: [0], ease: EASE.linear },
    { t: BEAT1, s: [SWEEP_DEG], ease: SPIN_UP },
    { t: HANDOFF, s: [HANDOFF_TOTAL_ROTATION] },
  ]
  return anim(kfs)
}
function handScaleAnim() {
  // Retract into the hub as the check's leading tip overtakes it.
  const kfs = [
    { t: 0, s: [100, 100, 100], ease: EASE.linear },
    { t: HAND_RETRACT_START, s: [100, 100, 100], ease: EASE.entranceSharp },
    { t: HAND_RETRACT_END, s: [0, 0, 100] },
  ]
  return anim(kfs)
}

// The ticks are DECALS on the dial: they hold perfectly still while the hand
// sweeps (the designer cut the per-tick pass accent — a tick that reacts to
// the hand is an effect the scene does not need), and retract as one
// assembly once the check takes over.
function ticksGroupAnim() {
  // Whole-assembly retract: they've done their job once the check takes over.
  const s = anim([
    { t: 0, s: [100, 100, 100], ease: EASE.linear },
    { t: TICK_RETRACT_START, s: [100, 100, 100], ease: EASE.entranceSharp },
    { t: TICK_RETRACT_END, s: [0, 0, 100] },
  ])
  const o = anim([
    { t: 0, s: [100], ease: EASE.linear },
    { t: TICK_RETRACT_START, s: [100], ease: EASE.entranceSharp },
    { t: TICK_RETRACT_END, s: [0] },
  ])
  return { s, o }
}

// Badge breathe (beats 1-2) — a pure transform, safe to cascade through
// `parent`. The pop-expand-and-fade is NOT: opacity does not cascade through
// `parent` in this Skottie build (confirmed by pixel sampling — a child's own
// ks.o is respected, but a parent null's ks.o has no visible effect on its
// children), so the pop lives on the OUTER precomp layer instead, where it
// composites as genuine alpha. See the learnings doc.
function badgeRootScale() {
  const BREATHE = 1.8   // % — "almost imperceptibly"
  const kfs = [
    { t: 0, s: [100, 100, 100], ease: EASE.settleSoft },
    { t: 65, s: [100 + BREATHE, 100 + BREATHE, 100], ease: EASE.settleSoft },
    { t: 130, s: [100, 100, 100] },
  ]
  return anim(kfs)
}
function badgePopScale() {
  const kfs = [
    { t: 0, s: [100, 100, 100], ease: EASE.settleSoft },
    { t: POP_START, s: [100, 100, 100], ease: EASE.expressivePop },
    { t: POP_END, s: [114, 114, 100] },
  ]
  return anim(kfs)
}
function badgePopOpacity() {
  const kfs = [
    { t: 0, s: [100], ease: EASE.settleSoft },
    { t: POP_START, s: [100], ease: EASE.settleSoft },
    { t: POP_END, s: [0] },
  ]
  return anim(kfs)
}

function hubAbsorbExitAnim() {
  // Swallow the hand, then leave — fast. Fully gone at HUB_EXIT_END (136),
  // which is 20 frames before the check finishes and well before the check's
  // line crosses the middle of the face, so the two never read at once.
  const kfs = [
    { t: 0, s: [100, 100, 100], ease: EASE.linear },
    { t: HUB_EXIT_START, s: [100, 100, 100], ease: EASE.expressivePop },
    { t: HUB_EXIT_START + 5, s: [118, 118, 100], ease: EASE.exitAccelerate },
    { t: HUB_EXIT_END, s: [0, 0, 100] },
  ]
  return anim(kfs)
}

// ── Texture: both badge artworks paint a raster diagonal hatch at low alpha —
// revectorize it (a real vector diagonal-line hatch), tile size derived from
// the pattern's own declared fraction (0.0266667 of the outer disc's own
// bbox width), color reused from the badge's own line color (#222222 — no
// invented fill). Each chord is computed to terminate EXACTLY on the disc's
// circle (the same exact-chord technique proven in
// build-moneytransfer-status-scene-s5zh.mjs's disc hatch), then a track
// matte (wrapped in a precomp — the pairing that scene's shipped hatch uses)
// backs it up at the silhouette edge.
const TEXTURE_FRACTION = 0.0266667
const TEXTURE_TILE = TEXTURE_FRACTION * badgeBox.w   // ~6.77px
function diagonalHatchLinesCircle(cx, cy, r, spacing) {
  const cMin = (cx - r) + (cy - r), cMax = (cx + r) + (cy + r)
  const segs = []
  for (let c = cMin; c <= cMax; c += spacing) {
    const k = (c - (cx + cy)) / 2
    const dist = Math.abs(k) * Math.SQRT2
    if (dist >= r) continue
    const h = Math.sqrt(r * r - dist * dist)
    const fx = cx + k, fy = cy + k
    const ux = Math.SQRT1_2, uy = -Math.SQRT1_2
    const p0 = [fx - h * ux, fy - h * uy], p1 = [fx + h * ux, fy + h * uy]
    segs.push({ v: [p0, p1], i: [[0, 0], [0, 0]], o: [[0, 0], [0, 0]], c: false })
  }
  return segs
}
const BADGE_R = (badgeBox.w + badgeBox.h) / 4
const hatchLines = diagonalHatchLinesCircle(badgeBox.cx, badgeBox.cy, BADGE_R, TEXTURE_TILE)

// Precomp wrapper for the matted layer (assets[] + a ty:0 layer with refId).
const PRECOMP_ASSETS = []
function precompLayer(nm, ind, parent, innerShapes, ksOverrides = {}, extra = {}) {
  const assetId = `precomp_${PRECOMP_ASSETS.length}`
  PRECOMP_ASSETS.push({
    id: assetId,
    layers: [{ ddd: 0, ind: 1, ty: 4, nm: `${nm}-inner`, sr: 1, ks: makeKs({}), ao: 0, shapes: innerShapes, ip: 0, op: OP, st: 0, bm: 0 }],
  })
  return {
    ddd: 0, ty: 0, nm, ind, refId: assetId, w: W, h: H,
    ip: 0, op: OP, st: 0, sr: 1,
    ...(parent != null ? { parent } : {}),
    ks: makeKs(ksOverrides),
    ...extra,
  }
}
// Multi-layer precomp: wraps an array of ALREADY-BUILT layers (with their own
// ind/parent wiring intact) as one nested composition, so the OUTER layer's
// own scale/opacity composite as genuine alpha/transform on the whole group —
// the fix for opacity not cascading through a plain `parent:` null.
function precompFromLayers(nm, ind, parent, innerLayers, ksOverrides = {}, extra = {}) {
  const assetId = `precomp_${PRECOMP_ASSETS.length}`
  PRECOMP_ASSETS.push({ id: assetId, layers: innerLayers })
  return {
    ddd: 0, ty: 0, nm, ind, refId: assetId, w: W, h: H,
    ip: 0, op: OP, st: 0, sr: 1,
    ...(parent != null ? { parent } : {}),
    ks: makeKs(ksOverrides),
    ...extra,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BADGE LAYERS
// ═══════════════════════════════════════════════════════════════════════════
let IND = 1
const badgeRootInd = IND++
const badgeRootLyr = nullLayer('badge-root', badgeRootInd, null, {
  p: sk([BADGE_C[0], BADGE_C[1], 0]),
  a: sk([BADGE_C[0], BADGE_C[1], 0]),
  s: badgeRootScale(),
})

const textureMatteInd = IND++
const textureMatteLyr = shapeLayer('badge-texture__matte', textureMatteInd, badgeRootInd, [
  group([pathShape(P1.outerDisc[0]), fill(WHITE)])
], {}, { td: true })

const textureInd = IND++
const textureLyr = precompLayer('badge-texture', textureInd, badgeRootInd, [
  group(hatchLines.map(pathShape).concat([strokeStyle(BLACK, 1.1)]))
], { o: sk(12) }, { tt: 1 })  // matches source pattern's ~0.12 fill-opacity

const whiteDiscInd = IND++
const whiteDiscLyr = shapeLayer('badge-white-disc', whiteDiscInd, badgeRootInd, [
  group([pathShape(P1.whiteDisc[0]), fill(WHITE)])
])

const mainRingInd = IND++
const mainRingLyr = shapeLayer('badge-main-ring', mainRingInd, badgeRootInd, [
  group([pathShape(P1.mainRing[0]), strokeStyle(BLACK, 2.26667)])
])

const innerRingInd = IND++
const innerRingLyr = shapeLayer('badge-inner-ring', innerRingInd, badgeRootInd, [
  group([pathShape(P1.innerRing[0]), strokeStyle(BLACK, 2.26667)])
])

const ticksPulse = ticksGroupAnim()
const ticksInd = IND++
const ticksLyr = shapeLayer('badge-ticks', ticksInd, badgeRootInd, [
  ...TICKS.map((k) => group(
    [pathShape(P1[k][0]), strokeStyle(BLACK, 2.26667)],
    `tick-${k}`
  )),
], { p: sk([BADGE_C[0], BADGE_C[1], 0]), a: sk([BADGE_C[0], BADGE_C[1], 0]), s: ticksPulse.s, o: ticksPulse.o })

const hubInd = IND++
const hubLyr = shapeLayer('badge-hub', hubInd, badgeRootInd, [
  group([pathShape(P1.hub[0]), fill(BLACK)])
], { p: sk([HUB_C[0], HUB_C[1], 0]), a: sk([HUB_C[0], HUB_C[1], 0]), s: hubAbsorbExitAnim() })

const handRigInd = IND++
const handRigLyr = nullLayer('badge-hand-rig', handRigInd, badgeRootInd, {
  p: sk([HUB_C[0], HUB_C[1], 0]),
  a: sk([HUB_C[0], HUB_C[1], 0]),
  r: handRotationAnim(),
  s: handScaleAnim(),
})
const handShapeInd = IND++
const handShapeLyr = shapeLayer('badge-hand-tail', handShapeInd, handRigInd, [
  group([pathShape(P1.hand[0]), pathShape(P1.tail[0]), strokeStyle(BLACK, 2.26667)])
])

const CHECK_STROKE_W = 2.26667  // brought into the badge's own ring-weight family (was 1.39256)
const checkTrim = anim([
  { t: 0, s: [0], ease: EASE.linear },
  { t: CHECK_START, s: [0], ease: EASE.travelBal },
  { t: CHECK_END, s: [100] },
])
// PUNCTUATION (motion-taste: "a completed gesture gets punctuation" — this
// brief's own words for it: "when the pen lifts, the finished check stamps
// home"). A small 2-3% overshoot-and-settle on the check's OWN bbox center
// right after the trim reaches 100%, fully resolved before the badge pop
// starts at POP_START so the two accents never compete for the same frame.
const checkBox = bbox([CHECK_SEG])
const CHECK_C = [checkBox.cx, checkBox.cy]
const CHECK_STAMP_PEAK = CHECK_END + 4    // 168
const CHECK_STAMP_SETTLE = CHECK_END + 10 // 174 — settled 2f before POP_START (176)
function checkStampAnim() {
  return anim([
    { t: 0, s: [100, 100, 100], ease: EASE.linear },
    { t: CHECK_END, s: [100, 100, 100], ease: EASE.expressivePop },
    { t: CHECK_STAMP_PEAK, s: [103, 103, 100], ease: EASE.settleSoft },
    { t: CHECK_STAMP_SETTLE, s: [100, 100, 100] },
  ])
}
const checkInd = IND++
const checkLyr = shapeLayer('check-mark', checkInd, badgeRootInd, [
  group([pathShape(CHECK_SEG), strokeStyle(BLACK, CHECK_STROKE_W), trimShape(0, checkTrim)])
], { p: sk([CHECK_C[0], CHECK_C[1], 0]), a: sk([CHECK_C[0], CHECK_C[1], 0]), s: checkStampAnim() })

// ═══════════════════════════════════════════════════════════════════════════
// MASCOT (artwork 3) — one continuous rig per property, spanning the beat-3
// entrance straight into the endless loop with no duplicated boundary key.
// ═══════════════════════════════════════════════════════════════════════════
const mascotBox = bbox(P3.bodyOutline)
const PIVOT = [mascotBox.cx, mascotBox.maxY]     // low pivot at the base of the blob
const eyeBox = bboxUnion(bbox(P3.eye1), bbox(P3.eye2))
const armsBox = bbox(P3.arms)
const sparkleABox = bbox(P3.sparkleA)
const sparkleBBox = bbox(P3.sparkleB)
const sparkleCBox = bbox(P3.sparkleC)
const shadowBox = bboxUnion(...SHADOW_SEGS.map(seg => bbox([seg])))

// Park depth: the WHOLE mascot subtree must clear the frame through beats
// 1-2, and its topmost geometry is the air-flow marks (armsBox.minY ≈ 93),
// not the body outline. The first cut parked only the body's own bbox
// (+150px) and the two curves peeked in at the bottom edge of the badge
// beats (field-tested — "a clean artifact below the clock").
const PARK_DY = Math.ceil(H + 6 - armsBox.minY)

// Loop physics — re-derived for THIS brief ("bounces happily and
// energetically... a real lift... squash on the landing"), not copied from
// the earlier all-set/n2ie/74j8 scenes' numbers.
const JUMP_H = 20
const OVERSHOOT_H = 16    // beat-3 launch overshoot above rest, before settling
const LEAN = 6
const STRETCH = { sx: 96, sy: 106 }
const SQUASH = { sx: 106, sy: 95 }
const ANTIC_SQUASH = { sx: 110, sy: 88 }   // extra-deep coil before the launch

function mascotPosition() {
  const off = [PIVOT[0], PIVOT[1] + PARK_DY, 0]          // fully offscreen below frame — air-flow marks included
  const anticOff = [PIVOT[0], PIVOT[1] + PARK_DY + 10, 0] // coil deeper before launch
  const rest = [PIVOT[0], PIVOT[1], 0]
  const kfs = [
    { t: 0, s: off, ease: EASE.settleSoft },
    { t: ANTIC_START, s: off, ease: EASE.entranceSharp },
    { t: ANTIC_END, s: anticOff, ease: EASE.exitAccelerate },
    { t: RISE_END, s: [PIVOT[0], PIVOT[1] - OVERSHOOT_H, 0], ease: EASE.exitAccelerate },
    { t: LAND_END, s: rest, ease: EASE.settleSoft },
    { t: T, s: rest, ease: EASE.travelBal },
  ]
  for (let i = 0; i < LANDINGS.length; i++) {
    // T's landing key already exists from the entrance chain — but beat 0's
    // PEAK must still be pushed. The first cut `continue`d past BOTH, which
    // deleted the first jump entirely: frozen [T, T+LBEAT], moving, then
    // frozen again after every wrap (field-tested exactly so).
    if (LANDINGS[i] !== T) kfs.push({ t: LANDINGS[i], s: rest, ease: EASE.travelBal })
    if (i < PEAKS.length) kfs.push({ t: PEAKS[i], s: [PIVOT[0], PIVOT[1] - JUMP_H, 0], ease: EASE.travelBal })
  }
  kfs.sort((a, b) => a.t - b.t)
  return anim(kfs, EASE.travelBal)
}
function mascotRotation() {
  const kfs = [
    { t: 0, s: [0], ease: EASE.settleSoft },
    { t: ANTIC_START, s: [0], ease: EASE.entranceSharp },
    { t: ANTIC_END, s: [-3], ease: EASE.exitAccelerate },   // small counter-twist, sells the coil
    { t: RISE_END, s: [LEAN], ease: EASE.exitAccelerate },
    { t: LAND_END, s: [0], ease: EASE.settleSoft },
    { t: T, s: [0], ease: EASE.travelBal },
  ]
  for (let i = 0; i < LANDINGS.length; i++) {
    // Same peak-skip fix as mascotPosition — push beat 0's peak.
    if (LANDINGS[i] !== T) kfs.push({ t: LANDINGS[i], s: [0], ease: EASE.travelBal })
    if (i < PEAKS.length) kfs.push({ t: PEAKS[i], s: [LEAN * LEAN_SIGNS[i]], ease: EASE.travelBal })
  }
  kfs.sort((a, b) => a.t - b.t)
  return anim(kfs, EASE.travelBal)
}
function mascotScaleKfs() {
  const rest3 = [SQUASH.sx, SQUASH.sy, 100]
  const kfs = [
    { t: 0, s: rest3, ease: EASE.settleSoft },
    { t: ANTIC_START, s: rest3, ease: EASE.entranceSharp },
    { t: ANTIC_END, s: [ANTIC_SQUASH.sx, ANTIC_SQUASH.sy, 100], ease: EASE.settleSoft },
    { t: RISE_END, s: [STRETCH.sx, STRETCH.sy, 100], ease: EASE.settleSoft },
    { t: LAND_END, s: rest3, ease: EASE.settleSoft },
    { t: T, s: rest3, ease: EASE.settleSoft },
  ]
  for (let i = 0; i < LANDINGS.length; i++) {
    // Same peak-skip fix as mascotPosition — push beat 0's peak.
    if (LANDINGS[i] !== T) kfs.push({ t: LANDINGS[i], s: rest3, ease: EASE.settleSoft })
    if (i < PEAKS.length) kfs.push({ t: PEAKS[i], s: [STRETCH.sx, STRETCH.sy, 100], ease: EASE.settleSoft })
  }
  kfs.sort((a, b) => a.t - b.t)
  return kfs
}
function mascotScale() { return anim(mascotScaleKfs(), EASE.settleSoft) }

// The eyes KEEP their drawn shape (designer direction: only the body and its
// white face morph). They are children of mascot-root, so they would inherit
// its squash/stretch — this inverts the parent's scale at every one of its own
// keyframes, so the product is 100% throughout and the arcs stay exactly as
// artwork 3 draws them. They still ride the body's position and lean, which is
// what keeps them glued to the face. The landing squint is deleted for the
// same reason.
function eyeCounterScale() {
  const kfs = mascotScaleKfs().map(k => ({
    t: k.t,
    s: [10000 / k.s[0], 10000 / k.s[1], 100],
    ease: k.ease,
  }))
  return anim(kfs, EASE.settleSoft)
}

// Air-flow marks (the two thin curves above the head): the designer corrected
// the first cut's "raised arms" reading — they are motion highlights for the
// up-down movement, so they exist only WHILE he moves: invisible at rest and
// at every landing, visible through each airborne arc (and the entrance
// rise), with a small lagging swish rotation so they read as displaced air.
// The visibility cycle lives on the SHAPE layer, never the rig null — a
// parent's `o` does not cascade in this player (see the badge pop note).
const AIR_LAG = 5
function airflowRotation() {
  const kfs = [{ t: 0, s: [0], ease: EASE.settleSoft }]
  const anticT = ANTIC_END + AIR_LAG
  kfs.push({ t: ANTIC_START, s: [0], ease: EASE.entranceSharp })
  kfs.push({ t: Math.min(anticT, RISE_END - 2), s: [-4], ease: EASE.settleSoft })
  kfs.push({ t: RISE_END + AIR_LAG, s: [10], ease: EASE.settleSoft })
  kfs.push({ t: LAND_END + AIR_LAG, s: [0], ease: EASE.settleSoft })
  kfs.push({ t: T + AIR_LAG, s: [0], ease: EASE.settleSoft })
  for (let i = 0; i < LANDINGS.length; i++) {
    const lt = LANDINGS[i] + AIR_LAG
    // Peak-skip fix as in mascotPosition: beat 0's peak must be pushed even
    // though its landing key is T's shared boundary key.
    if (lt !== T + AIR_LAG && lt < OP) kfs.push({ t: lt, s: [0], ease: EASE.settleSoft })
    if (i < PEAKS.length) kfs.push({ t: PEAKS[i] + AIR_LAG, s: [10 * LEAN_SIGNS[i]], ease: EASE.settleSoft })
  }
  kfs.push({ t: OP, s: [0] })
  return anim(sortedByT(kfs), EASE.settleSoft)
}
function airflowOpacity() {
  // Cartoon speed lines TRAIL the move that just happened, they don't lead it
  // (designer direction, round 3 — the first cut had them on the way UP).
  // He falls, the air he just moved through shows above him: nothing at the
  // apex, streaming in as the descent gets going, gone at the impact. Zero at
  // every PEAK and every LANDING — and since LANDINGS includes both T and OP,
  // the loop boundary matches by construction.
  const rampIn = (from, to) => from + Math.round((to - from) * 0.35)
  const kfs = [
    { t: 0, s: [0], ease: EASE.settleSoft },
    { t: RISE_END, s: [0], ease: EASE.entranceSharp },        // entrance apex — the rise shows nothing
    { t: rampIn(RISE_END, LAND_END), s: [85], ease: EASE.settleSoft },
    { t: LAND_END, s: [0], ease: EASE.settleSoft },
    { t: T, s: [0], ease: EASE.settleSoft },
  ]
  for (let i = 0; i < PEAKS.length; i++) {
    const P = PEAKS[i], L = LANDINGS[i + 1]
    kfs.push({ t: P, s: [0], ease: EASE.entranceSharp })
    kfs.push({ t: rampIn(P, L), s: [85], ease: EASE.settleSoft })
    kfs.push({ t: L, s: [0], ease: EASE.settleSoft })
  }
  return anim(sortedByT(kfs))
}

function shadowScaleAnim() {
  const kfs = []
  const rest = [114, 114, 100]
  for (let i = 0; i < LANDINGS.length; i++) {
    kfs.push({ t: LANDINGS[i], s: rest, ease: EASE.settleSoft })
    if (i < PEAKS.length) kfs.push({ t: PEAKS[i], s: [83, 83, 100], ease: EASE.settleSoft })
  }
  // Fade in during the launch — invisible while he's offscreen/below.
  kfs.unshift({ t: 0, s: [70, 70, 100], ease: EASE.settleSoft })
  kfs.unshift({ t: RISE_END, s: [80, 80, 100], ease: EASE.exitAccelerate })
  kfs.sort((a, b) => a.t - b.t)
  return anim(kfs)
}
function shadowOpacityAnim() {
  const kfs = [
    { t: 0, s: [0], ease: EASE.settleSoft },
    { t: ANTIC_START, s: [0], ease: EASE.settleSoft },
    { t: RISE_END, s: [30], ease: EASE.exitAccelerate },
    { t: LAND_END, s: [60], ease: EASE.settleSoft },
  ]
  for (let i = 0; i < LANDINGS.length; i++) {
    if (LANDINGS[i] <= LAND_END) continue
    kfs.push({ t: LANDINGS[i], s: [60], ease: EASE.settleSoft })
    if (i < PEAKS.length) kfs.push({ t: PEAKS[i], s: [96], ease: EASE.settleSoft })
  }
  kfs.sort((a, b) => a.t - b.t)
  return anim(kfs)
}

// Sparkle round-robin: three clusters burst in a staggered rotation. The loop
// segment [T, OP=T+216] tiles a 36f-round math the all-set lineage proved
// (216/36 = 6 exact rounds).
const SPARK_PERIOD = 36
function sparklePulse(startsLocal, { overshoot = 112, hold = 100, fadeScale = 88 } = {}) {
  const fitted = startsLocal.filter(s => s + 30 <= LOOP).map(s => s + T)
  const sKfs = [], oKfs = []
  if (fitted[0] !== T) {
    sKfs.push({ t: 0, s: [0, 0, 100], ease: EASE.expressivePop })
    oKfs.push({ t: 0, s: [0], ease: EASE.settleSoft })
  }
  for (const start of fitted) {
    sKfs.push({ t: start, s: [0, 0, 100], ease: EASE.expressivePop })
    sKfs.push({ t: start + 8, s: [overshoot, overshoot, 100], ease: EASE.settleSoft })
    sKfs.push({ t: start + 14, s: [hold, hold, 100], ease: EASE.settleSoft })
    sKfs.push({ t: start + 20, s: [hold, hold, 100], ease: EASE.settleSoft })
    sKfs.push({ t: start + 30, s: [fadeScale, fadeScale, 100], ease: EASE.settleSoft })
    oKfs.push({ t: start, s: [0], ease: EASE.settleSoft })
    oKfs.push({ t: start + 8, s: [100], ease: EASE.settleSoft })
    oKfs.push({ t: start + 20, s: [100], ease: EASE.settleSoft })
    oKfs.push({ t: start + 30, s: [0], ease: EASE.settleSoft })
  }
  sKfs.push({ t: OP, s: [0, 0, 100] })
  oKfs.push({ t: OP, s: [0] })
  return { scale: anim(sKfs, EASE.expressivePop), opacity: anim(oKfs, EASE.settleSoft) }
}

// Cluster A carries "the FIRST burst" — the brief: "the first burst fires as
// he lands — his settle and the first firework are one unified moment of
// joy, with no silent sky between his landing and the celebration... that
// first burst belongs to the landing itself, in the intro's tail." Anchoring
// A's whole 36f-period grid at LAND_END (not T) instead of the T-anchored
// scheme above puts a burst directly on his landing frame — the field-tested
// failure this guards against (now in chapterization-transition-grammar.md,
// "accents tied to an event fire AT the event") is a payoff accent that
// waits for the loop marker and leaves a silent gap between the event and
// its celebration. Because SPARK_PERIOD (36) divides LOOP (216) exactly six
// times, T and OP sit at the IDENTICAL phase of this anchor's cycle
// (OP - LAND_END ≡ T - LAND_END, mod 36) — so the seam's boundary values are
// the periodic function's own computed values at T and OP, never a
// hand-typed override (player-contract.md's boundary-value rule): the array
// is simply built instance-by-instance from the anchor and CLIPPED at OP: the
// wrap-around instance's own "+14 hold" keyframe lands exactly on OP by
// construction (474+14=488), so its keyframe already carries the value T
// needs to match — no forced {t:OP, s:0} exists to fight it.
function sparklePulseFromAnchor(anchorAbs, { overshoot = 112, hold = 100, fadeScale = 88 } = {}) {
  const steps = [
    { dt: 0, s: [0, 0, 100], o: 0, sEase: EASE.expressivePop, oEase: EASE.settleSoft },
    { dt: 8, s: [overshoot, overshoot, 100], o: 100, sEase: EASE.settleSoft, oEase: EASE.settleSoft },
    { dt: 14, s: [hold, hold, 100], o: 100, sEase: EASE.settleSoft, oEase: EASE.settleSoft },
    { dt: 20, s: [hold, hold, 100], o: 100, sEase: EASE.settleSoft, oEase: EASE.settleSoft },
    { dt: 30, s: [fadeScale, fadeScale, 100], o: 0, sEase: EASE.settleSoft, oEase: EASE.settleSoft },
  ]
  const sKfs = [], oKfs = []
  if (anchorAbs > 0) {
    sKfs.push({ t: 0, s: [0, 0, 100], ease: EASE.expressivePop })
    oKfs.push({ t: 0, s: [0], ease: EASE.settleSoft })
  }
  for (let start = anchorAbs; start < OP; start += SPARK_PERIOD) {
    for (const step of steps) {
      const t = start + step.dt
      if (t > OP) break
      sKfs.push({ t, s: step.s, ease: step.sEase })
      oKfs.push({ t, s: [step.o], ease: step.oEase })
    }
  }
  return { scale: anim(sortedByT(sKfs), EASE.expressivePop), opacity: anim(sortedByT(oKfs), EASE.settleSoft) }
}
const startsB = [12, 48, 84, 120, 156, 192]
const startsC = [24, 60, 96, 132, 168, 204]
const pulseA = sparklePulseFromAnchor(LAND_END)
const pulseB = sparklePulse(startsB)
const pulseC = sparklePulse(startsC)
console.log(`sparkle A anchored at LAND_END=${LAND_END} (T=${T}, gap ${T - LAND_END}f) — B/C stay T-anchored`)

// ── Swoosh (thick self-crossing scribble -> filled polygon) + its spark ──
const swooshTube = tubeBuilder(P3.swoosh[0], 18.3574)
const swooshBox = bbox([swooshTube.at(1)])
const sparkBox = bbox(P3.spark)
// The greens enter as ONE radiating gesture (field-tested fix: the first cut
// trim-drew the ribbon but FADED the swoosh in ~20 frames later, which read
// as two unrelated events). The artwork itself is one continuous line — the
// ribbon's head (198,112) sits on the swoosh's own start (173,112), and the
// swoosh's exit (222,148) hands into the spark — so while he rises the
// ribbon trim-draws outward to the LEFT of him and the swoosh wipes outward
// to the RIGHT on the SAME clock (swooshWipeGroups below — a fill polygon
// can't trim, and the corruption precedent forbids a live thick stroke), and
// the spark pops at the wipe's end like a pen lift. Everything settles well
// before T; T is keyed explicitly at the same rest value OP is forced to
// (player-contract.md, "a boundary value must come from evaluating the SAME
// function at that boundary").
// ONE PEN, TWO HALVES, IN SEQUENCE. The first cut ran both halves on one
// clock radiating outward from the join, which reads as two strokes started
// together. A hand draws a connected line along its own length: the ribbon
// first (left to right), then the swoosh from where the pen arrives.
// Durations are length-proportional so the pen does not change gear at the
// junction; the sweep runs slightly hotter than the scribble because a long
// smooth arc genuinely does. Both halves ease as an S-curve, so the small
// slowdown at the handover reads as the hand rounding a corner.
const SWOOSH_DRAW_DUR = RISE_END - ANTIC_END          // 50f — unchanged pace
const SWEEP_VS_SCRIBBLE = 1.4
const RIBBON_DRAW_DUR = Math.round(
  SWOOSH_DRAW_DUR * (pathLength(P3.ribbon[0]) / pathLength(P3.swoosh[0])) / SWEEP_VS_SCRIBBLE)
const SWOOSH_DRAW_END = LAND_END - 2                  // spark still settles before T
const DRAW_START = SWOOSH_DRAW_END - SWOOSH_DRAW_DUR  // swoosh picks the line up here
const DRAW_END = SWOOSH_DRAW_END
const RIBBON_DRAW_START = DRAW_START - RIBBON_DRAW_DUR
const RIBBON_DRAW_END = DRAW_START                    // no gap: the pen never lifts
// The swoosh is DRAWN, not wiped (designer direction, round 3: "like you would
// draw the letter Z with your hand"). The previous cut revealed it behind a
// left-to-right band, which uncovers the whole zigzag column by column — the
// eye reads a curtain, not a pen. A flattened polygon can't take a trim path,
// so the tube itself is keyframed: `swooshTube.at(p)` returns the tube
// truncated at pen-progress p with a constant vertex count (Skottie's shape
// interpolation contract), and its round end-cap IS the pen tip. The path
// follows the artwork's own authored pen order — which starts beside the
// ribbon's own head and scribbles outward, so the two still radiate from one
// point as one gesture.
const DRAW_STEPS = 20
// A hand accelerates INTO a stroke and eases out of it — an S-curve, not a
// sharp attack. entranceSharp's 3.75x initial slope threw ~40% of the
// scribble down in the first four frames, which read as a jump-cut rather
// than a pen.
const DRAW_PACE = EASE.travelBal
function swooshDrawPath() {
  const t0 = DRAW_START, t1 = DRAW_END
  const shapeAt = p => swooshTube.at(p)
  const pace = u => bezierEase(DRAW_PACE.o.x[0], DRAW_PACE.o.y[0], DRAW_PACE.i.x[0], DRAW_PACE.i.y[0], u)
  const k = []
  for (let i = 0; i < DRAW_STEPS; i++) {
    // Eased pen progress sampled at LINEAR times, so the handwriting keeps a
    // natural attack-and-settle without double-easing between samples.
    const p0 = pace(i / DRAW_STEPS)
    k.push({
      t: Math.round(t0 + (t1 - t0) * (i / DRAW_STEPS)),
      s: [shapeAt(Math.max(0.002, p0))],
      ...EASE.linear,
    })
  }
  k.push({ t: t1, s: [shapeAt(1)] })
  return { a: 1, k: sortedByT(k) }
}
function swooshDrawOpacity() {
  // A path track holds its FIRST keyframe backwards in time, so the pen's
  // starting dot would sit on stage from frame 0 (it did — a green dot beside
  // the clock through both badge beats). Gate the layer's own alpha instead.
  return anim([
    { t: 0, s: [0], ease: EASE.linear },
    { t: DRAW_START - 1, s: [0], ease: EASE.linear },
    { t: DRAW_START, s: [100], ease: EASE.linear },
    { t: OP, s: [100] },
  ])
}
function ambientBreathScale() {
  // The loop's barely-there breath — gate 1 (nothing inert). Unlike the 74j8
  // scene (which this brief does NOT echo), nothing here forbids it.
  return anim([
    { t: 0, s: [100, 100, 100], ease: EASE.settleSoft },
    { t: T, s: [100, 100, 100], ease: EASE.settleSoft },
    { t: T + LBEAT * 2, s: [96, 96, 100], ease: EASE.settleSoft },
    { t: T + LBEAT * 4, s: [100, 100, 100] },
  ])
}
function sparkEntrance() {
  const c = DRAW_END - 2   // the pen lifts as the stroke finishes
  const s = anim([
    { t: 0, s: [0, 0, 100], ease: EASE.settleSoft },
    { t: c, s: [0, 0, 100], ease: EASE.expressivePop },
    { t: c + 8, s: [114, 114, 100], ease: EASE.settleSoft },
    { t: c + 16, s: [100, 100, 100], ease: EASE.settleSoft },
    { t: T, s: [100, 100, 100], ease: EASE.settleSoft },
    { t: T + LBEAT * 2, s: [96, 96, 100], ease: EASE.settleSoft },
    { t: T + LBEAT * 4, s: [100, 100, 100] },
  ])
  const o = anim([
    { t: 0, s: [0], ease: EASE.settleSoft },
    { t: c, s: [0], ease: EASE.entranceSharp },
    { t: c + 6, s: [100], ease: EASE.settleSoft },
    { t: OP, s: [100] },
  ])
  return { s, o }
}

// ── Ribbon: a REAL alpha-ramping gradient (encoded, not flattened), sweeps
// in behind him as he rises via a trim draw-on, then a stacked-alpha "light
// reflection" gleam travels along it once per loop.
const ribbonSeg = P3.ribbon[0]
const RIBBON_W = 19.7116
// The source authors the ribbon RIGHT to LEFT (198,113 -> 10,104), so a
// trim-from-start draws it backwards for a right-handed pen. Reverse it — the
// same vertices-reversed/tangents-swapped move the checkmark needs — so the
// stroke runs LEFT to RIGHT, finishing beside the swoosh's own start point;
// the two halves then chain into one continuous hand movement. (The gradient
// is defined in canvas coordinates, so reversing the path does not move it,
// and the gleam keeps the source orientation.)
const ribbonDrawSeg = {
  v: [...ribbonSeg.v].reverse(),
  i: [...ribbonSeg.o].reverse(),
  o: [...ribbonSeg.i].reverse(),
  c: false,
}
// Gradient endpoints from the source (paint0_linear): x1,y1 -> x2,y2, alpha 1 -> 0.3.
const RIBBON_G0 = [186.843, 117.997], RIBBON_G1 = [75.038, 134.874]
// The ribbon's ramp as ONE object, referenced by the shape AND published as a
// slot. Two copies of the same numbers is how a slot and its property drift
// apart after the first edit — see player-contract "Content Parameters".
const RIBBON_RAMP = {
  p: 2,
  k: sk([
    0, GREEN2[0], GREEN2[1], GREEN2[2],
    1, GREEN2[0], GREEN2[1], GREEN2[2],
    0, 1,
    1, 0.3,
  ]),
  sid: 'ribbonRamp',
}

function gradientStroke(w) {
  return {
    ty: 'gs', o: sk(100), w: sk(w), lc: 2, lj: 2,
    t: 1,
    s: sk([RIBBON_G0[0], RIBBON_G0[1]]),
    e: sk([RIBBON_G1[0], RIBBON_G1[1]]),
    g: RIBBON_RAMP,
  }
}
const ribbonDrawTrim = anim([
  { t: 0, s: [0], ease: EASE.settleSoft },
  { t: RIBBON_DRAW_START, s: [0], ease: EASE.travelBal },
  { t: RIBBON_DRAW_END, s: [100] },
])

// THE GLEAM — a travelling trim WINDOW on the ribbon's own stroke.
//
// The previous technique (stacked white bands clipped to a flattened copy of
// the ribbon via Merge Paths intersect) renders correctly in Skottie but does
// NOT survive the HTML export: `exportLottieHtml`'s lottie-web compatibility
// pass has no translation for `ty:'mm'`, so lottie-web painted the raw
// clipping bands — visible as pale rectangles over the CLOCK from frame 0
// (a path track holds its first keyframe backwards in time) and as hard-edged
// slabs overhanging the ribbon during the loop. Both export findings, one
// cause. A technique that only works in the preview renderer is not shipped.
//
// Rebuilt with no boolean ops at all: three white strokes on the ribbon's OWN
// path, of decreasing width and low alpha, sharing one trim window that
// travels the length of the path. It is inside the ribbon by construction
// (a stroke on the same path, never wider than it), its round caps make both
// ends of the light soft, and trim paths are the best-supported modifier in
// every runtime. This also leaves the scene free of Merge Paths entirely —
// which is what dotLottie/ThorVG needs too.
const GLEAM_IN = T + Math.round(LOOP * 0.10)
const GLEAM_OUT = T + Math.round(LOOP * 0.80)
const GLEAM_WINDOW = 18          // % of path length — the lit stretch
const GLEAM_LAYERS = [
  { w: RIBBON_W * 0.98, a: 10 },
  { w: RIBBON_W * 0.72, a: 13 },
  { w: RIBBON_W * 0.44, a: 16 },  // stacked ≈ 34% peak at the core
]
function gleamTrim() {
  const s = anim([
    { t: GLEAM_IN, s: [0], ease: EASE.travelBal },
    { t: GLEAM_OUT, s: [100 - GLEAM_WINDOW] },
  ])
  const e = anim([
    { t: GLEAM_IN, s: [GLEAM_WINDOW], ease: EASE.travelBal },
    { t: GLEAM_OUT, s: [100] },
  ])
  return { s, e }
}
function gleamOpacity() {
  // Zero at T and at OP, so the seam holds no matter where the window sits.
  return anim([
    { t: 0, s: [0], ease: EASE.linear },
    { t: GLEAM_IN, s: [0], ease: EASE.settleSoft },
    { t: GLEAM_IN + 14, s: [100], ease: EASE.settleSoft },
    { t: GLEAM_OUT - 14, s: [100], ease: EASE.settleSoft },
    { t: GLEAM_OUT, s: [0], ease: EASE.linear },
    { t: OP, s: [0] },
  ])
}
function gleamGroups() {
  const trim = gleamTrim()
  return GLEAM_LAYERS.map((g, i) => group([
    pathShape(ribbonSeg),
    strokeStyle([1, 1, 1, 1], g.w, 2, 2, g.a),
    trimShape(trim.s, trim.e),
  ], `ribbon-gleam-${i}`))
}

// ═══════════════════════════════════════════════════════════════════════════
// MASCOT LAYERS
// ═══════════════════════════════════════════════════════════════════════════
const mascotRootInd = IND++
const mascotRootLyr = nullLayer('mascot-root', mascotRootInd, null, {
  p: mascotPosition(),
  a: sk([PIVOT[0], PIVOT[1], 0]),
  r: mascotRotation(),
  s: mascotScale(),
})

const sparkleAInd = IND++
const sparkleALyr = shapeLayer('sparkle-a', sparkleAInd, null, [
  group([...P3.sparkleA.map(pathShape), strokeStyle(BLACK, 1.39197)])
], { p: sk([sparkleABox.cx, sparkleABox.cy, 0]), a: sk([sparkleABox.cx, sparkleABox.cy, 0]), s: pulseA.scale, o: pulseA.opacity })

const sparkleBInd = IND++
const sparkleBLyr = shapeLayer('sparkle-b', sparkleBInd, null, [
  group([...P3.sparkleB.map(pathShape), strokeStyle(BLACK, 1.39197)])
], { p: sk([sparkleBBox.cx, sparkleBBox.cy, 0]), a: sk([sparkleBBox.cx, sparkleBBox.cy, 0]), s: pulseB.scale, o: pulseB.opacity })

const sparkleCInd = IND++
const sparkleCLyr = shapeLayer('sparkle-c', sparkleCInd, null, [
  group([...P3.sparkleC.map(pathShape), strokeStyle(BLACK, 1.39197)])
], { p: sk([sparkleCBox.cx, sparkleCBox.cy, 0]), a: sk([sparkleCBox.cx, sparkleCBox.cy, 0]), s: pulseC.scale, o: pulseC.opacity })

// Air-flow: a null carrying the lagging swish (rotation-only -> exempt from
// the scale-pivot gate), pivoting at the marks' own base over the head; the
// SHAPE child carries the visibility cycle (opacity would not cascade from
// the null — see the badge pop note).
const airflowPivot = [armsBox.cx, armsBox.maxY]
const airflowRigInd = IND++
const airflowRigLyr = nullLayer('mascot-airflow-rig', airflowRigInd, mascotRootInd, {
  p: sk([airflowPivot[0], airflowPivot[1], 0]),
  a: sk([airflowPivot[0], airflowPivot[1], 0]),
  r: airflowRotation(),
})
const airflowShapeInd = IND++
const airflowShapeLyr = shapeLayer('mascot-airflow', airflowShapeInd, airflowRigInd, [
  group([...P3.arms.map(pathShape), strokeStyle(BLACK, 1.39197)])
], { o: airflowOpacity() })

const eyesInd = IND++
const eyesLyr = shapeLayer('mascot-eyes', eyesInd, mascotRootInd, [
  group([pathShape(P3.eye1[0]), pathShape(P3.eye2[0]), strokeStyle(BLACK, 2.78393)])
], { p: sk([eyeBox.cx, eyeBox.cy, 0]), a: sk([eyeBox.cx, eyeBox.cy, 0]), s: eyeCounterScale() })

const bellyInd = IND++
const bellyLyr = shapeLayer('mascot-belly', bellyInd, mascotRootInd, [
  group([pathShape(P3.belly[0]), fill(WHITE)])
])
const outlineInd = IND++
const outlineLyr = shapeLayer('mascot-outline', outlineInd, mascotRootInd, [
  group([pathShape(P3.bodyOutline[0]), fill(BLACK)])
])

const ribbonSweepInd = IND++
const ribbonSweepLyr = shapeLayer('ribbon-sweep', ribbonSweepInd, null, [
  ...gleamGroups(),
], { o: gleamOpacity() })
const ribbonInd = IND++
const ribbonLyr = shapeLayer('mascot-ribbon', ribbonInd, null, [
  group([pathShape(ribbonDrawSeg), gradientStroke(RIBBON_W), trimShape(0, ribbonDrawTrim)])
])

const swooshInd = IND++
const swooshLyr = shapeLayer('mascot-swoosh', swooshInd, null, [
  group([{ ty: 'sh', ks: swooshDrawPath() }, fill(GREEN)], 'swoosh-stroke')
], { p: sk([swooshBox.cx, swooshBox.cy, 0]), a: sk([swooshBox.cx, swooshBox.cy, 0]), s: ambientBreathScale(), o: swooshDrawOpacity() })

const sparkAnims = sparkEntrance()
const sparkInd = IND++
const sparkLyr = shapeLayer('mascot-spark', sparkInd, null, [
  group([pathShape(P3.spark[0]), pathShape(P3.spark[1]), fill(GREEN, 'evenodd')])
], { p: sk([sparkBox.cx, sparkBox.cy, 0]), a: sk([sparkBox.cx, sparkBox.cy, 0]), s: sparkAnims.s, o: sparkAnims.o })

const shadowInd = IND++
const shadowLyr = shapeLayer('mascot-shadow', shadowInd, null, [
  group([...SHADOW_SEGS.map(pathShape), fill(SHADOW_C)])
], { p: sk([shadowBox.cx, shadowBox.cy, 0]), a: sk([shadowBox.cx, shadowBox.cy, 0]), s: shadowScaleAnim(), o: shadowOpacityAnim() })

// ═══════════════════════════════════════════════════════════════════════════
// COMPOSE — the badge assembly is wrapped in ONE precomp so the beat-3 pop
// (scale-out + fade) composites as real alpha (see badgePopScale/Opacity).
// ═══════════════════════════════════════════════════════════════════════════
const badgeInnerLayers = [
  checkLyr,
  handShapeLyr, handRigLyr,
  hubLyr, ticksLyr,
  mainRingLyr, innerRingLyr, whiteDiscLyr,
  textureMatteLyr, textureLyr,
  badgeRootLyr,
]
const badgePrecompInd = IND++
const badgePrecompLyr = precompFromLayers('badge', badgePrecompInd, null, badgeInnerLayers, {
  p: sk([BADGE_C[0], BADGE_C[1], 0]),
  a: sk([BADGE_C[0], BADGE_C[1], 0]),
  s: badgePopScale(),
  o: badgePopOpacity(),
})

const lottie = {
  v: '5.7.0',
  fr: FPS,
  ip: 0,
  op: OP,
  w: W,
  h: H,
  nm: 'Payment Confirmation — Story (3 chapters)',
  markers: [
    { cm: 'intro', tm: 0, dr: T },
    { cm: 'loop', tm: T, dr: OP - T },
  ],
  slots: { ribbonRamp: { p: RIBBON_RAMP } },
  assets: PRECOMP_ASSETS,
  // layers[0] is frontmost.
  layers: [
    sparkleALyr, sparkleBLyr, sparkleCLyr,
    airflowShapeLyr, airflowRigLyr,
    eyesLyr, bellyLyr, outlineLyr,
    ribbonSweepLyr, ribbonLyr, swooshLyr, sparkLyr,
    shadowLyr,
    mascotRootLyr,
    badgePrecompLyr,
  ],
}

const controls = {
  controls: [],
    parameters: [
      {
        id: 'ribbonRamp',
        kind: 'gradient',
        sid: 'ribbonRamp',
        label: 'Ribbon ramp',
        description: 'The green sweep behind the mascot — fades out along its tail.',
        themable: true,
      },
    ],
  layerControls: [
    { target: 'mascot-root', kind: 'amount', property: 'position', label: 'Jump height', description: 'How high he springs at each beat of the celebration loop.' },
    { target: 'mascot-root', kind: 'amount', property: 'rotation', label: 'Bounce lean', description: 'How far he tilts at the top of each jump.' },
    { target: 'mascot-airflow-rig', kind: 'amount', property: 'rotation', label: 'Air swish', description: 'How far the air-flow marks swish above him with each bounce.' },
    { target: 'badge-hand-rig', kind: 'amount', property: 'rotation', label: 'Hand sweep', description: 'How far the clock hand sweeps while waiting.' },
    { target: 'mascot-shadow', kind: 'amount', property: 'scale', label: 'Shadow pulse', description: 'How much the ground shadow spreads on landing vs pulls in at the peak.' },
  ],
  motionExceptions: [
    { layer: 'eyes', reason: "brief: \"Only the body and its white face morph\" — the eyes' scale track is the exact inverse of the body's squash/stretch (product 100%), so their drawn arcs never squash, stretch, or blink; only bodyOutline/belly carry the morph." },
    { a: 'ribbon', b: 'outline', reason: "sequence checklist default (chapterization-transition-grammar.md): \"anything that comes to rest rests where its source file draws it\" — the brief stages the ribbon/swoosh/spark as one pen-drawn gesture that arrives once (\"draws itself... straight on into the bright swoosh\"), never as a held or worn prop, so per the default they hold their source position while the body bounces near them." },
    { a: 'ribbon', b: 'belly', reason: "same as above — stage-fixed decoration, not welded to the body." },
    { a: 'swoosh', b: 'outline', reason: "same as above — the greens appear together as one smooth decorative gesture behind him when the celebration starts, then rest at the source position while he keeps bouncing; stage-fixed decoration, not a held prop." },
    { a: 'swoosh', b: 'belly', reason: "same as above." },
    { a: 'spark', b: 'outline', reason: "same as above — brief: \"the spark last like the pen lifting\" — pops at the gesture's end, then rests at the source position as stage decoration." },
    { a: 'spark', b: 'belly', reason: "same as above." },
    { a: 'ribbon-sweep', b: 'outline', reason: "the gleam strokes ride the ribbon's own static path; see the ribbon exception." },
    { a: 'ribbon-sweep', b: 'belly', reason: "same as above." },
    { a: 'ribbon', b: 'swoosh', reason: "same as above — both are stage-fixed decoration, not welded to each other or to the body." },
    { a: 'ribbon', b: 'eyes', reason: "same as above — stage-fixed decoration passing near the face, not welded to it." },
    { a: 'swoosh', b: 'airflow', reason: "same as above — stage-fixed decoration passing near the air-flow marks, not welded to them." },
    { a: 'swoosh', b: 'eyes', reason: "same as above — stage-fixed decoration passing near the face, not welded to it." },
    { a: 'swoosh', b: 'spark', reason: "the swoosh reveals by a static-geometry wipe while the spark pops around its own artwork centre at the wipe's end (scale-pivot gate), so their shared touching edge drifts a few px during the brief pop — an entrance artifact, not an independent clock." },
  ],
}

mkdirSync(OUT_DIR, { recursive: true })
// Ship compact: pretty-print costs ~1.9MB of indentation and the tube polygons
// carry 14 decimals of float noise on a 257px canvas (3dp = 0.0005px).
const round3 = (k, v) => (typeof v === 'number' ? +v.toFixed(3) : v)
writeFileSync(OUT, JSON.stringify(lottie, round3))
writeFileSync(join(OUT_DIR, 'controls.json'), JSON.stringify(controls, null, 2))
console.log(`Written ${OUT}`)
console.log(`badge center ${BADGE_C}  hub ${HUB_C}  hand rest ${HAND_A0.toFixed(1)}deg`)
console.log(`mascot pivot ${PIVOT}  jump ${JUMP_H}px  lean ${LEAN}deg`)
