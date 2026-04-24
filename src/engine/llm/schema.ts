import type {
  GroupTag,
  AnimationTemplateId,
  EasingKey,
  AnimationBinding,
  AnimationCategory,
} from '@/engine/scene/types'
import { templatesFor } from '@/engine/animations/templates'

/** Structured output the LLM returns via tool-use. */
export type GrouperOutput = {
  groups: Array<{
    label: string
    semanticTag: GroupTag
    elementIds: string[]
    animation: AnimationBinding
    rationale: string
  }>
  sceneRationale?: string
}

export const GROUP_TAGS: GroupTag[] = [
  'icon',
  'illustration',
  'text',
  'list-item',
  'button',
  'card',
  'background',
  'decoration',
  'unknown',
]

export const ANIMATION_TEMPLATES: AnimationTemplateId[] = [
  // Entrance
  'fade-in',
  'slide-up',
  'slide-down',
  'slide-left',
  'slide-right',
  'scale-in',
  'pop-in',
  'draw-stroke',
  'stagger-children',
  // Ambient (v1.1)
  'breathe',
  'float',
  'drift',
  'shimmer',
  // Rigged (v1.2)
  'walk-cycle',
  'wave',
  'idle-sway',
  'none',
]

export const EASINGS: EasingKey[] = [
  'linear',
  'easeIn',
  'easeOut',
  'easeInOut',
  'spring-gentle',
  'spring-bouncy',
  'spring-stiff',
]

/**
 * Build the JSON schema for the `propose_groups` tool, narrowed to the
 * template IDs valid for the given category. Narrowing the enum means the
 * LLM can't accidentally propose a template from another category — the
 * Anthropic tool-use validator rejects it before it reaches our code.
 */
export function proposeGroupsToolFor(category: AnimationCategory) {
  return {
    name: 'propose_groups',
    description:
      'Return semantic groupings of the SVG with a proposed animation for each group.',
    input_schema: {
      type: 'object',
      properties: {
        groups: {
          type: 'array',
          minItems: 1,
          maxItems: 8,
          items: {
            type: 'object',
            properties: {
              label: {
                type: 'string',
                description: 'Human-readable name, 1-3 words.',
              },
              semanticTag: { type: 'string', enum: GROUP_TAGS },
              elementIds: {
                type: 'array',
                minItems: 1,
                items: { type: 'string' },
                description:
                  'IDs drawn from the provided structural index. Every ID must exist in the index.',
              },
              animation: {
                type: 'object',
                properties: {
                  template: { type: 'string', enum: templatesFor(category) },
                  params: {
                    type: 'object',
                    properties: {
                      duration: { type: 'number', minimum: 100, maximum: 2000 },
                      delay: { type: 'number', minimum: 0, maximum: 1500 },
                      easing: { type: 'string', enum: EASINGS },
                      distance: { type: 'number', minimum: 8, maximum: 96 },
                      scaleFrom: { type: 'number', minimum: 0.5, maximum: 1 },
                      staggerMs: { type: 'number', minimum: 0, maximum: 200 },
                    },
                    required: ['duration', 'delay', 'easing'],
                  },
                  timing: {
                    type: 'object',
                    properties: {
                      start: { type: 'number', minimum: 0, maximum: 2500 },
                    },
                    required: ['start'],
                  },
                },
                required: ['template', 'params', 'timing'],
              },
              rationale: {
                type: 'string',
                description:
                  'One short sentence explaining the animation choice. Shown in the UI.',
              },
            },
            required: ['label', 'semanticTag', 'elementIds', 'animation', 'rationale'],
          },
        },
        sceneRationale: {
          type: 'string',
          description: 'Optional one-sentence framing of the scene as a whole.',
        },
      },
      required: ['groups'],
    },
  } as const
}
