import type { AnimationTemplate } from '@/engine/animations/template'

export const slideDown: AnimationTemplate = {
  id: 'slide-down',
  category: 'entrance',
  description: 'Slide down from above + fade in.',
  defaultParams: {
    duration: 450,
    delay: 0,
    easing: 'spring-gentle',
    distance: 24,
  },
  suitableFor: ['text', 'list-item', 'card', 'illustration', 'unknown'],
}
