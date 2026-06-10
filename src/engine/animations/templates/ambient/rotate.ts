import type { AnimationTemplate } from '@/engine/animations/template'

/**
 * Continuous full rotation around the element's centre. Best on cogs,
 * gears, wheels, spirals — anything that should appear to spin. Default
 * 6000ms per full rotation, linear easing (constant speed).
 *
 * Direction is controlled via `rotateDirection` ('cw' | 'ccw'). The
 * 'alternate' looping direction is intentionally not used — a cog that
 * reverses direction looks broken.
 */
export const rotate: AnimationTemplate = {
  id: 'rotate',
  category: 'ambient',
  description: 'Continuous rotation. Cogs, gears, wheels, spinning shapes.',
  defaultParams: {
    duration: 6000,
    delay: 0,
    easing: 'linear',
    rotateDirection: 'cw',
  },
  suitableFor: ['icon', 'illustration', 'decoration'],
}
