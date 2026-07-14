#!/usr/bin/env node
/**
 * Generates an animated Lottie JSON for WorldWide.svg — globe/plane/ribbon entrance.
 * Output: public/projects/worldwide/scene-1/lottie.json
 *
 * Animation design (60fps, 210f = 3.5s, plays once and holds), three beats:
 *  - Beat 1 (0-28): globe (+continents +ground-shadow ellipse, one shared
 *    transform) pops in — scale 60% -> ~112% overshoot -> 100% settle, with
 *    a quick opacity fade.
 *  - Beat 2 (36-152): the plane appears at the left end of the orbit path
 *    (36-44), then flies the exact orbit curve to its source resting spot.
 *    Since Skottie here can't animate rotation via anchor+position (see
 *    note below), the plane's two paths are baked as animated SHAPE
 *    keyframes: each keyframe is the full path geometry rigidly rotated
 *    around the plane's own centroid and translated to the sampled point
 *    on the orbit curve, so it moves and turns to face its heading without
 *    ever touching layer transform/anchor. The orbit line's trim path is
 *    keyed at the exact same sample times/progress so the contrail's edge
 *    always sits under the plane's nose. Two small white "eraser" strokes
 *    (which mask the orbit line where it should read as passing behind the
 *    globe) pop in the instant the revealed trail reaches their position
 *    along the curve (computed via arc-length nearest-point, not guessed).
 *  - Beat 3 (160-209): the green ribbon wraps the globe as one continuous
 *    brushstroke — bottom band + its end-caps first (sequential trim,
 *    "from bottom-left, up and around"), then the translucent gradient
 *    echo bands passing behind the globe (simultaneous trim, "once
 *    behind"), then the leaf and dot accents pop to finish.
 *  - Final frame matches the source SVG's static composition exactly.
 *
 * Non-obvious Skottie gotchas (same build as scripts/build-hubcash.mjs):
 *  - Non-zero anchor point + animated position freezes at rest. Any layer
 *    that needs to translate must keep anchor/position at identity and
 *    either offset from authored coordinates, or (for translate+rotate
 *    together, as the plane needs) bake the transform directly into
 *    animated shape-path keyframes instead of using ks.p/ks.r at all.
 *  - Animated property keyframe arrays must start at t=0; ensureStartsAtZero
 *    prepends a hold at the first authored value otherwise.
 */
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../public/projects/worldwide/scene-1')
const OUT = join(OUT_DIR, 'lottie.json')

const W = 256, H = 256, FPS = 60, FRAMES = 210 // 3.5s, plays once and holds

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

// ── Raw path data lifted from WorldWide.svg (viewBox 0 0 256 256) ──────────
const SVG_PATHS = {
  ribbonEcho: 'M160.714 176.137C164.902 177.576 169.415 175.348 170.792 171.161C172.17 166.974 169.892 162.413 165.703 160.975L163.209 168.556L160.714 176.137ZM77.3328 181.163C79.8415 184.837 84.8147 185.812 88.4407 183.341C92.0667 180.87 92.9725 175.889 90.4638 172.216L83.8983 176.689L77.3328 181.163ZM186.144 176.525C183.97 180.348 185.318 185.257 189.155 187.491C192.991 189.724 197.863 188.435 200.036 184.612L193.09 180.569L186.144 176.525ZM37.8332 117.781C36.7929 122.069 39.423 126.438 43.7078 127.539C47.9926 128.64 52.3094 126.057 53.3497 121.769L45.5915 119.775L37.8332 117.781ZM204.395 126.365C202.466 130.32 204.116 135.139 208.081 137.129C212.045 139.118 216.823 137.525 218.753 133.57L211.574 129.968L204.395 126.365ZM64.7936 52.0329C60.3891 52.1803 56.9848 55.8869 57.1897 60.3118C57.3947 64.7366 61.1314 68.2041 65.5358 68.0566L65.1647 60.0447L64.7936 52.0329ZM163.209 168.556L165.703 160.975C143.765 153.438 126.955 149.385 114.141 147.833C101.487 146.3 91.9186 147.1 85.0611 150.157C77.6497 153.462 73.727 159.314 73.1118 165.904C72.5578 171.84 74.7589 177.393 77.3328 181.163L83.8983 176.689L90.4638 172.216C89.4108 170.673 88.8948 168.839 89.0096 167.609C89.0634 167.032 89.1956 165.941 91.7011 164.824C94.7606 163.46 100.971 162.361 112.434 163.75C123.737 165.119 139.383 168.809 160.714 176.137L163.209 168.556ZM193.09 180.569L200.036 184.612C204.366 176.996 204.43 168.884 201.561 161.294C198.812 154.02 193.448 147.336 187.002 141.411C174.08 129.535 154.826 118.909 134.996 111.162C115.139 103.405 93.8064 98.1831 76.4014 97.7221C67.7411 97.4927 59.4248 98.4207 52.6329 101.3C45.6081 104.278 39.8246 109.573 37.8332 117.781L45.5915 119.775L53.3497 121.769C53.8835 119.569 55.358 117.63 59.0071 116.083C62.8889 114.437 68.6625 113.55 76.1907 113.749C91.1628 114.146 110.602 118.759 129.377 126.094C148.179 133.439 165.415 143.162 176.306 153.172C181.767 158.191 185.14 162.835 186.642 166.809C188.024 170.466 187.853 173.52 186.144 176.525L193.09 180.569ZM211.574 129.968L218.753 133.57C221.798 127.327 221.683 120.821 219.303 114.777C217.034 109.015 212.803 103.845 207.799 99.2946C197.79 90.193 182.796 81.8744 166.36 74.9019C133.512 60.9676 91.7756 51.1294 64.7936 52.0329L65.1647 60.0447L65.5358 68.0566C89.4047 67.2574 128.736 76.2638 160.311 89.6582C176.086 96.3501 189.142 103.817 197.166 111.114C201.178 114.762 203.458 117.945 204.464 120.5C205.359 122.773 205.281 124.549 204.395 126.365L211.574 129.968Z',
  globe: 'M113.13 60.904C148.715 51.3691 185.346 72.518 194.88 108.102C204.415 143.687 183.266 180.318 147.682 189.853C112.097 199.388 75.4664 178.239 65.9316 142.654C56.3968 107.07 77.5457 70.4388 113.13 60.904Z',
  orbit: 'M171.252 97.7208C202.284 111.628 221.797 130.978 217.668 146.391C212.314 166.37 169.245 172.214 121.549 159.434C73.8533 146.654 39.4766 120.058 44.8299 100.079C46.7539 92.8986 53.5494 87.544 63.6804 84.2234',
  continent1: 'M154.693 156.109C158.31 161.382 165.817 159.351 168.073 155.042C172.934 145.756 173.287 129.71 171.114 116.992C170.703 114.582 173.1 112.446 176.818 114.556C185.106 119.259 189.598 121.656 197.146 125.929C197.974 116.488 194.787 104.7 187.831 91.0661C182.486 80.5872 171.635 72.0752 166.923 69.1921C164.783 71.9792 157.763 77.0115 152.318 76.6111C146.161 76.1573 136.19 73.29 130.968 74.6893C125.745 76.0888 121.728 81.1813 123.034 86.0585C124.341 90.9363 129.663 88.6852 134.034 87.514C138.405 86.3429 143.616 85.2211 144.51 88.5584C145.404 91.8957 141.634 94.2818 136.235 95.7285C130.836 97.1752 113.934 98.3755 112.262 104.477C110.591 110.58 118.041 113.673 126.39 111.436C136.417 108.749 149.676 106.297 150.708 110.148C151.739 113.998 132.909 117.256 127.767 118.634C122.625 120.011 117.743 125.446 118.981 130.067C120.219 134.688 126.973 136.94 133.969 135.066C141.61 133.018 149.548 148.61 154.693 156.109Z',
  continent2: 'M78.2606 137.011C83.1323 138.412 103.88 140.263 108.756 149.304C111.616 154.607 106.24 157.966 106.558 162.887C107.047 170.468 116.602 175.128 114.331 178.988C110.18 186.04 87.5338 175.326 77.524 166.497C71.894 161.532 68.4121 151.912 65.9679 142.79C59.178 117.449 69.9976 92.2689 75.3971 86.6402C88.6707 76.699 97.91 95.0877 94.1664 108.945C92.6082 114.714 78.3793 123.316 76.089 126.235C72.2851 131.084 74.6963 135.986 78.2606 137.011Z',
  planeBody: 'M153.742 93.4167L151.276 90.5996C150.664 89.9011 151.252 88.8188 152.171 88.9511L161.57 90.3042C161.651 90.3159 161.73 90.3374 161.806 90.3683L177.909 96.9476C178.154 97.0479 178.43 97.0466 178.674 96.9439L183.107 95.0829C183.351 94.9802 183.627 94.9789 183.872 95.0792L184.407 95.2979C184.919 95.5068 185.164 96.0906 184.955 96.6018L183.229 100.826C183.129 101.072 182.935 101.267 182.69 101.37L178.258 103.231C178.013 103.334 177.738 103.335 177.493 103.235L169.728 100.062C169.119 99.8134 168.44 100.21 168.357 100.862L167.648 106.462C167.565 107.114 166.886 107.511 166.277 107.262L166.023 107.158C165.777 107.058 165.581 106.864 165.479 106.619L161.436 96.9907C161.333 96.7462 161.138 96.5525 160.892 96.4522L154.116 93.6837C153.973 93.625 153.844 93.5335 153.742 93.4167Z',
  planeWing: 'M173.36 86.9505L166.135 89.9845L171.355 92.1174C171.774 92.2886 172.256 92.157 172.53 91.7966L174.931 88.6356C175.329 88.1121 175.122 87.3537 174.513 87.105L174.126 86.9469C173.88 86.8465 173.605 86.8479 173.36 86.9505Z',
  eraser1: 'M195.712 111.431C192.022 108.817 187.944 106.27 183.528 103.83',
  eraser2: 'M63.6802 132.751C74.7268 141.211 89.8781 149.095 107.515 155.154',
  leaf: 'M50.7991 66.9908C55.3448 67.9524 62.9625 68.0128 67.5037 67.9618C67.5037 67.9618 73.0593 68.5181 73.0804 59.0829C73.0968 51.7302 66.1899 52.0778 66.1899 52.0778L62.4307 52.1672C61.2126 52.2148 60.3029 52.6019 59.5345 53.3255C58.7798 53.9875 58.1796 54.937 57.6784 55.9783C57.2104 56.9592 56.5413 57.8284 55.6843 58.4131C54.8273 59.0125 53.7687 59.3901 52.6097 59.2806C51.4522 59.2244 50.3984 59.3839 49.5186 59.8296C48.64 60.2842 47.9333 61.0292 47.5815 62.0667C47.2295 63.104 47.3799 64.1795 47.9599 65.0909C48.533 66.0122 49.54 66.7493 50.7991 66.9908Z',
  dot: 'M41.834 57.9264C39.9806 57.3298 37.952 58.3942 37.3031 60.3039C36.6542 62.2136 37.6307 64.2453 39.4841 64.8419C41.3375 65.4385 43.3661 64.374 44.015 62.4644C44.6639 60.5547 43.6874 58.5229 41.834 57.9264Z',
  ribbonFront: 'M90.7549 172.673C88.4961 168.842 83.5953 167.533 79.8086 169.751C76.0218 171.969 74.7832 176.873 77.0419 180.704L83.8984 176.689L90.7549 172.673ZM200.226 184.259C202.203 180.328 200.612 175.49 196.671 173.452C192.731 171.414 187.933 172.948 185.955 176.879L193.09 180.569L200.226 184.259ZM53.2136 122.261C54.5255 118.052 52.1765 113.527 47.9669 112.154C43.7574 110.781 39.2813 113.08 37.9694 117.289L45.5915 119.775L53.2136 122.261ZM219.202 132.437C220.504 128.225 218.145 123.705 213.933 122.341C209.72 120.978 205.249 123.287 203.947 127.499L211.574 129.968L219.202 132.437ZM83.8984 176.689L77.0419 180.704C79.5025 184.879 83.5544 187.893 87.6051 190.108C91.7896 192.395 96.7838 194.264 102.119 195.779C112.805 198.812 125.783 200.677 138.556 201.275C151.312 201.873 164.311 201.228 175.007 198.999C180.346 197.886 185.403 196.32 189.649 194.128C193.815 191.978 197.912 188.857 200.226 184.259L193.09 180.569L185.955 176.879C185.72 177.345 184.84 178.487 182.202 179.848C179.646 181.168 176.075 182.359 171.564 183.299C162.56 185.176 150.974 185.817 139.09 185.26C127.224 184.704 115.506 182.975 106.274 180.355C101.65 179.042 97.879 177.57 95.0962 176.049C92.1795 174.455 91.062 173.194 90.7549 172.673L83.8984 176.689ZM45.5915 119.775L37.9694 117.289C36.826 120.958 37.0673 124.708 38.613 128.149C40.0695 131.393 42.4753 133.917 44.9908 135.867C49.929 139.695 56.9192 142.553 64.4991 144.771C79.8934 149.274 100.905 152.018 122.037 153.048C143.222 154.081 165.121 153.419 182.402 150.851C190.999 149.574 198.828 147.772 204.95 145.28C208.014 144.034 210.935 142.501 213.362 140.565C215.781 138.636 218.105 135.984 219.202 132.437L211.574 129.968L203.947 127.499C204.084 127.056 204.201 127.266 203.33 127.961C202.467 128.649 201.014 129.504 198.786 130.41C194.323 132.226 187.89 133.798 179.861 134.991C163.89 137.364 143.08 138.033 122.601 137.034C102.069 136.033 82.4599 133.384 68.7782 129.382C61.8201 127.347 57.1583 125.174 54.6434 123.225C54.0629 122.775 53.6838 122.402 53.4472 122.126C53.2131 121.853 53.1515 121.714 53.1544 121.72C53.1643 121.742 53.2097 121.862 53.2206 122.041C53.2314 122.22 53.1989 122.308 53.2136 122.261L45.5915 119.775Z',
};
const ELLIPSE = {"cx":130.429,"cy":204.082,"rx":69.7375,"ry":11.955};

// ── Lottie builder helpers ──────────────────────────────────────────────────
const hexToRgb1 = (hex) => {
  hex = hex.replace('#', '')
  return [parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255]
}

const EASE = {
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

// Skottie requires an animated property's keyframe array to start at t=0;
// prepend a hold at the same value if the authored first keyframe is later.
function ensureStartsAtZero(points) {
  if (points[0].t === 0) return points
  return [{ t: 0, v: points[0].v, ease: points[0].ease }, ...points]
}

function animProp(points) {
  points = ensureStartsAtZero(points)
  const keys = points.map((p, idx) => {
    const isLast = idx === points.length - 1
    return kf(p.t, p.v, isLast ? null : (EASE[p.ease] || EASE.settleSoft))
  })
  return { a: 1, k: keys }
}

function shapeFromSubpath(sp, nm) {
  return { ty: 'sh', nm, ks: { a: 0, k: { c: sp.closed, v: sp.v, i: sp.i, o: sp.o } } }
}

function fillItem(colorHex, opacity = 100, rule = 1, nm = 'Fill') {
  const [r, g, b] = hexToRgb1(colorHex)
  return { ty: 'fl', nm, o: { a: 0, k: opacity }, c: { a: 0, k: [r, g, b, 1] }, r }
}

function strokeItem(colorHex, width, opacity = 100, nm = 'Stroke') {
  const [r, g, b] = hexToRgb1(colorHex)
  return { ty: 'st', nm, o: { a: 0, k: opacity }, w: { a: 0, k: width }, c: { a: 0, k: [r, g, b, 1] }, lc: 2, lj: 2 }
}

function groupTransform({ p = [0, 0], a = [0, 0], s = [100, 100], r = 0, o = 100 } = {}) {
  return { ty: 'tr', p: { a: 0, k: p }, a: { a: 0, k: a }, s: { a: 0, k: s }, r: { a: 0, k: r }, o: { a: 0, k: o }, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 } }
}

function group(nm, items, transform) {
  return { ty: 'gr', nm, it: [...items, groupTransform(transform)] }
}

function trimItem({ s = 0, eKeys, sKeys, m = 1, nm = 'Trim' } = {}) {
  const it = { ty: 'tm', nm, o: { a: 0, k: 0 }, m }
  it.e = eKeys ? { a: 1, k: trimEaseKeys(eKeys) } : { a: 0, k: 100 }
  it.s = sKeys ? { a: 1, k: trimEaseKeys(sKeys) } : { a: 0, k: s }
  return it
}

function trimEaseKeys(points) {
  points = ensureStartsAtZero(points)
  return points.map((p, idx) => {
    const isLast = idx === points.length - 1
    const k = { t: p.t, s: [p.v] }
    if (!isLast) {
      const [x1, y1, x2, y2] = EASE[p.ease] || EASE.settleSoft
      k.o = { x: [x1], y: [y1] }
      k.i = { x: [x2], y: [y2] }
    }
    return k
  })
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
function bboxUnion(a, b) { return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])] }

function baseTransform({ a = [0, 0, 0], p = [0, 0, 0], s = [100, 100, 100], o = 100 } = {}) {
  return { a: { a: 0, k: a }, p: { a: 0, k: p }, s: { a: 0, k: s }, r: { a: 0, k: 0 }, o: { a: 0, k: o } }
}

function layer({ nm, ind, shapes, ks }) {
  return { ddd: 0, ind, ty: 4, nm, sr: 1, ks, ao: 0, shapes, ip: 0, op: FRAMES, st: 0, bm: 0 }
}

// ── Bezier path sampling (for the plane's orbit) ────────────────────────────
function buildSegments(subpath) {
  const { v, i, o } = subpath
  const segs = []
  for (let k = 0; k < v.length - 1; k++) {
    segs.push([v[k], [v[k][0] + o[k][0], v[k][1] + o[k][1]], [v[k + 1][0] + i[k + 1][0], v[k + 1][1] + i[k + 1][1]], v[k + 1]])
  }
  return segs
}
function bezPt(seg, t) {
  const mt = 1 - t
  return [
    mt * mt * mt * seg[0][0] + 3 * mt * mt * t * seg[1][0] + 3 * mt * t * t * seg[2][0] + t * t * t * seg[3][0],
    mt * mt * mt * seg[0][1] + 3 * mt * mt * t * seg[1][1] + 3 * mt * t * t * seg[2][1] + t * t * t * seg[3][1],
  ]
}
function bezTangent(seg, t) {
  const mt = 1 - t
  return [
    3 * mt * mt * (seg[1][0] - seg[0][0]) + 6 * mt * t * (seg[2][0] - seg[1][0]) + 3 * t * t * (seg[3][0] - seg[2][0]),
    3 * mt * mt * (seg[1][1] - seg[0][1]) + 6 * mt * t * (seg[2][1] - seg[1][1]) + 3 * t * t * (seg[3][1] - seg[2][1]),
  ]
}
// Build a fine-grained arc-length lookup table across all segments.
// Table entries: { u (global 0..1 path parameter), pt, tan, len (cumulative) }.
function buildArcTable(subpath, samplesPerSeg = 200) {
  const segs = buildSegments(subpath)
  const table = []
  let cum = 0, prev = null
  for (let s = 0; s < segs.length; s++) {
    for (let j = 0; j <= samplesPerSeg; j++) {
      if (s > 0 && j === 0) continue
      const t = j / samplesPerSeg
      const pt = bezPt(segs[s], t)
      if (prev) cum += Math.hypot(pt[0] - prev[0], pt[1] - prev[1])
      table.push({ u: (s + t) / segs.length, pt, tan: bezTangent(segs[s], t), len: cum })
      prev = pt
    }
  }
  return { table, total: cum }
}
function sampleAtU(arcTable, u) {
  const { table } = arcTable
  let lo = 0, hi = table.length - 1
  for (let k = 0; k < table.length - 1; k++) { if (table[k].u <= u && table[k + 1].u >= u) { lo = k; hi = k + 1; break } }
  const a = table[lo], b = table[hi]
  const f = (u - a.u) / ((b.u - a.u) || 1)
  return {
    pt: [a.pt[0] + (b.pt[0] - a.pt[0]) * f, a.pt[1] + (b.pt[1] - a.pt[1]) * f],
    tan: [a.tan[0] + (b.tan[0] - a.tan[0]) * f, a.tan[1] + (b.tan[1] - a.tan[1]) * f],
    lenFrac: (a.len + (b.len - a.len) * f) / arcTable.total,
  }
}
// Nearest table entry to a target point -> arc-length fraction (0..1).
function nearestLenFrac(arcTable, px, py) {
  let best = null, bd = Infinity
  for (const e of arcTable.table) {
    const d = Math.hypot(e.pt[0] - px, e.pt[1] - py)
    if (d < bd) { bd = d; best = e }
  }
  return best.len / arcTable.total
}

function rotatePoint([px, py], [cx, cy], deg) {
  const rad = (deg * Math.PI) / 180
  const cos = Math.cos(rad), sin = Math.sin(rad)
  const dx = px - cx, dy = py - cy
  return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos]
}
function rotateVec([vx, vy], deg) {
  const rad = (deg * Math.PI) / 180
  const cos = Math.cos(rad), sin = Math.sin(rad)
  return [vx * cos - vy * sin, vx * sin + vy * cos]
}
// Rigidly transform a parsed subpath: rotate around `pivot` by `deg`, then
// translate so `pivot` lands on `target`.
function transformSubpath(sp, pivot, deg, target) {
  const v = sp.v.map((p) => { const r = rotatePoint(p, pivot, deg); return [r[0] + (target[0] - pivot[0]), r[1] + (target[1] - pivot[1])] })
  const i = sp.i.map((t) => rotateVec(t, deg))
  const o = sp.o.map((t) => rotateVec(t, deg))
  return { closed: sp.closed, v, i, o }
}

// ============================================================
// LAYER CONTENT ASSEMBLY
// ============================================================
let ind = 1
const layers = []

// ---- Beat 1: globe + continents + ground-shadow ellipse (shared pop-in) ----
{
  const globe = parsePath(SVG_PATHS.globe)[0]
  const c1 = parsePath(SVG_PATHS.continent1)[0]
  const c2 = parsePath(SVG_PATHS.continent2)[0]
  const items = [
    group('continent2', [shapeFromSubpath(c2, 'continent2-path'), fillItem('#222222')]),
    group('continent1', [shapeFromSubpath(c1, 'continent1-path'), fillItem('#222222')]),
    group('globe', [shapeFromSubpath(globe, 'globe-path'), fillItem('#FFFFFF'), strokeItem('#222222', 2)]),
    group('ground-shadow', [
      { ty: 'el', nm: 'shadow-ellipse', p: { a: 0, k: [ELLIPSE.cx, ELLIPSE.cy] }, s: { a: 0, k: [ELLIPSE.rx * 2, ELLIPSE.ry * 2] } },
      fillItem('#8C8C8C', 15, 1),
    ]),
  ]
  const c = bboxCenter([65.93, 60.9, 194.88, 189.85])
  const ks = baseTransform({ a: [c[0], c[1], 0], p: [c[0], c[1], 0] })
  ks.s = animProp([
    { t: 0, v: [60, 60, 100], ease: 'entranceSharp' },
    { t: 18, v: [112, 112, 100], ease: 'settleSoft' },
    { t: 28, v: [100, 100, 100] },
  ])
  ks.o = animProp([
    { t: 0, v: 0, ease: 'entranceSharp' },
    { t: 12, v: 100 },
  ])
  layers.push(layer({ nm: 'globe', ind: ind++, shapes: items, ks }))
}

// ---- Beat 2: orbit trail + eraser patches + plane ----
const FLIGHT_START = 44, FLIGHT_END = 152, FLIGHT_FRAMES = FLIGHT_END - FLIGHT_START
const N_SAMPLES = 16

const orbitSubpath = parsePath(SVG_PATHS.orbit)[0]
const orbitArc = buildArcTable(orbitSubpath)

// Precompute flight samples: s=0 (left end, u=1) -> s=1 (rest, u=0).
const restHeading = (() => {
  const { tan } = sampleAtU(orbitArc, 0)
  return Math.atan2(-tan[1], -tan[0]) * 180 / Math.PI
})()
const flightSamples = []
for (let k = 0; k <= N_SAMPLES; k++) {
  const s = k / N_SAMPLES
  const u = 1 - s
  const { pt, tan, lenFrac } = sampleAtU(orbitArc, u)
  const heading = Math.atan2(-tan[1], -tan[0]) * 180 / Math.PI
  const rot = heading - restHeading
  flightSamples.push({ s, u, pt, lenFrac, rot })
}

// ---- orbit trail (trim 's' shrinks 100->0 in sync with flight progress) ----
{
  const sp = orbitSubpath
  const shapes = [group('orbit', [
    shapeFromSubpath(sp, 'orbit-path'),
    strokeItem('#222222', 2),
    trimItem({
      sKeys: flightSamples.map((f, idx) => ({
        t: Math.round(FLIGHT_START + f.s * FLIGHT_FRAMES),
        v: (1 - f.s) * 100,
        ease: idx === N_SAMPLES - 1 ? 'settleSoft' : 'travelBalanced',
      })),
    }),
  ])]
  layers.push(layer({ nm: 'orbit', ind: ind++, shapes, ks: baseTransform() }))
}

// ---- eraser patches (pop in exactly when the trail reaches their point) ---
{
  const e1 = parsePath(SVG_PATHS.eraser1)[0]
  const e1Center = bboxCenter(bboxOf([e1]))
  const e1LenFrac = nearestLenFrac(orbitArc, e1Center[0], e1Center[1])
  const e1S = 1 - e1LenFrac
  const e1Frame = Math.round(FLIGHT_START + e1S * FLIGHT_FRAMES)

  const e2 = parsePath(SVG_PATHS.eraser2)[0]
  const e2Center = bboxCenter(bboxOf([e2]))
  const e2LenFrac = nearestLenFrac(orbitArc, e2Center[0], e2Center[1])
  const e2S = 1 - e2LenFrac
  const e2Frame = Math.round(FLIGHT_START + e2S * FLIGHT_FRAMES)

  for (const [nm, sp, frame] of [['eraser1', e1, e1Frame], ['eraser2', e2, e2Frame]]) {
    const shapes = [group(nm, [shapeFromSubpath(sp, `${nm}-path`), strokeItem('#FFFFFF', 2)])]
    const ks = baseTransform()
    ks.o = animProp([{ t: frame, v: 0, ease: 'entranceSharp' }, { t: frame + 4, v: 100 }])
    layers.push(layer({ nm, ind: ind++, shapes, ks }))
  }
}

// ---- plane (baked rigid-transform shape keyframes; body + wing) ----
{
  const bodySrc = parsePath(SVG_PATHS.planeBody)[0]
  const wingSrc = parsePath(SVG_PATHS.planeWing)[0]
  const pivot = bboxCenter(bboxUnion(bboxOf([bodySrc]), bboxOf([wingSrc])))

  function bakedShapeProp(src) {
    const points = flightSamples.map((f, idx) => ({
      t: Math.round(FLIGHT_START + f.s * FLIGHT_FRAMES),
      v: transformSubpath(src, pivot, f.rot, f.pt),
      ease: idx === N_SAMPLES - 1 ? 'settleSoft' : 'travelBalanced',
    }))
    return animProp(points)
  }

  const bodyShape = { ty: 'sh', nm: 'plane-body-path', ks: bakedShapeProp(bodySrc) }
  const wingShape = { ty: 'sh', nm: 'plane-wing-path', ks: bakedShapeProp(wingSrc) }
  const shapes = [
    group('plane-wing', [wingShape, fillItem('#FFFFFF')]),
    group('plane-body', [bodyShape, fillItem('#FFFFFF')]),
  ]
  const ks = baseTransform()
  ks.o = animProp([
    { t: FLIGHT_START - 8, v: 0, ease: 'entranceSharp' },
    { t: FLIGHT_START, v: 100 },
  ])
  layers.push(layer({ nm: 'plane', ind: ind++, shapes, ks }))
}

// ---- Beat 3: ribbon front (sequential), echo (simultaneous), leaf, dot ----
const RIBBON_START = 160, RIBBON_FRONT_END = 192, RIBBON_ECHO_END = 202

{
  // ribbonFront subpaths: [0]cap [1]cap [2]cap [3]cap [4]band-A(bottom) [5]band-B(upper)
  // Sequenced as bottom band (with its two caps) then upper band (with its two caps).
  const rf = parsePath(SVG_PATHS.ribbonFront)
  const order = [0, 4, 1, 2, 5, 3].map((i) => rf[i])
  const items = order.map((sp, idx) => shapeFromSubpath(sp, `ribbon-front-path${idx}`))
  items.push(fillItem('#22E243'))
  items.push(trimItem({ eKeys: [{ t: RIBBON_START, v: 0, ease: 'travelBalanced' }, { t: RIBBON_FRONT_END, v: 100 }], m: 2 }))
  layers.push(layer({ nm: 'ribbon-front', ind: ind++, shapes: [group('ribbon-front', items)], ks: baseTransform() }))
}

{
  // ribbonEcho subpaths: [0..5] caps, [6][7][8] bands (lower/middle/top). Reveal
  // together (simultaneous) as one translucent "behind" pass.
  const echoSp = parsePath(SVG_PATHS.ribbonEcho)
  const items = echoSp.map((s, i) => shapeFromSubpath(s, `ribbon-echo-path${i}`))
  const gStops = [0, 0.30516, 0.9696, 1]
  const gAlpha = [0.5, 0.63675, 0.98342, 1.0]
  const [r, g, b] = hexToRgb1('#22E243')
  const colorArr = [], alphaArr = []
  gStops.forEach((s, i) => { colorArr.push(s, r, g, b); alphaArr.push(s, gAlpha[i]) })
  items.push({
    ty: 'gf', nm: 'Gradient Fill', o: { a: 0, k: 100 }, r: 1,
    g: { p: 4, k: { a: 0, k: [...colorArr, ...alphaArr] } },
    s: { a: 0, k: [151.1, 79.3] }, e: { a: 0, k: [63.4, 179.6] }, t: 2,
  })
  items.push(trimItem({ eKeys: [{ t: RIBBON_FRONT_END, v: 0, ease: 'travelBalanced' }, { t: RIBBON_ECHO_END, v: 100 }], m: 1 }))
  layers.push(layer({ nm: 'ribbon-echo', ind: ind++, shapes: [group('ribbon-echo', items)], ks: baseTransform() }))
}

for (const [nm, key, popStart] of [['leaf', 'leaf', RIBBON_ECHO_END], ['dot', 'dot', RIBBON_ECHO_END + 4]]) {
  const sp = parsePath(SVG_PATHS[key])[0]
  const c = bboxCenter(bboxOf([sp]))
  const shapes = [group(nm, [shapeFromSubpath(sp, `${nm}-path`), fillItem('#22E243')])]
  const ks = baseTransform({ a: [c[0], c[1], 0], p: [c[0], c[1], 0] })
  ks.s = animProp([
    { t: popStart, v: [0, 0, 100], ease: 'entranceSharp' },
    { t: popStart + 6, v: [118, 118, 100], ease: 'settleSoft' },
    { t: popStart + 10, v: [100, 100, 100] },
  ])
  ks.o = animProp([{ t: popStart, v: 0, ease: 'entranceSharp' }, { t: popStart + 3, v: 100 }])
  layers.push(layer({ nm, ind: ind++, shapes, ks }))
}

// ============================================================
// Layers were pushed in build-convenience order above; reorder to the
// actual front-to-back paint order (array index 0 = frontmost) matching
// the source SVG: ribbon-front, dot, leaf, eraser2, eraser1, plane, orbit,
// globe (bundles continents + ground shadow), ribbon-echo (behind globe).
const FRONT_TO_BACK = ['ribbon-front', 'dot', 'leaf', 'eraser2', 'eraser1', 'plane', 'orbit', 'globe', 'ribbon-echo']
layers.sort((a, b) => FRONT_TO_BACK.indexOf(a.nm) - FRONT_TO_BACK.indexOf(b.nm))

const doc = {
  v: '5.9.0', fr: FPS, ip: 0, op: FRAMES, w: W, h: H, nm: 'WorldWide Entrance',
  ddd: 0, assets: [], layers, markers: [],
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT, JSON.stringify(doc))
console.log(`Wrote ${OUT} — ${layers.length} layers, ${FRAMES}f @ ${FPS}fps`)
