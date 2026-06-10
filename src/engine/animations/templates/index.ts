import type { AnimationCategory, AnimationTemplateId } from '@/engine/scene/types'
import type { AnimationTemplate } from '@/engine/animations/template'
import { ENTRANCE_TEMPLATE_IDS, ENTRANCE_TEMPLATES } from './entrance'
import { AMBIENT_TEMPLATE_IDS, AMBIENT_TEMPLATES } from './ambient'

export { fadeIn, slideUp } from './entrance'

/** Template IDs valid for each animation category. */
export const TEMPLATES_BY_CATEGORY: Record<AnimationCategory, AnimationTemplateId[]> = {
  entrance: ENTRANCE_TEMPLATE_IDS,
  ambient: AMBIENT_TEMPLATE_IDS,
}

export function templatesFor(category: AnimationCategory): AnimationTemplateId[] {
  return TEMPLATES_BY_CATEGORY[category]
}

/** Full template registry. */
export const TEMPLATE_REGISTRY: Record<string, AnimationTemplate> = {
  ...ENTRANCE_TEMPLATES,
  ...AMBIENT_TEMPLATES,
}

export function getTemplate(id: AnimationTemplateId): AnimationTemplate | undefined {
  return TEMPLATE_REGISTRY[id]
}
