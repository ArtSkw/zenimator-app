import type {
  Scene,
  AnimatableGroup,
  AnimationBinding,
  AnimationTemplateId,
  EasingKey,
  AnimationParams,
  AnimationCategory,
} from '@/engine/scene/types'
import { EASINGS as VALID_EASINGS } from '@/engine/llm/schema'
import { templatesFor, getTemplate } from '@/engine/animations/templates'
import { fadeIn } from '@/engine/animations/templates/entrance/fadeIn'

const MAX_TOTAL_MS = 2500

const VALID_EASING_SET = new Set<EasingKey>(VALID_EASINGS)

/**
 * Validate LLM-proposed animations against the scene's category, clamp
 * parameters into sane ranges, resolve absolute timing, and enforce the
 * total-duration cap.
 *
 * Pure function — no network, no side effects.
 */
export function proposeAnimations(scene: Scene): Scene {
  const allowed = new Set<AnimationTemplateId>(templatesFor(scene.category))
  const groups = scene.groups.map((g) => sanitizeGroup(g, scene.category, allowed))
  const timed = fitToDurationCap(groups)
  return { ...scene, groups: timed }
}

// ---------------------------------------------------------------------------
// Per-group sanitization
// ---------------------------------------------------------------------------

function sanitizeGroup(
  g: AnimatableGroup,
  category: AnimationCategory,
  allowed: Set<AnimationTemplateId>,
): AnimatableGroup {
  // No animation proposed — pick a sensible category default.
  if (g.animation == null) {
    return { ...g, animation: defaultForCategory(category) }
  }

  return { ...g, animation: sanitizeBinding(g.animation, category, allowed) }
}

function sanitizeBinding(
  b: AnimationBinding,
  category: AnimationCategory,
  allowed: Set<AnimationTemplateId>,
): AnimationBinding {
  // Clamp to the category's whitelist. If the LLM proposed something outside
  // it, fall back to category's safest default.
  const template: AnimationTemplateId = allowed.has(b.template)
    ? b.template
    : safestDefault(category)

  // Pull template defaults to fill any missing params.
  const defaults = getTemplate(template)?.defaultParams ?? fadeIn.defaultParams

  const easing: EasingKey = VALID_EASING_SET.has(b.params?.easing)
    ? b.params.easing
    : defaults.easing

  const params: AnimationParams = {
    duration: clamp(b.params?.duration, 100, 2000, defaults.duration),
    delay: clamp(b.params?.delay, 0, 1500, defaults.delay),
    easing,
  }

  if (b.params?.distance !== undefined || defaults.distance !== undefined) {
    params.distance = clamp(b.params?.distance, 8, 96, defaults.distance ?? 24)
  }
  if (b.params?.scaleFrom !== undefined || defaults.scaleFrom !== undefined) {
    params.scaleFrom = clamp(b.params?.scaleFrom, 0.5, 1, defaults.scaleFrom ?? 0.92)
  }
  if (b.params?.staggerMs !== undefined || defaults.staggerMs !== undefined) {
    params.staggerMs = clamp(b.params?.staggerMs, 0, 200, defaults.staggerMs ?? 60)
  }

  return {
    template,
    params,
    timing: {
      start: clamp(b.timing?.start, 0, MAX_TOTAL_MS, 0),
    },
  }
}

function safestDefault(_category: AnimationCategory): AnimationTemplateId {
  return 'fade-in'
}

function defaultForCategory(_category: AnimationCategory): AnimationBinding {
  return {
    template: 'fade-in',
    params: { ...fadeIn.defaultParams },
    timing: { start: 0 },
  }
}

// ---------------------------------------------------------------------------
// Duration cap — compress if we'd exceed MAX_TOTAL_MS
// ---------------------------------------------------------------------------

function fitToDurationCap(groups: AnimatableGroup[]): AnimatableGroup[] {
  const withAnim = groups.filter((g) => g.animation)
  if (withAnim.length === 0) return groups

  const totalEnd = Math.max(
    ...withAnim.map((g) => g.animation!.timing.start + g.animation!.params.duration),
  )

  if (totalEnd <= MAX_TOTAL_MS) return groups

  const scale = MAX_TOTAL_MS / totalEnd
  return groups.map((g) => {
    if (!g.animation) return g
    return {
      ...g,
      animation: {
        ...g.animation,
        timing: { start: Math.round(g.animation.timing.start * scale) },
        params: {
          ...g.animation.params,
          duration: Math.round(g.animation.params.duration * scale),
        },
      },
    }
  })
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function clamp(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

export function defaultFadeIn(): AnimationBinding {
  return {
    template: 'fade-in',
    params: { ...fadeIn.defaultParams },
    timing: { start: 0 },
  }
}
