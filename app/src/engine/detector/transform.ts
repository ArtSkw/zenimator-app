/**
 * SVG transform resolution.
 *
 * SVG elements can carry a `transform` attribute (matrix/translate/scale/rotate/
 * skew), and groups can nest transforms. getBBox() and raw geometry attributes
 * (cx, cy, d, …) are in the element's LOCAL space — BEFORE its own transform is
 * applied. To place geometry and bounds correctly in root (viewport) space we
 * must compose each element's transform with all ancestor transforms up to the
 * <svg> root and apply it. Without this, e.g. a `<circle cx=10 cy=10
 * transform="matrix(… 255 70)">` renders at the local origin instead of at
 * (255,70) — the "detached paw" bug.
 */

/** 2D affine matrix [a, b, c, d, e, f] →  | a c e |
 *                                          | b d f | */
export type Mat = [number, number, number, number, number, number]

export const IDENTITY: Mat = [1, 0, 0, 1, 0, 0]

/** A·B (apply B first, then A). */
export function mul(A: Mat, B: Mat): Mat {
  return [
    A[0] * B[0] + A[2] * B[1],
    A[1] * B[0] + A[3] * B[1],
    A[0] * B[2] + A[2] * B[3],
    A[1] * B[2] + A[3] * B[3],
    A[0] * B[4] + A[2] * B[5] + A[4],
    A[1] * B[4] + A[3] * B[5] + A[5],
  ]
}

export function isIdentity(m: Mat): boolean {
  return m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1 && m[4] === 0 && m[5] === 0
}

/** Apply to a point (includes translation). */
export function applyPoint(m: Mat, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
}

/** Apply to a free vector / tangent (NO translation). */
export function applyVec(m: Mat, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y, m[1] * x + m[3] * y]
}

/** Uniform linear scale factor of the matrix (for stroke-width scaling). */
export function linearScale(m: Mat): number {
  return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1
}

/** Axis-aligned bounding box of a rect after transforming its four corners. */
export function transformRect(
  m: Mat,
  r: { x: number; y: number; width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  if (isIdentity(m)) return r
  const corners: [number, number][] = [
    applyPoint(m, r.x, r.y),
    applyPoint(m, r.x + r.width, r.y),
    applyPoint(m, r.x, r.y + r.height),
    applyPoint(m, r.x + r.width, r.y + r.height),
  ]
  const xs = corners.map((c) => c[0])
  const ys = corners.map((c) => c[1])
  const x0 = Math.min(...xs)
  const y0 = Math.min(...ys)
  return { x: x0, y: y0, width: Math.max(...xs) - x0, height: Math.max(...ys) - y0 }
}

// ── Parsing ─────────────────────────────────────────────────────────────────

const DEG = Math.PI / 180

/** Parse one `transform` attribute string (possibly several functions) into a
 *  single composed matrix. Unknown functions are skipped. */
export function parseTransform(str: string | null): Mat {
  if (!str) return IDENTITY
  let m: Mat = IDENTITY
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(str))) {
    const fn = match[1]
    const args = match[2].split(/[\s,]+/).map(Number).filter((n) => !Number.isNaN(n))
    m = mul(m, fnToMat(fn, args))
  }
  return m
}

function fnToMat(fn: string, a: number[]): Mat {
  switch (fn) {
    case 'matrix':
      return a.length === 6 ? (a as Mat) : IDENTITY
    case 'translate':
      return [1, 0, 0, 1, a[0] || 0, a[1] || 0]
    case 'scale':
      return [a[0] ?? 1, 0, 0, a[1] ?? a[0] ?? 1, 0, 0]
    case 'rotate': {
      const cos = Math.cos((a[0] || 0) * DEG)
      const sin = Math.sin((a[0] || 0) * DEG)
      const rot: Mat = [cos, sin, -sin, cos, 0, 0]
      if (a.length >= 3) {
        // rotate(θ cx cy) = translate(cx cy)·rotate(θ)·translate(-cx -cy)
        return mul(mul([1, 0, 0, 1, a[1], a[2]], rot), [1, 0, 0, 1, -a[1], -a[2]])
      }
      return rot
    }
    case 'skewX':
      return [1, 0, Math.tan((a[0] || 0) * DEG), 1, 0, 0]
    case 'skewY':
      return [1, Math.tan((a[0] || 0) * DEG), 0, 1, 0, 0]
    default:
      return IDENTITY
  }
}

/** The element's full transform to root (viewport) space: its own `transform`
 *  composed with every ancestor `<g>` transform up to (not including) <svg>. */
export function elementWorldMatrix(el: Element): Mat {
  let m: Mat = IDENTITY
  let cur: Element | null = el
  while (cur && cur.tagName.toLowerCase().replace(/^svg:/, '') !== 'svg') {
    const t = parseTransform(cur.getAttribute('transform'))
    if (!isIdentity(t)) m = mul(t, m)
    cur = cur.parentElement
  }
  return m
}
