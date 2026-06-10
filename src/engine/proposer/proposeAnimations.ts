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

const MAX_TOTAL_MS = 2500     // entrance scenes — total budget across staggered animations
const MAX_DURATION_MS = 12000 // per-animation cap — ambient loops can be slow (e.g. 8-12s rotation)

const VALID_EASING_SET = new Set<EasingKey>(VALID_EASINGS)

// Per-template amplitude bounds. Ambient animations should always feel subtle.
const AMPLITUDE_BOUNDS: Record<string, { min: number; max: number; fallback: number }> = {
  breathe: { min: 0.005, max: 0.05, fallback: 0.02 }, // scale delta
  float:   { min: 2,     max: 20,   fallback: 6 },    // px
  drift:   { min: 2,     max: 40,   fallback: 8 },    // px
  shimmer: { min: 0.05,  max: 0.5,  fallback: 0.3 },  // opacity delta
}

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
  // Total-duration cap only applies to entrance — ambient loops have no "total scene length".
  const timed = scene.category === 'entrance' ? fitToDurationCap(groups) : groups
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
    duration: clamp(b.params?.duration, 100, MAX_DURATION_MS, defaults.duration),
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

  // Ambient amplitude — clamped to template-specific bounds.
  const amp = AMPLITUDE_BOUNDS[template]
  if (amp && (b.params?.amplitude !== undefined || defaults.amplitude !== undefined)) {
    params.amplitude = clamp(b.params?.amplitude, amp.min, amp.max, defaults.amplitude ?? amp.fallback)
  }
  if (template === 'drift') {
    params.driftAxis = b.params?.driftAxis === 'y' ? 'y' : (defaults.driftAxis ?? 'x')
  }
  if (template === 'rotate') {
    // Rotate must always use linear easing. Non-linear easings (especially
    // spring-bouncy) overshoot past 360° and snap back, which looks like a
    // brief reversal near the end of every cycle.
    params.easing = 'linear'
    params.rotateDirection = b.params?.rotateDirection === 'ccw' ? 'ccw' : (defaults.rotateDirection ?? 'cw')
    // Preserve manual pivot overrides (set via the UI, not the LLM).
    if (b.params?.rotateOriginX !== undefined) params.rotateOriginX = clamp(b.params.rotateOriginX, 0, 100, 50)
    if (b.params?.rotateOriginY !== undefined) params.rotateOriginY = clamp(b.params.rotateOriginY, 0, 100, 50)
  }

  // Ambient bindings loop infinitely by default. Preserve any LLM override,
  // but always force direction: 'normal' for rotate — alternate would reverse
  // a cog/hand mid-spin on every second iteration.
  const rawLooping = b.looping ?? (category === 'ambient'
    ? { iterations: 'infinite' as const, direction: 'normal' as const }
    : undefined)
  const looping = rawLooping && template === 'rotate'
    ? { ...rawLooping, direction: 'normal' as const }
    : rawLooping

  return {
    template,
    params,
    timing: {
      start: clamp(b.timing?.start, 0, MAX_TOTAL_MS, 0),
    },
    ...(looping ? { looping } : {}),
  }
}

function safestDefault(category: AnimationCategory): AnimationTemplateId {
  if (category === 'ambient') return 'breathe'
  return 'fade-in'
}

function defaultForCategory(category: AnimationCategory): AnimationBinding {
  if (category === 'ambient') {
    // Use breathe as the safest ambient default — gentle, works on most tags.
    const tpl = getTemplate('breathe')
    if (tpl) {
      return {
        template: 'breathe',
        params: { ...tpl.defaultParams },
        timing: { start: 0 },
        looping: { iterations: 'infinite', direction: 'normal' },
      }
    }
  }
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
