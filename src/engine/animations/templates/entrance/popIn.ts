import type { AnimationTemplate } from '@/engine/animations/template'

export const popIn: AnimationTemplate = {
  id: 'pop-in',
  category: 'entrance',
  description: 'Bouncy scale-up from 0.6 + fade in. Reserve for the single most important focal element.',
  defaultParams: {
    duration: 500,
    delay: 0,
    easing: 'spring-bouncy',
    scaleFrom: 0.6,
  },
  suitableFor: ['icon', 'button'],
}
