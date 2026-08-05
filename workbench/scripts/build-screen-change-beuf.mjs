#!/usr/bin/env node
/**
 * Generates the Lottie JSON for the "screen-change-beuf" ENTRY scene — two
 * mobile screens (transfer processing -> transfer confirmed) told as ONE
 * continuous composition, per assets/screen-change-beuf.svg (screen 1) and
 * assets/screen-change-beuf-2.svg (screen 2).
 * Output: public/projects/screen-change-beuf/scene-1/lottie.json
 *
 * Both screens share identical chrome (status bar, header title, two hand-
 * drawn clouds) at identical coordinates — confirmed byte-for-byte against
 * both source SVGs. This build treats that chrome as ONE set of layers that
 * never rebuilds; only the mark (ring+checkmark), headline, sub-copy, close
 * icon, and confirm button are new content that arrives in screen 2.
 *
 * screen-transfer-complete.svg ships the finished screen TWICE (a buried
 * "Screen" group under an opaque "Screen_2" group) — a Figma export
 * artifact. Only "Screen_2"'s ids (suffixed "_2") are used here; the buried
 * copy (and its home-indicator, which isn't part of the visible design) is
 * ignored entirely.
 *
 * Five beats, 60fps / 360 frames (6.0s), plays once and holds on the final
 * frame (= screen 2, pixel-exact):
 *  1. 0-~188   Clouds drift right-to-left at constant (mechanical) velocity,
 *              each wrapping off the left edge and back in from the right.
 *              The near/lower cloud completes 2 whole wraps, the far/upper
 *              cloud 1, so both land back on frame-0 coordinates by design
 *              (see buildWrapPoints).
 *  2. ~188-230 The last ~50px of drift eases out (settleSoft) into a full
 *              stop, landing exactly on native/source position.
 *  3. 216-280  The ring draws on (216-250, travelBalanced — "ink being laid
 *              down"), then the checkmark (250-280, entranceSharp — "the
 *              payoff", more snap). Each stroke's pen-down/pen-lift ink
 *              marks pop in exactly as the trim reaches them, never before.
 *  4. 276-308  Close icon + headline fade/rise together, then sub-copy
 *              (+7f/~120ms), then the confirm button (+7f) — settleSoft,
 *              ~8px rise, no bounce.
 *  5. 308-359  Hold. Final frame equals screen 2 exactly.
 *
 * Clipping: the whole scene is precomposed and matted by one 375x812 rx=40
 * rounded-rect shape (same technique as build-dataprocessing.mjs's
 * matte-circle + tt:1 precomp), so the clouds' wrap-around and any chrome
 * edges stay clipped to the rounded canvas — never a plain rectangle.
 *
 * Skottie gotchas carried from every other build script here:
 *  - Non-zero anchor + animated position freezes; anchor [0,0,0] + animated
 *    position is safe (used for the cloud drift and the beat-4 rise).
 *  - Non-zero anchor + animated scale is safe (used for the ink-mark pops).
 *  - A gradient stroke/fill is safe fully static; only animating its own
 *    stops/points breaks — the ring's gradient never animates, only the
 *    trim drawn over it does. The checkmark's source gradient (paint2) has
 *    two identical stops, so it's flattened to a flat color.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../public/projects/screen-change-beuf/scene-1')
const OUT = join(OUT_DIR, 'lottie.json')

const W = 375, H = 812, FPS = 60, FRAMES = 360 // 6.0s, plays once and holds

// ── Pull the long text-glyph compound paths straight from the source SVGs ──
// (transcribing 20k+/50k+ char compound paths by hand is exactly the kind of
// thing that silently corrupts a stray digit — parse them at build time).
const SVG1 = readFileSync(join(__dirname, '../assets/screen-change-beuf.svg'), 'utf8')
const SVG2 = readFileSync(join(__dirname, '../assets/screen-change-beuf-2.svg'), 'utf8')

function extractPathD(svg, id) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`<path id="${escaped}"[^>]*?\\sd="([^"]*)"`)
  const m = svg.match(re)
  if (!m) throw new Error(`path id not found in SVG: ${id}`)
  return m[1]
}

const HEADER_TEXT_D = extractPathD(SVG1, 'Header text')
const HEADLINE_D = extractPathD(SVG2, 'Transfer is on its way_2')
const SUBCOPY_D = extractPathD(SVG2, 'Text_3')
const BUTTON_LABEL_D = extractPathD(SVG2, 'Text_4')

// ── Small/geometric paths, verified against both source SVGs (identical
// coordinates in screen-change-beuf.svg and the visible "_2" copy in
// screen-change-beuf-2.svg for the shared chrome) ──────────────────────────
const CLOUD_NEAR = {
  bump: 'M23.3262 281.472H35.1935C34.6511 280.061 34.3539 278.53 34.3539 276.929C34.3539 269.944 40.0163 264.281 47.0023 264.281C49.4663 264.281 51.7575 264.996 53.7019 266.215C53.7705 253.313 64.2476 242.875 77.1649 242.875C88.1323 242.875 97.3398 250.399 99.9127 260.567C102.518 258.845 105.636 257.837 108.992 257.837C118.104 257.837 125.489 265.223 125.489 274.335C125.489 277.02 124.848 279.555 123.71 281.796H138.462',
  dashL: 'M17.8137 281.797H9.38086',
  dashR: 'M153.382 281.797H144.949',
}
const CLOUD_FAR = {
  bump: 'M260.957 213.987H270.177C269.756 212.891 269.525 211.701 269.525 210.458C269.525 205.03 273.924 200.631 279.352 200.631C281.266 200.631 283.046 201.187 284.557 202.133C284.61 192.11 292.75 184 302.786 184C311.306 184 318.46 189.846 320.459 197.745C322.483 196.408 324.906 195.624 327.513 195.624C334.592 195.624 340.33 201.363 340.33 208.442C340.33 210.528 339.832 212.498 338.947 214.239H350.409',
  dashL: 'M239.286 214.234H232.734',
  dashR: 'M362.001 214.234H355.449',
}
const RING = {
  stroke: 'M274.998 263.718C274.707 280.382 269.681 296.619 260.507 310.533C251.332 324.447 238.388 335.463 223.187 342.295C207.985 349.127 191.153 351.492 174.657 349.115C158.161 346.738 142.682 339.716 130.028 328.87C117.374 318.024 108.067 303.802 103.194 287.864C98.3216 271.926 98.0843 254.93 102.51 238.862C106.936 222.794 115.842 208.317 128.189 197.122C140.535 185.927 155.812 178.476 172.235 175.64',
  endBlob: 'M171.598 182.903L172.927 182.613C173.942 182.393 174.641 181.921 175.165 181.177C175.688 180.488 176.032 179.57 176.278 178.586C176.506 177.661 176.922 176.803 177.544 176.167C178.928 174.826 181.412 174.826 182.483 174.026C183.145 173.5 183.613 172.746 183.734 171.788C183.856 170.829 183.625 169.583 182.985 168.872C182.349 168.151 181.189 167.692 180.091 167.665C176.206 167.766 173.143 168.153 168.497 169.166C161.491 170.693 163.188 184.234 171.598 182.903Z',
  endDot: 'M191 173.045C192.538 172.767 193.56 171.295 193.282 169.756C193.004 168.218 191.532 167.196 189.994 167.474C188.456 167.751 187.434 169.224 187.712 170.762C187.99 172.301 189.462 173.323 191 173.045Z',
}
const RING_BEGIN_DOT = { cx: 272.5, cy: 261.5, r: 9.5 }
const TICK = {
  stroke: 'M271.438 172.401C271.438 172.401 205.082 310.083 170.551 292.469C148.332 281.135 158.707 243.983 158.707 243.983',
  startBlob: 'M278.62 173.296L279.168 172.081C279.588 171.154 279.63 170.331 279.358 169.488C279.129 168.679 278.619 167.878 278.001 167.116C277.417 166.402 276.996 165.579 276.864 164.722C276.632 162.857 278.076 160.9 278.08 159.593C278.058 158.768 277.746 157.964 277.075 157.315C276.405 156.666 275.307 156.129 274.384 156.222C273.456 156.307 272.427 156.957 271.768 157.807C269.587 160.927 268.106 163.565 266.189 167.812C263.298 174.215 274.761 180.693 278.62 173.296Z',
  startDot: 'M281.174 150.287C281.985 148.988 281.589 147.277 280.289 146.466C278.989 145.655 277.279 146.051 276.468 147.351C275.657 148.65 276.054 150.361 277.353 151.171C278.653 151.982 280.364 151.586 281.174 150.287Z',
}
const CLOSE_ICON_D = 'M23.3516 74.6978L40.6978 57.3516M40.6978 74.6978L23.3516 57.3516'
const BATTERY_BORDER = { x: 336.5, y: 17.8359, w: 21, h: 10.3333, r: 2.16667 }
const BATTERY_CAP_D = 'M359 21V25C359.805 24.6612 360.328 23.8731 360.328 23C360.328 22.1269 359.805 21.3388 359 21'
const BATTERY_CAPACITY = { x: 338, y: 19.3359, w: 18, h: 7.33333, r: 1.33333 }
const WIFI_D = 'M321.33 25.4267C322.583 24.3444 324.418 24.3444 325.671 25.4267C325.734 25.4849 325.771 25.5675 325.772 25.6542C325.774 25.7408 325.74 25.824 325.68 25.8847L323.718 27.9072C323.66 27.9664 323.582 27.9999 323.5 27.9999C323.418 27.9998 323.34 27.9665 323.282 27.9072L321.32 25.8847C321.26 25.824 321.227 25.7407 321.229 25.6542C321.23 25.5675 321.267 25.4849 321.33 25.4267ZM318.712 22.7294C321.411 20.165 325.592 20.165 328.291 22.7294C328.352 22.7895 328.387 22.8725 328.388 22.9589C328.388 23.0453 328.355 23.1281 328.295 23.1894L327.161 24.3603C327.044 24.4796 326.855 24.4814 326.735 24.3652C325.849 23.5456 324.696 23.0917 323.5 23.0917C322.305 23.0923 321.153 23.5462 320.268 24.3652C320.148 24.4815 319.959 24.4796 319.842 24.3603L318.708 23.1894C318.648 23.1282 318.616 23.0452 318.616 22.9589C318.617 22.8725 318.651 22.7895 318.712 22.7294ZM316.095 20.039C320.235 15.987 326.765 15.987 330.905 20.039C330.965 20.0992 331 20.1817 331 20.2675C331 20.3533 330.967 20.4361 330.908 20.497L329.772 21.6669C329.655 21.7868 329.466 21.788 329.348 21.6699C327.77 20.1383 325.676 19.2842 323.5 19.2841C321.324 19.2842 319.231 20.1385 317.653 21.6699C317.535 21.7882 317.344 21.7871 317.228 21.6669L316.092 20.497C316.033 20.4361 316 20.3532 316 20.2675C316.001 20.1817 316.035 20.0991 316.095 20.039Z'
const CELLULAR_D = 'M296 24.875C296.552 24.875 297 25.3367 297 25.9062V27.9688C297 28.5383 296.552 29 296 29H295C294.448 29 294 28.5383 294 27.9688V25.9062C294 25.3367 294.448 24.875 295 24.875H296ZM300.667 22.8125C301.219 22.8127 301.667 23.2743 301.667 23.8438V27.9688C301.667 28.5382 301.219 28.9998 300.667 29H299.667C299.115 29 298.667 28.5383 298.667 27.9688V23.8438C298.667 23.2742 299.115 22.8125 299.667 22.8125H300.667ZM305.333 20.4062C305.885 20.4062 306.333 20.868 306.333 21.4375V27.9688C306.333 28.5383 305.885 29 305.333 29H304.333C303.781 28.9998 303.333 28.5382 303.333 27.9688V21.4375C303.333 20.8681 303.781 20.4064 304.333 20.4062H305.333ZM310 18C310.552 18 311 18.4617 311 19.0312V27.9688C311 28.5383 310.552 29 310 29H309C308.448 29 308 28.5383 308 27.9688V19.0312C308 18.4617 308.448 18 309 18H310Z'
const TIME_PATHS = [
  'M59.207 28.5049H60.9707V18.6406H59.2139L56.6367 20.4521V22.1133L59.0908 20.377H59.207V28.5049Z',
  'M52.2207 28.5049H53.9092V26.6113H55.2354V25.1553H53.9092V18.6406H51.4141C50.0742 20.6777 48.6729 22.9473 47.3945 25.1689V26.6113H52.2207V28.5049ZM49.0352 25.1963V25.0938C49.9922 23.4189 51.1338 21.5938 52.1455 20.0488H52.248V25.1963H49.0352Z',
  'M44.6123 22.1133C45.2412 22.1133 45.6992 21.6348 45.6992 21.0332C45.6992 20.4248 45.2412 19.9531 44.6123 19.9531C43.9902 19.9531 43.5254 20.4248 43.5254 21.0332C43.5254 21.6348 43.9902 22.1133 44.6123 22.1133ZM44.6123 27.1855C45.2412 27.1855 45.6992 26.7139 45.6992 26.1055C45.6992 25.4971 45.2412 25.0254 44.6123 25.0254C43.9902 25.0254 43.5254 25.4971 43.5254 26.1055C43.5254 26.7139 43.9902 27.1855 44.6123 27.1855Z',
  'M37.8516 18.3906C35.7119 18.3906 34.1875 19.8535 34.1875 21.8564V21.8701C34.1875 23.7432 35.5137 25.124 37.4072 25.124C38.7607 25.124 39.6221 24.4336 39.9844 23.6543H40.1211C40.1211 23.7295 40.1143 23.8047 40.1143 23.8799C40.0391 25.7666 39.376 27.2979 37.8105 27.2979C36.9424 27.2979 36.334 26.8467 36.0742 26.1562L36.0537 26.0879H34.3174L34.3311 26.1631C34.6455 27.6738 35.999 28.7471 37.8105 28.7471C40.292 28.7471 41.7891 26.7783 41.7891 23.4561V23.4424C41.7891 19.8877 39.957 18.3906 37.8516 18.3906ZM37.8447 23.7705C36.7236 23.7705 35.9102 22.9502 35.9102 21.8086V21.7949C35.9102 20.6943 36.7783 19.8262 37.8652 19.8262C38.959 19.8262 39.8135 20.708 39.8135 21.8359V21.8496C39.8135 22.9639 38.959 23.7705 37.8447 23.7705Z',
]

// ── SVG path → Lottie bezier (identical tokenizer to every other build
// script here; only M/L/H/V/C/Z appear in this source) ─────────────────────
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

// ── Lottie builder helpers (same vocabulary as build-dataprocessing.mjs) ───
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

function trimEaseKeys(points) {
  points = ensureStartsAtZero(points)
  return points.map((p, idx) => {
    const isLast = idx === points.length - 1
    const k = { t: p.t, s: [p.v] }
    if (!isLast) {
      const [x1, y1, x2, y2] = EASE[p.ease] || EASE.linear
      k.o = { x: [x1], y: [y1] }
      k.i = { x: [x2], y: [y2] }
    }
    return k
  })
}
function trimItem({ eKeys, m = 1, nm = 'Trim' } = {}) {
  return { ty: 'tm', nm, s: { a: 0, k: 0 }, e: { a: 1, k: trimEaseKeys(eKeys) }, o: { a: 0, k: 0 }, m }
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

// Static (non-animated) linear gradient stroke — color-stops-then-alpha-stops
// packing, same convention as every other gradient in this project.
function gradientStrokeItem({ stops, width, opacity = 100, s, e, nm = 'Gradient Stroke' }) {
  const colorArr = [], alphaArr = []
  for (const st of stops) {
    const [r, g, b] = hexToRgb1(st.color)
    colorArr.push(st.offset, r, g, b)
    alphaArr.push(st.offset, st.alpha ?? 1)
  }
  return {
    ty: 'gs', nm, o: { a: 0, k: opacity }, w: { a: 0, k: width },
    g: { p: stops.length, k: { a: 0, k: [...colorArr, ...alphaArr] } },
    s: { a: 0, k: s }, e: { a: 0, k: e }, t: 1, lc: 2, lj: 2,
  }
}

function rectShapeItems(x, y, w, h, r, { fill, stroke, strokeWidth = 1, opacity = 100 } = {}) {
  const items = [{ ty: 'rc', nm: 'rect', p: { a: 0, k: [x + w / 2, y + h / 2] }, s: { a: 0, k: [w, h] }, r: { a: 0, k: r } }]
  if (fill) items.push(fillItem(fill, opacity))
  if (stroke) items.push(strokeItem(stroke, strokeWidth, opacity))
  return items
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
  const l = { ddd: 0, ind, ty: refId ? 0 : 4, nm, sr: 1, ks, ao, ip: 0, op: FRAMES, st: 0, bm: 0 }
  if (refId) { l.refId = refId; l.w = w; l.h = h } else { l.shapes = shapes }
  if (tt) l.tt = tt
  if (td) l.td = 1
  return l
}

// ── Cloud wrap-around drift ─────────────────────────────────────────────────
// Builds a keyframe list for a horizontal position OFFSET (added to the
// cloud's native/source position) that:
//   - travels left at a CONSTANT velocity (mechanical, per the brief's "smooth,
//     even drift"),
//   - "wraps" via an instant 1-frame jump whenever the cloud is fully
//     offscreen on both sides of the jump (so the reset is invisible),
//   - completes exactly `laps` full wraps, and
//   - eases (settleSoft) through the final `finalApproach` px into landing
//     EXACTLY on offset 0 (native/source position) at `settleEndFrame`.
function buildWrapPoints({ exit, enter, laps, velocity, finalApproach, settleEndFrame }) {
  const lapDistance = Math.abs(exit) + enter
  const totalDistance = laps * lapDistance
  const capDistance = totalDistance - finalApproach
  const pts = [{ t: 0, v: [0, 0, 0], ease: 'linear' }]
  let traveled = 0
  for (let lap = 0; lap < laps; lap++) {
    // exit leg: 0 -> exit (fully offscreen-left)
    const exitLeg = Math.abs(exit)
    if (traveled + exitLeg >= capDistance) {
      const capValue = -(capDistance - traveled)
      const capFrame = Math.round(capDistance / velocity)
      pts.push({ t: capFrame, v: [capValue, 0, 0], ease: 'settleSoft' })
      pts.push({ t: settleEndFrame, v: [0, 0, 0] })
      return pts
    }
    traveled += exitLeg
    const exitFrame = Math.round(traveled / velocity)
    pts.push({ t: exitFrame, v: [exit, 0, 0], ease: 'linear' })
    pts.push({ t: exitFrame + 1, v: [enter, 0, 0], ease: 'linear' }) // instant wrap: reappear offscreen-right

    // enter leg: enter -> 0 (drifting back into frame)
    const enterLeg = enter
    if (traveled + enterLeg >= capDistance) {
      const capValue = enter - (capDistance - traveled)
      const capFrame = Math.round(capDistance / velocity)
      pts.push({ t: capFrame, v: [capValue, 0, 0], ease: 'settleSoft' })
      pts.push({ t: settleEndFrame, v: [0, 0, 0] })
      return pts
    }
    traveled += enterLeg
    const enterFrame = Math.round(traveled / velocity)
    pts.push({ t: enterFrame, v: [0, 0, 0], ease: 'linear' })
  }
  pts.push({ t: settleEndFrame, v: [0, 0, 0] })
  return pts
}

// ============================================================
// TIMELINE CONSTANTS
// ============================================================
const CLOUD_FINAL_APPROACH = 50
const CLOUD_LIN_END = 188          // both clouds reach their final-approach cap here
const CLOUD_SETTLE_END = 230       // both clouds land exactly on native position here

const RING_DRAW = [216, 250]
const RING_BEGIN_POP = [216, 228]
const RING_END_POP = [238, 250]
const TICK_DRAW = [250, 280]
const TICK_START_POP = [250, 262]

const BEAT4_STAGGER = 7            // ~120ms @ 60fps
const BEAT4_DURATION = 18
const BEAT4_START = 276            // close-icon + headline
const SUBCOPY_START = BEAT4_START + BEAT4_STAGGER
const BUTTON_START = SUBCOPY_START + BEAT4_STAGGER
const RISE = 8

// Cloud native bboxes (from CLOUD_NEAR/CLOUD_FAR dash endpoints, matching
// the actual authored SVG coordinates):
//   near: x [9.381, 153.382]  far: x [232.734, 362.001]
const NEAR_EXIT = -165, NEAR_ENTER = 378, NEAR_LAPS = 2
const FAR_EXIT = -370, FAR_ENTER = 155, FAR_LAPS = 1
const nearVelocity = (NEAR_LAPS * (Math.abs(NEAR_EXIT) + NEAR_ENTER) - CLOUD_FINAL_APPROACH) / CLOUD_LIN_END
const farVelocity = (FAR_LAPS * (Math.abs(FAR_EXIT) + FAR_ENTER) - CLOUD_FINAL_APPROACH) / CLOUD_LIN_END

// ============================================================
// PRECOMP CONTENT (everything the rounded-rect matte clips)
// ============================================================
const precompLayers = []
let pind = 1

// ---- close icon (X, top-left): fades in with the copy -------------------
{
  const subs = parsePath(CLOSE_ICON_D)
  const items = subs.map((s, i) => shapeFromSubpath(s, `close-icon-${i}`))
  items.push(strokeItem('#222222', 2))
  const shapes = [group('close-icon', items)]
  const ks = baseTransform()
  ks.p = animProp([{ t: BEAT4_START, v: [0, RISE, 0], ease: 'settleSoft' }, { t: BEAT4_START + BEAT4_DURATION, v: [0, 0, 0] }])
  ks.o = animProp([{ t: BEAT4_START, v: 0, ease: 'settleSoft' }, { t: BEAT4_START + BEAT4_DURATION, v: 100 }])
  precompLayers.push(layer({ nm: 'close-button', ind: pind++, shapes, ks }))
}

// ---- status bar + header title: shared chrome, static throughout --------
{
  const shapes = []
  shapes.push(group('battery-border', rectShapeItems(BATTERY_BORDER.x, BATTERY_BORDER.y, BATTERY_BORDER.w, BATTERY_BORDER.h, BATTERY_BORDER.r, { fill: '#222222', stroke: '#222222', strokeWidth: 1, opacity: 35 })))
  {
    const sp = parsePath(BATTERY_CAP_D)[0]
    shapes.push(group('battery-cap', [shapeFromSubpath(sp, 'battery-cap-path'), fillItem('#222222', 40)]))
  }
  shapes.push(group('battery-capacity', rectShapeItems(BATTERY_CAPACITY.x, BATTERY_CAPACITY.y, BATTERY_CAPACITY.w, BATTERY_CAPACITY.h, BATTERY_CAPACITY.r, { fill: '#222222' })))
  {
    const subs = parsePath(WIFI_D)
    shapes.push(group('wifi', [...subs.map((s, i) => shapeFromSubpath(s, `wifi-${i}`)), fillItem('#222222')]))
  }
  {
    const subs = parsePath(CELLULAR_D)
    shapes.push(group('cellular', [...subs.map((s, i) => shapeFromSubpath(s, `cellular-${i}`)), fillItem('#222222')]))
  }
  {
    const subs = TIME_PATHS.flatMap((d) => parsePath(d))
    shapes.push(group('time', [...subs.map((s, i) => shapeFromSubpath(s, `time-${i}`)), fillItem('#222222')]))
  }
  {
    const subs = parsePath(HEADER_TEXT_D)
    shapes.push(group('header-title', [...subs.map((s, i) => shapeFromSubpath(s, `header-title-${i}`)), fillItem('#222222')]))
  }
  precompLayers.push(layer({ nm: 'status-bar', ind: pind++, shapes, ks: baseTransform() }))
}

// ---- confirm button (pill + label): fades/rises last in beat 4 ----------
{
  const labelSubs = parsePath(BUTTON_LABEL_D)
  const labelGroup = group('confirm-button-label', [...labelSubs.map((s, i) => shapeFromSubpath(s, `confirm-button-label-${i}`)), fillItem('#222222')])
  const pillGroup = group('confirm-button-pill', rectShapeItems(67.5, 692, 240, 60, 30, { fill: '#FFFFFF' }).concat(strokeItem('#222222', 2)))
  const shapes = [labelGroup, pillGroup]
  const ks = baseTransform()
  ks.p = animProp([{ t: BUTTON_START, v: [0, RISE, 0], ease: 'settleSoft' }, { t: BUTTON_START + BEAT4_DURATION, v: [0, 0, 0] }])
  ks.o = animProp([{ t: BUTTON_START, v: 0, ease: 'settleSoft' }, { t: BUTTON_START + BEAT4_DURATION, v: 100 }])
  precompLayers.push(layer({ nm: 'confirm-button', ind: pind++, shapes, ks }))
}

// ---- sub-copy: single compound path, fades/rises second in beat 4 -------
{
  const subs = parsePath(SUBCOPY_D)
  const shapes = [group('sub-copy', [...subs.map((s, i) => shapeFromSubpath(s, `sub-copy-${i}`)), fillItem('#727272')])]
  const ks = baseTransform()
  ks.p = animProp([{ t: SUBCOPY_START, v: [0, RISE, 0], ease: 'settleSoft' }, { t: SUBCOPY_START + BEAT4_DURATION, v: [0, 0, 0] }])
  ks.o = animProp([{ t: SUBCOPY_START, v: 0, ease: 'settleSoft' }, { t: SUBCOPY_START + BEAT4_DURATION, v: 100 }])
  precompLayers.push(layer({ nm: 'sub-copy', ind: pind++, shapes, ks }))
}

// ---- headline: single compound path, fades/rises with the close icon ----
{
  const subs = parsePath(HEADLINE_D)
  const shapes = [group('headline', [...subs.map((s, i) => shapeFromSubpath(s, `headline-${i}`)), fillItem('#222222')])]
  const ks = baseTransform()
  ks.p = animProp([{ t: BEAT4_START, v: [0, RISE, 0], ease: 'settleSoft' }, { t: BEAT4_START + BEAT4_DURATION, v: [0, 0, 0] }])
  ks.o = animProp([{ t: BEAT4_START, v: 0, ease: 'settleSoft' }, { t: BEAT4_START + BEAT4_DURATION, v: 100 }])
  precompLayers.push(layer({ nm: 'headline', ind: pind++, shapes, ks }))
}

// ---- checkmark: draws second, "the payoff" — a touch more snap ----------
{
  const sp = parsePath(TICK.stroke)[0] // already authored top-right -> vertex -> short arm: no reversal needed
  const shapes = [group('checkmark', [
    shapeFromSubpath(sp, 'checkmark-path'),
    strokeItem('#22E243', 14), // paint2 gradient is degenerate (both stops identical) -> flat color
    trimItem({ eKeys: [{ t: TICK_DRAW[0], v: 0, ease: 'entranceSharp' }, { t: TICK_DRAW[1], v: 100 }] }),
  ])]
  precompLayers.push(layer({ nm: 'checkmark', ind: pind++, shapes, ks: baseTransform() }))
}

// ---- checkmark's own ink marks: pop in exactly as its trim begins -------
for (const [nm, key] of [['checkmark-start-blob', 'startBlob'], ['checkmark-start-dot', 'startDot']]) {
  const sp = parsePath(TICK[key])[0]
  const c = bboxCenter(bboxOf([sp]))
  const shapes = [group(nm, [shapeFromSubpath(sp, `${nm}-path`), fillItem('#22E243')])]
  const ks = baseTransform({ a: [c[0], c[1], 0], p: [c[0], c[1], 0] })
  ks.s = animProp([{ t: TICK_START_POP[0], v: [0, 0, 100], ease: 'settleSoft' }, { t: TICK_START_POP[1], v: [100, 100, 100] }])
  ks.o = animProp([{ t: TICK_START_POP[0], v: 0, ease: 'settleSoft' }, { t: TICK_START_POP[0] + 8, v: 100 }])
  precompLayers.push(layer({ nm, ind: pind++, shapes, ks }))
}

// ---- ring: draws first, clockwise from its right-side dot ----------------
{
  const sp = parsePath(RING.stroke)[0] // already authored right -> bottom -> left -> top (clockwise): no reversal needed
  const shapes = [group('ring', [
    shapeFromSubpath(sp, 'ring-path'),
    gradientStrokeItem({
      width: 14,
      s: [199, 256.001],
      e: [11.5, 382.001],
      stops: [
        { offset: 0, color: '#22E243', alpha: 1 },
        { offset: 0.15694, color: '#22E243', alpha: 1 },
        { offset: 0.73997, color: '#0A9F24', alpha: 1 },
        { offset: 1, color: '#22E243', alpha: 0.2 },
      ],
    }),
    trimItem({ eKeys: [{ t: RING_DRAW[0], v: 0, ease: 'travelBalanced' }, { t: RING_DRAW[1], v: 100 }] }),
  ])]
  precompLayers.push(layer({ nm: 'ring', ind: pind++, shapes, ks: baseTransform() }))
}

// ---- ring's begin-dot: the pen touching down at the right ----------------
{
  const c = [RING_BEGIN_DOT.cx, RING_BEGIN_DOT.cy]
  const shapes = [group('ring-start-dot', [
    { ty: 'el', nm: 'ring-start-dot-ellipse', p: { a: 0, k: c }, s: { a: 0, k: [RING_BEGIN_DOT.r * 2, RING_BEGIN_DOT.r * 2] } },
    fillItem('#22E243'),
  ])]
  const ks = baseTransform({ a: [c[0], c[1], 0], p: [c[0], c[1], 0] })
  ks.s = animProp([{ t: RING_BEGIN_POP[0], v: [0, 0, 100], ease: 'settleSoft' }, { t: RING_BEGIN_POP[1], v: [100, 100, 100] }])
  ks.o = animProp([{ t: RING_BEGIN_POP[0], v: 0, ease: 'settleSoft' }, { t: RING_BEGIN_POP[0] + 8, v: 100 }])
  precompLayers.push(layer({ nm: 'ring-start-dot', ind: pind++, shapes, ks }))
}

// ---- ring's end blob + dot: the pen lifting off at the top ---------------
for (const [nm, key] of [['ring-end-blob', 'endBlob'], ['ring-end-dot', 'endDot']]) {
  const sp = parsePath(RING[key])[0]
  const c = bboxCenter(bboxOf([sp]))
  const shapes = [group(nm, [shapeFromSubpath(sp, `${nm}-path`), fillItem('#22E243')])]
  const ks = baseTransform({ a: [c[0], c[1], 0], p: [c[0], c[1], 0] })
  ks.s = animProp([{ t: RING_END_POP[0], v: [0, 0, 100], ease: 'settleSoft' }, { t: RING_END_POP[1], v: [100, 100, 100] }])
  ks.o = animProp([{ t: RING_END_POP[0], v: 0, ease: 'settleSoft' }, { t: RING_END_POP[1] - 4, v: 100 }])
  precompLayers.push(layer({ nm, ind: pind++, shapes, ks }))
}

// ---- clouds: drift + wrap, then ease to an exact stop --------------------
{
  const subs = [parsePath(CLOUD_FAR.bump)[0], parsePath(CLOUD_FAR.dashL)[0], parsePath(CLOUD_FAR.dashR)[0]]
  const shapes = [group('cloud-far', [...subs.map((s, i) => shapeFromSubpath(s, `cloud-far-${i}`)), strokeItem('#222222', 2)])]
  const ks = baseTransform()
  ks.p = animProp(buildWrapPoints({ exit: FAR_EXIT, enter: FAR_ENTER, laps: FAR_LAPS, velocity: farVelocity, finalApproach: CLOUD_FINAL_APPROACH, settleEndFrame: CLOUD_SETTLE_END }))
  precompLayers.push(layer({ nm: 'cloud-far', ind: pind++, shapes, ks }))
}
{
  const subs = [parsePath(CLOUD_NEAR.bump)[0], parsePath(CLOUD_NEAR.dashL)[0], parsePath(CLOUD_NEAR.dashR)[0]]
  const shapes = [group('cloud-near', [...subs.map((s, i) => shapeFromSubpath(s, `cloud-near-${i}`)), strokeItem('#222222', 2)])]
  const ks = baseTransform()
  ks.p = animProp(buildWrapPoints({ exit: NEAR_EXIT, enter: NEAR_ENTER, laps: NEAR_LAPS, velocity: nearVelocity, finalApproach: CLOUD_FINAL_APPROACH, settleEndFrame: CLOUD_SETTLE_END }))
  precompLayers.push(layer({ nm: 'cloud-near', ind: pind++, shapes, ks }))
}

// ---- background: opaque white, rounded corners (rx 40) -------------------
{
  const items = [{ ty: 'rc', nm: 'rect', p: { a: 0, k: [W / 2, H / 2] }, s: { a: 0, k: [W, H] }, r: { a: 0, k: 40 } }]
  items.push({ ty: 'fl', nm: 'Fill', o: { a: 0, k: 100 }, c: { sid: 'bgColor' }, r: 1 })
  const shapes = [group('background', items)]
  precompLayers.push(layer({ nm: 'background', ind: pind++, shapes, ks: baseTransform() }))
}

// ============================================================
// ROOT LAYERS: rounded-rect matte + the precomposed scene
// ============================================================
const SCENE_ASSET_ID = 'comp_scene'
let ind = 1
const layers = []

{
  const shapes = [group('canvas-matte', rectShapeItems(0, 0, W, H, 40, { fill: '#FFFFFF' }))]
  layers.push(layer({ nm: 'canvas-matte', ind: ind++, shapes, ks: baseTransform(), td: true }))
}
layers.push(layer({ nm: 'scene', ind: ind++, ks: baseTransform(), refId: SCENE_ASSET_ID, w: W, h: H, tt: 1 }))

// ============================================================
const doc = {
  v: '5.9.0', fr: FPS, ip: 0, op: FRAMES, w: W, h: H, nm: 'Screen Change (Beuf)',
  ddd: 0,
  assets: [{ id: SCENE_ASSET_ID, layers: precompLayers }],
  layers, markers: [],
  slots: { bgColor: { p: { a: 0, k: [1, 1, 1, 1] } } },
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT, JSON.stringify(doc))

const controls = {
  controls: [{ sid: 'bgColor', label: 'Screen background' }],
  layerControls: [
    { target: 'cloud-near', kind: 'amount', property: 'position', label: 'Sky drift', description: 'How far the clouds travel before settling.' },
    { target: 'global', kind: 'feel', label: 'Feel', description: 'The easing personality of the mark draw-on and confirmation reveal.' },
  ],
}
writeFileSync(join(OUT_DIR, 'controls.json'), JSON.stringify(controls, null, 2))

console.log(`Wrote ${OUT} — ${layers.length} root layers, ${precompLayers.length} precomp layers, ${FRAMES}f @ ${FPS}fps (${(FRAMES / FPS).toFixed(1)}s)`)
console.log(`Cloud velocities — near: ${nearVelocity.toFixed(3)}px/f, far: ${farVelocity.toFixed(3)}px/f`)
