import type { AnimationTemplate } from '@/engine/animations/template'

/**
 * Vertical drift — element rises a few pixels and settles back. Reads as
 * "weightless". Default amplitude 6px. 4000ms full cycle.
 */
export const float: AnimationTemplate = {
  id: 'float',
  category: 'ambient',
  description: 'Subtle vertical drift. Small detached elements (icons, illustrations).',
  defaultParams: {
    duration: 4000,
    delay: 0,
    easing: 'easeInOut',
    amplitude: 6,
  },
  suitableFor: ['icon', 'illustration', 'decoration'],
}
