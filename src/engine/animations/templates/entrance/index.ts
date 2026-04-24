import type { AnimationTemplateId } from '@/engine/scene/types'
import type { AnimationTemplate } from '@/engine/animations/template'

import { fadeIn } from './fadeIn'
import { slideUp } from './slideUp'
import { slideDown } from './slideDown'
import { slideLeft } from './slideLeft'
import { slideRight } from './slideRight'
import { scaleIn } from './scaleIn'
import { popIn } from './popIn'
import { drawStroke } from './drawStroke'
import { staggerChildren } from './staggerChildren'

export {
  fadeIn,
  slideUp,
  slideDown,
  slideLeft,
  slideRight,
  scaleIn,
  popIn,
  drawStroke,
  staggerChildren,
}

/** Map of entrance templates keyed by id. */
export const ENTRANCE_TEMPLATES: Record<string, AnimationTemplate> = {
  [fadeIn.id]: fadeIn,
  [slideUp.id]: slideUp,
  [slideDown.id]: slideDown,
  [slideLeft.id]: slideLeft,
  [slideRight.id]: slideRight,
  [scaleIn.id]: scaleIn,
  [popIn.id]: popIn,
  [drawStroke.id]: drawStroke,
  [staggerChildren.id]: staggerChildren,
}

/** Template IDs the LLM may propose for the Entrance category. */
export const ENTRANCE_TEMPLATE_IDS: AnimationTemplateId[] = [
  fadeIn.id,
  slideUp.id,
  slideDown.id,
  slideLeft.id,
  slideRight.id,
  scaleIn.id,
  popIn.id,
  drawStroke.id,
  staggerChildren.id,
  'none',
]
