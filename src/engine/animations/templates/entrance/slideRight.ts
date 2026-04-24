import type { AnimationTemplate } from '@/engine/animations/template'

export const slideRight: AnimationTemplate = {
  id: 'slide-right',
  category: 'entrance',
  description: 'Slide in from the left + fade in.',
  defaultParams: {
    duration: 450,
    delay: 0,
    easing: 'spring-gentle',
    distance: 24,
  },
  suitableFor: ['text', 'list-item', 'card', 'illustration', 'unknown'],
}
