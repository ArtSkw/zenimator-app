import Anthropic from '@anthropic-ai/sdk'
import type { StructuralIndex, AnimationCategory } from '@/engine/scene/types'
import { proposeGroupsToolFor, type GrouperOutput } from './schema'
import { systemPromptFor } from './prompts'
import { makeCacheKey, readCache, writeCache } from './cache'

export type GrouperInput = {
  svgRaw: string
  previewPngDataUrl: string
  index: StructuralIndex
  category: AnimationCategory
}

export type GrouperCallOptions = {
  apiKey: string
  model: string
  signal?: AbortSignal
  /** Bypass the localStorage cache for this call. */
  skipCache?: boolean
}

export type GrouperResult = {
  output: GrouperOutput
  fromCache: boolean
}

/**
 * Call Claude to propose semantic groupings + per-group animations for the
 * given category. Caching is category-scoped — the same SVG under Entrance
 * and Ambient produces two independent cache entries.
 */
export async function groupAndPropose(
  input: GrouperInput,
  opts: GrouperCallOptions,
): Promise<GrouperResult> {
  const cacheKey = await makeCacheKey({
    svg: input.svgRaw,
    model: opts.model,
    category: input.category,
  })

  if (!opts.skipCache) {
    const cached = readCache(cacheKey)
    if (cached) return { output: cached, fromCache: true }
  }

  const client = new Anthropic({
    apiKey: opts.apiKey,
    dangerouslyAllowBrowser: true,
  })

  const { mediaType, base64 } = splitDataUrl(input.previewPngDataUrl)
  const indexForLlm = slimIndex(input.index)
  const tool = proposeGroupsToolFor(input.category)
  const systemPrompt = systemPromptFor(input.category)

  const response = await client.messages.create(
    {
      model: opts.model,
      max_tokens: 4096,
      system: systemPrompt,
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
                `Structural index (JSON):\n${JSON.stringify(indexForLlm, null, 2)}\n\n` +
                `Return 3–7 semantic groups via the propose_groups tool.`,
            },
          ],
        },
      ],
    },
    { signal: opts.signal },
  )

  const toolBlock = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
  if (!toolBlock) throw new Error('LLM did not return a tool_use response')

  const output = toolBlock.input as GrouperOutput
  if (!output?.groups?.length) throw new Error('LLM returned an empty grouping')

  for (const g of output.groups) {
    if (!Array.isArray(g.elementIds) || g.elementIds.length === 0) {
      throw new Error(`Group "${g.label}" has no element IDs`)
    }
  }

  writeCache(cacheKey, output)
  return { output, fromCache: false }
}

/**
 * Lightweight connectivity check. Sends a one-token messages call.
 * Used by the Settings drawer "Test connection" button.
 */
export async function testApiKey(apiKey: string, model: string): Promise<void> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  await client.messages.create({
    model,
    max_tokens: 1,
    messages: [{ role: 'user', content: 'ok' }],
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function splitDataUrl(dataUrl: string): { mediaType: string; base64: string } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl)
  if (!match) throw new Error('Rasterizer did not return a base64 data URL')
  return { mediaType: match[1], base64: match[2] }
}

function slimIndex(index: StructuralIndex) {
  return {
    viewport: index.viewport,
    elements: index.elements.map((el) => ({
      id: el.id,
      tag: el.tag,
      bounds: {
        x: Math.round(el.bounds.x),
        y: Math.round(el.bounds.y),
        width: Math.round(el.bounds.width),
        height: Math.round(el.bounds.height),
      },
      ...(el.fill ? { fill: el.fill } : {}),
      ...(el.stroke ? { stroke: el.stroke } : {}),
      parentId: el.parentId,
    })),
  }
}
