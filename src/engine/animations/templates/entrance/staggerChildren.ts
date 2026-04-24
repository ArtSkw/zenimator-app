import type { AnimationTemplate } from '@/engine/animations/template'

/**
 * Container marker. The parent group itself doesn't produce keyframes;
 * staggered entrance comes from the LLM setting per-child `timing.start`
 * values. The player treats this template as "don't animate the parent,
 * let children handle themselves."
 */
export const staggerChildren: AnimationTemplate = {
  id: 'stagger-children',
  category: 'entrance',
  description: 'No parent animation; children animate in sequence via their own timing.',
  defaultParams: {
    duration: 300,
    delay: 0,
    easing: 'easeOut',
    staggerMs: 60,
  },
  suitableFor: ['card', 'list-item', 'illustration'],
}
