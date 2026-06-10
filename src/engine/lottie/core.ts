// Shared Lottie (Bodymovin) primitives: document types, keyframe builders, and
// the faithful per-layer rasterizer. Used by the grounded generate hybrid —
// the LLM never draws geometry; we render the real SVG elements here.

// ── Lottie shape types ──────────────────────────────────────────────────────

export type EaseHandle = { x: number[]; y: number[] }
export type NumKeyframe = { t: number; s: number[]; o?: EaseHandle; i?: EaseHandle }
export type Prop =
  | { a: 0; k: number }
  | { a: 0; k: number[] }
  | { a: 1; k: NumKeyframe[] }
export type Transform = { o: Prop; r: Prop; p: Prop; a: Prop; s: Prop }
export type ImageAsset = { id: string; w: number; h: number; u: string; p: string; e: 1 }
export type ImageLayer = {
  ddd: 0; ind: number; ty: 2; nm: string; refId: string
  sr: 1; ks: Transform; ao: 0; ip: number; op: number; st: 0; bm: 0
}
export type LottieDoc = {
  v: string; fr: number; ip: 0; op: number; w: number; h: number
  assets: ImageAsset[]; layers: ImageLayer[]
}

// ── Easing: named keys → cubic-bezier control points ─────────────────────────

export type EasingKey =
  | 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'
  | 'spring-gentle' | 'spring-bouncy' | 'spring-stiff'
export type Bezier = [number, number, number, number]

export const EASING_BEZIER: Record<EasingKey, Bezier> = {
  linear: [0, 0, 1, 1],
  easeIn: [0.4, 0, 1, 1],
  easeOut: [0, 0, 0.2, 1],
  easeInOut: [0.4, 0, 0.2, 1],
  'spring-gentle': [0.33, 1, 0.68, 1],
  'spring-bouncy': [0.34, 1.56, 0.64, 1],
  'spring-stiff': [0.22, 1, 0.36, 1.05],
}

// ── Property builders ────────────────────────────────────────────────────────

export const staticNum = (v: number): Prop => ({ a: 0, k: v })
export const staticVec = (v: number[]): Prop => ({ a: 0, k: v })

const handles = (b: Bezier) => ({ o: { x: [b[0]], y: [b[1]] }, i: { x: [b[2]], y: [b[3]] } })

/** General N-keyframe animated property. Each key carries its value `s` and the
 *  easing `bez` for the segment INTO the next key (Bodymovin puts handles on the
 *  start keyframe of a segment). The last key is always bare; a missing `bez`
 *  also yields a bare key (hold). This is the primitive the tracks model emits;
 *  `animed2`/`animed3` are just special cases kept for the prompt-path code. */
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

/** A 3-keyframe oscillation v0→v1→v0 for seamless loops (v0 must equal v2). */
export function animed3(
  t0: number, t1: number, t2: number,
  v0: number[], v1: number[], v2: number[],
  bez: Bezier,
): Prop {
  return animedKeys([{ t: t0, s: v0, bez }, { t: t1, s: v1, bez }, { t: t2, s: v2 }])
}

// ── Faithful per-layer rasterization ─────────────────────────────────────────
// Each "layer" is a set of element ids; we render exactly those elements (from
// the real SVG) to a full-viewport transparent PNG. The root <svg> attributes
// (notably fill="none") are carried so stroke-only paths don't fall back to
// solid black — the same fix proven in the Phase 0 exporter.

export type LayerDef = { name: string; elementIds: string[] }
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
    for (const el of els) wrapper.appendChild(el.cloneNode(true))
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
