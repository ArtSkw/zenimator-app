/**
 * SVG geometry → Lottie shape-layer data (Phase 1, WS1).
 *
 * Two public exports:
 *  - elementToPath(el)   — SVG element → Lottie SubPath[]
 *  - strokeStyle(el)     — SVG element → stroke style attributes
 *
 * Path convention (D1 decision): open paths are normalized so the first vertex
 * has the smallest X, giving L→R trim-path draw-on by default. Closed paths
 * rotate to start at the leftmost vertex.
 */

import { elementWorldMatrix, applyPoint, applyVec, isIdentity } from '@/engine/detector/transform'

// ── Public types ─────────────────────────────────────────────────────────────

/** One closed or open Lottie bezier sub-path.
 *  `v` = anchor points (absolute), `i`/`o` = in/out tangents (relative to v). */
export type SubPath = {
  v: number[][]
  i: number[][]
  o: number[][]
  c: boolean
}

export type StrokeStyle = {
  /** RGB, each channel 0–1. */
  color: [number, number, number]
  /** 0–1 */
  opacity: number
  /** px */
  width: number
  /** 1=butt 2=round 3=square */
  cap: 1 | 2 | 3
  /** 1=miter 2=round 3=bevel */
  join: 1 | 2 | 3
  /** Present when the stroke paint is a gradient. Coordinates are in user space;
   *  the caller scales them to comp space alongside the geometry. When set, the
   *  renderer emits a Lottie gradient stroke (gs); `color` remains a fallback. */
  gradient?: StrokeGradient
}

/** One gradient colour stop. */
export type GradientStop = {
  /** 0–1 along the gradient axis. */
  offset: number
  /** RGB, each channel 0–1. */
  color: [number, number, number]
  /** 0–1 */
  opacity: number
}

/** A resolved gradient paint in USER-SPACE coordinates. Used for both fills and
 *  strokes (the gradient itself is paint-agnostic). */
export type StrokeGradient = {
  kind: 'linear' | 'radial'
  /** Linear: gradient line start. Radial: focal/centre point. */
  start: [number, number]
  /** Linear: gradient line end. Radial: a point on the outer radius. */
  end: [number, number]
  stops: GradientStop[]
}

export type FillStyle = {
  /** RGB, each channel 0–1 (solid fill, or the gradient's dominant-stop fallback). */
  color: [number, number, number]
  /** 0–1 */
  opacity: number
  /** Lottie fill-rule: 1 = nonzero (default), 2 = evenodd. */
  rule: 1 | 2
  /** Present when the fill paint is a gradient. */
  gradient?: StrokeGradient
}

/** One paintable element: its sub-paths plus the fill and/or stroke that paint
 *  them. Holes are resolved by the fill rule, so all sub-paths of one element
 *  share a group. Either fill or stroke may be absent (but not both). */
export type VectorShape = {
  paths: SubPath[]
  fill?: FillStyle
  stroke?: StrokeStyle
}

// ── elementToPath ─────────────────────────────────────────────────────────────

/**
 * Extract Lottie SubPaths from an SVG element. Handles <path>, <line>,
 * <polyline>, <polygon>, <rect>, <circle>, <ellipse>.
 * Returns [] for degenerate or unsupported shapes.
 */
export function elementToPath(el: Element): SubPath[] {
  const tag = el.tagName.toLowerCase().replace(/^svg:/, '')
  let d = ''

  if (tag === 'path') {
    d = el.getAttribute('d') ?? ''
  } else if (tag === 'line') {
    const x1 = n(el, 'x1'), y1 = n(el, 'y1')
    const x2 = n(el, 'x2'), y2 = n(el, 'y2')
    d = `M ${x1} ${y1} L ${x2} ${y2}`
  } else if (tag === 'polyline' || tag === 'polygon') {
    const pts = parsePoints(el.getAttribute('points') ?? '')
    if (pts.length < 2) return []
    d = 'M ' + pts.map(([px, py]) => `${px} ${py}`).join(' L ')
    if (tag === 'polygon') d += ' Z'
  } else if (tag === 'rect') {
    d = rectToD(el)
  } else if (tag === 'circle') {
    const cx = n(el, 'cx'), cy = n(el, 'cy'), r = n(el, 'r')
    if (!r) return []
    d = circleToD(cx, cy, r, r)
  } else if (tag === 'ellipse') {
    const cx = n(el, 'cx'), cy = n(el, 'cy')
    const rx = n(el, 'rx'), ry = n(el, 'ry')
    if (!rx || !ry) return []
    d = circleToD(cx, cy, rx, ry)
  }

  const trimmed = d.trim()
  if (!trimmed) return []
  const subPaths = parseDToSubPaths(trimmed)

  // Bake the element's transform (own + ancestor <g> transforms) into the
  // geometry so it lands in root space. Without this, any element positioned by
  // a `transform` (matrix/translate/rotate) renders at its local origin.
  const m = elementWorldMatrix(el)
  if (isIdentity(m)) return subPaths
  return subPaths.map((sp) => ({
    v: sp.v.map(([x, y]) => applyPoint(m, x, y)),
    i: sp.i.map(([x, y]) => applyVec(m, x, y)),
    o: sp.o.map(([x, y]) => applyVec(m, x, y)),
    c: sp.c,
  }))
}

// ── strokeStyle ───────────────────────────────────────────────────────────────

/**
 * Extract stroke style attributes from an SVG element, walking up the
 * ancestor chain for inherited values. Falls back gracefully.
 */
export function strokeStyle(el: Element): StrokeStyle {
  const raw = (attr: string): string => {
    let cur: Element | null = el
    while (cur) {
      const v = cur.getAttribute(attr) ?? styleAttr(cur, attr)
      if (v && v !== 'inherit') return v
      cur = cur.parentElement
    }
    return ''
  }

  const colorStr = raw('stroke') || '#000000'
  const widthStr = raw('stroke-width') || '1'
  const capStr   = raw('stroke-linecap')  || 'butt'
  const joinStr  = raw('stroke-linejoin') || 'miter'
  const opStr    = raw('stroke-opacity')  || '1'

  // Gradient stroke → emit a real gradient (gs); keep the dominant stop as a
  // colour fallback for when parsing fails or the renderer can't honour it.
  const isGradient = colorStr.startsWith('url(')
  const color = isGradient ? resolveGradientDominant(colorStr, el) : parseColor(colorStr)
  const gradient = isGradient ? parseGradient(colorStr, el) : undefined

  return {
    color,
    opacity: Math.min(1, Math.max(0, parseFloat(opStr) || 1)),
    width:   Math.max(0.5, parseFloat(widthStr) || 1),
    cap:   { butt: 1, round: 2, square: 3 }[capStr] as 1 | 2 | 3 ?? 1,
    join:  { miter: 1, round: 2, bevel: 3 }[joinStr] as 1 | 2 | 3 ?? 1,
    ...(gradient ? { gradient } : {}),
  }
}

/** Scale a gradient's user-space coordinates into comp space. */
export function scaleGradient(g: StrokeGradient, s: number): StrokeGradient {
  return {
    ...g,
    start: [g.start[0] * s, g.start[1] * s],
    end: [g.end[0] * s, g.end[1] * s],
  }
}

/** Resolve an element's fill paint (walking the ancestor chain for inherited
 *  values, like strokeStyle). Returns null when the fill is explicitly 'none'.
 *  When no fill is specified anywhere, SVG's default is a black fill. */
export function fillStyle(el: Element): FillStyle | null {
  const raw = (attr: string): string => {
    let cur: Element | null = el
    while (cur) {
      const v = cur.getAttribute(attr) ?? styleAttr(cur, attr)
      if (v && v !== 'inherit') return v
      cur = cur.parentElement
    }
    return ''
  }

  const colorStr = raw('fill')
  if (colorStr === 'none') return null

  const isGradient = colorStr.startsWith('url(')
  const color = isGradient ? resolveGradientDominant(colorStr, el) : parseColor(colorStr || '#000000')
  const gradient = isGradient ? parseGradient(colorStr, el) : undefined
  const rule = raw('fill-rule') === 'evenodd' ? 2 : 1

  return {
    color,
    opacity: Math.min(1, Math.max(0, parseFloat(raw('fill-opacity') || '1') || 1)),
    rule,
    ...(gradient ? { gradient } : {}),
  }
}

/** True when the element (or an ancestor) carries an explicit, non-none stroke. */
export function hasStroke(el: Element): boolean {
  let cur: Element | null = el
  while (cur) {
    const v = cur.getAttribute('stroke') ?? styleAttr(cur, 'stroke')
    if (v && v !== 'inherit') return v !== 'none'
    cur = cur.parentElement
  }
  return false
}

/** Scale all coordinates in a SubPath by a uniform factor (user space → comp space). */
export function scalePath(sp: SubPath, s: number): SubPath {
  const sc = (arr: number[][]) => arr.map(([x, y]) => [x * s, y * s])
  return { v: sc(sp.v), i: sc(sp.i), o: sc(sp.o), c: sp.c }
}

/** A morph control point: normalized position along the path (u ∈ 0–1) plus
 *  x/y offsets in the same coordinate space as the SubPath vertices. */
export type MorphControl = {
  u: number
  dx: number
  dy: number
}

/**
 * Displace a SubPath's vertices using a set of control-point offsets. Each
 * vertex is offset by the value linearly interpolated from the nearest controls.
 * Tangent handles (i/o) are relative to their vertex and therefore unchanged —
 * only the anchor points shift, preserving curvature.
 */
export function morphPath(base: SubPath, controls: MorphControl[]): SubPath {
  const n = base.v.length
  if (n === 0 || controls.length === 0) return base

  const sorted = [...controls].sort((a, b) => a.u - b.u)

  const offsetAt = (u: number): [number, number] => {
    if (sorted.length === 1) return [sorted[0].dx, sorted[0].dy]
    if (u <= sorted[0].u) return [sorted[0].dx, sorted[0].dy]
    const last = sorted[sorted.length - 1]
    if (u >= last.u) return [last.dx, last.dy]
    let lo = 0
    while (lo < sorted.length - 2 && sorted[lo + 1].u <= u) lo++
    const a = sorted[lo], b = sorted[lo + 1]
    const t = b.u === a.u ? 0 : (u - a.u) / (b.u - a.u)
    return [a.dx + (b.dx - a.dx) * t, a.dy + (b.dy - a.dy) * t]
  }

  const span = base.c ? n : Math.max(1, n - 1)
  return {
    v: base.v.map(([vx, vy], j) => { const [dx, dy] = offsetAt(j / span); return [vx + dx, vy + dy] }),
    i: base.i,
    o: base.o,
    c: base.c,
  }
}

/**
 * Validate that all SubPaths share the same vertex count — required for Lottie
 * shape morphing (topology must be identical across all keyframes).
 * Returns null when valid, or a human-readable error when not.
 */
export function validateTopology(paths: SubPath[]): string | null {
  if (paths.length < 2) return null
  const ref = paths[0].v.length
  for (let j = 1; j < paths.length; j++) {
    if (paths[j].v.length !== ref) {
      return `Vertex count mismatch: path 0 has ${ref} vertices, path ${j} has ${paths[j].v.length}`
    }
  }
  return null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function n(el: Element, attr: string): number {
  return parseFloat(el.getAttribute(attr) ?? '0') || 0
}

function styleAttr(el: Element, prop: string): string {
  const style = el.getAttribute('style') ?? ''
  const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`).exec(style)
  return m ? m[1].trim() : ''
}

function parsePoints(pts: string): [number, number][] {
  const nums = pts.trim().split(/[\s,]+/).map(Number)
  const out: [number, number][] = []
  for (let j = 0; j + 1 < nums.length; j += 2) out.push([nums[j], nums[j + 1]])
  return out
}

function rectToD(el: Element): string {
  const x = n(el, 'x'), y = n(el, 'y')
  const w = n(el, 'width'), h = n(el, 'height')
  if (!w || !h) return ''
  let rx = n(el, 'rx'), ry = n(el, 'ry')
  if (!rx && !ry) return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`
  if (!rx) rx = ry
  if (!ry) ry = rx
  rx = Math.min(rx, w / 2); ry = Math.min(ry, h / 2)
  const k = 0.5523
  return [
    `M ${x + rx} ${y}`,
    `L ${x + w - rx} ${y}`,
    `C ${x + w - rx + k * rx} ${y} ${x + w} ${y + ry - k * ry} ${x + w} ${y + ry}`,
    `L ${x + w} ${y + h - ry}`,
    `C ${x + w} ${y + h - ry + k * ry} ${x + w - rx + k * rx} ${y + h} ${x + w - rx} ${y + h}`,
    `L ${x + rx} ${y + h}`,
    `C ${x + rx - k * rx} ${y + h} ${x} ${y + h - ry + k * ry} ${x} ${y + h - ry}`,
    `L ${x} ${y + ry}`,
    `C ${x} ${y + ry - k * ry} ${x + rx - k * rx} ${y} ${x + rx} ${y} Z`,
  ].join(' ')
}

function circleToD(cx: number, cy: number, rx: number, ry: number): string {
  const kx = 0.5523 * rx, ky = 0.5523 * ry
  return [
    `M ${cx} ${cy - ry}`,
    `C ${cx + kx} ${cy - ry} ${cx + rx} ${cy - ky} ${cx + rx} ${cy}`,
    `C ${cx + rx} ${cy + ky} ${cx + kx} ${cy + ry} ${cx} ${cy + ry}`,
    `C ${cx - kx} ${cy + ry} ${cx - rx} ${cy + ky} ${cx - rx} ${cy}`,
    `C ${cx - rx} ${cy - ky} ${cx - kx} ${cy - ry} ${cx} ${cy - ry} Z`,
  ].join(' ')
}

// ── SVG path `d` parser ───────────────────────────────────────────────────────

type CubicSeg = {
  from: [number, number]
  cp1:  [number, number]
  cp2:  [number, number]
  to:   [number, number]
}

function parseDToSubPaths(d: string): SubPath[] {
  const tokenRe = /[MmLlHhVvCcSsQqTtAaZz]|[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g
  const tokens: string[] = []
  let m: RegExpExecArray | null
  while ((m = tokenRe.exec(d)) !== null) tokens.push(m[0])

  // Group into { cmd, args } — implicit command repetition handled below
  const groups: { cmd: string; args: number[] }[] = []
  for (const tok of tokens) {
    if (/^[MmLlHhVvCcSsQqTtAaZz]$/.test(tok)) {
      groups.push({ cmd: tok, args: [] })
    } else {
      groups[groups.length - 1]?.args.push(parseFloat(tok))
    }
  }

  const subPaths: SubPath[] = []
  let cx = 0, cy = 0
  let startX = 0, startY = 0
  let prevCp2: [number, number] | null = null
  let prevQcp: [number, number] | null = null
  let curSegs: CubicSeg[] = []

  const addLine = (ex: number, ey: number) => {
    curSegs.push({ from: [cx, cy], cp1: [cx + (ex - cx) / 3, cy + (ey - cy) / 3], cp2: [cx + 2 * (ex - cx) / 3, cy + 2 * (ey - cy) / 3], to: [ex, ey] })
    cx = ex; cy = ey; prevCp2 = null; prevQcp = null
  }
  const addCubic = (x1: number, y1: number, x2: number, y2: number, ex: number, ey: number) => {
    curSegs.push({ from: [cx, cy], cp1: [x1, y1], cp2: [x2, y2], to: [ex, ey] })
    prevCp2 = [x2, y2]; prevQcp = null; cx = ex; cy = ey
  }
  const addQuad = (qx: number, qy: number, ex: number, ey: number) => {
    addCubic(cx + 2 / 3 * (qx - cx), cy + 2 / 3 * (qy - cy), ex + 2 / 3 * (qx - ex), ey + 2 / 3 * (qy - ey), ex, ey)
    prevCp2 = null; prevQcp = [qx, qy]
  }

  const finishSub = (closed: boolean) => {
    if (curSegs.length === 0) return
    subPaths.push(normalizeDirection(segsToSubPath(curSegs, closed), closed))
    curSegs = []
  }

  for (const { cmd, args } of groups) {
    const abs = cmd === cmd.toUpperCase()
    const c   = cmd.toLowerCase()
    const ax  = (v: number) => abs ? v : cx + v
    const ay  = (v: number) => abs ? v : cy + v

    // Arc flag values can appear without separators — no special fix needed here
    // since our tokenizer already handles them as numeric tokens.
    const argCount: Record<string, number> = { m:2, l:2, h:1, v:1, c:6, s:4, q:4, t:2, a:7, z:0 }
    const step = argCount[c] ?? 0

    const process = (a: number[]) => {
      if (c === 'z') {
        if (cx !== startX || cy !== startY) addLine(startX, startY)
        finishSub(true)
        cx = startX; cy = startY
      } else if (c === 'm') {
        if (curSegs.length > 0) finishSub(false)
        cx = ax(a[0]); cy = ay(a[1])
        startX = cx; startY = cy
        prevCp2 = null; prevQcp = null
      } else if (c === 'l') {
        addLine(ax(a[0]), ay(a[1]))
      } else if (c === 'h') {
        addLine(abs ? a[0] : cx + a[0], cy)
      } else if (c === 'v') {
        addLine(cx, abs ? a[0] : cy + a[0])
      } else if (c === 'c') {
        addCubic(ax(a[0]), ay(a[1]), ax(a[2]), ay(a[3]), ax(a[4]), ay(a[5]))
      } else if (c === 's') {
        const x1 = prevCp2 ? 2 * cx - prevCp2[0] : cx
        const y1 = prevCp2 ? 2 * cy - prevCp2[1] : cy
        addCubic(x1, y1, ax(a[0]), ay(a[1]), ax(a[2]), ay(a[3]))
      } else if (c === 'q') {
        addQuad(ax(a[0]), ay(a[1]), ax(a[2]), ay(a[3]))
      } else if (c === 't') {
        const qx = prevQcp ? 2 * cx - prevQcp[0] : cx
        const qy = prevQcp ? 2 * cy - prevQcp[1] : cy
        addQuad(qx, qy, ax(a[0]), ay(a[1]))
      } else if (c === 'a') {
        const [rx, ry, xRot, largeArc, sweep, ex, ey] = [Math.abs(a[0]), Math.abs(a[1]), a[2], a[3] !== 0, a[4] !== 0, ax(a[5]), ay(a[6])]
        if (ex === cx && ey === cy) return
        if (!rx || !ry) { addLine(ex, ey); return }
        for (const seg of arcToCubic(cx, cy, rx, ry, xRot, largeArc, sweep, ex, ey)) {
          addCubic(seg.cp1[0], seg.cp1[1], seg.cp2[0], seg.cp2[1], seg.to[0], seg.to[1])
        }
      }
    }

    // M after first pair: subsequent pairs are implicit L commands
    if (c === 'm' && args.length > 2) {
      process(args.slice(0, 2))
      for (let i = 2; i + 1 < args.length; i += 2) {
        // after M, implicit command is L (abs) or l (rel)
        const lx = abs ? args[i] : cx + args[i]
        const ly = abs ? args[i + 1] : cy + args[i + 1]
        addLine(lx, ly)
      }
    } else if (step === 0) {
      process([])
    } else {
      // Command repetition
      for (let i = 0; i + step <= args.length; i += step) {
        process(args.slice(i, i + step))
      }
    }
  }

  if (curSegs.length > 0) finishSub(false)
  return subPaths
}

/** Convert accumulated CubicSegs into a Lottie SubPath. */
function segsToSubPath(segs: CubicSeg[], closed: boolean): SubPath {
  const n = segs.length
  if (n === 0) return { v: [], i: [], o: [], c: false }

  const v: number[][] = []
  const inT: number[][] = []
  const outT: number[][] = []

  for (let j = 0; j < n; j++) {
    const seg  = segs[j]
    const prev = j > 0 ? segs[j - 1] : (closed ? segs[n - 1] : null)
    v.push([seg.from[0], seg.from[1]])
    outT.push([seg.cp1[0] - seg.from[0], seg.cp1[1] - seg.from[1]])
    inT.push(prev ? [prev.cp2[0] - seg.from[0], prev.cp2[1] - seg.from[1]] : [0, 0])
  }

  // For open paths append the endpoint of the last segment
  if (!closed) {
    const last = segs[n - 1]
    v.push([last.to[0], last.to[1]])
    inT.push([last.cp2[0] - last.to[0], last.cp2[1] - last.to[1]])
    outT.push([0, 0])
  }

  return { v, i: inT, o: outT, c: closed }
}

/**
 * Normalize draw-on direction (D1 decision).
 * Open path: reverse if first vertex X > last vertex X (ensures L→R trim).
 * Closed path: rotate so the leftmost vertex is first.
 */
function normalizeDirection(sp: SubPath, closed: boolean): SubPath {
  if (sp.v.length < 2) return sp
  if (!closed) {
    const firstX = sp.v[0][0]
    const lastX  = sp.v[sp.v.length - 1][0]
    return firstX <= lastX ? sp : reversePath(sp)
  }
  // Rotate closed path to leftmost vertex
  let idx = 0
  for (let j = 1; j < sp.v.length; j++) {
    if (sp.v[j][0] < sp.v[idx][0]) idx = j
  }
  if (idx === 0) return sp
  return {
    v: rotate(sp.v, idx),
    i: rotate(sp.i, idx),
    o: rotate(sp.o, idx),
    c: true,
  }
}

function reversePath(sp: SubPath): SubPath {
  // Reverse a bezier path: swap i↔o arrays (reversed), vertices reversed.
  // Correctness: o[j] relative to v[j] becomes i of the reversed v[n-1-j].
  return {
    v: [...sp.v].reverse(),
    i: [...sp.o].reverse(),
    o: [...sp.i].reverse(),
    c: sp.c,
  }
}

function rotate<T>(arr: T[], by: number): T[] {
  return [...arr.slice(by), ...arr.slice(0, by)]
}

// ── Arc → cubic bezier approximation (SVG spec F.6) ──────────────────────────

function arcToCubic(
  x1: number, y1: number, rx: number, ry: number,
  xRotDeg: number, largeArc: boolean, sweep: boolean,
  x2: number, y2: number,
): CubicSeg[] {
  const phi = (xRotDeg * Math.PI) / 180
  const cosPhi = Math.cos(phi), sinPhi = Math.sin(phi)

  // Step 1: compute (x1', y1')
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2
  const x1p =  cosPhi * dx + sinPhi * dy
  const y1p = -sinPhi * dx + cosPhi * dy

  // Ensure radii are large enough
  const x1p2 = x1p * x1p, y1p2 = y1p * y1p
  let rx2 = rx * rx, ry2 = ry * ry
  const lambda = x1p2 / rx2 + y1p2 / ry2
  if (lambda > 1) { const sq = Math.sqrt(lambda); rx *= sq; ry *= sq; rx2 = rx*rx; ry2 = ry*ry }

  // Step 2: compute center (cx', cy')
  const num = Math.max(0, rx2 * ry2 - rx2 * y1p2 - ry2 * x1p2)
  const den = rx2 * y1p2 + ry2 * x1p2
  const sq = den === 0 ? 0 : Math.sqrt(num / den)
  const sign = largeArc === sweep ? -1 : 1
  const cxp =  sign * sq * rx * y1p / ry
  const cyp = -sign * sq * ry * x1p / rx

  // Step 3: compute center (cx, cy) in original coords
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
  const ccx = cosPhi * cxp - sinPhi * cyp + mx
  const ccy = sinPhi * cxp + cosPhi * cyp + my

  // Step 4: compute angles
  const ang = (ux: number, uy: number, vx: number, vy: number) => {
    const dot = ux * vx + uy * vy
    const len = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy))
    const a = Math.acos(Math.max(-1, Math.min(1, dot / len)))
    return ux * vy - uy * vx < 0 ? -a : a
  }

  const theta1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
  let dtheta = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
  if (!sweep && dtheta > 0) dtheta -= 2 * Math.PI
  if ( sweep && dtheta < 0) dtheta += 2 * Math.PI

  // Split into ≤90° segments
  const nSegs = Math.ceil(Math.abs(dtheta) / (Math.PI / 2))
  const dt    = dtheta / nSegs
  const segs: CubicSeg[] = []

  for (let k = 0; k < nSegs; k++) {
    const t0 = theta1 + k * dt
    const t1 = theta1 + (k + 1) * dt
    segs.push(arcSegToCubic(ccx, ccy, rx, ry, phi, t0, t1))
  }
  return segs
}

function arcSegToCubic(
  cx: number, cy: number, rx: number, ry: number,
  phi: number, t0: number, t1: number,
): CubicSeg {
  const dt = t1 - t0
  const alpha = (4 / 3) * Math.tan(dt / 4)
  const cosPhi = Math.cos(phi), sinPhi = Math.sin(phi)

  const pt = (t: number): [number, number] => {
    const cosT = Math.cos(t), sinT = Math.sin(t)
    return [
      cx + cosPhi * rx * cosT - sinPhi * ry * sinT,
      cy + sinPhi * rx * cosT + cosPhi * ry * sinT,
    ]
  }
  const dpt = (t: number): [number, number] => {
    const cosT = Math.cos(t), sinT = Math.sin(t)
    return [
      -cosPhi * rx * sinT - sinPhi * ry * cosT,
       sinPhi * rx * sinT + cosPhi * ry * cosT,
    ] as [number, number]
  }

  const [p0x, p0y] = pt(t0)
  const [p1x, p1y] = pt(t1)
  const [d0x, d0y] = dpt(t0)
  const [d1x, d1y] = dpt(t1)

  return {
    from: [p0x, p0y],
    cp1:  [p0x + alpha * d0x, p0y + alpha * d0y],
    cp2:  [p1x - alpha * d1x, p1y - alpha * d1y],
    to:   [p1x, p1y],
  }
}

// ── Color parsing ─────────────────────────────────────────────────────────────

function parseColor(s: string): [number, number, number] {
  s = s.trim().toLowerCase()
  if (s === 'none' || s === 'transparent') return [0, 0, 0]
  if (s === 'black')   return [0, 0, 0]
  if (s === 'white')   return [1, 1, 1]
  if (s === 'red')     return [1, 0, 0]
  if (s === 'green')   return [0, 0.502, 0]
  if (s === 'blue')    return [0, 0, 1]
  if (s === 'currentcolor') return [0, 0, 0]

  // #rrggbb or #rgb
  if (s.startsWith('#')) {
    const hex = s.slice(1)
    if (hex.length === 6) {
      return [
        parseInt(hex.slice(0, 2), 16) / 255,
        parseInt(hex.slice(2, 4), 16) / 255,
        parseInt(hex.slice(4, 6), 16) / 255,
      ]
    }
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16) / 255,
        parseInt(hex[1] + hex[1], 16) / 255,
        parseInt(hex[2] + hex[2], 16) / 255,
      ]
    }
  }

  // rgb(r, g, b) or rgba(r, g, b, a)
  const rgbM = /rgba?\(\s*([\d.]+)(%?)\s*,\s*([\d.]+)(%?)\s*,\s*([\d.]+)(%?)/.exec(s)
  if (rgbM) {
    const ch = (v: string, pct: string) => {
      const num = parseFloat(v)
      return pct ? num / 100 : num / 255
    }
    return [ch(rgbM[1], rgbM[2]), ch(rgbM[3], rgbM[4]), ch(rgbM[5], rgbM[6])]
  }

  return [0, 0, 0]
}

function resolveGradientDominant(urlRef: string, el: Element): [number, number, number] {
  // url(#id) → find the gradient in the ownerDocument and use the dominant stop
  const m = /url\(#([^)]+)\)/.exec(urlRef)
  if (!m) return [0, 0, 0]
  const doc = el.ownerDocument
  if (!doc) return [0, 0, 0]
  const grad = doc.getElementById(m[1])
  if (!grad) return [0, 0, 0]
  const host = findStopsHost(grad)
  const stops = host ? Array.from(host.querySelectorAll('stop')) : []
  if (!stops.length) return [0, 0, 0]
  // Use the middle stop (or first) as the dominant color
  const midStop = stops[Math.floor(stops.length / 2)]
  const colorVal = midStop.getAttribute('stop-color') ?? styleAttr(midStop, 'stop-color') ?? '#000'
  return parseColor(colorVal)
}

/**
 * Fully resolve a `url(#id)` gradient reference into user-space coordinates and
 * colour stops. Supports linear and radial gradients, `userSpaceOnUse` and
 * `objectBoundingBox` units, and stop inheritance via href. Returns undefined
 * when the reference can't be resolved (the caller falls back to a solid stop).
 * Known limitation: `gradientTransform` is not applied.
 */
function parseGradient(urlRef: string, el: Element): StrokeGradient | undefined {
  const m = /url\(#([^)]+)\)/.exec(urlRef)
  if (!m) return undefined
  const doc = el.ownerDocument
  if (!doc) return undefined
  const grad = doc.getElementById(m[1])
  if (!grad) return undefined

  const tag = grad.tagName.toLowerCase().replace(/^svg:/, '')
  const kind: 'linear' | 'radial' = tag === 'radialgradient' ? 'radial' : 'linear'

  const host = findStopsHost(grad)
  const stopEls = host ? Array.from(host.querySelectorAll('stop')) : []
  if (!stopEls.length) return undefined
  const denom = Math.max(1, stopEls.length - 1)
  const stops: GradientStop[] = stopEls.map((s, i) => ({
    offset: parseOffset(s.getAttribute('offset'), i / denom),
    color: parseColor((s.getAttribute('stop-color') ?? styleAttr(s, 'stop-color')) || '#000'),
    opacity: clamp01n(parseFloat((s.getAttribute('stop-opacity') ?? styleAttr(s, 'stop-opacity')) || '1')),
  }))

  const userSpace = (gradAttr(grad, 'gradientUnits') ?? 'objectBoundingBox') === 'userSpaceOnUse'
  const num  = (raw: string | null, fb: number) => raw == null ? fb : (parseFloat(raw) || 0)
  const frac = (raw: string | null, fb: number) => {
    if (raw == null) return fb
    const t = raw.trim()
    return t.endsWith('%') ? (parseFloat(t) || 0) / 100 : (parseFloat(t) || 0)
  }

  if (userSpace) {
    if (kind === 'linear') {
      return {
        kind, stops,
        start: [num(gradAttr(grad, 'x1'), 0), num(gradAttr(grad, 'y1'), 0)],
        end:   [num(gradAttr(grad, 'x2'), 0), num(gradAttr(grad, 'y2'), 0)],
      }
    }
    const cx = num(gradAttr(grad, 'cx'), 0), cy = num(gradAttr(grad, 'cy'), 0)
    const r  = num(gradAttr(grad, 'r'), 0)
    return { kind, stops, start: [cx, cy], end: [cx + r, cy] }
  }

  // objectBoundingBox: coordinates are fractions of the element's geometry box.
  const bb = pathBBox(el)
  if (!bb) return undefined
  if (kind === 'linear') {
    const x1 = frac(gradAttr(grad, 'x1'), 0), y1 = frac(gradAttr(grad, 'y1'), 0)
    const x2 = frac(gradAttr(grad, 'x2'), 1), y2 = frac(gradAttr(grad, 'y2'), 0)
    return {
      kind, stops,
      start: [bb.x + x1 * bb.w, bb.y + y1 * bb.h],
      end:   [bb.x + x2 * bb.w, bb.y + y2 * bb.h],
    }
  }
  const cx = frac(gradAttr(grad, 'cx'), 0.5), cy = frac(gradAttr(grad, 'cy'), 0.5)
  const r  = frac(gradAttr(grad, 'r'), 0.5)
  const center: [number, number] = [bb.x + cx * bb.w, bb.y + cy * bb.h]
  return { kind, stops, start: center, end: [center[0] + r * bb.w, center[1]] }
}

/** A gradient may carry coords/units directly or inherit them via href. */
function gradAttr(grad: Element, attr: string): string | null {
  const own = grad.getAttribute(attr)
  if (own != null) return own
  const ref = hrefTarget(grad)
  return ref ? gradAttr(ref, attr) : null
}

/** Follow a gradient's stop list, inheriting from an href target when empty. */
function findStopsHost(grad: Element): Element | null {
  if (grad.querySelector('stop')) return grad
  const ref = hrefTarget(grad)
  return ref ? findStopsHost(ref) : null
}

function hrefTarget(el: Element): Element | null {
  const href = el.getAttribute('href') ?? el.getAttribute('xlink:href')
  if (!href || !href.startsWith('#')) return null
  return el.ownerDocument?.getElementById(href.slice(1)) ?? null
}

function parseOffset(raw: string | null, fb: number): number {
  if (raw == null) return fb
  const t = raw.trim()
  const v = t.endsWith('%') ? (parseFloat(t) || 0) / 100 : (parseFloat(t) || 0)
  return Math.max(0, Math.min(1, v))
}

function clamp01n(v: number): number {
  return Math.max(0, Math.min(1, Number.isNaN(v) ? 1 : v))
}

/** Bounding box of an element's geometry, in user space (from its parsed path). */
function pathBBox(el: Element): { x: number; y: number; w: number; h: number } | null {
  const sps = elementToPath(el)
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const sp of sps) for (const [x, y] of sp.v) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y)
    x1 = Math.max(x1, x); y1 = Math.max(y1, y)
  }
  if (!Number.isFinite(x0)) return null
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}
