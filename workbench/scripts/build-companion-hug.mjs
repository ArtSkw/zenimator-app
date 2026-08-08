#!/usr/bin/env node
/**
 * Generates the INTRO+LOOP Lottie for "companion-hug.svg" — a live onboarding
 * companion: the mascot hugs its heart-marked pillow while a speech bubble
 * above it says its line, once, then settles into an endless hug-breathe idle.
 * Output: public/projects/companion-hug/scene-1/lottie.json
 *
 * Source SVG groups mapped to layers:
 *  - "Tooltip/Compact" rect -> bubble plate (rc primitive, slotted size)
 *  - baked "font" glyph path -> REPLACED with a native ty:5 text layer
 *    (slot bubble.text), per recipe-companion-bubble.md
 *  - Ellipse 2420 / 2421 -> the two trail circles (the tail-equivalent —
 *    this source has no separate tail triangle, the brief names the circles
 *    as the trail/tail that the bubble grows from)
 *  - Group 1000007767 -> mascot + pillow:
 *      Ellipse 324        -> paw (peeks from behind, painted before body/pillow)
 *      body / face / Vector 1 / Vector 2 -> mascot head (body, face patch,
 *        left eye, right eye — closed happy-arc eyes)
 *      "charity stone" (+ "_2") -> pillow fill/stroke + its white crease lines
 *      "Union" -> the heart mark on the pillow (first of the two near-duplicate
 *        paths used; the second is the source's stroke-expanded-to-fill twin,
 *        redundant at this scale)
 *      Ellipse 325 -> arm-ring (the visible hugging arm, painted OVER the body
 *        and pillow in the source, confirming it's the foreground "arm" wrap)
 *      Vector 1012 -> arm-crease (secondary highlight, kept static — motion
 *        economy: only the ring + paw carry the "tightening" read)
 *  - "Fill 11" (raster <pattern> diagonal-hatch shadow) -> REVECTORIZED as a
 *    diagonal stroke hatch clipped to the same pill silhouette via a track
 *    matte (see svg-compatibility.md "Masks, Clips, Gradients, Patterns" —
 *    never flatten a pattern fill to a solid). It breathes as ONE piece
 *    (matte + hatch share a parent null), which is exactly the desired
 *    look — the texture never needs to move independently of its clip here.
 *
 * Rig: a "body-rig" null (pivot at the body's contact edge with the pillow,
 * ~[191,147]) parents body/face/eye-left/eye-right so the whole head presses
 * into the pillow as one piece each idle cycle; eyes get their own additional
 * own-center scaleY dip on top (character-rig recipe's blink idiom). The
 * pillow itself is a steady island (unparented, unanimated) — only the ring
 * + paw sell "arms tightening", 2 frames after the body's squeeze onset per
 * the brief. The bubble is a single "bubble-anchor" null anchored at the
 * plate's bottom-center (near the trail) so its intro pop scales UP FROM the
 * trail chain instead of from its own center; plate + text are parented to
 * it (text "fades in WITH the plate as one unit" per the recipe — no
 * per-glyph animation).
 */
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../public/projects/companion-hug/scene-1')
const OUT = join(OUT_DIR, 'lottie.json')

const W = 240, H = 240, FPS = 60
const T = 72        // 1.2s intro
const IDLE = 120     // 2.0s hug-breathe cycle
const OP = T + IDLE  // 192 total

// ── SVG path -> Lottie bezier (house parser, unchanged across scripts) ─────
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

// ── Raw path data lifted from companion-hug.svg (viewBox 0 0 240 240) ──────
const SVG_PATHS = {
  body: 'M142.806 98.5898C169.76 98.5898 191.611 120.441 191.611 147.395C191.611 174.35 169.76 196.201 142.806 196.201C115.851 196.201 94 174.35 94 147.395C94 120.441 115.851 98.5898 142.806 98.5898Z',
  face: 'M110.366 143.143C114.589 157.949 128.484 155.043 147.518 149.614C166.551 144.184 178.544 139.102 174.48 124.854C170.416 110.607 154.976 102.021 135.524 107.569C116.072 113.118 106.142 128.337 110.366 143.143Z',
  eyeLeft: 'M145.646 128.329C143.44 133.335 138.394 132.221 136.148 131.039',
  eyeRight: 'M150.958 126.818C155.473 129.907 159.172 126.299 160.456 124.109',
  pillow: 'M151.662 137.743C154.098 136.666 156.826 135.896 159.735 135.144C162.568 134.412 165.649 133.682 168.442 132.711L168.514 132.685L168.586 132.656C171.431 131.49 174.31 129.92 177.004 128.512C179.768 127.068 182.4 125.758 185.027 124.888C187.631 124.025 190.107 123.639 192.543 123.955C194.949 124.267 197.511 125.288 200.267 127.55L200.274 127.556L200.281 127.562C202.441 129.313 204.284 133.219 205.279 138.982C206.248 144.594 206.314 151.402 205.456 158.23C204.598 165.061 202.833 171.763 200.244 177.193C197.65 182.636 194.396 186.459 190.733 188.166C190.52 188.246 190.305 188.32 190.082 188.386L190.013 188.406L189.946 188.43L189.609 188.541C186.088 189.64 181.39 189.148 176.026 187.12C170.555 185.052 164.757 181.519 159.511 177.182C154.267 172.846 149.688 167.799 146.587 162.789C143.461 157.74 142.037 153.061 142.499 149.307C143.02 145.998 144.187 143.661 145.696 141.911C147.231 140.131 149.245 138.811 151.662 137.743Z',
  pillowCrease: 'M208.514 156.269C209.205 149.101 208.918 142.024 207.625 136.303M169.082 187.043C164.795 184.756 160.534 181.799 156.64 178.453',
  heart: 'M187.944 139.627C191.114 138.405 194.564 139.699 195.651 142.516C195.651 142.517 195.651 142.519 195.651 142.52L195.653 142.52C198.096 148.859 191.057 164.8 188.187 165.907C185.357 166.998 169.861 160.177 167.065 153.848C167.025 153.76 166.988 153.67 166.953 153.578C165.867 150.761 167.556 147.486 170.726 146.264C173.896 145.042 177.345 146.336 178.431 149.154C178.7 149.85 178.797 150.575 178.746 151.289L182.287 150.601L185.371 148.736C184.853 148.241 184.44 147.638 184.171 146.941C183.085 144.124 184.775 140.849 187.944 139.627Z',
  armRing: 'M144.961 180.192C150.945 182.552 157.709 179.615 160.069 173.631C162.429 167.648 159.492 160.884 153.508 158.524C147.525 156.163 140.76 159.101 138.4 165.084',
  armCrease: 'M147.242 151.837C147.242 150.391 147.347 149.104 147.548 147.955M175.527 131.871C164.014 138.071 152.854 136.492 148.823 144.072',
  shadow: 'M109.653 217.593C109.653 222.074 132.203 225.706 160.019 225.706C187.836 225.706 210.387 222.074 210.387 217.593C210.387 213.113 187.836 209.48 160.019 209.48C132.203 209.48 109.653 213.113 109.653 217.593Z',
}

// ── Lottie builder helpers (house pattern) ──────────────────────────────────
const hexToRgb1 = (hex) => {
  hex = hex.replace('#', '')
  return [parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255]
}

const EASE = {
  linear: [0, 0, 1, 1],
  entranceSharp: [0.20, 0.75, 0.34, 0.94],
  settleSoft: [0.00, 0.65, 0.51, 0.99],
  travelBalanced: [1.00, 0.49, 0.00, 0.55],
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

// Plain range track: keyframes exactly where authored, no forced t=0 —
// Skottie holds a property at its first keyframe's value for every earlier
// frame, which is exactly "static until this starts" for intro pops and
// "static through the intro, then idles" for the T..op rig tracks.
function animProp(points) {
  const keys = points.map((p, idx) => {
    const isLast = idx === points.length - 1
    return kf(p.t, p.v, isLast ? null : (EASE[p.ease] || EASE.linear))
  })
  return { a: 1, k: keys }
}

function shapeFromSubpath(sp, nm) {
  return { ty: 'sh', nm, ks: { a: 0, k: { c: sp.closed, v: sp.v, i: sp.i, o: sp.o } } }
}
function fillItem(colorHex, opacity = 100, nm = 'Fill') {
  const [r, g, b] = hexToRgb1(colorHex)
  return { ty: 'fl', nm, o: { a: 0, k: opacity }, c: { a: 0, k: [r, g, b, 1] }, r: 1 }
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

function baseTransform({ a = [0, 0, 0], p = [0, 0, 0], s = [100, 100, 100], o = 100 } = {}) {
  return { a: { a: 0, k: a }, p: { a: 0, k: p }, s: { a: 0, k: s }, r: { a: 0, k: 0 }, o: { a: 0, k: o } }
}
function animTransform({ a = [0, 0, 0], p = [0, 0, 0], sProp, oProp, o = 100 } = {}) {
  return { a: { a: 0, k: a }, p: { a: 0, k: p }, s: sProp || { a: 0, k: [100, 100, 100] }, r: { a: 0, k: 0 }, o: oProp || { a: 0, k: o } }
}

let ind = 1
const layers = []
function pushLayer({ nm, shapes, ks, parent, ty, textData, w, h, refId, tt, td }) {
  const l = { ddd: 0, ind: ind, nm, sr: 1, ks, ao: 0, ip: 0, op: OP, st: 0, bm: 0 }
  if (ty === 5) { l.ty = 5; l.t = textData }
  else if (refId) { l.ty = 0; l.refId = refId; l.w = w; l.h = h }
  else if (ty === 3) { l.ty = 3 }
  else { l.ty = 4; l.shapes = shapes }
  if (parent) l.parent = parent
  if (tt) l.tt = tt
  if (td) l.td = 1
  layers.push(l)
  ind++
  return l.ind
}

// ============================================================
// BUBBLE — plate (slotted size) + native text, one entrance unit
// ============================================================
const PLATE_DEFAULT_W = 208, PLATE_DEFAULT_H = 35, PLATE_R = 17.5
const PLATE_CX = 118, PLATE_TOP = 14, PLATE_BOTTOM = 49 // = 14 + 35

const FONT_SIZE = 17
const CAP_EM = 0.7 // fallback cap-height ratio (player-contract "Vector Text Vertical Placement")
const BASELINE_LOCAL = (CAP_EM * FONT_SIZE) / 2 // baseline below plate's local center

const DEFAULT_STRING = 'You’re off to a great start.'
function textDoc(str) {
  return {
    s: FONT_SIZE,
    f: 'Nunito',
    t: str,
    j: 2,
    tr: 0,
    lh: Math.round(FONT_SIZE * 1.25),
    ls: 0,
    fc: hexToRgb1('#222222'),
  }
}

// Bubble pop-in: grows from the trail (anchor pinned at plate bottom-center),
// soft overshoot, fully settled well before T=72.
const BUBBLE_POP = [
  { t: 18, v: 0, ease: 'entranceSharp' },
  { t: 40, v: 108, ease: 'settleSoft' },
  { t: 58, v: 100 },
]
const BUBBLE_OPACITY = [
  { t: 18, v: 0, ease: 'entranceSharp' },
  { t: 30, v: 100 },
]

const bubbleAnchorInd = pushLayer({
  nm: 'bubble-anchor',
  ty: 3,
  ks: {
    // local origin (0,0) is the plate CENTER; anchor at the plate's local
    // bottom-center (0, +H/2) so position [PLATE_CX, PLATE_BOTTOM] pins that
    // point in place while scale grows the plate upward from the trail.
    a: { a: 0, k: [0, PLATE_DEFAULT_H / 2, 0] },
    p: { a: 0, k: [PLATE_CX, PLATE_BOTTOM, 0] },
    s: animProp(BUBBLE_POP.map((p) => ({ ...p, v: [p.v, p.v, 100] }))),
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
  ks.o = animProp(BUBBLE_OPACITY)
  pushLayer({ nm: 'bubble-plate', shapes, ks, parent: bubbleAnchorInd })
}
{
  const doc = textDoc(DEFAULT_STRING)
  // Text layers in this Skottie build don't pick up an ancestor's animated
  // scale the way shape layers do (confirmed by preview: parented text
  // rendered full-size while the parent was still scaling in) — so the pop
  // is duplicated here as the text's OWN scale, pivoting at its own baseline
  // point (anchor == position == passthrough at rest), riding on top of the
  // parent's position offset (which DOES compose correctly).
  const ks = baseTransform({ a: [0, BASELINE_LOCAL, 0], p: [0, BASELINE_LOCAL, 0] })
  ks.s = animProp(BUBBLE_POP.map((p) => ({ ...p, v: [p.v, p.v, 100] })))
  ks.o = animProp(BUBBLE_OPACITY)
  const textData = {
    d: { k: [{ s: doc, t: 0 }], sid: 'bubble.text' },
    p: {},
    m: { g: 1, a: { a: 0, k: [0, 0] } },
    a: [],
  }
  pushLayer({ nm: 'bubble-text', ty: 5, textData, ks, parent: bubbleAnchorInd })
}

// ============================================================
// TRAIL — Ellipse 2421 (smallest, nearest the mouth) pops first, then 2420
// ============================================================
function trailCircle(nm, cx, cy, r, points) {
  const shapes = [group(nm, [
    { ty: 'el', nm: `${nm}-el`, p: { a: 0, k: [0, 0] }, s: { a: 0, k: [r * 2, r * 2] } },
    strokeItem('#222222', 1.5),
  ])]
  const ks = baseTransform({ p: [cx, cy, 0] })
  ks.s = animProp(points.map((p) => ({ ...p, v: [p.v, p.v, 100] })))
  ks.o = animProp(points.map((p) => ({ t: p.t, v: p.v > 0 ? 100 : 0, ease: p.ease })))
  pushLayer({ nm, shapes, ks })
}
trailCircle('trail-small', 114, 84, 4, [{ t: 0, v: 0, ease: 'entranceSharp' }, { t: 8, v: 112, ease: 'settleSoft' }, { t: 16, v: 100 }])
trailCircle('trail-large', 102, 66, 8, [{ t: 6, v: 0, ease: 'entranceSharp' }, { t: 16, v: 114, ease: 'settleSoft' }, { t: 26, v: 100 }])

// ============================================================
// MASCOT + PILLOW rig
// ============================================================
const bodySub = parsePath(SVG_PATHS.body)
const bodyBbox = bboxOf(bodySub)
const bodyRigPivot = [bodyBbox[2], bboxCenter(bodyBbox)[1]] // right edge, mid-height — contact side with the pillow

// idle squeeze: press into the pillow at ~40% through the cycle, ease back.
// Value/velocity at t=T and t=OP match exactly (both rest, symmetric ease) —
// the loop-seam discipline the recipe requires.
const SQUEEZE = [
  { t: T, v: [100, 100], ease: 'travelBalanced' },
  { t: T + 45, v: [96, 103], ease: 'travelBalanced' },
  { t: OP, v: [100, 100] },
]
const bodyRigInd = pushLayer({
  nm: 'body-rig',
  ty: 3,
  ks: {
    a: { a: 0, k: [bodyRigPivot[0], bodyRigPivot[1], 0] },
    p: { a: 0, k: [bodyRigPivot[0], bodyRigPivot[1], 0] },
    s: animProp(SQUEEZE.map((p) => ({ ...p, v: [...p.v, 100] }))),
    r: { a: 0, k: 0 },
    o: { a: 0, k: 100 },
  },
})

function staticShapeLayer(nm, d, paintItems, parent) {
  const subs = parsePath(d)
  const items = subs.map((s, i) => shapeFromSubpath(s, `${nm}-${i}`))
  const shapes = [group(nm, [...items, ...paintItems])]
  pushLayer({ nm, shapes, ks: baseTransform(), parent })
}

staticShapeLayer('face', SVG_PATHS.face, [fillItem('#FFFFFF')], bodyRigInd)

// eyes: parented to body-rig (ride the squeeze) PLUS their own subtle
// own-center scaleY arc dip at the same beat — character-rig's blink idiom.
function eyeLayer(nm, d) {
  const subs = parsePath(d)
  const c = bboxCenter(bboxOf(subs))
  const items = subs.map((s, i) => shapeFromSubpath(s, `${nm}-${i}`))
  const shapes = [group(nm, [...items, strokeItem('#222222', 3.32764)])]
  const ks = {
    a: { a: 0, k: [c[0], c[1], 0] },
    p: { a: 0, k: [c[0], c[1], 0] },
    s: animProp([
      { t: T, v: [100, 100, 100], ease: 'travelBalanced' },
      { t: T + 45, v: [104, 86, 100], ease: 'travelBalanced' },
      { t: OP, v: [100, 100, 100] },
    ]),
    r: { a: 0, k: 0 },
    o: { a: 0, k: 100 },
  }
  pushLayer({ nm, shapes, ks, parent: bodyRigInd })
}
eyeLayer('eye-right', SVG_PATHS.eyeRight)
eyeLayer('eye-left', SVG_PATHS.eyeLeft)

staticShapeLayer('body', SVG_PATHS.body, [fillItem('#222222')], bodyRigInd)

// arm-crease: static texture on the pillow, no rig.
staticShapeLayer('arm-crease', SVG_PATHS.armCrease, [strokeItem('#FFFFFF', 2.21843, 100, 'Stroke', 2, 1)])

// arm-ring: the visible hugging arm — tightens ~2 frames after the body's
// squeeze onset (the brief's "2 frames of overlap").
{
  const subs = parsePath(SVG_PATHS.armRing)
  const c = bboxCenter(bboxOf(subs))
  const items = subs.map((s, i) => shapeFromSubpath(s, `arm-ring-${i}`))
  const shapes = [group('arm-ring', [...items, strokeItem('#FFFFFF', 2.21842)])]
  const ks = {
    a: { a: 0, k: [c[0], c[1], 0] },
    p: { a: 0, k: [c[0], c[1], 0] },
    s: animProp([
      { t: T + 2, v: [100, 100, 100], ease: 'travelBalanced' },
      { t: T + 47, v: [94, 94, 100], ease: 'travelBalanced' },
      { t: OP, v: [100, 100, 100] },
    ]),
    r: { a: 0, k: 0 },
    o: { a: 0, k: 100 },
  }
  pushLayer({ nm: 'arm-ring', shapes, ks })
}

// heart mark + pillow crease: static, part of the pillow's steady island.
staticShapeLayer('heart', SVG_PATHS.heart, [fillItem('#FFFFFF')])
staticShapeLayer('pillow-crease', SVG_PATHS.pillowCrease, [strokeItem('#FFFFFF', 2.21843, 100, 'Stroke', 2, 1)])
staticShapeLayer('pillow', SVG_PATHS.pillow, [fillItem('#222222'), strokeItem('#222222', 5.6469, 100, 'Stroke', 0, 0)])

// paw: peeks from behind, tightens its grip in step with the arm-ring.
{
  const cx = 205.118, cy = 146.481, r = 11.6467
  const shapes = [group('paw', [
    { ty: 'el', nm: 'paw-el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [r * 2, r * 2] } },
    fillItem('#222222'),
  ])]
  const ks = baseTransform({ a: [cx, cy, 0], p: [cx, cy, 0] })
  ks.s = animProp([
    { t: T + 2, v: [100, 100, 100], ease: 'travelBalanced' },
    { t: T + 47, v: [97, 97, 100], ease: 'travelBalanced' },
    { t: OP, v: [100, 100, 100] },
  ])
  pushLayer({ nm: 'paw', shapes, ks })
}

// ============================================================
// SHADOW — revectorized diagonal hatch (source is a raster <pattern>),
// clipped to the true silhouette via track matte, breathing as one piece
// opposite the body: widest exactly when the body squeeze is deepest.
// ============================================================
const shadowSub = parsePath(SVG_PATHS.shadow)
const shadowBbox = bboxOf(shadowSub)
const shadowCenter = bboxCenter(shadowBbox)

const shadowRigInd = pushLayer({
  nm: 'shadow-rig',
  ty: 3,
  ks: {
    a: { a: 0, k: [shadowCenter[0], shadowCenter[1], 0] },
    p: { a: 0, k: [shadowCenter[0], shadowCenter[1], 0] },
    s: animProp([
      { t: T, v: [100, 100, 100], ease: 'travelBalanced' },
      { t: T + 45, v: [106, 102, 100], ease: 'travelBalanced' },
      { t: OP, v: [100, 100, 100] },
    ]),
    r: { a: 0, k: 0 },
    o: { a: 0, k: 100 },
  },
})

// matte source: the true pill silhouette, filled white.
{
  const items = shadowSub.map((s, i) => shapeFromSubpath(s, `shadow__matte-${i}`))
  const shapes = [group('shadow__matte', [...items, fillItem('#FFFFFF')])]
  pushLayer({ nm: 'shadow__matte', shapes, ks: baseTransform(), parent: shadowRigInd, td: true })
}
// hatch: parallel 45deg strokes ("/" direction) spanning the bbox with
// margin, spaced to match the source texture's ~4.4px period, matted to the
// pill above. fill-opacity 0.15 in the source -> stroke opacity 15.
{
  const margin = 16
  const xMin = shadowBbox[0] - margin, xMax = shadowBbox[2] + margin
  const yMin = shadowBbox[1] - margin, yMax = shadowBbox[3] + margin
  const spacing = 4.4
  const cMin = xMin - yMax, cMax = xMax - yMin
  const items = []
  let li = 0
  for (let c = cMin; c <= cMax; c += spacing) {
    const p0 = [xMin, xMin - c]
    const p1 = [xMax, xMax - c]
    items.push({ ty: 'sh', nm: `hatch-${li++}`, ks: { a: 0, k: { c: false, v: [p0, p1], i: [[0, 0], [0, 0]], o: [[0, 0], [0, 0]] } } })
  }
  items.push(strokeItem('#222222', 1.4, 15))
  const shapes = [group('shadow', items)]
  pushLayer({ nm: 'shadow', shapes, ks: baseTransform(), parent: shadowRigInd, tt: 1 })
}

// ============================================================
// Reorder to front-to-back paint order.
// ============================================================
const FRONT_TO_BACK = [
  'bubble-plate', 'bubble-text', 'bubble-anchor',
  'trail-large', 'trail-small',
  'arm-crease', 'arm-ring',
  'heart', 'pillow-crease', 'pillow',
  'eye-right', 'eye-left', 'face', 'body', 'body-rig',
  'paw',
  'shadow__matte', 'shadow', 'shadow-rig',
]
layers.sort((a, b) => FRONT_TO_BACK.indexOf(a.nm) - FRONT_TO_BACK.indexOf(b.nm))

const doc = {
  v: '5.9.0', fr: FPS, ip: 0, op: OP, w: W, h: H, nm: 'Companion Hug',
  ddd: 0,
  assets: [],
  layers,
  markers: [
    { cm: 'intro', tm: 0, dr: T },
    { cm: 'loop', tm: T, dr: OP - T },
  ],
  fonts: { list: [{ fName: 'Nunito', fFamily: 'Nunito', fStyle: 'Regular', ascent: 75 }] },
  slots: {
    'bubble.text': { p: { k: [{ s: textDoc(DEFAULT_STRING), t: 0 }] } },
    'bubble.size': { p: { a: 0, k: [PLATE_DEFAULT_W, PLATE_DEFAULT_H] } },
  },
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT, JSON.stringify(doc))
console.log(`Wrote ${OUT} — ${layers.length} layers, ${OP}f @ ${FPS}fps (intro ${T}f / loop ${OP - T}f)`)

const controls = {
  controls: [
    { sid: 'bubble.text', label: 'Bubble text' },
    { sid: 'bubble.size', label: 'Bubble size', autoFit: { text: 'bubble.text', padding: [17, 11], min: [90, 40] } },
  ],
  layerControls: [
    { target: 'body-rig', kind: 'amount', property: 'scale', label: 'Hug squeeze', description: 'How deeply the mascot presses into the pillow each breath.' },
    { target: 'bubble-anchor', kind: 'amount', property: 'scale', label: 'Bubble pop', description: 'How much the speech bubble overshoots as it arrives.' },
  ],
}
writeFileSync(join(OUT_DIR, 'controls.json'), JSON.stringify(controls, null, 2))
console.log(`Wrote ${join(OUT_DIR, 'controls.json')}`)
