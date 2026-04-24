import type { AnimationTemplate } from '@/engine/animations/template'

export const fadeIn: AnimationTemplate = {
  id: 'fade-in',
  category: 'entrance',
  description: 'Opacity 0 → 1. Subtle, safe default.',
  defaultParams: {
    duration: 300,
    delay: 0,
    easing: 'easeOut',
  },
  suitableFor: [
    'icon',
    'illustration',
    'text',
    'list-item',
    'button',
    'card',
    'background',
    'decoration',
    'whole-image',
    'unknown',
  ],
}
