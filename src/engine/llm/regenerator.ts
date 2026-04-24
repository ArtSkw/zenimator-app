import Anthropic from '@anthropic-ai/sdk'
import type {
  AnimationBinding,
  AnimationCategory,
  AnimatableGroup,
} from '@/engine/scene/types'
import { EASINGS } from './schema'
import { templatesFor } from '@/engine/animations/templates'
import { systemPromptFor } from './prompts'

/** Input for a focused single-group regeneration call. */
export type RegenerateInput = {
  previewPngDataUrl: string
  category: AnimationCategory
  targetGroup: AnimatableGroup
}

export type RegenerateOptions = {
  apiKey: string
  model: string
  signal?: AbortSignal
}

export type RegenerateResult = {
  animation: AnimationBinding
  rationale: string
}

/**
 * Ask Claude for an ALTERNATIVE animation for one specific group. The rest
 * of the scene isn't touched. Much cheaper and faster than re-running the
 * full grouping.
 */
export async function regenerateGroupAnimation(
  input: RegenerateInput,
  opts: RegenerateOptions,
): Promise<RegenerateResult> {
  const client = new Anthropic({
    apiKey: opts.apiKey,
    dangerouslyAllowBrowser: true,
  })

  const { mediaType, base64 } = splitDataUrl(input.previewPngDataUrl)
  const tool = buildTool(input.category)
  const preamble = systemPromptFor(input.category)

  const current = input.targetGroup.animation
  const currentSummary = current
    ? `${current.template} (duration ${current.params.duration}ms, ${current.params.easing})`
    : 'none'

  const response = await client.messages.create(
    {
      model: opts.model,
      max_tokens: 1024,
      system: preamble,
      tools: [tool as unknown as Anthropic.Tool],
      tool_choice: { type: 'tool', name: tool.name },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
                data: base64,
              },
            },
            {
              type: 'text',
              text:
                `Category: ${input.category}\n\n` +
                `The user wants a DIFFERENT animation for one group. Propose an alternative.\n\n` +
                `Target group:\n` +
                `  label: "${input.targetGroup.label}"\n` +
                `  tag: ${input.targetGroup.tag}\n` +
                `  current: ${currentSummary}\n\n` +
                `Consider a different template or noticeably different params. ` +
                `Return the alternative via the propose_alternative_animation tool.`,
            },
          ],
        },
      ],
    },
    { signal: opts.signal },
  )

  const block = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
  )
  if (!block) throw new Error('LLM did not return a tool_use response')

  const out = block.input as RegenerateResult
  if (!out?.animation?.template) throw new Error('LLM returned malformed animation')
  return out
}

function buildTool(category: AnimationCategory) {
  return {
    name: 'propose_alternative_animation',
    description: 'Return one alternative animation for the specified group.',
    input_schema: {
      type: 'object',
      properties: {
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
        rationale: { type: 'string' },
      },
      required: ['animation', 'rationale'],
    },
  } as const
}

function splitDataUrl(dataUrl: string): { mediaType: string; base64: string } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl)
  if (!match) throw new Error('Rasterizer did not return a base64 data URL')
  return { mediaType: match[1], base64: match[2] }
}

