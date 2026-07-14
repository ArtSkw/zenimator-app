// Shared Lottie (Bodymovin) primitives: document types, keyframe builders, and
// the faithful per-layer rasterizer. Used by the grounded generate hybrid —
// the LLM never draws geometry; we render the real SVG elements here.

import { elementWorldMatrix, isIdentity } from '@/engine/detector/transform'

// ── Lottie shape types ──────────────────────────────────────────────────────

export type EaseHandle = { x: number[]; y: number[] }
/** A numeric keyframe. `o`/`i` are TEMPORAL ease handles (speed curve). `to`/`ti`
 *  are SPATIAL bezier tangents for multi-dimensional values (position) — they
 *  bend the path between keyframes into a curve (arcs). */
export type NumKeyframe = { t: number; s: number[]; o?: EaseHandle; i?: EaseHandle; to?: number[]; ti?: number[]; h?: 0 | 1 }
export type Prop =
  | { a: 0; k: number }
  | { a: 0; k: number[] }
  | { a: 1; k: NumKeyframe[] }
export type Transform = { o: Prop; r: Prop; p: Prop; a: Prop; s: Prop }
export type ImageAsset = { id: string; w: number; h: number; u: string; p: string; e: 1 }
/** Track-matte fields: `td:1` marks a layer AS a matte (hidden, mattes the next
 *  layer); `tt` on a layer means "use the preceding layer as my matte"
 *  (1=alpha, 2=alpha-inverted, 3=luma, 4=luma-inverted). */
export type ImageLayer = {
  ddd: 0; ind: number; ty: 2; nm: string; refId: string
  sr: 1; ks: Transform; ao: 0 | 1; ip: number; op: number; st: 0; bm: 0
  tt?: 1 | 2 | 3 | 4; td?: 1
  /** `ind` of this layer's parent transform (null or shape). Children inherit the
   *  parent's transform — the basis of the bounce/sway rig. */
  parent?: number
}
// ── Shape-layer types (ty:4) ─────────────────────────────────────────────────
// Used by the vector path (WS1+). Every shape primitive must live inside a
// GrGroup whose `it` array ends with a TrGroup.

/** One vertex set inside a keyframed shape. */
export type ShapeVerts = { i: number[][]; o: number[][]; v: number[][]; c: boolean }

/** Static or keyframed bezier path. The `k` value follows Lottie's sh format:
 *  v = anchor points, i = in-tangents (relative), o = out-tangents (relative).
 *  Keyframed variant includes optional temporal ease handles `o`/`i` (out/in). */
export type ShapePath =
  | { a: 0; k: ShapeVerts }
  | { a: 1; k: Array<{ t: number; s: [ShapeVerts]; o?: EaseHandle; i?: EaseHandle }> }

export type ShPath   = { ty: 'sh'; ks: ShapePath; nm?: string }
export type StStroke = { ty: 'st'; c: Prop; o: Prop; w: Prop; lc: 1|2|3; lj: 1|2|3; nm?: string }
/** Gradient stroke. `t`: 1=linear, 2=radial. `s`/`e` are the gradient's start/end
 *  points in comp space. `g.p` is the stop count; `g.k` packs colour stops
 *  (offset,r,g,b …) followed by alpha stops (offset,a …), all 0–1. */
export type GsStroke = {
  ty: 'gs'; t: 1 | 2; s: Prop; e: Prop
  g: { p: number; k: Prop }
  o: Prop; w: Prop; lc: 1|2|3; lj: 1|2|3; nm?: string
}
/** Solid fill. `r`: 1=nonzero, 2=evenodd fill-rule. */
export type FlFill   = { ty: 'fl'; c: Prop; o: Prop; r?: 1 | 2; nm?: string }
/** Gradient fill. Same packing as GsStroke (`t`, `s`/`e`, `g`); `r` is fill-rule. */
export type GfFill   = {
  ty: 'gf'; t: 1 | 2; s: Prop; e: Prop
  g: { p: number; k: Prop }
  o: Prop; r?: 1 | 2; nm?: string
}
export type TmTrim   = { ty: 'tm'; s: Prop; e: Prop; o: Prop; m: 1; nm?: string }
export type TrGroup  = { ty: 'tr'; o: Prop; r: Prop; p: Prop; a: Prop; s: Prop; nm?: string }
export type GrGroup  = { ty: 'gr'; nm?: string; it: Array<ShPath | StStroke | GsStroke | FlFill | GfFill | TmTrim | TrGroup | GrGroup> }

export type ShapeLayer = {
  ddd: 0; ind: number; ty: 4; nm: string
  sr: 1; ks: Transform; ao: 0 | 1; ip: number; op: number; st: 0; bm: 0
  shapes: GrGroup[]
  tt?: 1 | 2 | 3 | 4; td?: 1
  /** `ind` of this layer's parent transform. See ImageLayer.parent. */
  parent?: number
}

/** Null layer (ty:3): an invisible transform other layers parent to. Carries
 *  group motion (e.g. a character's bounce, an arm's sway) so one set of
 *  keyframes drives every child. `w`/`h` are nominal (nulls don't render). */
export type NullLayer = {
  ddd: 0; ind: number; ty: 3; nm: string
  sr: 1; ks: Transform; ao: 0; ip: number; op: number; st: 0; bm: 0
  parent?: number
}

export type AnyLayer = ImageLayer | ShapeLayer | NullLayer

export type LottieDoc = {
  v: string; fr: number; ip: 0; op: number; w: number; h: number
  assets: ImageAsset[]; layers: AnyLayer[]
}

// ── Easing: named keys → cubic-bezier control points ─────────────────────────

export type EasingKey =
  | 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'
  | 'spring-gentle' | 'spring-bouncy' | 'spring-stiff'
  | 'entrance-sharp' | 'settle-soft' | 'exit-accelerate'
  | 'rise-out' | 'fall-in' | 'squash-recover'
export type Bezier = [number, number, number, number]

export const EASING_BEZIER: Record<EasingKey, Bezier> = {
  linear: [0, 0, 1, 1],
  easeIn: [0.4, 0, 1, 1],
  easeOut: [0, 0, 0.2, 1],
  easeInOut: [0.4, 0, 0.2, 1],
  'spring-gentle': [0.33, 1, 0.68, 1],
  'spring-bouncy': [0.34, 1.56, 0.64, 1],
  'spring-stiff': [0.22, 1, 0.36, 1.05],
  // Studio anchor curves (motion-taste): purpose-built, stronger character
  // than the CSS classics — swift-in/soft-land, deep no-bounce landing, and
  // a slow-out/fast-finish exit.
  'entrance-sharp': [0.2, 0.75, 0.34, 0.94],
  'settle-soft': [0, 0.65, 0.51, 0.99],
  'exit-accelerate': [1, 0.02, 0.54, 0.42],
  // Weight physics (character walk/bounce): a body pushes off FAST out of
  // contact and decelerates into the float; then hangs at the apex and
  // gravity-accelerates down. Symmetric curves on a bounce read as hovering.
  'rise-out': [0.22, 0.68, 0.36, 1],
  'fall-in': [0.55, 0.05, 0.78, 0.42],
  'squash-recover': [0.25, 0.8, 0.42, 1],
}

// ── Property builders ────────────────────────────────────────────────────────

export const staticNum = (v: number): Prop => ({ a: 0, k: v })
export const staticVec = (v: number[]): Prop => ({ a: 0, k: v })

const handles = (b: Bezier) => ({ o: { x: [b[0]], y: [b[1]] }, i: { x: [b[2]], y: [b[3]] } })

/** General N-keyframe animated property. Each key carries its value `s` and the
 *  easing `bez` for the segment INTO the next key (Bodymovin puts handles on the
 *  start keyframe of a segment). The last key is always bare; a missing `bez`
 *  also yields a bare key (hold). This is the primitive the tracks model emits;
 *  `animed2` is just a special case kept for the prompt-path code. */
export function animedKeys(keys: { t: number; s: number[]; bez?: Bezier }[]): Prop {
  const last = keys.length - 1
  return {
    a: 1,
    k: keys.map((kf, i) =>
      i < last && kf.bez ? { t: kf.t, s: kf.s, ...handles(kf.bez) } : { t: kf.t, s: kf.s },
    ),
  }
}

/** A 2-keyframe animated property from `from`→`to`. */
export function animed2(start: number, end: number, from: number[], to: number[], bez: Bezier): Prop {
  return animedKeys([{ t: start, s: from, bez }, { t: end, s: to }])
}

// ── Faithful per-layer rasterization ─────────────────────────────────────────
// Each "layer" is a set of element ids; we render exactly those elements (from
// the real SVG) to a full-viewport transparent PNG. The root <svg> attributes
// (notably fill="none") are carried so stroke-only paths don't fall back to
// solid black — the same fix proven in the Phase 0 exporter.

export type LayerDef = {
  name: string
  elementIds: string[]
  /** When this def is one piece of an SVG path the engine SPLIT into several
   *  leaves (multi-M stroke-only sub-path splitting), the shared source path's
   *  human name — ground truth that all pieces are ONE drawn element. */
  sourceName?: string
}
/** `defIndex` maps back to the position in the input `layerDefs` (so callers
 *  can pair a rasterized layer with its motion; empty defs are skipped). */
export type RasterLayer = { name: string; dataUrl: string; docIndex: number; defIndex: number }

export async function rasterizeLayers(
  svgText: string,
  viewport: { width: number; height: number },
  layerDefs: LayerDef[],
  /** Supersampling factor — renders each layer at dpi× the viewport so it stays
   *  crisp when the composition is scaled up on a retina canvas. */
  dpi = 1,
): Promise<RasterLayer[]> {
  const { width: W, height: H } = viewport
  const pxW = Math.round(W * dpi)
  const pxH = Math.round(H * dpi)
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml')
  const svg = doc.documentElement
  const ser = new XMLSerializer()

  const rootTemplate = svg.cloneNode(false) as Element
  // Scale the raster up via width/height while the viewBox keeps the original
  // user-space coordinates — the SVG renders crisp at the higher resolution.
  rootTemplate.setAttribute('width', String(pxW))
  rootTemplate.setAttribute('height', String(pxH))
  if (!rootTemplate.getAttribute('viewBox')) rootTemplate.setAttribute('viewBox', `0 0 ${W} ${H}`)

  const defsNodes = Array.from(svg.querySelectorAll('defs'))

  // Document order of every id'd element → paint order (later = on top).
  const order = new Map<string, number>()
  let counter = 0
  const walk = (el: Element) => {
    if (el.id) order.set(el.id, counter++)
    for (const child of Array.from(el.children)) walk(child)
  }
  walk(svg)

  const out: RasterLayer[] = []
  for (let defIndex = 0; defIndex < layerDefs.length; defIndex++) {
    const def = layerDefs[defIndex]
    const els = def.elementIds
      .map((id) => doc.getElementById(id))
      .filter((el): el is HTMLElement => el != null)
    if (els.length === 0) continue

    let minIdx = Infinity
    for (const el of els) {
      const idx = el.id ? order.get(el.id) : undefined
      if (idx !== undefined) minIdx = Math.min(minIdx, idx)
    }
    if (!Number.isFinite(minIdx)) minIdx = counter++

    const wrapper = rootTemplate.cloneNode(false) as Element
    for (const d of defsNodes) wrapper.appendChild(d.cloneNode(true))
    for (const el of els) {
      const clone = el.cloneNode(true) as Element
      // The clone is re-parented directly under <svg>, losing any ancestor
      // <g transform> chain — bake the element's full world matrix onto it so
      // pixels land where the (world-space) bounds say they are. The world
      // matrix already includes the element's own transform, so it replaces it.
      const world = elementWorldMatrix(el)
      if (isIdentity(world)) clone.removeAttribute('transform')
      else clone.setAttribute('transform', `matrix(${world.join(' ')})`)
      wrapper.appendChild(clone)
    }
    const dataUrl = await rasterizeTransparent(ser.serializeToString(wrapper), pxW, pxH)
    out.push({ name: def.name, dataUrl, docIndex: minIdx, defIndex })
  }
  return out
}

function rasterizeTransparent(svgText: string, w: number, h: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas 2D context unavailable')
        ctx.drawImage(img, 0, 0, w, h) // no fill → transparent background
        resolve(canvas.toDataURL('image/png'))
      } catch (e) {
        reject(e)
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to rasterize layer SVG'))
    }
    img.src = url
  })
}
