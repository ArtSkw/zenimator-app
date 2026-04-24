import { useEffect, useRef } from 'react'
import type {
  Scene,
  AnimatableGroup,
  AnimationTemplateId,
  AnimationParams,
  EasingKey,
} from '@/engine/scene/types'

type Props = {
  scene: Scene
  isPlaying: boolean
  animationKey: number
  selectedGroupId: string | null
}

export function SvgPlayer({ scene, isPlaying, animationKey, selectedGroupId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const animated = scene.groups.filter(
      (g) => g.animation && g.animation.template !== 'none',
    )

    // Resolve every target element (wrapper groups + per-element members).
    const targetsByGroup = animated.map((g) => ({
      group: g,
      targets: resolveTargets(g, container),
    }))

    const allTargets = targetsByGroup.flatMap((t) => t.targets)

    // Reset to resting state on every re-run (also clears on unmount).
    resetTargets(allTargets)

    if (!isPlaying) return

    // If nothing resolvable, fall back to a whole-SVG fade so the user still
    // sees *something* on Play (better than total silence).
    const haveAnyTarget = targetsByGroup.some((t) => t.targets.length > 0)
    if (!haveAnyTarget) {
      const svgEl = container.querySelector('svg') as unknown as HTMLElement | null
      if (svgEl) svgEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, fill: 'both' })
      return
    }

    const running: Animation[] = []

    for (const { group, targets } of targetsByGroup) {
      if (targets.length === 0 || !group.animation) continue
      const { template, params, timing } = group.animation

      // `stagger-children` is a marker on a parent group — it doesn't
      // produce its own keyframes. Children animate via their own timing.
      if (template === 'stagger-children') continue

      const options: KeyframeAnimationOptions = {
        duration: Math.max(1, params.duration),
        delay: Math.max(0, timing.start),
        easing: easingForWaapi(params.easing),
        fill: 'both',
      }

      try {
        if (template === 'draw-stroke') {
          // Draw-stroke needs per-path stroke-dashoffset animation.
          for (const el of targets) {
            running.push(...animateDrawStroke(el, options, !!params.drawReverse))
          }
        } else {
          // Generic transform + opacity keyframes via WAAPI.
          const keyframes = keyframesForTemplate(template, params)
          for (const el of targets) {
            prepareElementForTransform(el)
            running.push(el.animate(keyframes, options))
          }
        }
      } catch (err) {
        console.warn(
          `[zenimator] Failed to animate group "${group.label}":`,
          err,
        )
      }
    }

    return () => {
      for (const a of running) a.cancel()
      clearDrawStrokeStyles(allTargets)
    }
  }, [isPlaying, animationKey, scene])

  const selectedGroup = selectedGroupId
    ? scene.groups.find((g) => g.id === selectedGroupId)
    : null

  return (
    <div
      ref={containerRef}
      className="shadow-md rounded-md bg-white relative"
      style={{ width: scene.viewport.width, height: scene.viewport.height }}
    >
      <div dangerouslySetInnerHTML={{ __html: scene.source.raw }} />
      {selectedGroup && (
        <svg
          className="absolute inset-0 pointer-events-none"
          width={scene.viewport.width}
          height={scene.viewport.height}
          viewBox={`0 0 ${scene.viewport.width} ${scene.viewport.height}`}
        >
          <rect
            x={selectedGroup.bounds.x - 3}
            y={selectedGroup.bounds.y - 3}
            width={selectedGroup.bounds.width + 6}
            height={selectedGroup.bounds.height + 6}
            fill="rgba(10, 10, 10, 0.05)"
            stroke="#0A0A0A"
            strokeWidth="1.5"
            rx="4"
            strokeDasharray="5 3"
          />
        </svg>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Target resolution — a group animates its wrapper OR each member in sync.
// ---------------------------------------------------------------------------

function resolveTargets(group: AnimatableGroup, container: Element): HTMLElement[] {
  const results: HTMLElement[] = []
  if (group.elementRef) {
    const el = container.querySelector(group.elementRef) as HTMLElement | null
    if (el) results.push(el)
  } else if (group.memberRefs && group.memberRefs.length > 0) {
    for (const ref of group.memberRefs) {
      const el = container.querySelector(ref) as HTMLElement | null
      if (el) results.push(el)
    }
  }
  return results
}

function resetTargets(targets: HTMLElement[]): void {
  for (const el of targets) {
    el.style.opacity = ''
    el.style.transform = ''
  }
}

/**
 * SVG elements default to `transform-origin: 0 0` and user-space coordinates,
 * which makes scale/rotate animations misbehave. Setting `transform-box:
 * fill-box` + `transform-origin: center` makes CSS transforms on <g>/<path>
 * behave like HTML (relative to the element's own bounding box center).
 */
function prepareElementForTransform(el: HTMLElement): void {
  const style = el.style as CSSStyleDeclaration & { transformBox?: string }
  style.transformBox = 'fill-box'
  style.transformOrigin = 'center'
}

// ---------------------------------------------------------------------------
// draw-stroke — animate stroke-dashoffset on every <path> inside the target
// ---------------------------------------------------------------------------

function animateDrawStroke(
  target: HTMLElement,
  options: KeyframeAnimationOptions,
  reverse: boolean,
): Animation[] {
  const paths = collectPaths(target)
  const strokeable = paths.filter(hasVisibleStroke)

  // When no paths have a visible stroke, stroke-dashoffset has no visual effect.
  // Fall back to a clip-path inset reveal on the container — same "drawing" feel,
  // works for purely-filled shapes.
  if (strokeable.length === 0) {
    const from = reverse ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)'
    return [
      target.animate(
        [{ clipPath: from }, { clipPath: 'inset(0 0 0 0)' }] as Keyframe[],
        options,
      ),
    ]
  }

  const anims: Animation[] = []
  for (const path of strokeable) {
    try {
      const length = path.getTotalLength()
      if (!Number.isFinite(length) || length === 0) continue

      // reverse=false: offset L→0 reveals from path-end toward path-start.
      // reverse=true:  offset -L→0 reveals from path-start toward path-end.
      const startOffset = reverse ? -length : length
      path.style.strokeDasharray = String(length)
      path.style.strokeDashoffset = String(startOffset)

      anims.push(
        path.animate(
          [{ strokeDashoffset: startOffset }, { strokeDashoffset: 0 }] as Keyframe[],
          options,
        ),
      )
    } catch {
      // Element doesn't support getTotalLength — skip.
    }
  }
  return anims
}

function hasVisibleStroke(path: SVGPathElement): boolean {
  const computed = getComputedStyle(path)
  const stroke = computed.stroke
  if (!stroke || stroke === 'none') return false
  const width = parseFloat(computed.strokeWidth)
  return Number.isFinite(width) && width > 0
}

function collectPaths(target: Element): SVGPathElement[] {
  if (target.tagName.toLowerCase() === 'path') {
    return [target as unknown as SVGPathElement]
  }
  return Array.from(target.querySelectorAll('path')) as unknown as SVGPathElement[]
}

function clearDrawStrokeStyles(targets: HTMLElement[]): void {
  for (const t of targets) {
    for (const path of collectPaths(t)) {
      path.style.strokeDasharray = ''
      path.style.strokeDashoffset = ''
    }
  }
}

// ---------------------------------------------------------------------------
// Keyframes per template (non-draw-stroke)
// ---------------------------------------------------------------------------

function keyframesForTemplate(
  template: AnimationTemplateId,
  params: AnimationParams,
): Keyframe[] {
  const distance = params.distance ?? 24
  const scaleFrom = params.scaleFrom

  switch (template) {
    case 'slide-up':
      return [
        { opacity: 0, transform: `translateY(${distance}px)` },
        { opacity: 1, transform: 'translateY(0)' },
      ]
    case 'slide-down':
      return [
        { opacity: 0, transform: `translateY(-${distance}px)` },
        { opacity: 1, transform: 'translateY(0)' },
      ]
    case 'slide-left':
      return [
        { opacity: 0, transform: `translateX(${distance}px)` },
        { opacity: 1, transform: 'translateX(0)' },
      ]
    case 'slide-right':
      return [
        { opacity: 0, transform: `translateX(-${distance}px)` },
        { opacity: 1, transform: 'translateX(0)' },
      ]
    case 'scale-in':
      return [
        { opacity: 0, transform: `scale(${scaleFrom ?? 0.92})` },
        { opacity: 1, transform: 'scale(1)' },
      ]
    case 'pop-in':
      return [
        { opacity: 0, transform: `scale(${scaleFrom ?? 0.6})` },
        { opacity: 1, transform: 'scale(1)' },
      ]
    case 'fade-in':
    default:
      return [{ opacity: 0 }, { opacity: 1 }]
  }
}

// ---------------------------------------------------------------------------
// Easing mapping — WAAPI accepts named easings or cubic-bezier strings.
// Springs are approximated with bezier curves; close enough for entrance
// animations and guaranteed to run everywhere.
// ---------------------------------------------------------------------------

const EASING_MAP: Record<EasingKey, string> = {
  linear: 'linear',
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  'spring-gentle': 'cubic-bezier(0.33, 1, 0.68, 1)',
  'spring-bouncy': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  'spring-stiff': 'cubic-bezier(0.22, 1, 0.36, 1.05)',
}

function easingForWaapi(key: EasingKey): string {
  return EASING_MAP[key] ?? 'cubic-bezier(0, 0, 0.2, 1)'
}
