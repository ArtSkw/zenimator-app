import type { AnimationTemplate } from '@/engine/animations/template'

/**
 * Brief vertical-scale collapse — the element shrinks to ~5% of its
 * height for a tiny fraction of the cycle, then returns. Used for
 * character eyes, animated mouth/lid features, anything that should
 * "blink".
 *
 * The eye is open ~96% of the time and closed for ~4% of the cycle.
 * That means with the default 4000ms duration the blink itself is ~160ms
 * (snappy, like a real blink). Designers tune frequency via `duration`.
 */
export const blink: AnimationTemplate = {
  id: 'blink',
  category: 'ambient',
  description: 'Brief vertical collapse — character eyes, blinking lids.',
  defaultParams: {
    duration: 4000,
    delay: 0,
    easing: 'easeOut',
  },
  suitableFor: ['icon', 'illustration', 'decoration'],
}
