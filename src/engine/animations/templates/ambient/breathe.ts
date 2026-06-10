import type { AnimationTemplate } from '@/engine/animations/template'

/**
 * Subtle scale oscillation — the focal element of the scene "breathes" in
 * place. Default amplitude 0.02 (= 2% scale up at peak). 3000ms full cycle.
 */
export const breathe: AnimationTemplate = {
  id: 'breathe',
  category: 'ambient',
  description: 'Subtle scale oscillation. Focal hero/card element that should feel alive.',
  defaultParams: {
    duration: 3000,
    delay: 0,
    easing: 'easeInOut',
    amplitude: 0.02,
  },
  suitableFor: ['card', 'illustration', 'whole-image', 'icon'],
}
