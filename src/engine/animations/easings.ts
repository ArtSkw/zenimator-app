import type { EasingKey } from '@/engine/scene/types'

type SpringDef = { type: 'spring'; damping: number; stiffness: number; mass: number }
type BezierDef = [number, number, number, number]
export type EasingDef = 'linear' | BezierDef | SpringDef

export const EASINGS: Record<EasingKey, EasingDef> = {
  linear: 'linear',
  easeIn: [0.4, 0, 1, 1],
  easeOut: [0, 0, 0.2, 1],
  easeInOut: [0.4, 0, 0.2, 1],
  'spring-gentle': { type: 'spring', damping: 20, stiffness: 100, mass: 1 },
  'spring-bouncy': { type: 'spring', damping: 10, stiffness: 120, mass: 1 },
  'spring-stiff': { type: 'spring', damping: 22, stiffness: 200, mass: 1 },
}

export function isSpring(def: EasingDef): def is SpringDef {
  return typeof def === 'object' && !Array.isArray(def)
}
