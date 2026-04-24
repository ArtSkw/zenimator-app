import type { EasingKey } from '@/engine/scene/types'
import { EASINGS, isSpring } from '@/engine/animations/easings'

const W = 40
const H = 18

function cubicBezierPath(x1: number, y1: number, x2: number, y2: number): string {
  // SVG Y is inverted: value 0 → bottom (H), value 1 → top (0)
  return `M 0 ${H} C ${x1 * W} ${(1 - y1) * H} ${x2 * W} ${(1 - y2) * H} ${W} 0`
}

function simulateSpring(damping: number, stiffness: number, mass: number): number[] {
  const omega0 = Math.sqrt(stiffness / mass)
  const zeta = damping / (2 * Math.sqrt(stiffness * mass))
  // Simulate to 5 time-constants so the curve is clearly settled at the right edge.
  const T = zeta >= 1 ? 5 / omega0 : 5 / (zeta * omega0)
  const N = 60
  return Array.from({ length: N + 1 }, (_, i) => {
    const t = (i / N) * T
    if (zeta >= 1) {
      return 1 - Math.exp(-omega0 * t) * (1 + omega0 * t)
    }
    const omegaD = omega0 * Math.sqrt(1 - zeta * zeta)
    const decay = Math.exp(-zeta * omega0 * t)
    const phase = Math.cos(omegaD * t) + (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(omegaD * t)
    return 1 - decay * phase
  })
}

function springPath(damping: number, stiffness: number, mass: number): string {
  const values = simulateSpring(damping, stiffness, mass)
  const maxVal = Math.max(...values, 1)
  const minVal = Math.min(...values, 0)
  const range = maxVal - minVal
  const VPAD = 1.5
  const drawH = H - 2 * VPAD
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * W
      const y = VPAD + (1 - (v - minVal) / range) * drawH
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

function buildPath(easing: EasingKey): string {
  const def = EASINGS[easing]
  if (def === 'linear') return `M 0 ${H} L ${W} 0`
  if (Array.isArray(def)) return cubicBezierPath(def[0], def[1], def[2], def[3])
  if (isSpring(def)) return springPath(def.damping, def.stiffness, def.mass)
  return `M 0 ${H} L ${W} 0`
}

// Pre-compute all paths at module load — avoids running the spring simulation
// (61 samples) and bezier math on every dropdown render.
const CACHED_PATHS = Object.fromEntries(
  (Object.keys(EASINGS) as EasingKey[]).map((k) => [k, buildPath(k)]),
) as Record<EasingKey, string>

type Props = { easing: EasingKey }

export function EasingCurve({ easing }: Props) {
  return (
    // Explicit style overrides SelectTrigger's [&_svg:not([class*='size-'])]:size-4 rule.
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: W, height: H }}
      className="shrink-0"
      aria-hidden
    >
      <path
        d={CACHED_PATHS[easing]}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.7}
      />
    </svg>
  )
}
