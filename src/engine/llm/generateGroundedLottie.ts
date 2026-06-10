import Anthropic from '@anthropic-ai/sdk'
import type { StructuralIndex } from '@/engine/scene/types'
import { detectSvg } from '@/engine/detector/detectSvg'
import { sanitizeSvg } from '@/engine/detector/sanitizeSvg'
import { rasterizeSvg } from '@/engine/detector/rasterize'
import { MOTION_PLAN_PROMPT } from './prompts/motionPlan'
import { REFINE_MOTION_PROMPT } from './prompts/refine'
import { renderLottieFrames, pickFrames } from '@/engine/lottie/render'
import {
  rasterizeLayers,
  animed2,
  animed3,
  staticNum,
  staticVec,
  EASING_BEZIER,
  type EasingKey,
  type Transform,
  type LayerDef,
  type LottieDoc,
  type ImageAsset,
  type ImageLayer,
} from '@/engine/lottie/core'

// ── Motion plan shape (mirrors the plan_motion tool schema) ─────────────────

const MOTION_TYPES = [
  'rise', 'fall', 'slide-left', 'slide-right', 'fade', 'scale-in', 'pop',
  'float', 'drift', 'pulse', 'rotate', 'shimmer', 'none',
] as const
type MotionType = (typeof MOTION_TYPES)[number]

type PlanLayer = {
  name: string
  elementIds: string[]
  type: MotionType
  amplitude?: number
  distance?: number
  scaleFrom?: number
  direction?: 'cw' | 'ccw'
  driftAxis?: 'x' | 'y'
  easing?: EasingKey
  startFrame?: number
  durationFrames?: number
}
type MotionPlan = { fps?: number; totalFrames?: number; layers: PlanLayer[] }

const PLAN_TOOL = {
  name: 'plan_motion',
  description:
    'Group the illustration\'s elements into animated layers and assign each a motion. Do NOT draw or redraw shapes.',
  input_schema: {
    type: 'object' as const,
    properties: {
      fps: { type: 'number' as const },
      totalFrames: { type: 'number' as const, description: 'Composition length in frames; it loops.' },
      layers: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            name: { type: 'string' as const },
            elementIds: {
              type: 'array' as const,
              items: { type: 'string' as const },
              description: 'IDs of the SVG elements that form this layer.',
            },
            type: { type: 'string' as const, enum: [...MOTION_TYPES] },
            amplitude: { type: 'number' as const },
            distance: { type: 'number' as const },
            scaleFrom: { type: 'number' as const },
            direction: { type: 'string' as const, enum: ['cw', 'ccw'] },
            driftAxis: { type: 'string' as const, enum: ['x', 'y'] },
            easing: {
              type: 'string' as const,
              enum: ['linear', 'easeIn', 'easeOut', 'easeInOut', 'spring-gentle', 'spring-bouncy', 'spring-stiff'],
            },
            startFrame: { type: 'number' as const },
            durationFrames: { type: 'number' as const },
          },
          required: ['name', 'elementIds', 'type'],
        },
      },
    },
    required: ['layers'],
  },
}

export type GenerateOptions = {
  apiKey: string
  model: string
  signal?: AbortSignal
  /** Progress callback for the multi-stage pipeline. */
  onStage?: (stage: string) => void
}

/**
 * Grounded hybrid: render the real SVG faithfully, let the LLM only choreograph.
 * Two passes — plan, then render real frames and let the model critique and
 * adjust the motion (geometry stays fixed, so the refine only re-applies new
 * motion to the already-rasterized layers). Returns a Lottie JSON string.
 */
export async function generateGroundedLottie(
  svgText: string,
  prompt: string,
  opts: GenerateOptions,
): Promise<string> {
  const index = detectSvg(sanitizeSvg(svgText))
  opts.onStage?.('Analyzing artwork…')
  const previewPng = await rasterizeSvg(index.enrichedSvg)

  opts.onStage?.('Planning motion…')
  const plan = await planMotion(index, previewPng, prompt, opts)

  opts.onStage?.('Rendering layers…')
  const prepared = await prepareLayers(index, plan)
  const v1 = assemble(prepared)

  // Refine: render frames of v1, let the model adjust the per-layer motion.
  // Resilient — any failure falls back to the (already good) first pass.
  try {
    opts.onStage?.('Refining motion…')
    const frames = await renderLottieFrames(JSON.stringify(v1), pickFrames(prepared.op), 320)
    const refined = await refineMotionPlan(prepared, prompt, frames, opts)
    applyRefinedMotions(prepared, refined)
    return JSON.stringify(assemble(prepared))
  } catch {
    return JSON.stringify(v1)
  }
}

// ── Step 1: ask the model for a motion plan ──────────────────────────────────

async function planMotion(
  index: StructuralIndex,
  previewPng: string,
  prompt: string,
  opts: GenerateOptions,
): Promise<MotionPlan> {
  const client = new Anthropic({ apiKey: opts.apiKey, dangerouslyAllowBrowser: true })
  const { mediaType, base64 } = splitDataUrl(previewPng)

  const content: Anthropic.ContentBlockParam[] = [
    {
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif',
        data: base64,
      },
    },
    {
      type: 'text',
      text:
        `Elements (JSON):\n${JSON.stringify(slimIndex(index), null, 2)}\n\n` +
        `Animation request:\n${prompt}`,
    },
  ]

  const response = await client.messages.create(
    {
      model: opts.model,
      max_tokens: 4096,
      system: MOTION_PLAN_PROMPT,
      tools: [PLAN_TOOL as unknown as Anthropic.Tool],
      tool_choice: { type: 'tool', name: PLAN_TOOL.name },
      messages: [{ role: 'user', content }],
    },
    { signal: opts.signal },
  )

  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
  )
  if (!toolBlock) throw new Error('The model did not return a motion plan.')
  const plan = toolBlock.input as MotionPlan
  if (!plan?.layers?.length) throw new Error('The motion plan had no layers.')
  return plan
}

// ── Step 2: render faithful layers (once) + apply the plan ───────────────────

/** A faithful, already-rasterized layer + its assigned motion. Geometry here is
 *  fixed; the refine pass only swaps `motion` and re-assembles. */
type PreparedLayer = {
  name: string
  elementIds: string[]
  dataUrl: string
  cx: number
  cy: number
  motion: PlanLayer
}
type Prepared = { fps: number; op: number; S: number; Wc: number; Hc: number; layers: PreparedLayer[] }

async function prepareLayers(index: StructuralIndex, plan: MotionPlan): Promise<Prepared> {
  const { width: W, height: H } = index.viewport
  const fps = clampInt(plan.fps, 12, 120, 60)
  const op = clampInt(plan.totalFrames, 30, 1800, fps * 4)
  // Supersample so raster layers stay crisp when scaled onto a retina canvas.
  const S = dpiScale(W, H)

  const boundsById = new Map(index.elements.map((e) => [e.id, e.bounds]))
  const byId = new Map(index.elements.map((e) => [e.id, e]))

  const planLayers = plan.layers.filter(
    (l) => Array.isArray(l.elementIds) && l.elementIds.some((id) => byId.has(id)),
  )
  if (planLayers.length === 0) throw new Error('The motion plan referenced no known elements.')

  // Every visual element belongs to exactly ONE layer — otherwise the same
  // pixels render twice (a static copy + an animated copy = the "ghost"/dupe).
  // Animated layers claim their elements first; static layers take the rest.
  const VISUAL = new Set(['path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'line', 'use', 'text', 'image'])
  const leaves = index.elements.filter((e) => VISUAL.has(e.tag))
  const coversLeaf = (set: Set<string>, leafId: string): boolean => {
    let cur = byId.get(leafId)
    while (cur) {
      if (set.has(cur.id)) return true
      cur = cur.parentId ? byId.get(cur.parentId) : undefined
    }
    return false
  }
  const owner = new Map<string, number>()
  const assign = (pred: (l: PlanLayer) => boolean) =>
    planLayers.forEach((l, li) => {
      if (!pred(l)) return
      const set = new Set(l.elementIds)
      for (const leaf of leaves) {
        if (owner.has(leaf.id)) continue
        if (coversLeaf(set, leaf.id)) owner.set(leaf.id, li)
      }
    })
  assign((l) => l.type !== 'none') // animated layers win
  assign((l) => l.type === 'none') // then static layers

  const defs: LayerDef[] = []
  const motions: PlanLayer[] = []
  planLayers.forEach((l, li) => {
    const owned = leaves.filter((lf) => owner.get(lf.id) === li).map((lf) => lf.id)
    if (owned.length === 0) return
    defs.push({ name: l.name || 'layer', elementIds: owned })
    motions.push(l)
  })
  const uncovered = leaves.filter((lf) => !owner.has(lf.id)).map((lf) => lf.id)
  if (uncovered.length) {
    defs.push({ name: '(static)', elementIds: uncovered })
    motions.push({ name: '(static)', elementIds: uncovered, type: 'none' })
  }

  const rasters = await rasterizeLayers(index.enrichedSvg, index.viewport, defs, S)

  const layers: PreparedLayer[] = rasters
    .map((r) => {
      const elementIds = defs[r.defIndex].elementIds
      const c = unionCentre(elementIds, boundsById, W, H)
      return { layer: { name: r.name, elementIds, dataUrl: r.dataUrl, cx: c.cx * S, cy: c.cy * S, motion: motions[r.defIndex] }, docIndex: r.docIndex }
    })
    // Topmost-first: later in paint order → earlier in the layers array.
    .sort((a, b) => b.docIndex - a.docIndex)
    .map((e) => e.layer)

  return { fps, op, S, Wc: W * S, Hc: H * S, layers }
}

function assemble(prepared: Prepared): LottieDoc {
  const { fps, op, S, Wc, Hc, layers } = prepared
  const assets: ImageAsset[] = []
  const lottieLayers: ImageLayer[] = []
  layers.forEach((l, i) => {
    const id = `img_${i}`
    assets.push({ id, w: Wc, h: Hc, u: '', p: l.dataUrl, e: 1 })
    lottieLayers.push({
      ddd: 0, ind: i + 1, ty: 2, nm: l.name, refId: id,
      sr: 1, ks: buildTransform(l.motion, l.cx, l.cy, op, fps, S), ao: 0, ip: 0, op, st: 0, bm: 0,
    })
  })
  return { v: '5.7.0', fr: fps, ip: 0, op, w: Wc, h: Hc, assets, layers: lottieLayers }
}

/** Target ~1024px on the long side; clamp to 1–4×. */
function dpiScale(W: number, H: number): number {
  return Math.min(4, Math.max(1, Math.round(1024 / Math.max(W, H))))
}

// ── Step 3: refine — show the model real frames, adjust per-layer motion ─────

async function refineMotionPlan(
  prepared: Prepared,
  prompt: string,
  frames: string[],
  opts: GenerateOptions,
): Promise<Map<string, PlanLayer>> {
  const client = new Anthropic({ apiKey: opts.apiKey, dangerouslyAllowBrowser: true })

  const planSummary = prepared.layers.map((l) => ({ name: l.name, motion: l.motion }))
  const content: Anthropic.ContentBlockParam[] = [
    {
      type: 'text',
      text:
        `Current plan (layers and their motions):\n${JSON.stringify(planSummary, null, 2)}\n\n` +
        `User request:\n${prompt}\n\n` +
        `Rendered frames of the current result follow, in order across the loop:`,
    },
    ...frames.map((f) => imageBlock(f)),
  ]

  const response = await client.messages.create(
    {
      model: opts.model,
      max_tokens: 4096,
      system: REFINE_MOTION_PROMPT,
      tools: [PLAN_TOOL as unknown as Anthropic.Tool],
      tool_choice: { type: 'tool', name: PLAN_TOOL.name },
      messages: [{ role: 'user', content }],
    },
    { signal: opts.signal },
  )

  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
  )
  if (!toolBlock) throw new Error('The refine pass returned no plan.')
  const plan = toolBlock.input as MotionPlan
  const byName = new Map<string, PlanLayer>()
  for (const l of plan.layers ?? []) if (l?.name) byName.set(l.name, l)
  return byName
}

/** Re-apply refined motion to the prepared layers, keeping each layer's
 *  geometry (elementIds, raster, centre) untouched. */
function applyRefinedMotions(prepared: Prepared, refined: Map<string, PlanLayer>): void {
  for (const layer of prepared.layers) {
    const r = refined.get(layer.name)
    if (!r) continue
    layer.motion = {
      name: layer.name,
      elementIds: layer.elementIds,
      type: r.type ?? layer.motion.type,
      amplitude: r.amplitude,
      distance: r.distance,
      scaleFrom: r.scaleFrom,
      direction: r.direction,
      driftAxis: r.driftAxis,
      easing: r.easing,
      startFrame: r.startFrame,
      durationFrames: r.durationFrames,
    }
  }
}

function imageBlock(dataUrl: string): Anthropic.ContentBlockParam {
  const { mediaType, base64 } = splitDataUrl(dataUrl)
  return {
    type: 'image',
    source: {
      type: 'base64',
      media_type: mediaType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif',
      data: base64,
    },
  }
}

// ── Motion → Lottie transform ────────────────────────────────────────────────

function buildTransform(
  m: PlanLayer, cx: number, cy: number, total: number, fps: number, scale: number,
): Transform {
  const a = staticVec([cx, cy, 0])
  const baseP = [cx, cy, 0]
  const base: Transform = {
    o: staticNum(100), r: staticNum(0), p: staticVec(baseP), a, s: staticVec([100, 100, 100]),
  }

  const start = clampInt(m.startFrame, 0, total, 0)
  const dur = clampInt(m.durationFrames, 1, total, Math.max(1, Math.round(fps * 0.6)))
  const end = Math.min(total, start + dur)
  const eIn = EASING_BEZIER[pickEasing(m.easing, 'easeOut')]
  const eLoop = EASING_BEZIER[pickEasing(m.easing, 'easeInOut')]
  const half = Math.max(1, Math.round(total / 2))
  const fadeIn = animed2(start, end, [0], [100], eIn)
  // Pixel-based params are authored in viewport units → scale to comp space.
  const dist = clampNum(m.distance, 8, 140, 40) * scale

  switch (m.type) {
    case 'fade':
      return { ...base, o: fadeIn }
    case 'rise':
      return { ...base, o: fadeIn, p: animed2(start, end, [cx, cy + dist, 0], baseP, eIn) }
    case 'fall':
      return { ...base, o: fadeIn, p: animed2(start, end, [cx, cy - dist, 0], baseP, eIn) }
    case 'slide-left':
      return { ...base, o: fadeIn, p: animed2(start, end, [cx + dist, cy, 0], baseP, eIn) }
    case 'slide-right':
      return { ...base, o: fadeIn, p: animed2(start, end, [cx - dist, cy, 0], baseP, eIn) }
    case 'scale-in': {
      const sf = clampNum(m.scaleFrom, 0.3, 0.98, 0.85) * 100
      return { ...base, o: fadeIn, s: animed2(start, end, [sf, sf, 100], [100, 100, 100], eIn) }
    }
    case 'pop': {
      const sf = clampNum(m.scaleFrom, 0.3, 0.98, 0.6) * 100
      return { ...base, o: fadeIn, s: animed2(start, end, [sf, sf, 100], [100, 100, 100], EASING_BEZIER['spring-bouncy']) }
    }
    case 'float': {
      const amp = clampNum(m.amplitude, 2, 30, 8) * scale
      return { ...base, p: animed3(0, half, total, baseP, [cx, cy - amp, 0], baseP, eLoop) }
    }
    case 'drift': {
      const amp = clampNum(m.amplitude, 2, 30, 8) * scale
      const mid = m.driftAxis === 'y' ? [cx, cy + amp, 0] : [cx + amp, cy, 0]
      return { ...base, p: animed3(0, half, total, baseP, mid, baseP, eLoop) }
    }
    case 'pulse': {
      const amp = clampNum(m.amplitude, 0.01, 0.2, 0.04)
      const up = (1 + amp) * 100
      return { ...base, s: animed3(0, half, total, [100, 100, 100], [up, up, 100], [100, 100, 100], eLoop) }
    }
    case 'rotate': {
      const dir = m.direction === 'ccw' ? -1 : 1
      return { ...base, r: animed2(0, total, [0], [360 * dir], EASING_BEZIER.linear) }
    }
    case 'shimmer': {
      const amp = clampNum(m.amplitude, 0.05, 0.7, 0.3)
      return { ...base, o: animed3(0, half, total, [100], [100 * (1 - amp)], [100], eLoop) }
    }
    case 'none':
    default:
      return base
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function unionCentre(
  ids: string[],
  boundsById: Map<string, { x: number; y: number; width: number; height: number }>,
  W: number,
  H: number,
): { cx: number; cy: number } {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const id of ids) {
    const b = boundsById.get(id)
    if (!b || (b.width <= 0 && b.height <= 0)) continue
    x0 = Math.min(x0, b.x)
    y0 = Math.min(y0, b.y)
    x1 = Math.max(x1, b.x + b.width)
    y1 = Math.max(y1, b.y + b.height)
  }
  if (!Number.isFinite(x0)) return { cx: W / 2, cy: H / 2 }
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }
}

function pickEasing(key: EasingKey | undefined, fallback: EasingKey): EasingKey {
  return key && EASING_BEZIER[key] ? key : fallback
}

function clampNum(v: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof v !== 'number' || Number.isNaN(v)) return fallback
  return Math.min(max, Math.max(min, v))
}

function clampInt(v: number | undefined, min: number, max: number, fallback: number): number {
  return Math.round(clampNum(v, min, max, fallback))
}

function slimIndex(index: StructuralIndex) {
  return {
    viewport: index.viewport,
    elements: index.elements.map((e) => ({
      id: e.id,
      tag: e.tag,
      bounds: {
        x: Math.round(e.bounds.x),
        y: Math.round(e.bounds.y),
        width: Math.round(e.bounds.width),
        height: Math.round(e.bounds.height),
      },
      ...(e.fill ? { fill: e.fill } : {}),
      parentId: e.parentId,
    })),
  }
}

function splitDataUrl(dataUrl: string): { mediaType: string; base64: string } {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl)
  if (!m) throw new Error('Invalid preview image data URL')
  return { mediaType: m[1], base64: m[2] }
}
