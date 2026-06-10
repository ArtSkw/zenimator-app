import Anthropic from '@anthropic-ai/sdk'
import type { StructuralIndex } from '@/engine/scene/types'
import type { GenConfig } from './generateLottie'
import { detectSvg } from '@/engine/detector/detectSvg'
import { sanitizeSvg } from '@/engine/detector/sanitizeSvg'
import { rasterizeSvg } from '@/engine/detector/rasterize'
import { MOTION_PLAN_PROMPT } from './prompts/motionPlan'
import { REFINE_MOTION_PROMPT } from './prompts/refine'
import { renderLottieFrames, pickFrames } from '@/engine/lottie/render'
import { rasterizeLayers, type LayerDef, type EasingKey } from '@/engine/lottie/core'
import {
  assembleProject,
  clampInt,
  clampNum,
  EASINGS,
  type GenerateProject,
  type ProjectLayer,
  type LayerTracks,
} from '@/engine/lottie/project'

// ── Motion plan shape (mirrors the plan_motion tool schema) ─────────────────
// Each layer authors KEYFRAMES directly, one list per animatable property.
// There is no preset vocabulary — the model places keyframes freely.

type ScalarKey = { t: number; v: number; easing?: string }
type PosKey = { t: number; x: number; y: number; easing?: string }
type PlanLayer = {
  name: string
  elementIds: string[]
  opacity?: ScalarKey[]
  position?: PosKey[]
  scale?: ScalarKey[]
  rotation?: ScalarKey[]
}
type MotionPlan = { fps?: number; totalFrames?: number; layers: PlanLayer[] }

const EASE_ENUM = [...EASINGS]

const SCALAR_KEYS = (desc: string) => ({
  type: 'array' as const,
  description: desc,
  items: {
    type: 'object' as const,
    properties: {
      t: { type: 'number' as const, description: 'Frame (0..totalFrames).' },
      v: { type: 'number' as const },
      easing: { type: 'string' as const, enum: EASE_ENUM, description: 'Curve INTO the next keyframe.' },
    },
    required: ['t', 'v'],
  },
})

const PLAN_TOOL = {
  name: 'plan_motion',
  description:
    "Group the illustration's elements into layers and animate each by placing KEYFRAMES on its property tracks (opacity, position, scale, rotation). Do NOT draw or redraw shapes.",
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
            opacity: SCALAR_KEYS('Opacity keyframes; v is percent 0–100 (rest 100).'),
            scale: SCALAR_KEYS('Scale keyframes; v is percent, uniform (rest 100, e.g. 60 = 60%).'),
            rotation: SCALAR_KEYS('Rotation keyframes; v is degrees (rest 0; 360 = one full turn).'),
            position: {
              type: 'array' as const,
              description: 'Position keyframes; x/y are an OFFSET in px from the layer\'s rest centre (rest 0,0).',
              items: {
                type: 'object' as const,
                properties: {
                  t: { type: 'number' as const, description: 'Frame (0..totalFrames).' },
                  x: { type: 'number' as const },
                  y: { type: 'number' as const },
                  easing: { type: 'string' as const, enum: EASE_ENUM, description: 'Curve INTO the next keyframe.' },
                },
                required: ['t', 'x', 'y'],
              },
            },
          },
          required: ['name', 'elementIds'],
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
  onStage?: (stage: string) => void
}

export type GroundedResult = { lottieJson: string; project: GenerateProject }

/**
 * Grounded hybrid: render the real SVG faithfully, let the LLM only choreograph
 * by authoring keyframes. Two passes — plan, then render real frames and let the
 * model critique and adjust. Returns the Lottie JSON + the editable project.
 */
export async function generateGroundedLottie(
  svgText: string,
  prompt: string,
  config: GenConfig,
  opts: GenerateOptions,
): Promise<GroundedResult> {
  const index = detectSvg(sanitizeSvg(svgText))
  opts.onStage?.('Analyzing artwork…')
  const previewPng = await rasterizeSvg(index.enrichedSvg)

  opts.onStage?.('Planning motion…')
  const plan = await planMotion(index, previewPng, prompt, config, opts)

  opts.onStage?.('Rendering layers…')
  const project = await prepareLayers(index, plan)
  const v1 = assembleProject(project)

  try {
    opts.onStage?.('Refining motion…')
    const frames = await renderLottieFrames(JSON.stringify(v1), pickFrames(project.op), 320)
    const refined = await refineMotionPlan(project, prompt, frames, opts)
    applyRefined(project, refined)
    return { lottieJson: JSON.stringify(assembleProject(project)), project }
  } catch {
    return { lottieJson: JSON.stringify(v1), project }
  }
}

// ── Step 1: ask the model for a motion plan ──────────────────────────────────

async function planMotion(
  index: StructuralIndex,
  previewPng: string,
  prompt: string,
  config: GenConfig,
  opts: GenerateOptions,
): Promise<MotionPlan> {
  const client = new Anthropic({ apiKey: opts.apiKey, dangerouslyAllowBrowser: true })
  const { mediaType, base64 } = splitDataUrl(previewPng)

  const request =
    config.method === 'auto'
      ? 'No specific instruction is given — propose a tasteful animation that fits.'
      : `User request:\n${prompt}`

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
        `${guidanceFor(config)}\n\n` +
        `Elements (JSON):\n${JSON.stringify(slimIndex(index), null, 2)}\n\n` +
        request,
    },
  ]

  const response = await client.messages.create(
    {
      model: opts.model,
      max_tokens: 8192,
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

// ── Step 2: render faithful layers (once) → editable project ─────────────────

const hasMotion = (l: PlanLayer): boolean =>
  !!(l.opacity?.length || l.position?.length || l.scale?.length || l.rotation?.length)

async function prepareLayers(index: StructuralIndex, plan: MotionPlan): Promise<GenerateProject> {
  const { width: W, height: H } = index.viewport
  const fps = clampInt(plan.fps, 12, 120, 60)
  const op = clampInt(plan.totalFrames, 30, 1800, fps * 4)
  const S = dpiScale(W, H)

  const boundsById = new Map(index.elements.map((e) => [e.id, e.bounds]))
  const byId = new Map(index.elements.map((e) => [e.id, e]))

  const planLayers = plan.layers.filter(
    (l) => Array.isArray(l.elementIds) && l.elementIds.some((id) => byId.has(id)),
  )
  if (planLayers.length === 0) throw new Error('The motion plan referenced no known elements.')

  // Every visual element belongs to exactly ONE layer — animated layers (those
  // with motion) claim their elements first; static layers take the rest.
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
  assign(hasMotion)
  assign((l) => !hasMotion(l))

  const defs: LayerDef[] = []
  const fx: LayerTracks[] = []
  planLayers.forEach((l, li) => {
    const owned = leaves.filter((lf) => owner.get(lf.id) === li).map((lf) => lf.id)
    if (owned.length === 0) return
    defs.push({ name: l.name || 'layer', elementIds: owned })
    fx.push(planToTracks(l, op))
  })
  const uncovered = leaves.filter((lf) => !owner.has(lf.id)).map((lf) => lf.id)
  if (uncovered.length) {
    defs.push({ name: '(static)', elementIds: uncovered })
    fx.push({})
  }

  const rasters = await rasterizeLayers(index.enrichedSvg, index.viewport, defs, S)

  const layers: ProjectLayer[] = rasters
    .map((r) => {
      const elementIds = defs[r.defIndex].elementIds
      const b = unionBox(elementIds, boundsById, W, H)
      return {
        layer: {
          name: r.name, elementIds, dataUrl: r.dataUrl,
          cx: b.cx * S, cy: b.cy * S,
          bounds: { x: b.x * S, y: b.y * S, w: b.w * S, h: b.h * S },
          tracks: fx[r.defIndex],
        } satisfies ProjectLayer,
        docIndex: r.docIndex,
      }
    })
    .sort((a, b) => b.docIndex - a.docIndex)
    .map((e) => e.layer)

  return { fps, op, scale: S, w: W * S, h: H * S, layers }
}

function dpiScale(W: number, H: number): number {
  return Math.min(4, Math.max(1, Math.round(1024 / Math.max(W, H))))
}

/** Convert a plan layer's raw keyframe lists into clamped, validated tracks. */
function planToTracks(l: PlanLayer, op: number): LayerTracks {
  const t: LayerTracks = {}
  const ease = (e?: string): EasingKey | undefined =>
    e && (EASINGS as string[]).includes(e) ? (e as EasingKey) : undefined

  const scalar = (arr: ScalarKey[] | undefined, min: number, max: number, fb: number) =>
    arr?.length
      ? { keys: arr.map((k) => ({ t: clampInt(k.t, 0, op, 0), v: clampNum(k.v, min, max, fb), easing: ease(k.easing) })) }
      : undefined

  const o = scalar(l.opacity, 0, 100, 100)
  if (o) t.opacity = o
  const s = scalar(l.scale, 0, 400, 100)
  if (s) t.scale = s
  const r = scalar(l.rotation, -3600, 3600, 0)
  if (r) t.rotation = r
  if (l.position?.length) {
    t.position = {
      keys: l.position.map((k) => ({
        t: clampInt(k.t, 0, op, 0),
        v: [clampNum(k.x, -2000, 2000, 0), clampNum(k.y, -2000, 2000, 0)] as [number, number],
        easing: ease(k.easing),
      })),
    }
  }
  return t
}

// ── Step 3: refine — show the model real frames, adjust the keyframes ────────

async function refineMotionPlan(
  project: GenerateProject,
  prompt: string,
  frames: string[],
  opts: GenerateOptions,
): Promise<Map<string, LayerTracks>> {
  const client = new Anthropic({ apiKey: opts.apiKey, dangerouslyAllowBrowser: true })

  const planSummary = project.layers.map((l) => ({ name: l.name, tracks: tracksToPlan(l.tracks) }))
  const content: Anthropic.ContentBlockParam[] = [
    {
      type: 'text',
      text:
        `Current plan (layers and their keyframe tracks):\n${JSON.stringify(planSummary, null, 2)}\n\n` +
        `User request:\n${prompt}\n\n` +
        `Rendered frames of the current result follow, in order across the loop:`,
    },
    ...frames.map((f) => imageBlock(f)),
  ]

  const response = await client.messages.create(
    {
      model: opts.model,
      max_tokens: 8192,
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
  const byName = new Map<string, LayerTracks>()
  for (const l of plan.layers ?? []) if (l?.name) byName.set(l.name, planToTracks(l, project.op))
  return byName
}

function applyRefined(project: GenerateProject, refined: Map<string, LayerTracks>): void {
  for (const layer of project.layers) {
    const r = refined.get(layer.name)
    if (r) layer.tracks = r
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Tracks → the plan tool's flat keyframe shape (for the refine prompt). */
function tracksToPlan(tracks: LayerTracks): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const scalar = (key: 'opacity' | 'scale' | 'rotation') => {
    const keys = tracks[key]?.keys
    if (keys?.length) out[key] = keys.map((k) => ({ t: k.t, v: Array.isArray(k.v) ? k.v[0] : k.v, easing: k.easing }))
  }
  scalar('opacity'); scalar('scale'); scalar('rotation')
  const pos = tracks.position?.keys
  if (pos?.length) {
    out.position = pos.map((k) => {
      const [x, y] = Array.isArray(k.v) ? k.v : [k.v, 0]
      return { t: k.t, x, y, easing: k.easing }
    })
  }
  return out
}

/** Union bounding box (user space) of a layer's elements, plus its centre.
 *  Falls back to the full viewport when no element has finite bounds. */
function unionBox(
  ids: string[],
  boundsById: Map<string, { x: number; y: number; width: number; height: number }>,
  W: number,
  H: number,
): { x: number; y: number; w: number; h: number; cx: number; cy: number } {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const id of ids) {
    const b = boundsById.get(id)
    if (!b || (b.width <= 0 && b.height <= 0)) continue
    x0 = Math.min(x0, b.x)
    y0 = Math.min(y0, b.y)
    x1 = Math.max(x1, b.x + b.width)
    y1 = Math.max(y1, b.y + b.height)
  }
  if (!Number.isFinite(x0)) return { x: 0, y: 0, w: W, h: H, cx: W / 2, cy: H / 2 }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }
}

function guidanceFor(config: GenConfig): string {
  const subject =
    config.subject === 'screen'
      ? 'This is a whole app/screen UI. Treat each major section (header, cards, list items, buttons) as a layer and reveal them with a tasteful stagger.'
      : 'This is a single illustration. Animate its parts expressively but tastefully.'
  const kind =
    config.kind === 'loop'
      ? 'Make a LOOPING animation: every track must return to its starting value at totalFrames so the loop is seamless (first and last keyframe equal). Prefer continuous motion. Pick totalFrames around 120–240.'
      : 'Make an ENTRY animation: elements animate in once and settle, then hold. Keyframes finish well before totalFrames and stay put. Pick a short totalFrames (~60–120).'
  return `${subject}\n${kind}`
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

function splitDataUrl(dataUrl: string): { mediaType: string; base64: string } {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl)
  if (!m) throw new Error('Invalid preview image data URL')
  return { mediaType: m[1], base64: m[2] }
}
