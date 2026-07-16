#!/usr/bin/env node
/**
 * Generates a seamlessly-looping Lottie JSON for "seamless-loop-zenek-w1li.svg"
 * — Zenek perched on his circular badge, two meshed gears turning behind him,
 * an independent settings-gear, and Zenek jotting notes on a page.
 *
 * This SVG was diffed against every previously-shipped Zenek/DataProcessing
 * scene (per svg-compatibility.md's intake gate): different viewBox (240x240
 * vs 256x257), different Zenek body construction (a plain circular blob with
 * a smile + two dot eyes, no hand-drawn "Intersect" hair/face), no shine
 * texture, a simpler ellipse shadow instead of a hatch cluster. Not a match —
 * this is a full rebuild — but the *engineering approach* (precomp + one
 * shared track matte for the badge-clipped gear cluster, gears rotating
 * rigidly with their fused icons, the shared balloon float curve reused by
 * body/pen/shadow, dense-sampled eye scan+float with a sparse baked-in
 * blink) is the same proven system documented in
 * docs/dataprocessing-loop-animation.md, adapted to new geometry.
 *
 * The brief here gives no exact seconds (unlike the dataprocessing brief's
 * "2.2s", "~4s", etc.) — only relative relationships ("faster", "the other
 * way", "every other float"). That leaves the timing free to choose a loop
 * length whose divisors satisfy every relationship exactly, no compromise:
 *
 *   T = 480 frames @ 60fps = 8s
 *   Zenek float:      120f (2s)   x4 cycles
 *   Eye scan:          96f (1.6s round trip) x5 round trips
 *   Pen tap:      every other float cycle -> 240f x2 taps
 *   Big gear:         240f  x2 clockwise turns
 *   Dollar gear:       96f  x5 counter-clockwise turns (2.5x big gear's rate)
 *   Settings gear:    160f  x3 turns, own axis, clockwise
 *   Settings pulse:   240f  x2 pulses
 *
 * All rotations are true linear (no ease) — real machinery, no easing.
 * Zenek's float/pen/shadow use the shared asymmetric balloon curve (ease-out
 * rise, ease-in fall — "not a bounce").
 *
 * Masking: the decorative background pattern + settings-gear + both meshed
 * gears are clipped to the circular badge via an SVG <mask> in the source
 * (Vector_3's bbox runs to x:-11..155, y:-34..132 — well past the canvas,
 * the tell that it's mask-cropped, not a plain static layer). Bundled into
 * one precomp asset, matted once by a single circle layer.
 *
 * Skottie gotchas (confirmed again here, see dataprocessing doc for the
 * original repro): non-zero anchor + animated ROTATION/SCALE is safe;
 * non-zero anchor + animated POSITION freezes at rest. So gears (rotation)
 * anchor at their own bbox center; Zenek's body/pen/eyes (position) keep
 * anchor at [0,0,0]. The eyes additionally need a blink (scale, pivoting on
 * their own center) while also translating (scan + float) — split across
 * layer transform (position, anchor 0) and shape geometry (blink, baked
 * into vertices around the pupil's own rest center).
 */
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../public/projects/seamless-loop-zenek-w1li/scene-1')
const OUT = join(OUT_DIR, 'lottie.json')

const W = 240, H = 240, FPS = 60
const T = 480 // 8s seamless loop

// ── SVG path → Lottie bezier ────────────────────────────────────────────────
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

// ── Raw path data lifted from seamless-loop-zenek-w1li.svg (viewBox 0 0 240 240) ──
const SVG_PATHS = {
  badge: 'M117.521 201.328C172.588 201.328 217.229 156.688 217.229 101.62C217.229 46.553 172.588 1.91211 117.521 1.91211C62.4534 1.91211 17.8125 46.553 17.8125 101.62C17.8125 156.688 62.4534 201.328 117.521 201.328Z',
  badgePattern: 'M84.2052 -32.8559C76.1999 -34.0272 68.0667 -34.0272 60.0614 -32.8559V-13.412C51.4754 -11.7686 43.3156 -8.38877 36.0822 -3.47972L22.3336 -17.2284C15.8446 -12.3961 10.0935 -6.64514 5.26115 -0.156239L19.0098 13.5925C14.1012 20.8257 10.7213 28.9851 9.07733 37.5706H-10.3661C-11.5375 45.5764 -11.5375 53.71 -10.3661 61.7157H9.07735C10.7211 70.3013 14.101 78.4607 19.0098 85.6938L5.26115 99.4426C10.0934 105.932 15.8445 111.683 22.3336 116.515L36.0822 102.767C43.3157 107.675 51.4755 111.055 60.0614 112.699V132.142C68.0667 133.314 76.1999 133.314 84.2052 132.142V112.699C92.7908 111.055 100.95 107.675 108.183 102.767L121.932 116.515C128.421 111.683 134.172 105.932 139.004 99.4426L125.257 85.6938C130.165 78.4603 133.544 70.301 135.189 61.7157H154.632C155.803 53.71 155.803 45.5764 154.632 37.5706H135.189C133.544 28.9854 130.165 20.8262 125.257 13.5925L139.004 -0.156251C134.172 -6.64539 128.421 -12.3964 121.932 -17.2284L108.183 -3.47974C100.95 -8.38877 92.7909 -11.7686 84.2052 -13.412L84.2052 -32.8559Z',
  settingsGear: 'M31.316 80.6329C29.1974 80.3229 27.045 80.3229 24.9265 80.6329V85.7784C22.6543 86.2134 20.495 87.1079 18.5807 88.4069L14.9423 84.7684C13.225 86.0473 11.703 87.5693 10.4242 89.2865L14.0627 92.9249C12.7636 94.8392 11.8692 96.9986 11.4342 99.2707H6.28866C5.97865 101.389 5.97865 103.542 6.28866 105.66H11.4342C11.8692 107.932 12.7636 110.092 14.0627 112.006L10.4242 115.644C11.7031 117.362 13.225 118.884 14.9423 120.162L18.5807 116.524C20.495 117.823 22.6543 118.718 24.9265 119.153V124.298C27.045 124.608 29.1974 124.608 31.316 124.298V119.153C33.5881 118.718 35.7475 117.823 37.6617 116.524L41.3002 120.162C43.0175 118.884 44.5394 117.362 45.8183 115.644L42.1799 112.006C43.4789 110.092 44.3733 107.932 44.8083 105.66H49.9539C50.2639 103.542 50.2639 101.389 49.9539 99.2707H44.8083C44.3733 96.9986 43.4789 94.8392 42.1799 92.9249L45.8183 89.2865C44.5394 87.5693 43.0175 86.0473 41.3002 84.7684L37.6617 88.4069C35.7475 87.1079 33.5881 86.2134 31.316 85.7784V80.6329Z',
  bigGearOutline: 'M136.773 24.4279C131.949 23.722 127.048 23.722 122.224 24.4279V36.1452C117.05 37.1356 112.132 39.1724 107.773 42.1307L99.488 33.8453C95.5776 36.7574 92.1119 40.2231 89.1997 44.1335L97.485 52.4188C94.527 56.7777 92.4902 61.6948 91.4995 66.8687H79.7824C79.0765 71.6931 79.0765 76.5947 79.7824 81.4191H91.4995C92.49 86.593 94.5268 91.5101 97.485 95.869L89.1997 104.154C92.1118 108.065 95.5776 111.531 99.488 114.443L107.773 106.157C112.132 109.116 117.05 111.152 122.224 112.143V123.86C127.048 124.566 131.949 124.566 136.773 123.86V112.143C141.947 111.152 146.864 109.116 151.223 106.157L159.509 114.443C163.419 111.531 166.885 108.065 169.797 104.154L161.512 95.869C164.47 91.5098 166.507 86.5929 167.498 81.4191H179.214C179.92 76.5947 179.92 71.6931 179.214 66.8687H167.498C166.506 61.695 164.47 56.778 161.512 52.4188L169.797 44.1335C166.885 40.223 163.419 36.7572 159.509 33.8453L151.223 42.1307C146.865 39.1724 141.947 37.1356 136.773 36.1452V24.4279Z',
  bigGearHub: 'M111.104 85.6672C109.492 82.7359 108.648 79.4446 108.65 76.0994C108.65 64.8816 117.99 55.7754 129.492 55.7754C140.991 55.7754 150.33 64.8816 150.33 76.0994C150.334 79.4447 149.49 82.7364 147.878 85.6672',
  bigGearTick1: 'M132.806 56.709V74.4573',
  bigGearTick2: 'M126.175 56.709V74.4573',
  dollarGearOutline: 'M190.301 107.588C186.149 105.529 181.636 104.296 177.014 103.959L174.806 112.095C169.792 112.023 164.853 113.321 160.523 115.849L154.599 109.85C150.74 112.417 147.416 115.709 144.813 119.543L150.754 125.523C148.185 129.829 146.84 134.755 146.864 139.769L138.708 141.899C139 146.525 140.189 151.049 142.208 155.221L150.358 153.066C152.803 157.444 156.396 161.072 160.75 163.558L158.517 171.687C162.669 173.746 167.182 174.979 171.805 175.316L174.013 167.18C179.027 167.252 183.965 165.955 188.296 163.427L194.219 169.426C198.078 166.859 201.402 163.567 204.006 159.733L198.064 153.752C200.633 149.446 201.978 144.52 201.954 139.506L210.111 137.376C209.818 132.751 208.629 128.226 206.61 124.054L198.46 126.21C196.015 121.831 192.422 118.204 188.068 115.717L190.301 107.588Z',
  dollarGearRing1: 'M174.948 138.964C174.055 138.071 173.447 136.933 173.201 135.695C172.954 134.456 173.081 133.172 173.564 132.006C174.047 130.839 174.866 129.842 175.916 129.14C176.966 128.439 178.2 128.064 179.463 128.064C180.725 128.064 181.96 128.439 183.01 129.14C184.06 129.842 184.878 130.839 185.361 132.006C185.844 133.172 185.971 134.456 185.725 135.695C185.478 136.933 184.87 138.071 183.977 138.964',
  dollarGearRing2: 'M165.919 138.965C165.026 139.858 164.418 140.995 164.172 142.234C163.925 143.472 164.052 144.756 164.535 145.923C165.018 147.089 165.836 148.086 166.886 148.788C167.936 149.489 169.171 149.864 170.433 149.864C171.696 149.864 172.93 149.49 173.98 148.788C175.03 148.087 175.849 147.089 176.332 145.923C176.815 144.756 176.942 143.473 176.695 142.234C176.449 140.996 175.841 139.858 174.948 138.965',
  dollarGearSlash: 'M186.987 126.926L163.339 150.574',
  badgeStroke: 'M117.521 201.328C172.588 201.328 217.229 156.688 217.229 101.62C217.229 46.553 172.588 1.91211 117.521 1.91211C62.4534 1.91211 17.8125 46.553 17.8125 101.62C17.8125 156.688 62.4534 201.328 117.521 201.328Z',
  arc1: 'M218.674 68.8281C220.167 73.4376 221.341 78.1445 222.187 82.9153',
  arc2: 'M158.589 3.53711C171.651 9.02599 183.488 17.062 193.41 27.1759C203.331 37.2899 211.139 49.2791 216.376 62.4436',
  body: 'M56.4244 173.111C62.3198 173.111 68.0828 174.859 72.9846 178.135C77.8864 181.41 81.7069 186.065 83.963 191.512C86.2191 196.959 86.8094 202.952 85.6592 208.734C84.5091 214.516 81.6702 219.827 77.5016 223.996C73.3329 228.165 68.0217 231.004 62.2396 232.154C56.4575 233.304 50.4642 232.713 45.0176 230.457C39.571 228.201 34.9157 224.381 31.6404 219.479C28.3651 214.577 26.6169 208.814 26.6169 202.919C26.617 195.013 29.7575 187.432 35.3474 181.842C40.9374 176.252 48.519 173.111 56.4244 173.111',
  mouth: 'M36.6937 196.059C36.496 204.992 45.1978 206.452 56.1091 206.731L57.5542 206.761C68.4677 206.939 77.2264 205.845 77.4242 196.913C77.626 187.784 68.673 180.193 57.426 179.957C46.1789 179.722 36.897 186.93 36.6937 196.059',
  eyeLeft: 'M61.8679 194.797C63.2398 194.797 64.3518 196.131 64.3518 197.778C64.3518 199.424 63.2398 200.758 61.8679 200.758C60.4959 200.758 59.3838 199.424 59.3838 197.778C59.3838 196.131 60.4959 194.797 61.8679 194.797Z',
  eyeRight: 'M69.6487 195.09C71.0208 195.09 72.1328 196.424 72.1328 198.071C72.1328 199.717 71.0208 201.051 69.6487 201.051C68.2767 201.051 67.1648 199.717 67.1648 198.071C67.1648 196.424 68.2767 195.09 69.6487 195.09Z',
  penBody: 'M97.3774 147.965C97.3774 146.487 96.7903 145.07 95.7452 144.025C94.7001 142.98 93.2827 142.393 91.8048 142.393C90.3268 142.393 88.9094 142.98 87.8644 144.025C86.8193 145.07 86.2322 146.487 86.2322 147.965V196.682H97.3774V147.965Z',
  penCenterLine: 'M91.8047 150.217V196.683',
  penCapLine: 'M86.2322 150.217H97.3774',
  paper: 'M130.005 174.059H82.3016L59.3525 225.328H107.055L130.005 174.059Z',
  shadow: 'M57.0894 239.507C72.9887 239.507 85.8776 237.25 85.8776 234.466C85.8776 231.682 72.9887 229.426 57.0894 229.426C41.1902 229.426 28.3013 231.682 28.3013 234.466C28.3013 237.25 41.1902 239.507 57.0894 239.507Z',
}

// ── Lottie builder helpers ──────────────────────────────────────────────────
const hexToRgb1 = (hex) => {
  hex = hex.replace('#', '')
  return [parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255]
}

const EASE = {
  linear: [0, 0, 1, 1],
  entranceSharp: [0.20, 0.75, 0.34, 0.94],
  settleSoft: [0.00, 0.65, 0.51, 0.99],
  gentleAccel: [0.42, 0.00, 1.00, 1.00],
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

function ensureStartsAtZero(points) {
  if (points[0].t === 0) return points
  return [{ t: 0, v: points[0].v, ease: points[0].ease }, ...points]
}

function animProp(points) {
  points = ensureStartsAtZero(points)
  const keys = points.map((p, idx) => {
    const isLast = idx === points.length - 1
    return kf(p.t, p.v, isLast ? null : (EASE[p.ease] || EASE.linear))
  })
  return { a: 1, k: keys }
}

// Repeat one cycle's worth of keyframes (t in [0, periodF)) numCycles times,
// then close with one final keyframe at t = numCycles*periodF = finalValue.
function tileCycle(periodF, numCycles, points, finalValue) {
  const out = []
  for (let c = 0; c < numCycles; c++) {
    for (const p of points) out.push({ t: c * periodF + p.t, v: p.v, ease: p.ease })
  }
  out.push({ t: numCycles * periodF, v: finalValue })
  return out
}

function shapeFromSubpath(sp, nm) {
  return { ty: 'sh', nm, ks: { a: 0, k: { c: sp.closed, v: sp.v, i: sp.i, o: sp.o } } }
}

function fillItem(colorHex, opacity = 100, rule = 1, nm = 'Fill') {
  const [cr, cg, cb] = hexToRgb1(colorHex)
  return { ty: 'fl', nm, o: { a: 0, k: opacity }, c: { a: 0, k: [cr, cg, cb, 1] }, r: rule }
}

function strokeItem(colorHex, width, opacity = 100, nm = 'Stroke') {
  const [cr, cg, cb] = hexToRgb1(colorHex)
  return { ty: 'st', nm, o: { a: 0, k: opacity }, w: { a: 0, k: width }, c: { a: 0, k: [cr, cg, cb, 1] }, lc: 2, lj: 2 }
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

function layer({ nm, ind, shapes, ks, refId, w, h, tt, td, ao = 0 }) {
  const l = { ddd: 0, ind, ty: refId ? 0 : 4, nm, sr: 1, ks, ao, ip: 0, op: T, st: 0, bm: 0 }
  if (refId) { l.refId = refId; l.w = w; l.h = h } else { l.shapes = shapes }
  if (tt) l.tt = tt
  if (td) l.td = 1
  return l
}

// ── Rigid-transform helpers (for baking blink scale into eye vertices) ─────
function scaleSubpath(sp, center, scale) {
  const v = sp.v.map(([x, y]) => [center[0] + (x - center[0]) * scale, center[1] + (y - center[1]) * scale])
  const i = sp.i.map(([x, y]) => [x * scale, y * scale])
  const o = sp.o.map(([x, y]) => [x * scale, y * scale])
  return { c: sp.closed, v, i, o }
}

// ── Generic eased-track evaluator (for dense-sampling combined motions) ────
function bezierEaseFn(x1, y1, x2, y2) {
  return (t) => {
    const bx = (s) => { const m = 1 - s; return 3 * m * m * s * x1 + 3 * m * s * s * x2 + s * s * s }
    const by = (s) => { const m = 1 - s; return 3 * m * m * s * y1 + 3 * m * s * s * y2 + s * s * s }
    let lo = 0, hi = 1
    for (let k = 0; k < 30; k++) { const mid = (lo + hi) / 2; if (bx(mid) < t) lo = mid; else hi = mid }
    return by((lo + hi) / 2)
  }
}
function evalTrack(points, finalValue, total, t) {
  const all = [...points, { t: total, v: finalValue }]
  let seg = all.length - 2
  for (let k = 0; k < all.length - 1; k++) { if (t >= all[k].t && t <= all[k + 1].t) { seg = k; break } }
  const a = all[seg], b = all[seg + 1]
  const frac = (t - a.t) / ((b.t - a.t) || 1)
  const [x1, y1, x2, y2] = EASE[a.ease] || EASE.linear
  const eased = bezierEaseFn(x1, y1, x2, y2)(frac)
  return a.v + (b.v - a.v) * eased
}

// ============================================================
// TIMING — the brief gives only relative relationships ("faster", "the
// other way", "every other float"), not exact seconds, so T is chosen so
// every period divides it exactly: no compromise, unlike a brief with
// mixed exact/approximate numbers (see dataprocessing-loop-animation.md).
// ============================================================
const FLOAT_PERIOD = 120, FLOAT_CYCLES = T / FLOAT_PERIOD               // 4
const EYE_CYCLE = 96, EYE_ROUNDTRIPS = T / EYE_CYCLE                    // 5
const BIG_GEAR_PERIOD = 240, BIG_GEAR_TURNS = T / BIG_GEAR_PERIOD       // 2
const DOLLAR_GEAR_PERIOD = 96, DOLLAR_GEAR_TURNS = T / DOLLAR_GEAR_PERIOD // 5
const SETTINGS_GEAR_PERIOD = 160, SETTINGS_GEAR_TURNS = T / SETTINGS_GEAR_PERIOD // 3
const PULSE_PERIOD = 240, PULSE_COUNT = T / PULSE_PERIOD               // 2

// Shared float cycle (local t in [0,120)): gentle rise, brief hover, gentle
// accelerating fall — "a slow balloon ease, not a bounce."
const FLOAT_POINTS = [
  { t: 0, v: 0, ease: 'entranceSharp' },
  { t: 30, v: -7, ease: 'settleSoft' },
  { t: 84, v: -7.5, ease: 'gentleAccel' },
]
const floatY = (t) => evalTrack(FLOAT_POINTS, 0, FLOAT_PERIOD, t % FLOAT_PERIOD)

const SCAN_AMPLITUDE = 5
const SCAN_POINTS = [
  { t: 0, v: -SCAN_AMPLITUDE, ease: 'travelBalanced' },
  { t: 48, v: SCAN_AMPLITUDE, ease: 'travelBalanced' },
]
const scanX = (t) => evalTrack(SCAN_POINTS, -SCAN_AMPLITUDE, EYE_CYCLE, t % EYE_CYCLE)

let ind = 1
const layers = []

// ---- paper (static, steady island — Zenek floats above it, unparented) ----
{
  const sp = parsePath(SVG_PATHS.paper)[0]
  const shapes = [group('paper', [shapeFromSubpath(sp, 'paper-path'), fillItem('#FFFFFF'), strokeItem('#222222', 2)])]
  layers.push(layer({ nm: 'paper', ind: ind++, shapes, ks: baseTransform() }))
}

// ---- pen (float + tap-down every other cycle) ----
{
  const fillSp = parsePath(SVG_PATHS.penBody)[0]
  const centerSp = parsePath(SVG_PATHS.penCenterLine)[0]
  const capSp = parsePath(SVG_PATHS.penCapLine)[0]
  const shapes = [
    group('pen-details', [shapeFromSubpath(centerSp, 'pen-center-line'), shapeFromSubpath(capSp, 'pen-cap-line'), strokeItem('#222222', 1)]),
    group('pen-fill', [shapeFromSubpath(fillSp, 'pen-fill-path'), fillItem('#FFFFFF'), strokeItem('#222222', 2)]),
  ]
  const points = []
  for (let c = 0; c < FLOAT_CYCLES; c++) {
    const base = c * FLOAT_PERIOD
    const isTap = c % 2 === 0
    points.push({ t: base + 0, v: [0, 0, 0], ease: 'entranceSharp' })
    points.push({ t: base + 30, v: [0, -7, 0], ease: 'settleSoft' })
    points.push({ t: base + 84, v: [0, -7.5, 0], ease: isTap ? 'entranceSharp' : 'gentleAccel' })
    if (isTap) {
      points.push({ t: base + 96, v: [1.5, 2, 0], ease: 'entranceSharp' })
      points.push({ t: base + 104, v: [-1.5, 2, 0], ease: 'entranceSharp' })
      points.push({ t: base + 112, v: [1, 2, 0], ease: 'settleSoft' })
    }
  }
  const ks = baseTransform()
  ks.p = animProp([...points, { t: T, v: [0, 0, 0] }])
  layers.push(layer({ nm: 'pen', ind: ind++, shapes, ks }))
}

// ---- eyes (position = scan+float dense-sampled; blink baked into shape) ---
const BLINK_PASSES = [1, 3] // occasional, away from the loop seam
const BLINK_DUR = 8

for (const [nm, key] of [['eye-right', 'eyeRight'], ['eye-left', 'eyeLeft']]) {
  const sp = parsePath(SVG_PATHS[key])[0]
  const center = bboxCenter(bboxOf([sp]))

  const posPoints = []
  const SAMPLE_STEP = 6
  for (let t = 0; t <= T; t += SAMPLE_STEP) posPoints.push({ t, v: [scanX(t), floatY(t), 0], ease: 'linear' })
  const ks = baseTransform()
  ks.p = animProp(posPoints)

  const shapePoints = [{ t: 0, scale: 1, ease: 'linear' }]
  for (const p of BLINK_PASSES) {
    const c = p * EYE_CYCLE + EYE_CYCLE / 2
    shapePoints.push({ t: c - BLINK_DUR - 1, scale: 1, ease: 'entranceSharp' })
    shapePoints.push({ t: c, scale: 0.12, ease: 'settleSoft' })
    shapePoints.push({ t: c + BLINK_DUR, scale: 1, ease: 'linear' })
  }
  shapePoints.sort((a, b) => a.t - b.t)
  const shapeKeys = shapePoints.map((p, idx) => {
    const isLast = idx === shapePoints.length - 1
    return kf(p.t, scaleSubpath(sp, center, p.scale), isLast ? null : (EASE[p.ease] || EASE.linear))
  })
  if (shapeKeys[shapeKeys.length - 1].t < T) shapeKeys.push(kf(T, scaleSubpath(sp, center, 1), null))
  const eyeShape = { ty: 'sh', nm: `${nm}-path`, ks: { a: 1, k: shapeKeys } }

  const shapes = [group(nm, [eyeShape, fillItem('#222222')])]
  layers.push(layer({ nm, ind: ind++, shapes, ks }))
}

// ---- zenek body (mouth + body outline + body fill, float only) -----------
{
  const mouthSp = parsePath(SVG_PATHS.mouth)[0]
  const bodySp = parsePath(SVG_PATHS.body)[0]
  const shapes = [
    group('mouth', [shapeFromSubpath(mouthSp, 'mouth-path'), fillItem('#FFFFFF')]),
    group('body', [shapeFromSubpath(bodySp, 'body-path'), fillItem('#222222'), strokeItem('#222222', 2)]),
  ]
  const ks = baseTransform()
  ks.p = animProp(tileCycle(FLOAT_PERIOD, FLOAT_CYCLES, FLOAT_POINTS.map((p) => ({ ...p, v: [0, p.v, 0] })), [0, 0, 0]))
  layers.push(layer({ nm: 'zenek-body', ind: ind++, shapes, ks }))
}

// ---- decorative arcs (static) ----
{
  const a1 = parsePath(SVG_PATHS.arc1)[0]
  const a2 = parsePath(SVG_PATHS.arc2)[0]
  const shapes = [group('badge-arcs', [
    shapeFromSubpath(a1, 'arc1-path'),
    shapeFromSubpath(a2, 'arc2-path'),
    strokeItem('#222222', 2),
  ])]
  layers.push(layer({ nm: 'badge-arcs', ind: ind++, shapes, ks: baseTransform() }))
}

// ---- badge stroke (static, on top of the masked gear content) ----
{
  const sp = parsePath(SVG_PATHS.badgeStroke)[0]
  const shapes = [group('badge-stroke', [shapeFromSubpath(sp, 'badge-stroke-path'), strokeItem('#222222', 2)])]
  layers.push(layer({ nm: 'badge-stroke', ind: ind++, shapes, ks: baseTransform() }))
}

// ---- inside-badge precomp: pattern, settings gear, big gear, dollar gear ----
const precompLayers = []
let pind = 1

{
  // decorative background pattern — static, low-opacity, clipped to the badge
  const sp = parsePath(SVG_PATHS.badgePattern)[0]
  const shapes = [group('badge-pattern', [shapeFromSubpath(sp, 'badge-pattern-path'), fillItem('#8A8A8A', 15)])]
  precompLayers.push(layer({ nm: 'badge-pattern', ind: pind++, shapes, ks: baseTransform() }))
}

{
  // settings gear — independent slow spin with its own subtle pulse
  const sp = parsePath(SVG_PATHS.settingsGear)[0]
  const c = bboxCenter(bboxOf([sp]))
  const shapes = [group('settings-gear', [shapeFromSubpath(sp, 'settings-gear-path'), fillItem('#222222')])]
  const ks = baseTransform({ a: [c[0], c[1], 0], p: [c[0], c[1], 0] })
  ks.r = animProp([{ t: 0, v: 0, ease: 'linear' }, { t: T, v: 360 * SETTINGS_GEAR_TURNS }])
  const pulsePts = [
    { t: 0, v: 100, ease: 'entranceSharp' },
    { t: 60, v: 104, ease: 'settleSoft' },
    { t: 120, v: 100, ease: 'gentleAccel' },
  ]
  ks.s = animProp(tileCycle(PULSE_PERIOD, PULSE_COUNT, pulsePts.map((p) => ({ ...p, v: [p.v, p.v, 100] })), [100, 100, 100]))
  precompLayers.push(layer({ nm: 'settings-gear', ind: pind++, shapes, ks }))
}

{
  // big gear: outline + hub arc + two axle ticks, ALL one rigid piece
  const outline = parsePath(SVG_PATHS.bigGearOutline)[0]
  const hub = parsePath(SVG_PATHS.bigGearHub)[0]
  const tick1 = parsePath(SVG_PATHS.bigGearTick1)[0]
  const tick2 = parsePath(SVG_PATHS.bigGearTick2)[0]
  const center = bboxCenter(bboxOf([outline, hub, tick1, tick2]))
  // outline needs its own fill+stroke; hub/ticks are stroke-only icon detail
  // fused on top — two subgroups under one shared rigid rotation transform.
  const shapes = [
    group('big-gear-icon', [
      shapeFromSubpath(hub, 'big-gear-hub'),
      shapeFromSubpath(tick1, 'big-gear-tick1'),
      shapeFromSubpath(tick2, 'big-gear-tick2'),
      strokeItem('#222222', 2, 100, 'icon-stroke'),
    ]),
    group('big-gear-outline', [
      shapeFromSubpath(outline, 'big-gear-outline-path'),
      fillItem('#FFFFFF'),
      strokeItem('#222222', 2, 100, 'outline-stroke'),
    ]),
  ]
  const ks = baseTransform({ a: [center[0], center[1], 0], p: [center[0], center[1], 0] })
  ks.r = animProp([{ t: 0, v: 0, ease: 'linear' }, { t: T, v: 360 * BIG_GEAR_TURNS }])
  precompLayers.push(layer({ nm: 'big-gear', ind: pind++, shapes, ks }))
}

{
  // dollar gear: outline + two rings + diagonal slash ($ sign), ALL one rigid piece
  const outline = parsePath(SVG_PATHS.dollarGearOutline)[0]
  const ring1 = parsePath(SVG_PATHS.dollarGearRing1)[0]
  const ring2 = parsePath(SVG_PATHS.dollarGearRing2)[0]
  const slash = parsePath(SVG_PATHS.dollarGearSlash)[0]
  const center = bboxCenter(bboxOf([outline, ring1, ring2, slash]))
  const shapes = [
    group('dollar-gear', [
      shapeFromSubpath(ring1, 'dollar-gear-ring1'),
      shapeFromSubpath(ring2, 'dollar-gear-ring2'),
      shapeFromSubpath(slash, 'dollar-gear-slash'),
      strokeItem('#222222', 2, 100, 'icon-stroke'),
    ]),
    group('dollar-gear-outline', [
      shapeFromSubpath(outline, 'dollar-gear-outline-path'),
      fillItem('#FFFFFF'),
      strokeItem('#222222', 2, 100, 'outline-stroke'),
    ]),
  ]
  const ks = baseTransform({ a: [center[0], center[1], 0], p: [center[0], center[1], 0] })
  ks.r = animProp([{ t: 0, v: 0, ease: 'linear' }, { t: T, v: -360 * DOLLAR_GEAR_TURNS }])
  precompLayers.push(layer({ nm: 'dollar-gear', ind: pind++, shapes, ks }))
}

// front-to-back within the precomp: dollar > big > settings > pattern
{
  const order = ['dollar-gear', 'big-gear', 'settings-gear', 'badge-pattern']
  precompLayers.sort((a, b) => order.indexOf(a.nm) - order.indexOf(b.nm))
}

const insideBadgeAssetId = 'comp_badgeGears'

// ---- matte circle + precomp layer (clips the whole gear cluster at once) ----
{
  const matteSp = parsePath(SVG_PATHS.badge)[0]
  const matteShapes = [group('badge__matte', [shapeFromSubpath(matteSp, 'badge-matte-path'), fillItem('#FFFFFF')])]
  layers.push(layer({ nm: 'badge__matte', ind: ind++, shapes: matteShapes, ks: baseTransform(), td: true }))

  layers.push(layer({ nm: 'badge-gears', ind: ind++, ks: baseTransform(), refId: insideBadgeAssetId, w: W, h: H, tt: 1 }))
}

// ---- badge fill (static, behind everything) ----
{
  const sp = parsePath(SVG_PATHS.badge)[0]
  const shapes = [group('badge-fill', [shapeFromSubpath(sp, 'badge-fill-path'), fillItem('#FFFFFF')])]
  layers.push(layer({ nm: 'badge-fill', ind: ind++, shapes, ks: baseTransform() }))
}

// ---- shadow (breathes with float: wider+lighter at peak, tight+normal at rest) ----
{
  const sp = parsePath(SVG_PATHS.shadow)[0]
  const c = bboxCenter(bboxOf([sp]))
  const shapes = [group('shadow', [shapeFromSubpath(sp, 'shadow-path'), fillItem('#2B2B2B', 32)])]
  const ks = baseTransform({ a: [c[0], c[1], 0], p: [c[0], c[1], 0] })
  const scalePts = [
    { t: 0, v: 100, ease: 'entranceSharp' },
    { t: 30, v: 128, ease: 'settleSoft' },
    { t: 84, v: 132, ease: 'gentleAccel' },
  ]
  const opacityPts = [
    { t: 0, v: 100, ease: 'entranceSharp' },
    { t: 30, v: 58, ease: 'settleSoft' },
    { t: 84, v: 55, ease: 'gentleAccel' },
  ]
  ks.s = animProp(tileCycle(FLOAT_PERIOD, FLOAT_CYCLES, scalePts.map((p) => ({ ...p, v: [p.v, 100, 100] })), [100, 100, 100]))
  ks.o = animProp(tileCycle(FLOAT_PERIOD, FLOAT_CYCLES, opacityPts, 100))
  layers.push(layer({ nm: 'shadow', ind: ind++, shapes, ks }))
}

// ============================================================
// Reorder to front-to-back paint order.
const FRONT_TO_BACK = [
  'paper', 'pen', 'eye-right', 'eye-left', 'zenek-body', 'badge-arcs', 'badge-stroke',
  'badge__matte', 'badge-gears', 'badge-fill', 'shadow',
]
layers.sort((a, b) => FRONT_TO_BACK.indexOf(a.nm) - FRONT_TO_BACK.indexOf(b.nm))

const doc = {
  v: '5.9.0', fr: FPS, ip: 0, op: T, w: W, h: H, nm: 'Seamless Loop — Zenek',
  ddd: 0,
  assets: [{ id: insideBadgeAssetId, layers: precompLayers }],
  layers, markers: [],
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT, JSON.stringify(doc))
console.log(`Wrote ${OUT} — ${layers.length} main layers + ${precompLayers.length} precomp layers, ${T}f @ ${FPS}fps (${(T / FPS).toFixed(1)}s loop)`)
