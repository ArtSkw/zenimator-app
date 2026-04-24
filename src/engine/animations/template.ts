import type {
  AnimationCategory,
  AnimationParams,
  AnimationTemplateId,
  GroupTag,
} from '@/engine/scene/types'

/**
 * Shared contract for every animation template module. Templates live under
 * `templates/{category}/` and are aggregated into a per-category registry.
 *
 * The template is *data* — metadata, defaults, suitability. It intentionally
 * does NOT own its own keyframes. Keyframe generation lives in the player
 * (SvgPlayer) because some templates need SVG-specific behaviour
 * (e.g. stroke-dashoffset) that doesn't fit a generic template function.
 */
export type AnimationTemplate = {
  id: AnimationTemplateId
  category: AnimationCategory
  /** One-line label for UI surfaces. */
  description: string
  /** Sensible defaults — used when the LLM omits a param, or when the user
   *  resets a group. */
  defaultParams: AnimationParams
  /** Group tags this template makes sense for. Used as a sanity filter
   *  when the LLM proposes an animation. */
  suitableFor: GroupTag[]
}
