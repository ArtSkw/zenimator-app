#!/usr/bin/env node
/**
 * Generates the INTRO+LOOP Lottie for "live-onboarding-companion-s51p.svg" —
 * a live onboarding companion: the mascot hugs its heart-marked charity
 * stone (source id="charity stone" — a ZEN client-benefit Stone, not a
 * pillow) while a speech bubble above it says its line once, then settles
 * into an endless calm hug-and-breathe idle. Output:
 * public/projects/live-onboarding-companion-s51p/scene-1/lottie.json
 *
 * SECOND PASS (see docs/live-onboarding-companion-s51p-animation.md "Second
 * pass" for the full measured writeup): fixed four defects found by review —
 * (1) bubble-text double-animated the entrance pop on top of its parent
 * bubble-anchor, compositing to 125.4% instead of 112%; (2) bubble-text's
 * anchor and position were both set to the same point, a "hidden zero" that
 * silently cancelled the vertical-centering offset regardless of its value;
 * (3) the charity stone and every arm part were unparented and mostly
 * static — a held object glued to the background instead of moving with the
 * hug; (4) the stone/pillow naming didn't match the source, and the heart
 * was built from only one of the source's two stacked paths (too small).
 *
 * Source SVG is BYTE-IDENTICAL to assets/companion-hug.svg (confirmed via
 * diff) — same rig, same "mascot hugs heart-marked pillow" pose. This script
 * reuses that scene's confirmed element map and paint order (see
 * docs/companion-hug-animation.md) but is NOT a mechanical port: per the
 * generation contract, every published constant below was re-derived against
 * the CURRENT skill references rather than carried over, because
 * companion-hug.mjs (2026-08-05) predates several house-standard updates
 * that later scenes (live-onboarding-companion-svmt.mjs etc, 2026-08-07)
 * already carry. Differences from the old script, and why:
 *
 *  - Font: companion-hug.mjs used "Nunito" Regular at size 17. The current
 *    recipe requires the BOLD static for bubble text (fName must equal the
 *    shipped weight file's basename) and the ZEN tooltip spec is Nunito Bold
 *    15px / line-height 19 — this script ships Nunito-Bold.ttf and uses
 *    FONT_SIZE=15/LINE_HEIGHT=19, not the old 17.
 *  - Slots: companion-hug.mjs shipped only bubble.text/bubble.size. The
 *    current contract additionally requires bubble.textPos (vertical
 *    centering, since text-doc `ls` is silently ignored by Skottie) and
 *    bubble.anchor (pins the plate's tail-side edge so slot-driven growth
 *    goes away from the trail) — both added here, following the mechanism
 *    proven in live-onboarding-companion-svmt/scene-1/lottie.json.
 *  - autoFit `max`: companion-hug.mjs's controls.json had no `max` at all
 *    (now required). Computed here from this scene's OWN geometry — stage
 *    margin 3% of 240 = 7.2px, plate pinned at PLATE_BOTTOM=49 unmoved from
 *    the source SVG's y=14 rect. That geometry only clears margin for a
 *    single line (49 - 7.2 = 41.8 < the 54px a 2-line plate would need) —
 *    documented honestly as max=[width,35] rather than faking headroom the
 *    composition doesn't have; the recipe's own fallback ("widen toward
 *    max[0] instead of growing taller") is exactly this case.
 *  - Entrance timing: companion-hug.mjs's bubble popped in at t=18 over 40f.
 *    The recipe's HOUSE CONSTANT table (unchanged since, re-read in full
 *    this session) is trail-small 0/20f/10f-opacity/~112%, trail-large
 *    +8/24f/12f/~114%, plate+text +28/54f(900ms)/16f/~112% — this script
 *    uses those exact numbers, sized T=90 (82 settle + 8f buffer) to the
 *    entrance, matching the pattern verified in i8ek/lcjz/svmt.
 *  - Idle richness: companion-hug.mjs's idle was three sparse keyframes per
 *    track over a 120f cycle. The brief calls this scene "the calmest of
 *    the set" (motion-taste's calm/contemplative register: long periods,
 *    floor amplitudes) and the current Living-idles bar requires density
 *    (hundreds of keyframes from a sampled envelope, not dozens of hand
 *    keys), decorative satellites that float instead of freezing after
 *    their entrance, and an idle alive from frame 0 under the intro (the
 *    "echo" technique). This script rebuilds the idle as a dense-sampled
 *    single-pump-per-cycle envelope over a 216f (3.6s) IDLE, echoed
 *    backward so the release tail of a virtual "previous" breath is already
 *    playing out across the whole intro window.
 *
 * Element map (paint order and geometry unchanged from companion-hug —
 * confirmed by the byte-diff, not re-guessed; names fixed in the second pass):
 *  - "Tooltip/Compact" rect -> bubble plate; baked "font" glyph path ->
 *    REPLACED with a native ty:5 text layer (slot bubble.text).
 *  - Ellipse 2420 / 2421 -> trail-large / trail-small (the tail-equivalent;
 *    this source has no separate tail triangle).
 *  - Group 1000007767 -> mascot + the held charity stone:
 *      Ellipse 324        -> paw (peeks from behind, painted before body)
 *      body / face / Vector 1 / Vector 2 -> mascot head (body blob, white
 *        face patch, left eye, right eye — closed, content arcs)
 *      "charity stone" (+ "_2") -> charity-stone fill/stroke + its white
 *        creases (charity-stone-crease) — NOT "pillow", see above
 *      "Union" -> the heart mark on the stone; the source stacks TWO white
 *        paths here (a small inner fill + a larger stroke-expanded outline
 *        of the SAME heart) — both are used, painted as two opaque fills
 *      Ellipse 325 -> arm-ring (the visible hugging arm, painted OVER body
 *        and the stone)
 *      Vector 1012 -> arm-crease (secondary highlight)
 *  - "Fill 11" (raster diagonal-hatch shadow) -> revectorized diagonal
 *    stroke hatch, track-matted to the true pill silhouette, parented to a
 *    shadow-rig null — confirmed-correct paint order (behind everything)
 *    per companion-hug's raw-SVG-render verification, reused as-is since
 *    the geometry is identical.
 *
 * Rig: "body-rig" (pivot at the body's contact edge with the charity stone)
 * parents body/face/eye-left/eye-right — the whole head presses into the
 * stone each breath. Eyes carry an ADDITIONAL own-center scaleY dip on top
 * (deeper arc at the squeeze). "hug-rig" carries the shared arm-tightening
 * motion and parents arm-ring/paw/arm-crease (pure inherit, no own scale —
 * "never animate the same property twice down a parent chain") PLUS
 * "stone-rig", which nests inside hug-rig and adds the held stone's OWN
 * phase-delayed secondary compress, parenting charity-stone/
 * charity-stone-crease/heart so they ride the stone's own deformation
 * ("a held object is part of the body" — see the HUG-RIG + STONE-RIG
 * section below). shadow-rig breathes the OPPOSITE sign of the body's
 * envelope, same timing (widens as the body compresses). trail-small /
 * trail-large float gently on their own clocks once the loop begins, so they
 * read as alive satellites instead of freezing into stickers after their
 * entrance.
 */
import { writeFileSync, mkdirSync, copyFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../public/projects/live-onboarding-companion-s51p/scene-1')
const OUT = join(OUT_DIR, 'lottie.json')

const W = 240, H = 240, FPS = 60

// ── House entrance constants (recipe-companion-bubble.md, re-read in full
// this session, absolute time @ 60fps) ──────────────────────────────────
const TRAIL_SMALL_START = 0, TRAIL_SMALL_DUR = 20, TRAIL_SMALL_OP = 10, TRAIL_SMALL_OVERSHOOT = 112
const TRAIL_LARGE_START = 8, TRAIL_LARGE_DUR = 24, TRAIL_LARGE_OP = 12, TRAIL_LARGE_OVERSHOOT = 114
const BUBBLE_START = 28, BUBBLE_DUR = 54, BUBBLE_OP = 16, BUBBLE_OVERSHOOT = 112
const BUBBLE_SETTLE = BUBBLE_START + BUBBLE_DUR // 82
const T = BUBBLE_SETTLE + 8 // 90 — a few frames after the entrance settles

// ── Idle: one calm hug-breathe per cycle, "the calmest of the set" ───────
const IDLE = 216 // 3.6s — long comfortable period, per motion-taste's calm register
const OP = T + IDLE // 306

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

// ── Raw path data (byte-identical to assets/companion-hug.svg, confirmed
// by diff against assets/live-onboarding-companion-s51p.svg) ─────────────
const SVG_PATHS = {
  body: 'M142.806 98.5898C169.76 98.5898 191.611 120.441 191.611 147.395C191.611 174.35 169.76 196.201 142.806 196.201C115.851 196.201 94 174.35 94 147.395C94 120.441 115.851 98.5898 142.806 98.5898Z',
  face: 'M110.366 143.143C114.589 157.949 128.484 155.043 147.518 149.614C166.551 144.184 178.544 139.102 174.48 124.854C170.416 110.607 154.976 102.021 135.524 107.569C116.072 113.118 106.142 128.337 110.366 143.143Z',
  eyeLeft: 'M145.646 128.329C143.44 133.335 138.394 132.221 136.148 131.039',
  eyeRight: 'M150.958 126.818C155.473 129.907 159.172 126.299 160.456 124.109',
  // Source names this element "charity stone" (id="charity stone" in the
  // SVG) — a ZEN client-benefit Stone, not a pillow. Renamed from the old
  // `pillow`/`pillowCrease` keys so the cast reads truthfully.
  charityStone: 'M151.662 137.743C154.098 136.666 156.826 135.896 159.735 135.144C162.568 134.412 165.649 133.682 168.442 132.711L168.514 132.685L168.586 132.656C171.431 131.49 174.31 129.92 177.004 128.512C179.768 127.068 182.4 125.758 185.027 124.888C187.631 124.025 190.107 123.639 192.543 123.955C194.949 124.267 197.511 125.288 200.267 127.55L200.274 127.556L200.281 127.562C202.441 129.313 204.284 133.219 205.279 138.982C206.248 144.594 206.314 151.402 205.456 158.23C204.598 165.061 202.833 171.763 200.244 177.193C197.65 182.636 194.396 186.459 190.733 188.166C190.52 188.246 190.305 188.32 190.082 188.386L190.013 188.406L189.946 188.43L189.609 188.541C186.088 189.64 181.39 189.148 176.026 187.12C170.555 185.052 164.757 181.519 159.511 177.182C154.267 172.846 149.688 167.799 146.587 162.789C143.461 157.74 142.037 153.061 142.499 149.307C143.02 145.998 144.187 143.661 145.696 141.911C147.231 140.131 149.245 138.811 151.662 137.743Z',
  charityStoneCrease: 'M208.514 156.269C209.205 149.101 208.918 142.024 207.625 136.303M169.082 187.043C164.795 184.756 160.534 181.799 156.64 178.453',
  // Source path index 7 (of the SVG's flat path list): the heart itself,
  // ONE closed subpath, 10 curve commands, white fill — bbox ~166,138 to
  // 198,167. The SVG's <g id="Union"> also stacks a path index 8 alongside
  // it: that SAME heart's stroke, already expanded to 26 filled outline
  // fragments by Figma's export (bbox ~163,135 to 199,169 — slightly larger
  // all round, as an outlined stroke straddling the fill boundary would be).
  // A previous pass imported both wholesale as two separate fills; rebuilt
  // to use ONLY this path plus a real Lottie stroke at the source width
  // instead — see the `heart` layer below for the fitted width and why.
  heartInner: 'M187.944 139.627C191.114 138.405 194.564 139.699 195.651 142.516C195.651 142.517 195.651 142.519 195.651 142.52L195.653 142.52C198.096 148.859 191.057 164.8 188.187 165.907C185.357 166.998 169.861 160.177 167.065 153.848C167.025 153.76 166.988 153.67 166.953 153.578C165.867 150.761 167.556 147.486 170.726 146.264C173.896 145.042 177.345 146.336 178.431 149.154C178.7 149.85 178.797 150.575 178.746 151.289L182.287 150.601L185.371 148.736C184.853 148.241 184.44 147.638 184.171 146.941C183.085 144.124 184.775 140.849 187.944 139.627Z',
  armRing: 'M144.961 180.192C150.945 182.552 157.709 179.615 160.069 173.631C162.429 167.648 159.492 160.884 153.508 158.524C147.525 156.163 140.76 159.101 138.4 165.084',
  armCrease: 'M147.242 151.837C147.242 150.391 147.347 149.104 147.548 147.955M175.527 131.871C164.014 138.071 152.854 136.492 148.823 144.072',
  shadow: 'M109.653 217.593C109.653 222.074 132.203 225.706 160.019 225.706C187.836 225.706 210.387 222.074 210.387 217.593C210.387 213.113 187.836 209.48 160.019 209.48C132.203 209.48 109.653 213.113 109.653 217.593Z',
}

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

// Sparse entrance track: keyframes exactly where authored, no forced t=0 —
// Skottie holds a property at its first keyframe's value for every earlier
// frame ("static until this starts" for free).
function animProp(points) {
  const keys = points.map((p, idx) => {
    const isLast = idx === points.length - 1
    return kf(p.t, p.v, isLast ? null : (EASE[p.ease] || EASE.linear))
  })
  return { a: 1, k: keys }
}

// Dense baked track from a sampled point list — every non-terminal point
// gets a LINEAR outgoing tangent, which is indistinguishable from the true
// curve at 1-2 frame sampling density (motion-taste "bake smooth, not
// stepped"). Redundant flat runs are pre-compressed by sampleDense().
function bakedProp(points) {
  const keys = points.map((p, idx) => {
    const isLast = idx === points.length - 1
    return kf(p.t, p.v, isLast ? null : EASE.linear)
  })
  return { a: 1, k: keys }
}

function sampleDense(fn, from, to, step = 2) {
  const pts = []
  for (let t = from; t <= to; t += step) pts.push({ t, v: fn(t) })
  if (pts[pts.length - 1].t !== to) pts.push({ t: to, v: fn(to) })
  // Protect T: compress()'s flat-run collapse would otherwise drop the
  // MIDDLE point at the loop start whenever it sits inside a flat rest
  // (the interpolated value is still correct, but "key exactly on the loop
  // boundaries" per motion-taste is a literal requirement, not just a
  // numeric one — verified by a boundary-key scan, not just a value check).
  return compress(pts, new Set([T]))
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

// ============================================================
// Living-idle envelope system: ONE gentle hug-breathe per IDLE cycle.
// A piecewise smoothstep hump with genuine flat rests bookending it, so the
// "echo" technique (evaluating the same generator at t-IDLE for t<T) lands
// its surviving portion inside real motion during the intro AND inside a
// flat rest by the time it reaches T — alive under the entrance, settled at
// the seam. See docs for the frac-boundary derivation.
// ============================================================
function smoothstep(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x) }

// cf: position within the cycle, 0 = the real cycle's start (t=T).
// Handles t<T (pre-loop / intro) by wrapping backward through the SAME
// generator — this IS the recipe's echo technique, expressed as a modulo.
function cyclePos(t) {
  let cf = (t - T) % IDLE
  if (cf < 0) cf += IDLE
  return cf
}

// Body's own envelope: rest, rise, hold, long gentle release, rest.
// Boundaries in frames-into-cycle (sum = IDLE = 216).
const BODY_B = { rest1: 12, riseEnd: 66, holdEnd: 80, fallEnd: 206 } // rest2 = [206,216]
function bodyEnvelope(cf) {
  if (cf < BODY_B.rest1) return 0
  if (cf < BODY_B.riseEnd) return smoothstep((cf - BODY_B.rest1) / (BODY_B.riseEnd - BODY_B.rest1))
  if (cf < BODY_B.holdEnd) return 1
  if (cf < BODY_B.fallEnd) return 1 - smoothstep((cf - BODY_B.holdEnd) / (BODY_B.fallEnd - BODY_B.holdEnd))
  return 0
}

// Arms/paw: the hug tightening — a follower with its OWN narrower, later
// curve (peaks a few frames after the body), not a time-shifted duplicate.
const ARM_B = { rest1: 20, riseEnd: 70, holdEnd: 84, fallEnd: 206 }
function armEnvelope(cf) {
  if (cf < ARM_B.rest1) return 0
  if (cf < ARM_B.riseEnd) return smoothstep((cf - ARM_B.rest1) / (ARM_B.riseEnd - ARM_B.rest1))
  if (cf < ARM_B.holdEnd) return 1
  if (cf < ARM_B.fallEnd) return 1 - smoothstep((cf - ARM_B.holdEnd) / (ARM_B.fallEnd - ARM_B.holdEnd))
  return 0
}

// The held charity stone: its OWN secondary curve, settling a beat AFTER
// the arms (peak ~8f later than ARM_B's) — motion-taste "a held object is
// part of the body": it inherits the hug via parenting (hug-rig) and THEN
// carries this additional compress-into-the-squeeze on top, not a
// time-shifted duplicate of the arm's own curve.
const STONE_B = { rest1: 28, riseEnd: 78, holdEnd: 92, fallEnd: 206 }
function stoneEnvelope(cf) {
  if (cf < STONE_B.rest1) return 0
  if (cf < STONE_B.riseEnd) return smoothstep((cf - STONE_B.rest1) / (STONE_B.riseEnd - STONE_B.rest1))
  if (cf < STONE_B.holdEnd) return 1
  if (cf < STONE_B.fallEnd) return 1 - smoothstep((cf - STONE_B.holdEnd) / (STONE_B.fallEnd - STONE_B.holdEnd))
  return 0
}

// ============================================================
// BUBBLE — plate (slotted size/anchor) + native Bold text, one entrance unit
// ============================================================
const PLATE_DEFAULT_W = 208, PLATE_DEFAULT_H = 35, PLATE_R = 17.5
const PLATE_CX = 118, PLATE_TOP = 14, PLATE_BOTTOM = 49 // = 14 + 35

const FONT_SIZE = 15
const LINE_HEIGHT = 19
const PAD_X = 16, PAD_Y = 8, LEADING = 2
// Measured via the ISOLATED-layer method (render bubble-text alone and
// bubble-plate alone in throwaway copies, compare ink bounds — a scan of the
// assembled bubble can't see this, the plate's own stroke runs along every
// row/column). The REAL bug: the text layer's `ks.a` and `ks.p` were both
// set to the SAME point (`[0, BASELINE_LOCAL, 0]`) — a "hidden zero", since
// `(local − a) + p` cancels whenever `a == p` regardless of the value, so
// the baseline offset was NEVER applied no matter what BASELINE_LOCAL was
// set to (confirmed: changing it from 5.41 to 9.3 measured identical
// insets). Fixed by leaving `a` at `[0,0,0]` and letting `p` alone carry
// the translation (see the bubble-text layer below). With that fixed,
// 3.9 measured top inset == bottom inset == 12px exactly.
const BASELINE_LOCAL = 3.9

const DEFAULT_STRING = "You're off to a great start."
function textDoc(str, lh = LINE_HEIGHT) {
  return {
    s: FONT_SIZE,
    f: 'Nunito-Bold',
    t: str,
    j: 2,
    tr: 0,
    lh,
    ls: 0,
    fc: hexToRgb1('#222222'),
  }
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
    // Anchor pinned at the plate's local bottom-center (nearest the trail) —
    // slotted so autoFit tooling rewrites y to height/2 on resize, keeping
    // the bottom edge fixed while all growth goes upward, away from the tail.
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
  // ONE node owns the entrance pop — bubble-anchor. Text is parented to it
  // and its scale DOES compose down the chain in this player: giving the
  // text its own matching 112% scale on top of the parent's own 112%
  // composited to 125.4% at the overshoot frame, so the text visibly
  // outgrew its own plate (measured). Text inherits scale through parenting
  // here same as position — no own `ks.s` needed.
  // Anchor stays at [0,0,0] — setting it to the SAME point as `p` (as the
  // previous version did, `a:[0,BASELINE_LOCAL,0]` alongside `p` at that
  // same value) is the "hidden zero": (local − a) + p cancels the offset
  // entirely regardless of the value, which is why the vertical-centering
  // defect measured the SAME insets no matter what BASELINE_LOCAL was set
  // to — the baseline shift was never actually applied. Position alone
  // carries the translation.
  const ks = baseTransform()
  ks.p = { a: 0, k: [0, BASELINE_LOCAL, 0], sid: 'bubble.textPos' }
  ks.o = animProp(bubbleTrack.opacity)
  const textData = {
    d: { k: [{ s: doc, t: 0 }], sid: 'bubble.text' },
    p: {},
    m: { g: 1, a: { a: 0, k: [0, 0] } },
    a: [],
  }
  pushLayer({ nm: 'bubble-text', ty: 5, textData, ks, parent: bubbleAnchorInd })
}

// ============================================================
// TRAIL — pops in (house entrance timing), then floats gently forever
// (satellites don't freeze into stickers once the loop begins).
// ============================================================
function trailCircle(nm, cx, cy, r, entrance, floatPeriod, floatAmp) {
  const shapes = [group(nm, [
    { ty: 'el', nm: `${nm}-el`, p: { a: 0, k: [0, 0] }, s: { a: 0, k: [r * 2, r * 2] } },
    strokeItem('#222222', 1.5),
  ])]
  const ks = baseTransform()
  ks.s = animProp(entrance.scale.map((p) => ({ ...p, v: [p.v, p.v, 100] })))
  ks.o = animProp(entrance.opacity)
  // Position: flat at [cx,cy] through the intro, then a small vertical bob
  // on its own clock once the loop begins — seamed by construction, since
  // floatPeriod divides IDLE exactly (sin(2*pi*k) = 0 at both T and op).
  const posPts = [{ t: 0, v: [cx, cy, 0] }, { t: T, v: [cx, cy, 0] }]
  for (let t = T; t <= OP; t += 2) posPts.push({ t, v: [cx, cy + floatAmp * Math.sin((2 * Math.PI * (t - T)) / floatPeriod), 0] })
  if (posPts[posPts.length - 1].t !== OP) posPts.push({ t: OP, v: [cx, cy, 0] })
  ks.p = bakedProp(compress(posPts))
  pushLayer({ nm, shapes, ks })
}
const trailSmallTrack = entranceTrack(TRAIL_SMALL_START, TRAIL_SMALL_DUR, TRAIL_SMALL_OVERSHOOT, TRAIL_SMALL_OP)
const trailLargeTrack = entranceTrack(TRAIL_LARGE_START, TRAIL_LARGE_DUR, TRAIL_LARGE_OVERSHOOT, TRAIL_LARGE_OP)
trailCircle('trail-small', 114, 84, 4, trailSmallTrack, 54, 1.4)
trailCircle('trail-large', 102, 66, 8, trailLargeTrack, 72, 1.9)

// ============================================================
// MASCOT + PILLOW rig
// ============================================================
const bodySub = parsePath(SVG_PATHS.body)
const bodyBbox = bboxOf(bodySub)
const bodyRigPivot = [bodyBbox[2], bboxCenter(bodyBbox)[1]] // right edge, mid-height — contact side with the charity stone

// Body squeeze: volume-preserving-ish (scaleX shrinks toward the stone's
// contact edge, scaleY widens slightly), dense-sampled from bodyEnvelope.
const AMP_BODY_X = 5, AMP_BODY_Y = 4
const bodyScalePts = sampleDense((t) => {
  const e = bodyEnvelope(cyclePos(t))
  return [100 - AMP_BODY_X * e, 100 + AMP_BODY_Y * e, 100]
}, 0, OP)
const bodyRigInd = pushLayer({
  nm: 'body-rig',
  ty: 3,
  ks: {
    a: { a: 0, k: [bodyRigPivot[0], bodyRigPivot[1], 0] },
    p: { a: 0, k: [bodyRigPivot[0], bodyRigPivot[1], 0] },
    s: bakedProp(bodyScalePts),
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

// eyes: parented to body-rig (ride the squeeze) PLUS their own additional
// own-center scaleY dip at the SAME beat — "arc subtly deeper at the squeeze".
function eyeLayer(nm, d) {
  const subs = parsePath(d)
  const c = bboxCenter(bboxOf(subs))
  const items = subs.map((s, i) => shapeFromSubpath(s, `${nm}-${i}`))
  const shapes = [group(nm, [...items, strokeItem('#222222', 3.32764)])]
  const scalePts = sampleDense((t) => {
    const e = bodyEnvelope(cyclePos(t))
    return [100 + 6 * e, 100 - 16 * e, 100]
  }, 0, OP)
  const ks = {
    a: { a: 0, k: [c[0], c[1], 0] },
    p: { a: 0, k: [c[0], c[1], 0] },
    s: bakedProp(scalePts),
    r: { a: 0, k: 0 },
    o: { a: 0, k: 100 },
  }
  pushLayer({ nm, shapes, ks, parent: bodyRigInd })
}
eyeLayer('eye-right', SVG_PATHS.eyeRight)
eyeLayer('eye-left', SVG_PATHS.eyeLeft)

staticShapeLayer('body', SVG_PATHS.body, [fillItem('#222222')], bodyRigInd)

// ============================================================
// HUG-RIG + STONE-RIG — "a held object is part of the body" (motion-taste).
// The charity stone, its crease, the heart, and every arm part were
// previously UNPARENTED and either static or independently animated — the
// mascot breathed and hugged around an object glued to the composition.
// Fixed rig: hug-rig carries the shared "arms tighten" motion (the same
// amplitude arm-ring alone used to carry) and parents every arm part PLUS
// stone-rig, so the whole embrace — arms, paw, and the held stone — moves
// as one unit. stone-rig then adds the stone's OWN secondary compress,
// phase-delayed (stoneEnvelope peaks ~8f after armEnvelope) so the stone
// settles a beat after the arms, and parents the stone's own parts (so the
// heart and crease ride the deforming stone instead of floating over it).
// ============================================================
const armRingSub = parsePath(SVG_PATHS.armRing)
const charityStoneSub = parsePath(SVG_PATHS.charityStone)
const hugBbox = bboxOf([...armRingSub, ...charityStoneSub])
const hugPivot = bboxCenter(hugBbox)
const hugScalePts = sampleDense((t) => {
  const e = armEnvelope(cyclePos(t))
  return [100 - 9 * e, 100 - 9 * e, 100]
}, 0, OP)
const hugRigInd = pushLayer({
  nm: 'hug-rig',
  ty: 3,
  ks: {
    a: { a: 0, k: [hugPivot[0], hugPivot[1], 0] },
    p: { a: 0, k: [hugPivot[0], hugPivot[1], 0] },
    s: bakedProp(hugScalePts),
    r: { a: 0, k: 0 },
    o: { a: 0, k: 100 },
  },
})

const charityStoneBbox = bboxOf(charityStoneSub)
const stonePivot = [charityStoneBbox[0], bboxCenter(charityStoneBbox)[1]] // contact edge (facing the body/arms), mid-height
const stoneScalePts = sampleDense((t) => {
  const e = stoneEnvelope(cyclePos(t))
  return [100 - 3 * e, 100 - 2 * e, 100]
}, 0, OP)
const stoneRigInd = pushLayer({
  nm: 'stone-rig',
  ty: 3,
  parent: hugRigInd,
  ks: {
    a: { a: 0, k: [stonePivot[0], stonePivot[1], 0] },
    p: { a: 0, k: [stonePivot[0], stonePivot[1], 0] },
    s: bakedProp(stoneScalePts),
    r: { a: 0, k: 0 },
    o: { a: 0, k: 100 },
  },
})

// arm-crease: parented to hug-rig — inherits the embrace, no own accent.
staticShapeLayer('arm-crease', SVG_PATHS.armCrease, [strokeItem('#FFFFFF', 2.21843, 100, 'Stroke', 2, 1)], hugRigInd)

// arm-ring: the visible hugging arm — the tightening curve now lives on
// hug-rig (shared with the paw and the stone it holds), so arm-ring itself
// is static and purely inherits.
{
  const items = armRingSub.map((s, i) => shapeFromSubpath(s, `arm-ring-${i}`))
  const shapes = [group('arm-ring', [...items, strokeItem('#FFFFFF', 2.21842)])]
  pushLayer({ nm: 'arm-ring', shapes, ks: baseTransform(), parent: hugRigInd })
}

// heart: the source's <g id="Union"> stacks path index 7 (the ONE clean
// heart shape, 10 curves, white fill) with path index 8 — that SAME heart's
// stroke, already expanded to 26 filled outline fragments by Figma's SVG
// export (white fill, bbox ~2-3px larger all round, as an outlined stroke
// straddling the fill boundary would be). A previous pass imported both
// paths wholesale as two separate fills — visually close, but importing 27
// subpaths / 189 vertices to approximate what is really "one shape plus its
// own stroke" is fragile (any future edit that repositions/rescales the
// heart has to keep two divergent path sets in sync) and measured ~2px off
// the true bbox on inspection. Rebuilt as the simpler, exact equivalent:
// path 7 alone, filled AND given a real stroke at the source width. Width
// 5.6469 (a value already used elsewhere in this SVG, for "charity stone"'s
// own outline) was found by fitting candidate widths against a rasterized
// ground truth of path 7 + path 8 together — 5.6469 matches to ~1.3px over
// the whole heart (vs 90-200px for other candidates), i.e. the design
// reused the stone's own stroke weight for the heart mark on it.
{
  const heartSubs = parsePath(SVG_PATHS.heartInner)
  const items = heartSubs.map((s, i) => shapeFromSubpath(s, `heart-${i}`))
  const shapes = [group('heart', [...items, fillItem('#FFFFFF'), strokeItem('#FFFFFF', 5.6469, 100, 'Stroke', 0, 0)])]
  pushLayer({ nm: 'heart', shapes, ks: baseTransform(), parent: stoneRigInd })
}
staticShapeLayer('charity-stone-crease', SVG_PATHS.charityStoneCrease, [strokeItem('#FFFFFF', 2.21843, 100, 'Stroke', 2, 1)], stoneRigInd)
staticShapeLayer('charity-stone', SVG_PATHS.charityStone, [fillItem('#222222'), strokeItem('#222222', 5.6469, 100, 'Stroke', 0, 0)], stoneRigInd)

// paw: peeks from behind, parented to hug-rig — tightens its grip in step
// with the arm-ring and the stone, purely by inheriting hug-rig's squeeze.
{
  const cx = 205.118, cy = 146.481, r = 11.6467
  const shapes = [group('paw', [
    { ty: 'el', nm: 'paw-el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [r * 2, r * 2] } },
    fillItem('#222222'),
  ])]
  // The ellipse primitive sits at LOCAL (0,0) — position alone places it at
  // (cx,cy); anchor stays default (0,0,0) so scale pivots on that same
  // local center. (Setting anchor=position=(cx,cy) here would be the
  // "hidden zero" player-contract warns about: local(0,0) - anchor(cx,cy) +
  // position(cx,cy) collapses to (0,0) — a stray shape glued to the
  // composition origin. Caught by rendering frame 0 and reading it.)
  const ks = baseTransform({ p: [cx, cy, 0] })
  pushLayer({ nm: 'paw', shapes, ks, parent: hugRigInd })
}

// ============================================================
// SHADOW — revectorized diagonal hatch, track-matted to the true pill
// silhouette, breathing OPPOSITE the body: widens exactly as the body
// compresses, same beat, inverted sign.
// ============================================================
const shadowSub = parsePath(SVG_PATHS.shadow)
const shadowBbox = bboxOf(shadowSub)
const shadowCenter = bboxCenter(shadowBbox)

const shadowScalePts = sampleDense((t) => {
  const e = bodyEnvelope(cyclePos(t))
  return [100 + 5 * e, 100 + 3 * e, 100]
}, 0, OP)
const shadowRigInd = pushLayer({
  nm: 'shadow-rig',
  ty: 3,
  ks: {
    a: { a: 0, k: [shadowCenter[0], shadowCenter[1], 0] },
    p: { a: 0, k: [shadowCenter[0], shadowCenter[1], 0] },
    s: bakedProp(shadowScalePts),
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
// hatch: parallel 45deg strokes spanning the bbox with margin, matted to the
// pill above. Source fill-opacity 0.15 -> Lottie stroke opacity 15.
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
// Reorder to front-to-back paint order (confirmed via companion-hug's
// raw-SVG render — same geometry, same order).
// ============================================================
const FRONT_TO_BACK = [
  'bubble-plate', 'bubble-text', 'bubble-anchor',
  'trail-large', 'trail-small',
  'arm-crease', 'arm-ring',
  'heart', 'charity-stone-crease', 'charity-stone', 'stone-rig',
  'eye-right', 'eye-left', 'face', 'body', 'body-rig',
  'paw', 'hug-rig',
  'shadow__matte', 'shadow', 'shadow-rig',
]
layers.sort((a, b) => FRONT_TO_BACK.indexOf(a.nm) - FRONT_TO_BACK.indexOf(b.nm))

const doc = {
  v: '5.9.0', fr: FPS, ip: 0, op: OP, w: W, h: H, nm: 'Live Onboarding Companion (s51p)',
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
writeFileSync(OUT, JSON.stringify(doc))
copyFileSync(join(__dirname, '../assets/fonts/Nunito-Bold.ttf'), join(OUT_DIR, 'Nunito-Bold.ttf'))
const totalKeyframes = layers.reduce((sum, l) => {
  let n = 0
  for (const prop of [l.ks?.p, l.ks?.s, l.ks?.o, l.ks?.a, l.ks?.r]) if (prop?.a === 1) n += prop.k.length
  return sum + n
}, 0)
console.log(`Wrote ${OUT} — ${layers.length} layers, ${totalKeyframes} animated keyframes, T=${T}/IDLE=${IDLE}/OP=${OP} @ ${FPS}fps`)

// ── autoFit max: derived from THIS scene's stage margin + pinned geometry ──
const MARGIN = W * 0.03 // 7.2 — Render-Aware Motion safety margin
const AUTOFIT_MAX_W = Math.min(2 * (PLATE_CX - MARGIN), 2 * (W - PLATE_CX - MARGIN)) // 221.6 — left edge is the tighter constraint
const maxLinesFit = Math.floor((PLATE_BOTTOM - MARGIN - PAD_Y * 2) / LINE_HEIGHT) // headroom clears 1 line only at this geometry
const AUTOFIT_MAX_H = Math.max(1, maxLinesFit) * LINE_HEIGHT + 2 * PAD_Y

const controls = {
  controls: [
    { sid: 'bubble.text', label: 'Bubble text' },
    { sid: 'bubble.size', label: 'Bubble size', autoFit: { text: 'bubble.text', padding: [PAD_X, PAD_Y], min: [90, PLATE_DEFAULT_H], max: [AUTOFIT_MAX_W, AUTOFIT_MAX_H], leading: LEADING } },
    { sid: 'bubble.textPos', label: 'Bubble text position', internal: true },
    { sid: 'bubble.anchor', label: 'Bubble anchor', internal: true },
  ],
  layerControls: [
    { target: 'body-rig', kind: 'amount', property: 'scale', label: 'Hug squeeze', description: 'How deeply the mascot presses into the charity stone each breath.' },
    { target: 'hug-rig', kind: 'amount', property: 'scale', label: 'Arm tighten', description: 'How firmly the arms (and the stone they hold) squeeze at the peak of the hug.' },
    { target: 'bubble-anchor', kind: 'amount', property: 'scale', label: 'Bubble pop', description: 'How much the speech bubble overshoots as it arrives.' },
    { target: 'shadow-rig', kind: 'amount', property: 'scale', label: 'Shadow settle', description: 'How much the ground shadow widens as the body settles into the charity stone.' },
  ],
}
writeFileSync(join(OUT_DIR, 'controls.json'), JSON.stringify(controls, null, 2))
console.log(`Wrote ${join(OUT_DIR, 'controls.json')} — autoFit max=[${AUTOFIT_MAX_W},${AUTOFIT_MAX_H}] (maxLinesFit=${maxLinesFit})`)
