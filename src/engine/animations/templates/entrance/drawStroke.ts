import type { AnimationTemplate } from '@/engine/animations/template'

/**
 * Animates `stroke-dashoffset` from the path length down to 0, producing
 * a "drawing" effect on stroked paths. SVG-only — the player computes
 * each path's stroke length via `getTotalLength()` at animation start.
 */
export const drawStroke: AnimationTemplate = {
  id: 'draw-stroke',
  category: 'entrance',
  description: 'Draws stroked paths on from zero length. SVG illustrations with visible strokes.',
  defaultParams: {
    duration: 800,
    delay: 0,
    easing: 'easeInOut',
    drawReverse: false,
  },
  suitableFor: ['illustration', 'icon', 'decoration'],
}
