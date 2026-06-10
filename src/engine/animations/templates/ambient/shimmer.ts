import type { AnimationTemplate } from '@/engine/animations/template'

/**
 * Opacity pulse — element fades down and back up. Used for accents,
 * sparkles, and celebration highlights. Default amplitude 0.3 (=opacity
 * dips to 0.7 at trough). 2500ms full cycle.
 */
export const shimmer: AnimationTemplate = {
  id: 'shimmer',
  category: 'ambient',
  description: 'Subtle opacity pulse. Sparkles, stars, and accent highlights.',
  defaultParams: {
    duration: 2500,
    delay: 0,
    easing: 'easeInOut',
    amplitude: 0.3,
  },
  suitableFor: ['decoration', 'icon'],
}
