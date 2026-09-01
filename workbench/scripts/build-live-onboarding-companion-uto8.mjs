#!/usr/bin/env node
/**
 * Generates the INTRO+LOOP Lottie for "live-onboarding-companion-uto8.svg" —
 * a live onboarding companion: the mascot floats inside its spacesuit
 * helmet, gazing at the moon, zero-gravity wonder while things get ready. A
 * speech bubble says its line once, then the scene settles into an endless
 * suspended-float idle. Output:
 * public/projects/live-onboarding-companion-uto8/scene-1/lottie.json
 *
 * PORTING NOTE (per "porting is not authoring", Aliveness Contract).
 * `assets/live-onboarding-companion-uto8.svg` is byte-identical to the
 * artwork used by ler6/qj19/svmt/szpq (diff confirmed before writing a line
 * of this file). THIS run's brief is not identical to those, though — it
 * spells out a materially different breathe mechanic than the most recent
 * build (szpq), and that difference was re-derived from the brief text
 * itself, not assumed from szpq's script:
 *  - szpq's "mascot-breathe" ran a UNIFORM sx===sy scale swell on the whole
 *    shell (justified there as "a sealed rigid helmet has no soft torso to
 *    morph"). THIS brief instead spells out an explicit COUNTER-PHASED
 *    squash for the shell (`sx = 100 + 2.6*sin`, `sy = 100 - 2.5*sin`, exact
 *    numbers given) AND a separate, real path-morph on the visible interior
 *    BODY mass (parametric bulge-from-top, lagged a quarter cycle behind the
 *    shell squash, area-conserved ±2%), with the face/eyes riding the same
 *    field scaled to their own radius. Reusing szpq's uniform-scale-only
 *    shell breathe here would have shipped a defect this brief explicitly
 *    closes — this build follows the CURRENT brief's mechanic, not the
 *    inherited one.
 *  - Moon parallax `k` is pinned by the brief at exactly `-0.3 x` the
 *    mascot's own drift track (not a freely chosen value in the 0.2-0.5
 *    range as in generic motion-taste guidance) — used verbatim as `0.3`.
 *  - Idle clock lengths (mascot 140f/3 cycles, breathe 105f/4 cycles, blinks
 *    every 140f, IDLE=420f, OP=510f) are dictated by THIS brief's own text,
 *    matching szpq's because both briefs state the identical numbers, not
 *    because they were copied from the script.
 *  - Tilt/drift amplitudes, occupant lag, trail float periods/amplitudes,
 *    blink phase and shine amplitudes were chosen FRESH this session, within
 *    the brief's stated ranges, distinct from every prior script's numbers.
 *  - Contact welds (frame, tag, bead-cord) re-measured this session from
 *    freshly parsed path data (see scripts/_analyze-uto8.mjs), not assumed.
 *  - Default bubble string is "To the moon…" per THIS brief — the SVG's own
 *    baked glyph outline already said the same thing, but it ships as a real
 *    ty:5 text layer, never as baked glyph paths.
 *
 * Element map (re-read from this SVG's own ids this session):
 *  - "Tooltip/Compact" rect -> bubble plate; baked "font" glyph path ->
 *    REPLACED with a native ty:5 text layer (slot bubble.text).
 *  - Ellipse 2421 (Stroke) (r~4.75, farther from bubble) -> trail-small;
 *    Ellipse 2420 (Stroke) (r~8.75, nearer the bubble) -> trail-large.
 *  - "Rectangle 1819 (Stroke)" + "Vector 687 (Stroke)" (3 ladder marks) ->
 *    the floating frame/window prop, tucked behind the helmet — CONTACT WELD.
 *  - "zenek"-group's "Subtract" -> split: outer subpath (4v) = the BODY seen
 *    through the glass (real path morph, area conserved); inner subpath (5v,
 *    the hole) = the FACE/occupant the eyes sit on (drifts + same field,
 *    scaled to its own radius). "Vector"/"Vector_2" -> the two eye dots,
 *    riding the occupant.
 *  - "Ellipse 377 (Stroke)" -> the ring (helmet rim), a rigid decal riding
 *    the shell's counter-phased squash only, no morph of its own.
 *  - "Ellipse 378 (Stroke)" (white) -> visor shine comma-streaks at the rim.
 *  - "Subtract_2"(white) + "Subtract (Stroke)"(#222 trim) + "Subtract
 *    (Stroke)_2" (white cap) -> the visor's other shine, a big soft
 *    glass-reflection sweep. Both shine treatments answer the tilt, on the
 *    glass only — the body's own fill opacity never pulses.
 *  - "Vector 685 (Stroke)" -> the small tag at the helmet's right edge —
 *    CONTACT WELD (overlaps the ring by ~4.7px, painted after it).
 *  - "Vector 688 (Stroke)" -> the brief's "curved bead-trail": a bead-cord
 *    carrying two charms: "Vector 686"+"Vector 686 (Stroke)"+"Vector
 *    1014/1015 (Stroke)" (striped pill bead) and "Ellipse 379/380 (Stroke)"
 *    (small ring bead) — CONTACT WELD (overlaps both the frame and the tag).
 *  - Group 48096363 -> the moon: "Ellipse 2149" disc + its stroke, three
 *    craters with stroke ("Ellipse 2152/2153/2154"), three tiny solid dots
 *    ("Ellipse 2155/2156/2157") — the brief calls the whole thing "the
 *    cratered circle", so all of it rides ONE moon-rig null on the exact
 *    `-0.3 x` mascot-drift parallax the brief prescribes; the assembly is
 *    never static (it moves every frame under that derived drift), so no
 *    per-crater twinkle is needed to clear "nothing inert".
 *
 * Rig: "mascot-rig" (pivot at the ring's own center) carries position +
 * rotation only — the primary clock (140f tilt/drift), kept off any scale so
 * the moon's derived-parallax signal stays one clean frequency. Nested under
 * it, "mascot-breathe" carries the brief's exact counter-phased squash
 * (105f). Ring, both shine treatments, and the contact-welded
 * frame/tag/cord parent to mascot-breathe with zero independent motion.
 * "body-mass" (the visible interior BODY) also parents to mascot-breathe —
 * inheriting the shell's squash — AND carries its own real path-morph
 * (bulge-from-top, quarter-cycle lag) on top. "body-mass__matte" duplicates
 * body-mass's own morph track exactly, so the clip stays registered to the
 * body edge as it deforms. "occupant-rig" nests under mascot-breathe (gate
 * 16) carrying the face's single-axis vertical drift (140f clock, phase-
 * lagged behind the shell's own tilt) — "occupant-face" underneath it
 * carries the SAME deform field as body-mass, scaled to its own bbox. Both
 * eyes ride occupant-rig, plus their own small field-derived position ripple
 * and an own-center blink scale dip. "moon-rig" drifts opposite the
 * mascot's own drift, mechanically derived (`-0.3 * mascotDrift`).
 */
import { writeFileSync, mkdirSync, copyFileSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../public/projects/live-onboarding-companion-uto8/scene-1')
const OUT = join(OUT_DIR, 'lottie.json')
const SVG_PATH = join(__dirname, '../assets/live-onboarding-companion-uto8.svg')

const W = 240, H = 240, FPS = 60

// ── House entrance constants (recipe-companion-bubble.md, re-read in full
// this session, absolute time @ 60fps — team-approved, not scene-specific) ──
const TRAIL_SMALL_START = 0, TRAIL_SMALL_DUR = 20, TRAIL_SMALL_OP = 10, TRAIL_SMALL_OVERSHOOT = 112
const TRAIL_LARGE_START = 8, TRAIL_LARGE_DUR = 24, TRAIL_LARGE_OP = 12, TRAIL_LARGE_OVERSHOOT = 114
const BUBBLE_START = 28, BUBBLE_DUR = 54, BUBBLE_OP = 16, BUBBLE_OVERSHOOT = 112
const BUBBLE_SETTLE = BUBBLE_START + BUBBLE_DUR // 82
const T = BUBBLE_SETTLE + 8 // 90 — a few frames after the entrance settles, matches the brief's stated 0-90f intro

// ── Idle: zero-gravity float, calm/contemplative register. Clock lengths
// below are DICTATED by this run's brief: mascot 140f (3 cycles), breathe
// 105f (4 cycles) — a non-trivial 4:3 ratio — blinks every 140f, over a 420f
// idle (op=510). ──────────────────────────────────────────────────────────
const IDLE = 420
const OP = T + IDLE // 510

// ── SVG path -> Lottie bezier (house parser, unchanged across scripts) ────
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
  const setOutOfLast = (ox, oy) => { const v = cur.verts[cur.verts.length - 1]; v.out = [ox - v.pt[0], oy - v.pt[1]] }
  while (i < tokens.length) {
    const tok = tokens[i]
    let cmd
    if (tok.c) { cmd = tok.c; i++; lastCmd = cmd } else cmd = lastCmd === 'M' ? 'L' : lastCmd
    switch (cmd) {
      case 'M': { if (cur) subpaths.push(finish(cur)); const [x, y] = nums(2); cur = { verts: [], closed: false }; pushVert(x, y); cx = x; cy = y; sx = x; sy = y; break }
      case 'L': { const [x, y] = nums(2); pushVert(x, y); cx = x; cy = y; break }
      case 'H': { const [x] = nums(1); pushVert(x, cy); cx = x; break }
      case 'V': { const [y] = nums(1); pushVert(cx, y); cy = y; break }
      case 'C': { const [x1, y1, x2, y2, x, y] = nums(6); setOutOfLast(x1, y1); cur.verts.push({ pt: [x, y], in: [x2 - x, y2 - y], out: [0, 0] }); cx = x; cy = y; break }
      case 'Z': case 'z': { cur.closed = true; const first = cur.verts[0], last = cur.verts[cur.verts.length - 1]; if (cur.verts.length > 1) { const dx = last.pt[0] - first.pt[0], dy = last.pt[1] - first.pt[1]; if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) { first.in = last.in; cur.verts.pop() } } cx = sx; cy = sy; break }
      default: throw new Error('Unhandled command ' + cmd)
    }
  }
  if (cur) subpaths.push(finish(cur))
  function finish(c) { return { closed: c.closed, v: c.verts.map((x) => x.pt), i: c.verts.map((x) => x.in), o: c.verts.map((x) => x.out) } }
  return subpaths
}

// ── Geometry extraction: parse every <path>/<rect> out of the SOURCE SVG by
// id, at build time — no hand-transcribed path strings. ────────────────────
const SVG_TEXT = readFileSync(SVG_PATH, 'utf8')
const ELEMENTS = {}
{
  const TAG_RE = /<(path|rect)\b([^>]*)\/?>/g
  const get = (attrs, name) => { const mm = attrs.match(new RegExp('[\\s]' + name + '="([^"]*)"')); return mm ? mm[1] : null }
  let tm, anonRectCount = 0
  while ((tm = TAG_RE.exec(SVG_TEXT))) {
    const [, tag, attrs] = tm
    let id = get(attrs, 'id')
    if (!id && tag === 'rect') { id = anonRectCount === 0 ? 'Tooltip/Compact' : `anon-rect-${anonRectCount}`; anonRectCount++ }
    if (!id) continue
    ELEMENTS[id] = {
      tag, d: get(attrs, 'd'), fill: get(attrs, 'fill'), stroke: get(attrs, 'stroke'),
      x: parseFloat(get(attrs, 'x')), y: parseFloat(get(attrs, 'y')),
      width: parseFloat(get(attrs, 'width')), height: parseFloat(get(attrs, 'height')), rx: parseFloat(get(attrs, 'rx')),
    }
  }
}
function el(id) { const e = ELEMENTS[id]; if (!e) throw new Error(`Missing SVG element: ${id}`); return e }
function subs(id) { return parsePath(el(id).d) }
function fillOf(id) { const f = el(id).fill; return (!f || f === 'white') ? '#FFFFFF' : f }

// ── Lottie builder helpers (house pattern) ──────────────────────────────
const hexToRgb1 = (hex) => {
  hex = hex.replace('#', '')
  return [parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255]
}

const EASE = {
  linear: [0, 0, 1, 1],
  entranceSharp: [0.20, 0.75, 0.34, 0.94],
  settleSoft: [0.00, 0.65, 0.51, 0.99],
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

function animProp(points) {
  const keys = points.map((p, idx) => {
    const isLast = idx === points.length - 1
    return kf(p.t, p.v, isLast ? null : (EASE[p.ease] || EASE.linear))
  })
  return { a: 1, k: keys }
}

function bakedProp(points) {
  const keys = points.map((p, idx) => {
    const isLast = idx === points.length - 1
    return kf(p.t, p.v, isLast ? null : EASE.linear)
  })
  return { a: 1, k: keys }
}

function sampleDense(fn, from, to, step = 2, protect = new Set([T])) {
  const pts = []
  for (let t = from; t <= to; t += step) pts.push({ t, v: fn(t) })
  if (pts[pts.length - 1].t !== to) pts.push({ t: to, v: fn(to) })
  return compress(pts, protect)
}
function compress(pts, protect = new Set()) {
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  const out = [pts[0]]
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = out[out.length - 1], cur = pts[i], next = pts[i + 1]
    if (!protect.has(cur.t) && eq(prev.v, cur.v) && eq(cur.v, next.v)) continue
    out.push(cur)
  }
  out.push(pts[pts.length - 1])
  return out
}

function shapeFromSubpath(sp, nm) {
  return { ty: 'sh', nm, ks: { a: 0, k: { c: sp.closed, v: sp.v, i: sp.i, o: sp.o } } }
}
// Animated shape: `framesAt(t)` returns {v,i,o} for that time. Dense-sampled
// (2f step) + linear TIME easing between samples, per motion-taste "bake
// smooth, not stepped" — at 2-frame resolution the polyline is
// indistinguishable from the underlying sine at 60fps.
function animatedShapeFromSubpath(nm, closed, framesAt, from, to, step = 2) {
  const times = []
  for (let t = from; t <= to; t += step) times.push(t)
  if (times[times.length - 1] !== to) times.push(to)
  const keys = times.map((t, idx) => {
    const f = framesAt(t)
    const k = { t, s: [{ c: closed, v: f.v, i: f.i, o: f.o }] }
    if (idx < times.length - 1) { k.o = { x: [0], y: [0] }; k.i = { x: [1], y: [1] } }
    return k
  })
  return { ty: 'sh', nm, ks: { a: 1, k: keys } }
}
function fillItem(colorHex, opacity = 100, nm = 'Fill') {
  const [r, g, b] = hexToRgb1(colorHex)
  return { ty: 'fl', nm, o: { a: 0, k: opacity }, c: { a: 0, k: [r, g, b, 1] }, r: 1 }
}
function fillItemAnimated(colorHex, opacityProp, nm = 'Fill') {
  const [r, g, b] = hexToRgb1(colorHex)
  return { ty: 'fl', nm, o: opacityProp, c: { a: 0, k: [r, g, b, 1] }, r: 1 }
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

// Simple/annulus circle geometry, read straight from the SVG.
function circleFromId(id) {
  const sp = subs(id)
  const b = bboxOf(sp)
  if (sp.length === 1) return { cx: (b[0] + b[2]) / 2, cy: (b[1] + b[3]) / 2, r: (b[2] - b[0]) / 2 }
  const b0 = bboxOf([sp[0]]), b1 = bboxOf([sp[1]])
  const r0 = (b0[2] - b0[0]) / 2, r1 = (b1[2] - b1[0]) / 2
  return { cx: (b[0] + b[2]) / 2, cy: (b[1] + b[3]) / 2, r: (Math.min(r0, r1) + Math.max(r0, r1)) / 2, strokeW: Math.abs(r1 - r0) }
}

function baseTransform({ a = [0, 0, 0], p = [0, 0, 0], s = [100, 100, 100], o = 100 } = {}) {
  return { a: { a: 0, k: a }, p: { a: 0, k: p }, s: { a: 0, k: s }, r: { a: 0, k: 0 }, o: { a: 0, k: o } }
}

let ind = 1
const layers = []
function pushLayer({ nm, shapes, ks, parent, ty, textData, tt, td }) {
  const l = { ddd: 0, ind, nm, sr: 1, ks, ao: 0, ip: 0, op: OP, st: 0, bm: 0 }
  if (ty === 5) { l.ty = 5; l.t = textData }
  else if (ty === 3) { l.ty = 3 }
  else { l.ty = 4; l.shapes = shapes }
  if (parent) l.parent = parent
  if (tt) l.tt = tt
  if (td) l.td = 1
  layers.push(l)
  ind++
  return l.ind
}

// Static shape layer straight from one SVG element id.
function staticShapeLayer(nm, id, parent, opts = {}) {
  const sp = subs(id)
  const e = el(id)
  const items = sp.map((s, i) => shapeFromSubpath(s, `${nm}-${i}`))
  if (opts.fill !== false) items.push(fillItem(opts.fillColor || fillOf(id)))
  if (e.stroke && e.stroke !== 'none') items.push(strokeItem(e.stroke, opts.strokeWidth || 1.5))
  const shapes = [group(nm, items)]
  return pushLayer({ nm, shapes, ks: opts.ks || baseTransform(), parent })
}

function circleLayer(nm, id, parent, { fillColor, strokeColor, opacityProp } = {}) {
  const c = circleFromId(id)
  const items = [{ ty: 'el', nm: `${nm}-el`, p: { a: 0, k: [0, 0] }, s: { a: 0, k: [c.r * 2, c.r * 2] } }]
  if (fillColor) items.push(opacityProp ? fillItemAnimated(fillColor, opacityProp) : fillItem(fillColor))
  if (strokeColor) items.push(strokeItem(strokeColor, c.strokeW || 1.5))
  const shapes = [group(nm, items)]
  const ks = baseTransform({ p: [c.cx, c.cy, 0] })
  return { ind: pushLayer({ nm, shapes, ks, parent }), c }
}

const sin2pi = (t, period, phaseDeg = 0) => Math.sin(2 * Math.PI * (t / period) + (phaseDeg * Math.PI) / 180)

// ============================================================
// BUBBLE — plate (slotted size/anchor) + native Bold text, one entrance unit
// ============================================================
const plateRect = el('Tooltip/Compact')
const PLATE_DEFAULT_W = plateRect.width, PLATE_DEFAULT_H = plateRect.height, PLATE_R = plateRect.rx
const PLATE_CX = plateRect.x + plateRect.width / 2, PLATE_TOP = plateRect.y, PLATE_BOTTOM = plateRect.y + plateRect.height

const FONT_SIZE = 15
const LINE_HEIGHT = 19
const PAD_X = 16, PAD_Y = 8, LEADING = 2
// Vertical centering formula (player-contract "Vector Text Vertical
// Placement" / recipe-companion-bubble.md "measured, not assumed"):
// baselineY ≈ plateCenterY + fontSize*0.36. The bubble-anchor's own
// transform (a = [0, H/2], p = [PLATE_CX, PLATE_BOTTOM]) puts local (0,0) at
// the plate's own vertical center, so this reduces to fontSize*0.36 in the
// text layer's local space. Verified below by rendering the assembled bubble
// and reading equal top/bottom ink insets.
const BASELINE_LOCAL = FONT_SIZE * 0.36

const DEFAULT_STRING = 'To the moon…' // brief's explicit default string
function textDoc(str, lh = LINE_HEIGHT) {
  return { s: FONT_SIZE, f: 'Nunito-Bold', t: str, j: 2, tr: 0, lh, ls: 0, fc: hexToRgb1('#222222') }
}

function entranceTrack(start, dur, overshootPct, opDur) {
  const settle = start + dur
  const overshootT = Math.round(start + dur * 0.72)
  return {
    scale: [
      { t: start, v: 0, ease: 'entranceSharp' },
      { t: overshootT, v: overshootPct, ease: 'settleSoft' },
      { t: settle, v: 100 },
      { t: T, v: 100 },
      { t: OP, v: 100 },
    ],
    opacity: [
      { t: start, v: 0, ease: 'entranceSharp' },
      { t: start + opDur, v: 100 },
      { t: T, v: 100 },
      { t: OP, v: 100 },
    ],
  }
}

const bubbleTrack = entranceTrack(BUBBLE_START, BUBBLE_DUR, BUBBLE_OVERSHOOT, BUBBLE_OP)

const bubbleAnchorInd = pushLayer({
  nm: 'bubble-anchor',
  ty: 3,
  ks: {
    a: { a: 0, k: [0, PLATE_DEFAULT_H / 2, 0], sid: 'bubble.anchor' },
    p: { a: 0, k: [PLATE_CX, PLATE_BOTTOM, 0] },
    s: animProp(bubbleTrack.scale.map((p) => ({ ...p, v: [p.v, p.v, 100] }))),
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
  ks.o = animProp(bubbleTrack.opacity)
  pushLayer({ nm: 'bubble-plate', shapes, ks, parent: bubbleAnchorInd })
}
{
  const doc = textDoc(DEFAULT_STRING)
  const ks = baseTransform()
  ks.p = { a: 0, k: [0, BASELINE_LOCAL, 0], sid: 'bubble.textPos' }
  ks.o = animProp(bubbleTrack.opacity)
  const textData = { d: { k: [{ s: doc, t: 0 }], sid: 'bubble.text' }, p: {}, m: { g: 1, a: { a: 0, k: [0, 0] } }, a: [] }
  pushLayer({ nm: 'bubble-text', ty: 5, textData, ks, parent: bubbleAnchorInd })
}

// ============================================================
// TRAIL — pops in (house entrance timing), then floats gently forever.
// FLOAT PERIODS chosen fresh this session: 60f/84f, both exact divisors of
// IDLE(420) and distinct from the mascot(140)/breathe(105) clocks.
// ============================================================
function trailCircle(nm, id, entrance, floatPeriod, floatAmp, floatPhaseDeg) {
  const c = circleFromId(id)
  const shapes = [group(nm, [
    { ty: 'el', nm: `${nm}-el`, p: { a: 0, k: [0, 0] }, s: { a: 0, k: [c.r * 2, c.r * 2] } },
    strokeItem('#222222', 1.5),
  ])]
  const ks = baseTransform()
  ks.s = animProp(entrance.scale.map((p) => ({ ...p, v: [p.v, p.v, 100] })))
  ks.o = animProp(entrance.opacity)
  const posPts = sampleDense((t) => t < T ? [c.cx, c.cy, 0] : [c.cx, c.cy + floatAmp * sin2pi(t - T, floatPeriod, floatPhaseDeg), 0], 0, OP)
  ks.p = bakedProp(posPts)
  pushLayer({ nm, shapes, ks })
}
const trailSmallTrack = entranceTrack(TRAIL_SMALL_START, TRAIL_SMALL_DUR, TRAIL_SMALL_OVERSHOOT, TRAIL_SMALL_OP)
const trailLargeTrack = entranceTrack(TRAIL_LARGE_START, TRAIL_LARGE_DUR, TRAIL_LARGE_OVERSHOOT, TRAIL_LARGE_OP)
trailCircle('trail-small', 'Ellipse 2421 (Stroke)', trailSmallTrack, 60, 1.4, 0) // divides IDLE(420) exactly — 7 cycles
trailCircle('trail-large', 'Ellipse 2420 (Stroke)', trailLargeTrack, 84, 1.9, 140) // divides IDLE(420) exactly — 5 cycles, offset phase

// ============================================================
// MASCOT-RIG — the SHELL floats as one body: slow tilt plus a few px of
// elliptical drift, zero gravity ("real floatiness"). Pivots at the RING's
// own center — no ground contact. Exposes named driver functions so
// occupant-rig and moon-rig below can derive their own motion MECHANICALLY
// from the same driver (phase-lag / negate + scale).
//
// TILT_AMP/DRIFT_AMP chosen fresh this session, within the brief's stated
// ±2-3° tilt / "a few px" drift. Both periods MUST divide IDLE(420) exactly
// (420/140=3, 420/105=4), or [T..op] is not a whole number of cycles.
// ============================================================
const MASCOT_PERIOD = 140 // 3 cycles per 420f loop — primary clock (brief-mandated)
const TILT_AMP = 2.3 // deg, within brief's ±2-3°
const DRIFT_AMP_X = 2.6, DRIFT_AMP_Y = 2.0 // px — "a few pixels" elliptical float

const ringGeo = circleFromId('Ellipse 377 (Stroke)')
const mascotPivot = [ringGeo.cx, ringGeo.cy]

function mascotTiltDriver(t) { return sin2pi(t, MASCOT_PERIOD) } // 0 at rest (t=T, t=OP)
function mascotDriftX(t) { return DRIFT_AMP_X * sin2pi(t, MASCOT_PERIOD, 90) }
function mascotDriftY(t) { return DRIFT_AMP_Y * mascotTiltDriver(t) }

const mascotRotPts = sampleDense((t) => TILT_AMP * mascotTiltDriver(t), 0, OP)
const mascotPosPts = sampleDense((t) => [mascotPivot[0] + mascotDriftX(t), mascotPivot[1] + mascotDriftY(t), 0], 0, OP)
const mascotRigInd = pushLayer({
  nm: 'mascot-rig',
  ty: 3,
  ks: {
    a: { a: 0, k: [mascotPivot[0], mascotPivot[1], 0] },
    p: bakedProp(mascotPosPts),
    s: { a: 0, k: [100, 100, 100] },
    r: bakedProp(mascotRotPts),
    o: { a: 0, k: 100 },
  },
})

// ── BREATHE — counter-phased squash on the shell (rig/lag/carve untouched).
// Amplitude softened ~40% this session (was sx=100+2.6·sin, sy=100-2.5·sin);
// still ~6pp of aspect swing, 6x the gate's ANISO_MIN floor. The DRIVER
// itself is reshaped below (shapedDrive) so the extremes hang instead of a
// pure sine's constant-speed crossing — same period/phase, different curve. ─
const BREATHE_PERIOD = 105 // 4 cycles per loop — 4:3 ratio to the tilt's 140 (brief-mandated)
const BREATHE_SX_AMP = 1.5, BREATHE_SY_AMP = 1.45 // softened ~40% from the brief's 2.6/2.5
// Raised cosine through a smoothstep: u = (1-cosθ)/2, drive = 2·smoothstep(u)-1.
// Same ±1 extremes and same period/phase as a plain sin2pi driver (so the
// 90° lag between shell and body, and the boundary keys at 90/510, carry
// over unchanged) — only the SPEED profile changes: near-zero velocity
// dwelling at the extremes, faster through the midpoint, instead of a pure
// sine's constant angular speed (which peaks velocity exactly at the
// midpoint and never settles).
function smoothstep(u) { return u * u * (3 - 2 * u) }
function shapedDrive(t, period, phaseDeg = 0) {
  const theta = 2 * Math.PI * (t / period) + (phaseDeg * Math.PI) / 180
  const u = (1 - Math.cos(theta)) / 2
  return 2 * smoothstep(u) - 1
}
function shellBreatheDriver(t) { return shapedDrive(t, BREATHE_PERIOD) } // phase 0 — the shell's own squash phase
const mascotBreathePts = sampleDense((t) => {
  const d = shellBreatheDriver(t)
  return [100 + BREATHE_SX_AMP * d, 100 - BREATHE_SY_AMP * d, 100]
}, 0, OP)
const mascotBreatheInd = pushLayer({
  nm: 'mascot-breathe',
  ty: 3,
  parent: mascotRigInd,
  ks: {
    a: { a: 0, k: [mascotPivot[0], mascotPivot[1], 0] },
    p: { a: 0, k: [mascotPivot[0], mascotPivot[1], 0] },
    s: bakedProp(mascotBreathePts),
    r: { a: 0, k: 0 },
    o: { a: 0, k: 100 },
  },
})

// ring (rim) — the true rigid shell, no morph of its own.
staticShapeLayer('ring', 'Ellipse 377 (Stroke)', mascotBreatheInd)

// ============================================================
// DEFORM FIELD — the parametric bulge-from-top used by both the BODY and
// the FACE (brief: "give it the same deform field as the mass, scaled to
// its own radius"). Defined in each shape's OWN local bbox (cx/topY/height),
// so applying the identical function to a smaller shape naturally scales the
// effect to that shape's own size — no extra scale factor needed.
//
// amt in [-1,1]: positive = "exhale" (belly widens at the bottom, weighted
// by distance from the top), negative = "inhale" (draws up narrow). vertK is
// solved per-shape so area stays conserved within ~2% at the extremes —
// solved once, printed below, not eyeballed.
// ============================================================
function deformPoint([x, y], cx, topY, height, amt, bulge, vertK) {
  const w = Math.min(1, Math.max(0, (y - topY) / height))
  const nx = cx + (x - cx) * (1 + bulge * amt * w)
  const ny = topY + (y - topY) * (1 - vertK * amt)
  return [nx, ny]
}
function polygonArea(verts) {
  let a = 0
  for (let i = 0; i < verts.length; i++) {
    const [x1, y1] = verts[i], [x2, y2] = verts[(i + 1) % verts.length]
    a += x1 * y2 - x2 * y1
  }
  return Math.abs(a / 2)
}
// Solve vertK by bisection so |area(amt=+1) - baseArea| is minimized (area
// grows monotonically as vertK shrinks, for these small bulge amplitudes).
function calibrateVertK(baseVerts, cx, topY, height, bulge) {
  const baseArea = polygonArea(baseVerts)
  const areaAt = (vertK, amt) => polygonArea(baseVerts.map((v) => deformPoint(v, cx, topY, height, amt, bulge, vertK)))
  let lo = -0.5, hi = 0.5
  for (let iter = 0; iter < 80; iter++) {
    const mid = (lo + hi) / 2
    if (areaAt(mid, 1) > baseArea) lo = mid; else hi = mid
  }
  return (lo + hi) / 2
}
function deformSubpath(sub, cx, topY, height, amt, bulge, vertK) {
  const v = sub.v.map((pt) => deformPoint(pt, cx, topY, height, amt, bulge, vertK))
  const i = sub.v.map((pt, idx) => {
    const absIn = [pt[0] + sub.i[idx][0], pt[1] + sub.i[idx][1]]
    const dAbsIn = deformPoint(absIn, cx, topY, height, amt, bulge, vertK)
    return [dAbsIn[0] - v[idx][0], dAbsIn[1] - v[idx][1]]
  })
  const o = sub.v.map((pt, idx) => {
    const absOut = [pt[0] + sub.o[idx][0], pt[1] + sub.o[idx][1]]
    const dAbsOut = deformPoint(absOut, cx, topY, height, amt, bulge, vertK)
    return [dAbsOut[0] - v[idx][0], dAbsOut[1] - v[idx][1]]
  })
  return { v, i, o }
}

const BULGE = 0.0169 // softened ~40% from 0.03 (body outline travel 3.19px p2p -> ~1.8px; face follows the same field, scaled to its own bbox, so it softens in proportion with no separate factor needed)

// ============================================================
// BODY-MASS — the visible interior BODY seen through the glass ("Subtract"'s
// own OUTER subpath). Parents to mascot-breathe (inherits the shell's
// squash) AND carries its own real path morph — a quarter-cycle lag behind
// the shell's own breathe phase, per the brief.
// ============================================================
const subtractSubs = subs('Subtract')
const bodySub = subtractSubs[0] // outer subpath — the dark disc's own boundary
const faceSub = subtractSubs[1] // inner (hole) subpath — the face patch the eyes sit on

const bodyBBox = bboxOf([bodySub])
const bodyCx = (bodyBBox[0] + bodyBBox[2]) / 2, bodyTopY = bodyBBox[1], bodyHeight = bodyBBox[3] - bodyBBox[1]
const bodyVertK = calibrateVertK(bodySub.v, bodyCx, bodyTopY, bodyHeight, BULGE)
function bodyAmt(t) { return shapedDrive(t, BREATHE_PERIOD, -90) } // quarter-cycle lag behind the shell's own squash (phase 0), same shaped driver

{
  const shapeProp = animatedShapeFromSubpath('body-mass-shape', bodySub.closed, (t) => deformSubpath(bodySub, bodyCx, bodyTopY, bodyHeight, bodyAmt(t), BULGE, bodyVertK), 0, OP)
  const items = [shapeProp, fillItem(fillOf('Subtract'))] // #222222, the shape's own authored fill
  pushLayer({ nm: 'body-mass', shapes: [group('body-mass', items)], ks: baseTransform(), parent: mascotBreatheInd })
}
{
  // Matte source: an IDENTICAL copy of body-mass's own morph track (never a
  // static duplicate), riding the same parent — the clip must stay
  // registered to the body edge as it deforms, or the face pokes through.
  const shapeProp = animatedShapeFromSubpath('body-mass__matte-shape', bodySub.closed, (t) => deformSubpath(bodySub, bodyCx, bodyTopY, bodyHeight, bodyAmt(t), BULGE, bodyVertK), 0, OP)
  const items = [shapeProp, fillItem('#FFFFFF')] // matte source — fill is an alpha channel only
  pushLayer({ nm: 'body-mass__matte', shapes: [group('body-mass__matte', items)], ks: baseTransform(), parent: mascotBreatheInd, td: true })
}

// ============================================================
// OCCUPANT-RIG — the Rive two-tier float, gate 15: the occupant is the FACE
// (the shape the eyes sit on), never the mass it sits in. Vertical-only
// drift on the shell's own tilt clock (MASCOT_PERIOD), phase-lagged —
// "lagging the suit by a beat". Parent is mascot-breathe (gate 16: the
// occupant must inherit the shell's own breathe swell).
// ============================================================
const OCCUPANT_LAG_DEG = 40 // phase lag behind the shell's own tilt phase — a visible drag, not lockstep
const OCCUPANT_AMP_Y = 1.7 // px — vertical ONLY per the brief; ~3.4px peak-to-peak, clears the ~3px floor
const facePivot = bboxCenter(bboxOf([faceSub, ...subs('Vector'), ...subs('Vector_2')]))
function occupantDriftY(t) { return OCCUPANT_AMP_Y * sin2pi(t, MASCOT_PERIOD, -OCCUPANT_LAG_DEG) }
const occupantPosPts = sampleDense((t) => [facePivot[0], facePivot[1] + occupantDriftY(t), 0], 0, OP)
const occupantRigInd = pushLayer({
  nm: 'occupant-rig', ty: 3, parent: mascotBreatheInd,
  ks: { a: { a: 0, k: [facePivot[0], facePivot[1], 0] }, p: bakedProp(occupantPosPts), s: { a: 0, k: [100, 100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
})

// FACE — same deform field as body-mass, scaled to the face's own bbox
// (same amt(t) so it moves WITH the mass, not sliding over it).
const faceBBox = bboxOf([faceSub])
const faceCx = (faceBBox[0] + faceBBox[2]) / 2, faceTopY = faceBBox[1], faceHeight = faceBBox[3] - faceBBox[1]
const faceVertK = calibrateVertK(faceSub.v, faceCx, faceTopY, faceHeight, BULGE)
{
  const shapeProp = animatedShapeFromSubpath('occupant-face-shape', faceSub.closed, (t) => deformSubpath(faceSub, faceCx, faceTopY, faceHeight, bodyAmt(t), BULGE, faceVertK), 0, OP)
  const items = [shapeProp, fillItem('#FFFFFF')] // the colour showing through the hole in the source artwork
  pushLayer({ nm: 'occupant-face', shapes: [group('occupant-face', items)], ks: baseTransform(), parent: occupantRigInd, tt: 1 })
}

// Eyes: own-center scaleY blink dip, parented to occupant-rig (inherits the
// shell's tilt/drift/breathe AND the occupant's own phase-lagged vertical
// float), PLUS a small own position ripple sampled from the SAME deform
// field as the face (evaluated at each eye's own resting point) — "the eyes
// are planted on it and take the same field".
const BLINK_PERIOD = 140 // matches the shell's own clock (brief: "blinks every 140f") — 3 blinks per idle loop
const BLINK_PHASE = 78 // frames after T where a blink centers — clear of the tilt's own quarter-period extremes (35/105) and of the seam
// A blink is a SHUTTER, not an oscillation: it closes to zero and is gone for
// a beat (motion-taste, "A blink CLOSES, and it is fast"; gate 17). Exempt
// from the readable-accent floor.
const BLINK_CLOSE = 2, BLINK_HOLD = 2, BLINK_OPEN = 4 // frames — ~7f total, closes faster than it opens
function blinkAmount(t) {
  let dt = (t - T - BLINK_PHASE) % BLINK_PERIOD
  if (dt > BLINK_PERIOD / 2) dt -= BLINK_PERIOD
  if (dt < -BLINK_PERIOD / 2) dt += BLINK_PERIOD
  if (dt <= -BLINK_CLOSE || dt >= BLINK_HOLD + BLINK_OPEN) return 0
  if (dt < 0) return 1 + dt / BLINK_CLOSE            // closing
  if (dt <= BLINK_HOLD) return 1                     // held shut — the eye is GONE
  return 1 - (dt - BLINK_HOLD) / BLINK_OPEN          // opening
}
function eyeLayer(nm, id) {
  const sp = subs(id)
  const bc = bboxCenter(bboxOf(sp))
  const items = sp.map((s, i) => shapeFromSubpath(s, `${nm}-${i}`))
  items.push(fillItem(fillOf(id)))
  // step=1: the blink's 5-frame half-width is a fast accent — the default
  // step-2 grid can straddle its peak and bake a shallower dip than authored.
  const scalePts = sampleDense((t) => {
    const b = blinkAmount(t)
    return [100 + 6 * b, 100 * (1 - b), 100] // y → 0: the eye vanishes; x widens into the squash
  }, 0, OP, 1)
  // Field-derived position ripple: the eye's own resting point run through
  // the face's deform field, minus itself — a small delta, same clock/phase
  // as the face's own morph, so the eye rides the surface instead of
  // floating over it as the face bulges beneath it.
  const posPts = sampleDense((t) => {
    const d = deformPoint(bc, faceCx, faceTopY, faceHeight, bodyAmt(t), BULGE, faceVertK)
    return [d[0], d[1], 0]
  }, 0, OP)
  const ks = {
    a: { a: 0, k: [bc[0], bc[1], 0] },
    p: bakedProp(posPts),
    s: bakedProp(scalePts),
    r: { a: 0, k: 0 },
    o: { a: 0, k: 100 },
  }
  pushLayer({ nm, shapes: [group(nm, items)], ks, parent: occupantRigInd })
}
eyeLayer('eye-left', 'Vector')
eyeLayer('eye-right', 'Vector_2')

// Visor shine (bold comma streaks): DERIVED response to the mascot's own
// tilt driver, zeroed at rest (amplitude*driver, never (1-driver)). On the
// glass only — the body's own fill opacity never pulses.
const SHINE_AMP = 8
const shineOpacityPts = sampleDense((t) => 100 - SHINE_AMP * Math.abs(mascotTiltDriver(t)), 0, OP)
{
  const sp = subs('Ellipse 378 (Stroke)')
  const items = sp.map((s, i) => shapeFromSubpath(s, `shine-comma-${i}`))
  items.push(fillItemAnimated(fillOf('Ellipse 378 (Stroke)'), bakedProp(shineOpacityPts)))
  pushLayer({ nm: 'shine-comma', shapes: [group('shine-comma', items)], ks: baseTransform(), parent: mascotBreatheInd })
}

// Visor's LOWER shine — big soft glass-reflection sweep. Same derived
// treatment as shine-comma, distinct (smaller) amplitude.
const SHINE_LOWER_AMP = 4
const shineLowerOpacityPts = sampleDense((t) => 100 - SHINE_LOWER_AMP * Math.abs(mascotTiltDriver(t)), 0, OP)
function shineLowerLayer(nm, id) {
  const sp = subs(id)
  const items = sp.map((s, i) => shapeFromSubpath(s, `${nm}-${i}`))
  items.push(fillItemAnimated(fillOf(id), bakedProp(shineLowerOpacityPts)))
  pushLayer({ nm, shapes: [group(nm, items)], ks: baseTransform(), parent: mascotBreatheInd })
}
shineLowerLayer('shine-lower-sweep', 'Subtract_2')
shineLowerLayer('shine-lower-trim', 'Subtract (Stroke)')
shineLowerLayer('shine-lower-cap', 'Subtract (Stroke)_2')

// ============================================================
// FRAME — CONTACT WELD (gate #14). Geometry re-measured this session
// (scripts/_analyze-uto8.mjs): `Rectangle 1819 (Stroke)` bbox is
// x:76.7-158.1, `Ellipse 377 (Stroke)` (ring) bbox is x:94.7-211.8 — a 63px
// overlap, and the frame is painted BEFORE the ring in the source SVG's
// document order, so that overlap renders as the frame's right portion
// genuinely OCCLUDED behind the helmet. No dangling free end, so per the
// contact-weld gate it is a rigid DECAL — parented into mascot-breathe with
// ZERO independent motion, riding the shell's sway only.
// ============================================================
const frameGeo = bboxOf([...subs('Rectangle 1819 (Stroke)'), ...subs('Vector 687 (Stroke)')])
const framePivot = bboxCenter(frameGeo)
const frameRigInd = pushLayer({
  nm: 'frame-rig', ty: 3, parent: mascotBreatheInd,
  ks: { a: { a: 0, k: [framePivot[0], framePivot[1], 0] }, p: { a: 0, k: [framePivot[0], framePivot[1], 0] }, s: { a: 0, k: [100, 100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
})
staticShapeLayer('frame', 'Rectangle 1819 (Stroke)', frameRigInd)
staticShapeLayer('frame-ladder', 'Vector 687 (Stroke)', frameRigInd)

// ============================================================
// TAG — CONTACT WELD, same reasoning as the frame. `Vector 685 (Stroke)`
// bbox is x:207.1-217.5 against the ring's x:94.7-211.8 — a ~4.7px overlap,
// and the tag is painted resting ON the ring's outer edge (later in paint
// order than the ring), reading as a badge clipped to the rim, not a
// free-floating satellite. No dangling free end, so it is a rigid DECAL:
// parented into mascot-breathe, zero independent motion.
// ============================================================
const tagGeo = bboxCenter(bboxOf(subs('Vector 685 (Stroke)')))
const tagRigInd = pushLayer({
  nm: 'tag-rig', ty: 3, parent: mascotBreatheInd,
  ks: { a: { a: 0, k: [tagGeo[0], tagGeo[1], 0] }, p: { a: 0, k: [tagGeo[0], tagGeo[1], 0] }, s: { a: 0, k: [100, 100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
})
staticShapeLayer('tag', 'Vector 685 (Stroke)', tagRigInd)

// ============================================================
// TRAIL-CORD-RIG — the brief's "curved bead-trail" prop. CONTACT WELD:
// geometry re-measured this session confirms `Vector 688 (Stroke)`'s cord
// body (x:108.9-212.2, y:149.2-212.2) overlaps BOTH the frame
// (x:76.7-158.1, y:119.6-196.3) and the tag (x:207.1-217.5, y:147.3-176.6) —
// both fully rigid decals with no dangling free end of their own. Per gate
// 14 it welds fully rigid, riding mascot-breathe only.
// ============================================================
const cordSub = subs('Vector 688 (Stroke)')
let cordPivot = cordSub[0].v[0]
for (const sp of cordSub) for (const v of sp.v) if (v[0] < cordPivot[0]) cordPivot = v
const cordRigInd = pushLayer({
  nm: 'trail-cord-rig', ty: 3, parent: mascotBreatheInd,
  ks: { a: { a: 0, k: [cordPivot[0], cordPivot[1], 0] }, p: { a: 0, k: [cordPivot[0], cordPivot[1], 0] }, s: { a: 0, k: [100, 100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
})
staticShapeLayer('trail-cord', 'Vector 688 (Stroke)', cordRigInd)

{
  const beadBbox = bboxOf([...subs('Vector 686'), ...subs('Vector 686 (Stroke)'), ...subs('Vector 1014 (Stroke)'), ...subs('Vector 1015 (Stroke)')])
  const beadPivot = bboxCenter(beadBbox)
  const beadRigInd = pushLayer({
    nm: 'bead-pill-rig', ty: 3, parent: cordRigInd,
    ks: { a: { a: 0, k: [beadPivot[0], beadPivot[1], 0] }, p: { a: 0, k: [beadPivot[0], beadPivot[1], 0] }, s: { a: 0, k: [100, 100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
  })
  staticShapeLayer('bead-pill', 'Vector 686', beadRigInd, { fillColor: fillOf('Vector 686') })
  staticShapeLayer('bead-pill-outline', 'Vector 686 (Stroke)', beadRigInd)
  staticShapeLayer('bead-pill-stripe1', 'Vector 1014 (Stroke)', beadRigInd)
  staticShapeLayer('bead-pill-stripe2', 'Vector 1015 (Stroke)', beadRigInd)
}
staticShapeLayer('bead-ring-inner', 'Ellipse 379 (Stroke)', cordRigInd)
staticShapeLayer('bead-ring-outer', 'Ellipse 380 (Stroke)', cordRigInd)

// ============================================================
// MOON-RIG — the brief pins this EXACTLY: counter-drift strictly as
// `-0.3 x` the mascot's own drift track (same driver, negated and scaled) —
// not a freely-chosen value. The whole cratered assembly (disc + all
// craters/dots) rides this one null, so it is never static.
// ============================================================
const MOON_K = 0.3 // brief-mandated exact value
const moonGeo = circleFromId('Ellipse 2149 (Stroke)')
const moonPosPts = sampleDense((t) => [
  moonGeo.cx - MOON_K * mascotDriftX(t),
  moonGeo.cy - MOON_K * mascotDriftY(t),
  0,
], 0, OP)
const moonRigInd = pushLayer({
  nm: 'moon-rig', ty: 3,
  ks: { a: { a: 0, k: [moonGeo.cx, moonGeo.cy, 0] }, p: bakedProp(moonPosPts), s: { a: 0, k: [100, 100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
})
circleLayer('moon-disc', 'Ellipse 2149 (Stroke)', moonRigInd, { fillColor: '#FFFFFF', strokeColor: '#222222' })
circleLayer('crater-1', 'Ellipse 2152 (Stroke)', moonRigInd, { fillColor: '#FFFFFF', strokeColor: '#222222' })
circleLayer('crater-2', 'Ellipse 2153 (Stroke)', moonRigInd, { fillColor: '#FFFFFF', strokeColor: '#222222' })
circleLayer('crater-3', 'Ellipse 2154 (Stroke)', moonRigInd, { fillColor: '#FFFFFF', strokeColor: '#222222' })
circleLayer('crater-dot-1', 'Ellipse 2155', moonRigInd, { fillColor: fillOf('Ellipse 2155') })
circleLayer('crater-dot-2', 'Ellipse 2156', moonRigInd, { fillColor: fillOf('Ellipse 2156') })
circleLayer('crater-dot-3', 'Ellipse 2157', moonRigInd, { fillColor: fillOf('Ellipse 2157') })

// ============================================================
// Reorder to front-to-back paint order (source SVG document order, reversed,
// with the occupant-face/matte pair inserted directly in front of the shell
// they clip, per the canonical recipe-character-rig.md order: eyes, matte,
// occupant-mass, then shell).
// ============================================================
const FRONT_TO_BACK = [
  'crater-dot-3', 'crater-dot-2', 'crater-dot-1',
  'crater-3', 'crater-2', 'crater-1', 'moon-disc', 'moon-rig',
  'shine-lower-cap',
  'bead-ring-outer', 'bead-ring-inner',
  'trail-cord', 'trail-cord-rig',
  'frame-ladder',
  'bead-pill-stripe2', 'bead-pill-stripe1', 'bead-pill-outline', 'bead-pill', 'bead-pill-rig',
  'tag', 'tag-rig',
  'shine-lower-trim', 'shine-lower-sweep',
  'shine-comma', 'ring', 'eye-right', 'eye-left', 'body-mass__matte', 'occupant-face', 'occupant-rig',
  'body-mass', 'mascot-breathe', 'mascot-rig',
  'frame', 'frame-rig',
  'trail-small', 'trail-large',
  'bubble-plate', 'bubble-text', 'bubble-anchor',
]
layers.sort((a, b) => FRONT_TO_BACK.indexOf(a.nm) - FRONT_TO_BACK.indexOf(b.nm))
const unplaced = layers.filter((l) => !FRONT_TO_BACK.includes(l.nm))
if (unplaced.length) throw new Error('Unplaced layers in paint order: ' + unplaced.map((l) => l.nm).join(', '))

const doc = {
  v: '5.9.0', fr: FPS, ip: 0, op: OP, w: W, h: H, nm: 'Live Onboarding Companion (uto8)',
  ddd: 0,
  assets: [],
  layers,
  markers: [
    { cm: 'intro', tm: 0, dr: T },
    { cm: 'loop', tm: T, dr: OP - T },
  ],
  fonts: { list: [{ fName: 'Nunito-Bold', fFamily: 'Nunito', fStyle: 'Bold', ascent: 75 }] },
  slots: {
    'bubble.text': { p: { k: [{ s: textDoc(DEFAULT_STRING), t: 0 }] } },
    'bubble.size': { p: { a: 0, k: [PLATE_DEFAULT_W, PLATE_DEFAULT_H] } },
    'bubble.textPos': { p: { a: 0, k: [0, BASELINE_LOCAL, 0] } },
    'bubble.anchor': { p: { a: 0, k: [0, PLATE_DEFAULT_H / 2, 0] } },
  },
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT, JSON.stringify(doc, (k, v) => (typeof v === 'number' ? +v.toFixed(3) : v)))
copyFileSync(join(__dirname, '../assets/fonts/Nunito-Bold.ttf'), join(OUT_DIR, 'Nunito-Bold.ttf'))
const totalKeyframes = layers.reduce((sum, l) => {
  let n = 0
  for (const prop of [l.ks?.p, l.ks?.s, l.ks?.o, l.ks?.a, l.ks?.r]) if (prop?.a === 1) n += prop.k.length
  for (const shape of l.shapes ? [l.shapes[0].it[0]] : []) if (shape?.ks?.a === 1) n += shape.ks.k.length
  return sum + n
}, 0)
console.log(`Wrote ${OUT} — ${layers.length} layers, ${totalKeyframes} animated keyframes, T=${T}/IDLE=${IDLE}/OP=${OP} @ ${FPS}fps`)

// Area-conservation report for the two calibrated morph fields.
{
  const bodyBase = polygonArea(bodySub.v)
  const bodyHi = polygonArea(deformSubpath(bodySub, bodyCx, bodyTopY, bodyHeight, 1, BULGE, bodyVertK).v)
  const bodyLo = polygonArea(deformSubpath(bodySub, bodyCx, bodyTopY, bodyHeight, -1, BULGE, bodyVertK).v)
  const faceBase = polygonArea(faceSub.v)
  const faceHi = polygonArea(deformSubpath(faceSub, faceCx, faceTopY, faceHeight, 1, BULGE, faceVertK).v)
  const faceLo = polygonArea(deformSubpath(faceSub, faceCx, faceTopY, faceHeight, -1, BULGE, faceVertK).v)
  console.log(`Body morph area: base=${bodyBase.toFixed(1)} +1=${bodyHi.toFixed(1)} (${((bodyHi / bodyBase - 1) * 100).toFixed(2)}%) -1=${bodyLo.toFixed(1)} (${((bodyLo / bodyBase - 1) * 100).toFixed(2)}%) vertK=${bodyVertK.toFixed(4)}`)
  console.log(`Face morph area: base=${faceBase.toFixed(1)} +1=${faceHi.toFixed(1)} (${((faceHi / faceBase - 1) * 100).toFixed(2)}%) -1=${faceLo.toFixed(1)} (${((faceLo / faceBase - 1) * 100).toFixed(2)}%) vertK=${faceVertK.toFixed(4)}`)
}

// ── autoFit max: derived from THIS scene's stage margin + pinned geometry ──
const MARGIN = W * 0.03 // 7.2 — Render-Aware Motion safety margin

const PLATE_LEFT = PLATE_CX - PLATE_DEFAULT_W / 2
const PLATE_RIGHT = PLATE_CX + PLATE_DEFAULT_W / 2
const ROOM_GROWING_RIGHT = W - MARGIN - PLATE_LEFT // left edge pinned
const ROOM_GROWING_LEFT = PLATE_RIGHT - MARGIN     // right edge pinned
const GROW = ROOM_GROWING_RIGHT >= ROOM_GROWING_LEFT ? 'right' : 'left'
const STAGE_MAX_W = Math.max(ROOM_GROWING_RIGHT, ROOM_GROWING_LEFT)

const READABLE_MAX_W = 1.5 * PLATE_DEFAULT_W
const AUTOFIT_MAX_W = Math.min(STAGE_MAX_W, READABLE_MAX_W)
const maxLinesFit = Math.floor((PLATE_BOTTOM - MARGIN - PAD_Y * 2) / LINE_HEIGHT)
const AUTOFIT_MAX_H = Math.max(1, maxLinesFit) * LINE_HEIGHT + 2 * PAD_Y

const controls = {
  controls: [
    { sid: 'bubble.text', label: 'Bubble text' },
    { sid: 'bubble.size', label: 'Bubble size', autoFit: { text: 'bubble.text', padding: [PAD_X, PAD_Y], min: [90, PLATE_DEFAULT_H], max: [AUTOFIT_MAX_W, AUTOFIT_MAX_H], leading: LEADING, grow: GROW } },
    { sid: 'bubble.textPos', label: 'Bubble text position', internal: true },
    { sid: 'bubble.anchor', label: 'Bubble anchor', internal: true },
  ],
  layerControls: [
    { target: 'mascot-rig', kind: 'amount', property: 'rotation', label: 'Helmet sway', description: 'How far the helmet tilts as it floats in zero gravity.' },
    { target: 'mascot-rig', kind: 'amount', property: 'position', label: 'Float drift', description: 'How far the mascot drifts against the frame each cycle.' },
    { target: 'occupant-rig', kind: 'amount', property: 'position', label: 'Inner float', description: 'How much the mascot’s body drifts inside its own helmet, separate from the shell.' },
    { target: 'moon-rig', kind: 'amount', property: 'position', label: 'Moon parallax', description: 'How far the moon drifts opposite the mascot.' },
    { target: 'bubble-anchor', kind: 'amount', property: 'scale', label: 'Bubble pop', description: 'How much the speech bubble overshoots as it arrives.' },
  ],
}
writeFileSync(join(OUT_DIR, 'controls.json'), JSON.stringify(controls, null, 2))
console.log(`Wrote ${join(OUT_DIR, 'controls.json')} — autoFit max=[${AUTOFIT_MAX_W},${AUTOFIT_MAX_H}] grow=${GROW} (stage allows ${STAGE_MAX_W.toFixed(1)}, readable cap ${READABLE_MAX_W}; maxLinesFit=${maxLinesFit})`)
