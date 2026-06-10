import type { AnimationTemplateId } from '@/engine/scene/types'
import type { AnimationTemplate } from '@/engine/animations/template'

import { breathe } from './breathe'
import { float } from './float'
import { drift } from './drift'
import { shimmer } from './shimmer'
import { rotate } from './rotate'
import { blink } from './blink'

export { breathe, float, drift, shimmer, rotate, blink }

/** Map of ambient templates keyed by id. */
export const AMBIENT_TEMPLATES: Record<string, AnimationTemplate> = {
  [breathe.id]: breathe,
  [float.id]: float,
  [drift.id]: drift,
  [shimmer.id]: shimmer,
  [rotate.id]: rotate,
  [blink.id]: blink,
}

/** Template IDs the LLM may propose for the Ambient category. */
export const AMBIENT_TEMPLATE_IDS: AnimationTemplateId[] = [
  breathe.id,
  float.id,
  drift.id,
  shimmer.id,
  rotate.id,
  blink.id,
  'none',
]
