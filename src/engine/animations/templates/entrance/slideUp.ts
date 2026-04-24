import type { AnimationTemplate } from '@/engine/animations/template'

export const slideUp: AnimationTemplate = {
  id: 'slide-up',
  category: 'entrance',
  description: 'Slide up from below + fade in. Primary focal-element entry.',
  defaultParams: {
    duration: 450,
    delay: 0,
    easing: 'spring-gentle',
    distance: 24,
  },
  suitableFor: ['text', 'list-item', 'card', 'illustration', 'button', 'icon', 'unknown'],
}
