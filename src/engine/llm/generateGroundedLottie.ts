import Anthropic from '@anthropic-ai/sdk'
import type { StructuralIndex } from '@/engine/scene/types'
import type { GenConfig } from './generateLottie'
import { detectSvg } from '@/engine/detector/detectSvg'
import { sanitizeSvg, assertFullSvg } from '@/engine/detector/sanitizeSvg'
import { rasterizeSvg } from '@/engine/detector/rasterize'
import { MOTION_PLAN_PROMPT } from './prompts/motionPlan'
import { REFINE_MOTION_PROMPT, ASK_CHANGES_MOTION_PROMPT } from './prompts/refine'
import { renderLottieFrames, pickFrames } from '@/engine/lottie/render'
import { rasterizeLayers, type LayerDef, type EasingKey } from '@/engine/lottie/core'
import {
  assembleProject,
  loopSeamWarnings,
  clampInt,
  clampNum,
  EASINGS,
  TRACK_KEYS,
  type GenerateProject,
  type ProjectLayer,
  type LayerTracks,
  type VectorGeometry,
  type MorphKey,
  type TrackKey,
  type HandleMeta,
} from '@/engine/lottie/project'
import { elementToPath, strokeStyle, scalePath, type SubPath, type StrokeStyle } from '@/engine/lottie/vector'

// ── Motion plan shape (mirrors the plan_motion tool schema) ─────────────────
// Each layer authors KEYFRAMES directly, one list per animatable property.
// There is no preset vocabulary — the model places keyframes freely.

type ScalarKey = { t: number; v: number; easing?: string }
type PosKey = { t: number; x: number; y: number; easing?: string }
type ControlSpec = { track: string; label: string; hint?: string }
/** One control point for a morph keyframe, in SVG user-space px. */
type PlanMorphControl = { u: number; dx: number; dy: number }
/** One morph keyframe: displace the path at frame `t` using the given controls. */
type PlanMorphKey = { t: number; controls: PlanMorphControl[]; easing?: string }
type PlanLayer = {
  name: string
  elementIds: string[]
  opacity?: ScalarKey[]
  position?: PosKey[]
  scale?: ScalarKey[]
  /** Independent X-scale keyframes (percent, rest 100). Use for coin-flip / axis-spin effects. */
  scaleX?: ScalarKey[]
  rotation?: ScalarKey[]
  /** Trim-path end% keyframes (0=hidden → 100=fully drawn). Only valid on
   *  stroke-only vector layers. The model sets this for draw-on entry effects. */
  trim?: ScalarKey[]
  /** Explicit pivot point override in SVG user-space px. When absent the centroid is used. */
  pivot?: { x: number; y: number }
  /** Path deformation keyframes. Only valid on stroke-only vector layers. Each
   *  key displaces the path's vertices at frame `t` using a small set of control
   *  points (u=0..1 along the path, dx/dy offset in SVG user-space px). */
  morphKeys?: PlanMorphKey[]
  controls?: ControlSpec[]
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
            scaleX: SCALAR_KEYS("Independent X-scale keyframes (percent, rest 100). Use for coin-flip axis-spin: scale X through 0 (e.g. 100→0→100 or 100→-100→100). Compose with scale (Y); scale drives uniform; scaleX drives width only."),
            trim: SCALAR_KEYS('Trim-path end% keyframes (0=hidden, 100=fully drawn). ONLY for stroke-only vector layers with draw-on intent. Entry: keyframe from 0→100 eased; loop: omit.'),
            pivot: {
              type: 'object' as const,
              description: "Override the rotation/scale pivot for this layer in SVG user-space px. Omit to use the layer's bounding-box centroid. Use when the natural rotation centre is off-centre (e.g. a door hinge, clock hand, pendulum root).",
              properties: {
                x: { type: 'number' as const },
                y: { type: 'number' as const },
              },
              required: ['x', 'y'],
            },
            morphKeys: {
              type: 'array' as const,
              description: "Path deformation keyframes. ONLY for stroke-only vector layers. Each key displaces the path's vertices at frame t using a small set of control points (u ∈ 0–1 along the path, dx/dy in SVG user-space px). Use for ropes, wires, cables, bouncing lines — shapes that need to bend or flex rather than rigidly transform. Loop: first and last key should have all offsets zero. Max 5 control points per key; max 8 keys.",
              items: {
                type: 'object' as const,
                properties: {
                  t: { type: 'number' as const, description: 'Frame (0..totalFrames).' },
                  controls: {
                    type: 'array' as const,
                    description: 'Control-point offsets. u=0 is path start, u=1 is path end.',
                    items: {
                      type: 'object' as const,
                      properties: {
                        u: { type: 'number' as const, description: 'Normalised position along path (0..1).' },
                        dx: { type: 'number' as const, description: 'X offset in SVG user-space px.' },
                        dy: { type: 'number' as const, description: 'Y offset in SVG user-space px.' },
                      },
                      required: ['u', 'dx', 'dy'],
                    },
                  },
                  easing: { type: 'string' as const, enum: EASE_ENUM, description: 'Curve INTO the next keyframe.' },
                },
                required: ['t', 'controls'],
              },
            },
            controls: {
              type: 'array' as const,
              description:
                "Designer-facing labels for this layer's motion knobs. Provide ONE entry for EVERY track you animate on this layer — each animated track becomes a slider, and an unlabelled slider reads as generic ('Scale amount'). Name what the motion MEANS in this picture, not the mechanism.",
              items: {
                type: 'object' as const,
                properties: {
                  track: { type: 'string' as const, enum: ['opacity', 'position', 'scale', 'scaleX', 'rotation', 'trim'] },
                  label: {
                    type: 'string' as const,
                    description: "Short, illustration-specific slider name (≤30 chars), e.g. 'Card launch', 'Steam drift', 'Mascot bounce'.",
                  },
                  hint: {
                    type: 'string' as const,
                    description: "One short line describing what this slider does, in the picture's own terms, e.g. 'How far the card flies up off the screen'.",
                  },
                },
                required: ['track', 'label'],
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
  assertFullSvg(svgText) // throws with a designer-facing message if embedded raster found
  const index = detectSvg(sanitizeSvg(svgText))
  opts.onStage?.('Analyzing artwork…')
  const previewPng = await rasterizeSvg(index.enrichedSvg)

  opts.onStage?.('Planning motion…')
  const plan = await planMotion(index, previewPng, prompt, config, opts)

  opts.onStage?.('Rendering layers…')
  const project = await prepareLayers(index, plan)
  if (config.kind === 'loop') {
    const seams = loopSeamWarnings(project)
    if (seams.length) console.warn('[Zenimator] Loop seam warnings:\n' + seams.join('\n'))
  }
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
  !!(l.opacity?.length || l.position?.length || l.scale?.length || l.rotation?.length || l.trim?.length || l.morphKeys?.length)

/** True when EVERY element in the layer is stroke-only (has a stroke, no fill). */
function isStrokeOnly(elementIds: string[], svgDoc: Document): boolean {
  if (elementIds.length === 0) return false
  return elementIds.every((id) => {
    const el = svgDoc.getElementById(id)
    if (!el) return false
    const tag = el.tagName.toLowerCase().replace(/^svg:/, '')
    if (!['path', 'line', 'polyline', 'circle', 'ellipse', 'rect', 'polygon'].includes(tag)) return false
    const fill = el.getAttribute('fill') ?? styleAttrVal(el, 'fill') ?? ''
    const stroke = el.getAttribute('stroke') ?? styleAttrVal(el, 'stroke') ?? ''
    // Has an explicit stroke and either no fill or fill=none
    return stroke !== '' && stroke !== 'none' && (fill === '' || fill === 'none')
  })
}

function styleAttrVal(el: Element, prop: string): string {
  const style = el.getAttribute('style') ?? ''
  const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`).exec(style)
  return m ? m[1].trim() : ''
}

/** Build vector geometry for a set of stroke-only element ids, scaled to comp space. */
function buildVectorGeom(elementIds: string[], svgDoc: Document, S: number): VectorGeometry | null {
  const paths: SubPath[] = []
  let style: StrokeStyle | null = null
  for (const id of elementIds) {
    const el = svgDoc.getElementById(id)
    if (!el) continue
    const subPaths = elementToPath(el)
    for (const sp of subPaths) paths.push(scalePath(sp, S))
    if (!style) style = strokeStyle(el)
  }
  if (paths.length === 0 || !style) return null
  return { paths, stroke: style }
}

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

  // Parse the enriched SVG into a DOM once — used for stroke classification
  // and for extracting vector geometry.
  const svgDoc = new DOMParser().parseFromString(index.enrichedSvg, 'image/svg+xml')

  const defs: LayerDef[] = []
  const fx: LayerTracks[] = []
  const labels: (Partial<Record<TrackKey, HandleMeta>> | undefined)[] = []
  // 'vector' entries carry pre-built geometry; null = raster (build after)
  const vectorGeoms: (VectorGeometry | null)[] = []

  // Collect pivot overrides per plan-layer index (in SVG user-space px)
  const pivotOverrides = new Map<number, { x: number; y: number }>()
  planLayers.forEach((l, li) => { if (l.pivot) pivotOverrides.set(li, l.pivot) })

  // Collect morph key overrides per plan-layer index. Offsets are given by the
  // model in SVG user-space px; scale to comp space here so project.ts sees
  // consistent units with the SubPath vertices (which are already scaled by S).
  const morphKeyOverrides = new Map<number, MorphKey[]>()
  planLayers.forEach((l, li) => {
    if (!l.morphKeys?.length) return
    const ease = (e?: string) => e && (EASINGS as string[]).includes(e) ? e as MorphKey['easing'] : undefined
    const keys: MorphKey[] = l.morphKeys.map((mk) => ({
      t: clampInt(mk.t, 0, op, 0),
      controls: (mk.controls ?? []).slice(0, 5).map((c) => ({
        u: Math.max(0, Math.min(1, c.u)),
        dx: c.dx * S,
        dy: c.dy * S,
      })),
      easing: ease(mk.easing),
    }))
    morphKeyOverrides.set(li, keys)
  })

  planLayers.forEach((l, li) => {
    const owned = leaves.filter((lf) => owner.get(lf.id) === li).map((lf) => lf.id)
    if (owned.length === 0) return
    defs.push({ name: l.name || 'layer', elementIds: owned })
    fx.push(planToTracks(l, op))
    labels.push(controlsToMeta(l.controls))

    // Classify: stroke-only layers become vector layers (skip rasterize)
    if (isStrokeOnly(owned, svgDoc)) {
      const geom = buildVectorGeom(owned, svgDoc, S)
      vectorGeoms.push(geom)
    } else {
      vectorGeoms.push(null)
    }
  })
  const uncovered = leaves.filter((lf) => !owner.has(lf.id)).map((lf) => lf.id)
  if (uncovered.length) {
    defs.push({ name: '(static)', elementIds: uncovered })
    fx.push({})
    labels.push(undefined)
    vectorGeoms.push(null)
  }

  // Only rasterize the defs that don't have vector geometry
  const rasterDefs = defs.filter((_, i) => vectorGeoms[i] === null)
  const rasters = await rasterizeLayers(index.enrichedSvg, index.viewport, rasterDefs, S)
  // Build a map from def name back to raster result (names are unique within a plan)
  const rasterByName = new Map(rasters.map((r) => [r.name, r]))

  // Assign a stable document order for vector layers using the first element's order
  const order = new Map<string, number>()
  let counter = 0
  const walkOrder = (el: Element) => { if (el.id) order.set(el.id, counter++); for (const ch of Array.from(el.children)) walkOrder(ch) }
  const svgRoot = svgDoc.documentElement
  walkOrder(svgRoot)

  const layers: ProjectLayer[] = defs
    .map((def, di): { layer: ProjectLayer; docIndex: number } | null => {
      const b = unionBox(def.elementIds, boundsById, W, H)
      const piv = pivotOverrides.get(di)
      const mKeys = morphKeyOverrides.get(di)
      const base = {
        name: def.name, elementIds: def.elementIds,
        cx: (piv ? piv.x : b.cx) * S,
        cy: (piv ? piv.y : b.cy) * S,
        bounds: { x: b.x * S, y: b.y * S, w: b.w * S, h: b.h * S },
        tracks: fx[di],
        handleControls: labels[di],
        ...(mKeys ? { morphKeys: mKeys } : {}),
      }
      const firstId = def.elementIds[0] ?? ''
      const docIndex = order.get(firstId) ?? counter++

      const vg = vectorGeoms[di]
      if (vg) {
        return { layer: { ...base, kind: 'vector', vector: vg } satisfies ProjectLayer, docIndex }
      }
      const r = rasterByName.get(def.name)
      if (!r) return null
      return {
        layer: { ...base, kind: 'image', dataUrl: r.dataUrl } satisfies ProjectLayer,
        docIndex: r.docIndex,
      }
    })
    .filter((e): e is { layer: ProjectLayer; docIndex: number } => e !== null)
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
  const sx = scalar(l.scaleX, -200, 200, 100)
  if (sx) t.scaleX = sx
  const r = scalar(l.rotation, -3600, 3600, 0)
  if (r) t.rotation = r
  const tr = scalar(l.trim, 0, 100, 100)
  if (tr) t.trim = tr
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

/** Validate the model's control specs into a per-track {label, hint} map. */
function controlsToMeta(controls: ControlSpec[] | undefined): Partial<Record<TrackKey, HandleMeta>> | undefined {
  if (!controls?.length) return undefined
  const out: Partial<Record<TrackKey, HandleMeta>> = {}
  for (const c of controls) {
    const label = typeof c?.label === 'string' ? c.label.trim().slice(0, 40) : ''
    if (!label || !(TRACK_KEYS as readonly string[]).includes(c.track)) continue
    const hint = typeof c?.hint === 'string' ? c.hint.trim().slice(0, 120) : ''
    out[c.track as TrackKey] = hint ? { label, hint } : { label }
  }
  return Object.keys(out).length ? out : undefined
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

// ── Conversational follow-up: apply a user-directed change ───────────────────

/**
 * Apply a free-text change request to an existing grounded result. Reuses the
 * cached layer rasters (no re-rasterization) — only the motion plan is re-asked
 * — so it's cheap. Returns the updated Lottie JSON and project.
 */
export async function askProjectChange(
  project: GenerateProject,
  instruction: string,
  opts: GenerateOptions,
): Promise<GroundedResult> {
  opts.onStage?.('Reading current animation…')
  const frames = await renderLottieFrames(JSON.stringify(assembleProject(project)), pickFrames(project.op), 320)

  opts.onStage?.('Applying your change…')
  const updated = await askChangesPlan(project, instruction, frames, opts)

  const layers = project.layers.map((l) => {
    const u = updated.get(l.name)
    return u ? { ...l, tracks: u.tracks, handleControls: u.labels ?? l.handleControls } : l
  })
  const next: GenerateProject = { ...project, layers }
  return { lottieJson: JSON.stringify(assembleProject(next)), project: next }
}

async function askChangesPlan(
  project: GenerateProject,
  instruction: string,
  frames: string[],
  opts: GenerateOptions,
): Promise<Map<string, { tracks: LayerTracks; labels?: Partial<Record<TrackKey, HandleMeta>> }>> {
  const client = new Anthropic({ apiKey: opts.apiKey, dangerouslyAllowBrowser: true })

  const planSummary = project.layers.map((l) => ({
    name: l.name,
    tracks: tracksToPlan(l.tracks),
    ...(l.handleControls ? { controls: l.handleControls } : {}),
  }))
  const content: Anthropic.ContentBlockParam[] = [
    {
      type: 'text',
      text:
        `Current plan (layers, their keyframe tracks, and any control labels):\n${JSON.stringify(planSummary, null, 2)}\n\n` +
        `The user asks for this change:\n${instruction}\n\n` +
        `Rendered frames of the current result follow, in order across the loop:`,
    },
    ...frames.map((f) => imageBlock(f)),
  ]

  const response = await client.messages.create(
    {
      model: opts.model,
      max_tokens: 8192,
      system: ASK_CHANGES_MOTION_PROMPT,
      tools: [PLAN_TOOL as unknown as Anthropic.Tool],
      tool_choice: { type: 'tool', name: PLAN_TOOL.name },
      messages: [{ role: 'user', content }],
    },
    { signal: opts.signal },
  )

  const toolBlock = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
  if (!toolBlock) throw new Error('The change request returned no plan.')
  const plan = toolBlock.input as MotionPlan
  const out = new Map<string, { tracks: LayerTracks; labels?: Partial<Record<TrackKey, HandleMeta>> }>()
  for (const l of plan.layers ?? []) {
    if (l?.name) out.set(l.name, { tracks: planToTracks(l, project.op), labels: controlsToMeta(l.controls) })
  }
  return out
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
    elements: index.elements.map((e) => {
      const bx = Math.round(e.bounds.x)
      const by = Math.round(e.bounds.y)
      const bw = Math.round(e.bounds.width)
      const bh = Math.round(e.bounds.height)
      const strokeOnly = !!(e.stroke && e.stroke !== 'none' && (!e.fill || e.fill === 'none'))
      return {
        id: e.id,
        tag: e.tag,
        depth: e.depth,
        bounds: { x: bx, y: by, width: bw, height: bh },
        centroid: { x: Math.round(bx + bw / 2), y: Math.round(by + bh / 2) },
        ...(e.fill ? { fill: e.fill } : {}),
        ...(e.stroke && e.stroke !== 'none' ? { stroke: e.stroke } : {}),
        ...(strokeOnly ? { strokeOnly: true } : {}),
        parentId: e.parentId,
      }
    }),
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
