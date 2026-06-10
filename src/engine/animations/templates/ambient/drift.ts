import type { AnimationTemplate } from '@/engine/animations/template'

/**
 * Slow horizontal or vertical translation — element drifts a few pixels in
 * one direction and returns. Default amplitude 8px on the X axis. 6000ms
 * full cycle.
 */
export const drift: AnimationTemplate = {
  id: 'drift',
  category: 'ambient',
  description: 'Slow directional drift. Background shapes and decorative elements.',
  defaultParams: {
    duration: 6000,
    delay: 0,
    easing: 'easeInOut',
    amplitude: 8,
    driftAxis: 'x',
  },
  suitableFor: ['decoration', 'background', 'illustration'],
}
