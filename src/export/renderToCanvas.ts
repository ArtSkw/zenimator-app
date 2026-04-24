import type {
  Scene,
  AnimatableGroup,
  AnimationTemplateId,
  AnimationParams,
  EasingKey,
} from '@/engine/scene/types'

// ─── Cubic-bezier easing ─────────────────────────────────────────────────────

function makeBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1
  const bx = 3 * x2 - 6 * x1
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * y2 - 6 * y1
  const ay = 1 - cy - by

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t
  const sampleDX = (t: number) => (3 * ax * t + 2 * bx) * t + cx
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t

  return (x: number): number => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let u = x
    for (let i = 0; i < 10; i++) {
      const dx = sampleDX(u)
      if (Math.abs(dx) < 1e-7) break
      u -= (sampleX(u) - x) / dx
    }
    return sampleY(u)
  }
}

const EASING_FNS: Record<EasingKey, (t: number) => number> = {
  linear:          (t) => t,
  easeIn:          makeBezier(0.4, 0, 1, 1),
  easeOut:         makeBezier(0, 0, 0.2, 1),
  easeInOut:       makeBezier(0.4, 0, 0.2, 1),
  'spring-gentle': makeBezier(0.33, 1, 0.68, 1),
  'spring-bouncy': makeBezier(0.34, 1.56, 0.64, 1),
  'spring-stiff':  makeBezier(0.22, 1, 0.36, 1.05),
}

// ─── Animation state at time t ────────────────────────────────────────────────

type GroupState = {
  opacity: number
  transform: string
  strokeProgress?: number  // draw-stroke only: 0 = hidden, 1 = fully drawn
}

export function computeGroupState(group: AnimatableGroup, t: number): GroupState {
  const anim = group.animation
  if (!anim || anim.template === 'none' || anim.template === 'stagger-children') {
    return { opacity: 1, transform: '' }
  }
  const elapsed = t - anim.timing.start
  const dur = anim.params.duration
  const ease = EASING_FNS[anim.params.easing] ?? EASING_FNS.easeOut

  let p: number
  if (elapsed < 0) p = 0
  else if (elapsed >= dur) p = 1
  else p = ease(elapsed / dur)

  return stateForTemplate(anim.template, anim.params, p)
}

function stateForTemplate(
  tpl: AnimationTemplateId,
  params: AnimationParams,
  p: number,
): GroupState {
  const d = params.distance ?? 24
  switch (tpl) {
    case 'fade-in':
      return { opacity: p, transform: '' }
    case 'slide-up':
      return { opacity: p, transform: `translateY(${d * (1 - p)}px)` }
    case 'slide-down':
      return { opacity: p, transform: `translateY(${-d * (1 - p)}px)` }
    case 'slide-left':
      return { opacity: p, transform: `translateX(${d * (1 - p)}px)` }
    case 'slide-right':
      return { opacity: p, transform: `translateX(${-d * (1 - p)}px)` }
    case 'scale-in': {
      const s = params.scaleFrom ?? 0.92
      return { opacity: p, transform: `scale(${s + (1 - s) * p})` }
    }
    case 'pop-in': {
      const s = params.scaleFrom ?? 0.6
      return { opacity: p, transform: `scale(${s + (1 - s) * p})` }
    }
    case 'draw-stroke':
      return { opacity: 1, transform: '', strokeProgress: p }
    default:
      return { opacity: 1, transform: '' }
  }
}

// ─── Target element helpers ───────────────────────────────────────────────────

function resolveTargets(group: AnimatableGroup, root: Element): Element[] {
  if (group.elementRef) {
    const el = root.querySelector(group.elementRef)
    return el ? [el] : []
  }
  return (group.memberRefs ?? []).flatMap((ref) => {
    const el = root.querySelector(ref)
    return el ? [el] : []
  })
}

function pathsOf(el: Element): SVGPathElement[] {
  if (el.tagName.toLowerCase() === 'path') return [el as SVGPathElement]
  return Array.from(el.querySelectorAll('path')) as SVGPathElement[]
}

function hasVisibleStrokeSvg(path: SVGPathElement): boolean {
  const stroke = path.getAttribute('stroke') ?? path.style.stroke
  if (!stroke || stroke === 'none') return false
  const width = path.getAttribute('stroke-width') ?? path.style.strokeWidth
  if (width === '0') return false
  return true
}

// ─── draw-stroke path length pre-measurement ─────────────────────────────────
// Must be called before the render loop; injects the SVG into a hidden container,
// calls getTotalLength() on each path, then removes the container.

export type PathLengths = Map<string, number>

export function measureDrawStrokeLengths(scene: Scene): PathLengths {
  const lengths: PathLengths = new Map()
  if (!scene.groups.some((g) => g.animation?.template === 'draw-stroke')) return lengths

  const container = document.createElement('div')
  container.style.cssText =
    'position:fixed;left:-10000px;top:-10000px;visibility:hidden;pointer-events:none'
  container.innerHTML = scene.source.raw
  document.body.appendChild(container)

  try {
    for (const g of scene.groups) {
      if (g.animation?.template !== 'draw-stroke') continue
      for (const el of resolveTargets(g, container)) {
        for (const path of pathsOf(el)) {
          if (!path.id) continue
          try {
            const len = path.getTotalLength()
            if (Number.isFinite(len) && len > 0) lengths.set(path.id, len)
          } catch {
            // not a stroked path — skip
          }
        }
      }
    }
  } finally {
    document.body.removeChild(container)
  }
  return lengths
}

// ─── SVG frame renderer ───────────────────────────────────────────────────────
// Mutates svgDoc in-place each frame (we own it), then serializes and draws.
// SVG images loaded via Blob URL are treated as static by the browser, so
// our computed inline styles are applied without CSS animation interference.

export async function drawSvgFrame(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  svgDoc: Document,
  t: number,
  w: number,
  h: number,
  pathLengths: PathLengths,
) {
  const root = svgDoc.documentElement
  root.setAttribute('width', String(w))
  root.setAttribute('height', String(h))

  for (const group of scene.groups) {
    const state = computeGroupState(group, t)
    for (const el of resolveTargets(group, root)) {
      const svgEl = el as SVGElement
      svgEl.style.opacity = state.opacity < 1 ? String(state.opacity) : ''
      if (state.transform) {
        svgEl.style.transform = state.transform
        svgEl.style.transformBox = 'fill-box'
        svgEl.style.transformOrigin = 'center'
      } else {
        svgEl.style.removeProperty('transform')
        svgEl.style.removeProperty('transform-box')
        svgEl.style.removeProperty('transform-origin')
      }
      if (state.strokeProgress !== undefined) {
        const reverse = group.animation?.params.drawReverse ?? false
        const paths = pathsOf(el)
        const strokeable = paths.filter(hasVisibleStrokeSvg)

        if (strokeable.length === 0) {
          // No visible strokes — clip-path reveal, mirrors the SvgPlayer fallback.
          const pct = ((1 - state.strokeProgress) * 100).toFixed(2)
          svgEl.style.clipPath = reverse
            ? `inset(0 0 0 ${pct}%)`
            : `inset(0 ${pct}% 0 0)`
        } else {
          const sign = reverse ? -1 : 1
          for (const path of strokeable) {
            const len = path.id ? pathLengths.get(path.id) : undefined
            if (len !== undefined && len > 0) {
              path.style.strokeDasharray = String(len)
              path.style.strokeDashoffset = String(sign * len * (1 - state.strokeProgress))
            }
          }
        }
      }
    }
  }

  const svgStr = new XMLSerializer().serializeToString(root)
  const blob = new Blob([svgStr], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)

  await new Promise<void>((resolve) => {
    const img = new Image(w, h)
    img.onload = () => {
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve()
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve()  // don't abort the whole export on a single bad frame
    }
    img.src = url
  })
}

