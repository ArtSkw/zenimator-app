import type { AnimationTemplate } from '@/engine/animations/template'

export const scaleIn: AnimationTemplate = {
  id: 'scale-in',
  category: 'entrance',
  description: 'Gentle scale-up from 0.92 + fade in. Icons, buttons, compact focal elements.',
  defaultParams: {
    duration: 350,
    delay: 0,
    easing: 'easeOut',
    scaleFrom: 0.92,
  },
  suitableFor: ['icon', 'button', 'illustration', 'card'],
}
