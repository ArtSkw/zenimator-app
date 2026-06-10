import Anthropic from '@anthropic-ai/sdk'
import { LOTTIE_SYSTEM_PROMPT } from './prompts/lottie'
import { REFINE_LOTTIE_INSTRUCTION } from './prompts/refine'
import { generateGroundedLottie } from './generateGroundedLottie'
import { renderLottieFrames, pickFrames } from '@/engine/lottie/render'
import type { GenerateProject } from '@/engine/lottie/project'

/** A generation result: the Lottie JSON, plus the editable project when the
 *  grounded path produced one (pure-prompt results aren't layer-editable). */
export type GenerateResult = { lottieJson: string; project: GenerateProject | null }

/** The three property axes that configure a generation. */
export type GenConfig = {
  subject: 'illustration' | 'screen'
  kind: 'entry' | 'loop'
  method: 'manual' | 'auto'
}

export type GenerateLottieInput = {
  /** The user's short intent prompt (empty for method: 'auto'). */
  prompt: string
  /** Optional reference SVG to ground the generation. */
  grounding?: { svgText: string; pngDataUrl: string }
  config: GenConfig
}

export type GenerateLottieOptions = {
  apiKey: string
  model: string
  signal?: AbortSignal
  /** Progress callback for the multi-stage pipeline. */
  onStage?: (stage: string) => void
}

// A permissive tool: forcing tool_use guarantees a clean JSON object back
// (no markdown fences to strip). The Lottie shape is too free-form for a strict
// schema, so `lottie` is just an object the model fills.
const RENDER_TOOL = {
  name: 'render_lottie',
  description: 'Return the complete, renderable Lottie (Bodymovin) animation document.',
  input_schema: {
    type: 'object' as const,
    properties: {
      lottie: { type: 'object' as const, description: 'The complete Lottie document.' },
    },
    required: ['lottie'],
  },
}

/**
 * Generate a Lottie animation from a text prompt (optionally grounded by a
 * reference SVG). Two passes: draw, then render real frames and let the model
 * critique and correct. Returns the validated document as a JSON string.
 */
export async function generateLottie(
  input: GenerateLottieInput,
  opts: GenerateLottieOptions,
): Promise<GenerateResult> {
  // Grounded by an SVG → faithful geometry + LLM motion plan (the model never
  // redraws the artwork). Pure-prompt ideas fall through to shape authoring.
  if (input.grounding) {
    return generateGroundedLottie(input.grounding.svgText, input.prompt, input.config, opts)
  }

  opts.onStage?.('Generating…')
  const kindHint = input.config.kind === 'loop' ? ' Make it a seamless loop.' : ' Make it an entrance that plays once and holds.'
  const v1 = await drawLottie(input.prompt + kindHint, opts)

  // Refine: render frames of v1, let the model correct what it can see.
  // Resilient — any failure falls back to the first pass. Pure-prompt results
  // have no editable project (the shapes are free-form, not faithful geometry).
  try {
    opts.onStage?.('Refining…')
    const op = readOp(v1)
    const frames = await renderLottieFrames(v1, pickFrames(op), 320)
    return { lottieJson: await refineLottie(input.prompt, v1, frames, opts), project: null }
  } catch {
    return { lottieJson: v1, project: null }
  }
}

/** First pass: author a Lottie from shapes. */
async function drawLottie(prompt: string, opts: GenerateLottieOptions): Promise<string> {
  const client = new Anthropic({ apiKey: opts.apiKey, dangerouslyAllowBrowser: true })
  const response = await client.messages.create(
    {
      model: opts.model,
      max_tokens: 16384,
      system: LOTTIE_SYSTEM_PROMPT,
      tools: [RENDER_TOOL as unknown as Anthropic.Tool],
      tool_choice: { type: 'tool', name: RENDER_TOOL.name },
      messages: [{ role: 'user', content: `Animation request:\n${prompt}` }],
    },
    { signal: opts.signal },
  )
  return extractLottie(response)
}

/** Second pass: show the model real frames and have it return a corrected doc. */
async function refineLottie(
  prompt: string,
  currentJson: string,
  frames: string[],
  opts: GenerateLottieOptions,
): Promise<string> {
  const client = new Anthropic({ apiKey: opts.apiKey, dangerouslyAllowBrowser: true })
  const content: Anthropic.ContentBlockParam[] = [
    {
      type: 'text',
      text:
        `Your current animation JSON:\n${currentJson}\n\n` +
        `User request:\n${prompt}\n\n${REFINE_LOTTIE_INSTRUCTION}\n\n` +
        `Rendered frames of the current result follow, in order across the loop:`,
    },
    ...frames.map((f) => imageBlock(f)),
  ]
  const response = await client.messages.create(
    {
      model: opts.model,
      max_tokens: 16384,
      system: LOTTIE_SYSTEM_PROMPT,
      tools: [RENDER_TOOL as unknown as Anthropic.Tool],
      tool_choice: { type: 'tool', name: RENDER_TOOL.name },
      messages: [{ role: 'user', content }],
    },
    { signal: opts.signal },
  )
  return extractLottie(response)
}

function extractLottie(response: Anthropic.Message): string {
  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
  )
  if (!toolBlock) throw new Error('The model did not return a Lottie animation.')
  const doc = (toolBlock.input as { lottie?: unknown }).lottie
  return JSON.stringify(validateLottie(doc))
}

function readOp(json: string): number {
  try {
    const op = (JSON.parse(json) as { op?: number }).op
    return typeof op === 'number' && op > 0 ? op : 180
  } catch {
    return 180
  }
}

function imageBlock(dataUrl: string): Anthropic.ContentBlockParam {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl)
  if (!m) throw new Error('Invalid frame data URL')
  return {
    type: 'image',
    source: {
      type: 'base64',
      media_type: m[1] as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif',
      data: m[2],
    },
  }
}

/**
 * Light structural validation + autofix of top-level fields. Deep shape
 * correctness is the system prompt's job (and the Phase 2 refine loop's); here
 * we just guarantee the player won't choke on missing required fields.
 */
function validateLottie(d: unknown): Record<string, unknown> {
  if (!d || typeof d !== 'object') throw new Error('The model did not return a Lottie object.')
  const doc = d as Record<string, unknown>

  if (typeof doc.v !== 'string') doc.v = '5.7.0'
  if (typeof doc.ip !== 'number') doc.ip = 0
  if (typeof doc.fr !== 'number' || (doc.fr as number) <= 0) doc.fr = 60
  if (typeof doc.w !== 'number' || (doc.w as number) <= 0) doc.w = 512
  if (typeof doc.h !== 'number' || (doc.h as number) <= 0) doc.h = 512
  if (typeof doc.op !== 'number' || (doc.op as number) <= 0) doc.op = (doc.fr as number) * 3
  if (!Array.isArray(doc.assets)) doc.assets = []
  if (!Array.isArray(doc.layers) || (doc.layers as unknown[]).length === 0) {
    throw new Error('The generated animation has no layers.')
  }
  return doc
}
