import type { Scene, StructuralIndex, AnimationCategory } from '@/engine/scene/types'
import type { GrouperOutput } from '@/engine/llm/schema'
import { detectSvg } from '@/engine/detector/detectSvg'
import { sanitizeSvg } from '@/engine/detector/sanitizeSvg'
import { rasterizeSvg } from '@/engine/detector/rasterize'
import { groupAndPropose } from '@/engine/llm/grouper'
import { restructureSvg } from '@/engine/restructurer/injectWrappers'
import { proposeAnimations } from '@/engine/proposer/proposeAnimations'
import { heuristicGrouping } from '@/engine/proposer/heuristicFallback'
import { sortReadingOrder } from '@/engine/scene/bounds'
import { humanizeLlmError } from '@/engine/llm/errors'

export type BuildSceneOptions = {
  apiKey: string
  model: string
  useLlm: boolean
  category: AnimationCategory
  signal?: AbortSignal
  /** Optional stage callback for UI progress indicators. */
  onStage?: (stage: BuildSceneStage) => void
}

export type BuildSceneStage =
  | 'parsing'
  | 'rasterizing'
  | 'calling-llm'
  | 'restructuring'
  | 'done'

export type BuildSceneResult = {
  scene: Scene
  fromCache: boolean
  /** Set when the LLM call failed and heuristic grouping was used as fallback. */
  llmError: string | null
}

/**
 * Full pipeline: SVG text → Scene. Runs detector → rasterizer → LLM (or
 * heuristic fallback) → restructurer → proposer.
 */
export async function buildSceneFromSvg(
  svgText: string,
  opts: BuildSceneOptions,
): Promise<BuildSceneResult> {
  opts.onStage?.('parsing')
  const index = detectSvg(sanitizeSvg(svgText))

  let grouping: GrouperOutput
  let fromCache = false
  let llmError: string | null = null
  let groupingSource: Scene['groupingSource']

  const canUseLlm = opts.useLlm && opts.apiKey.trim().length > 0

  if (canUseLlm) {
    opts.onStage?.('rasterizing')
    const previewPng = await rasterizeSvg(index.enrichedSvg)

    opts.onStage?.('calling-llm')
    try {
      const result = await groupAndPropose(
        {
          svgRaw: index.enrichedSvg,
          previewPngDataUrl: previewPng,
          index,
          category: opts.category,
        },
        { apiKey: opts.apiKey, model: opts.model, signal: opts.signal },
      )
      grouping = result.output
      fromCache = result.fromCache
      groupingSource = 'llm'
    } catch (err) {
      console.warn('[zenimator] LLM grouping failed, using heuristic fallback:', err)
      grouping = heuristicGrouping(index)
      groupingSource = 'heuristic'
      llmError = humanizeLlmError(err)
    }
  } else {
    grouping = heuristicGrouping(index)
    groupingSource = 'heuristic'
  }

  opts.onStage?.('restructuring')
  const { restructuredSvg, groups } = restructureSvg(index, grouping)

  const scene: Scene = {
    id: crypto.randomUUID(),
    source: {
      kind: 'svg',
      raw: restructuredSvg,
      originalRaw: index.enrichedSvg,
    },
    viewport: index.viewport,
    groups: sortReadingOrder(groups),
    category: opts.category,
    groupingSource,
    sceneRationale: grouping.sceneRationale,
  }

  const proposed = proposeAnimations(scene)

  opts.onStage?.('done')
  return { scene: proposed, fromCache, llmError }
}

// Re-export for convenience so callers don't need to pull from internal paths.
export type { StructuralIndex }
