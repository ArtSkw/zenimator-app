import type { Scene, AnimatableGroup, EasingKey } from '@/engine/scene/types'

// ---------------------------------------------------------------------------
// Scene → Lottie (Bodymovin) JSON exporter
//
// Strategy ("route a"): every animatable group is rasterized to a full-viewport
// transparent PNG and placed on its own Lottie image layer. The group's
// entrance template is mapped to that layer's transform keyframes (opacity /
// position / scale). This preserves the artwork pixel-for-pixel and maps
// cleanly to fade / slide / scale / pop.
//
// Known limitations (refined in later phases):
// - draw-stroke is approximated as a fade-in (no per-path trim in raster form).
// - stagger-children renders as a static visible layer.
// - The PNGs are 1× the viewport; large raster exports will soften. A DPI knob
//   comes later.
// - Background is transparent (standard for Lottie).
// ---------------------------------------------------------------------------

const FPS = 60
const HOLD_TAIL_FRAMES = 30 // hold the final state ~0.5s before the file ends

// ── Lottie shape types ──────────────────────────────────────────────────────

type EaseHandle = { x: number[]; y: number[] }
type NumKeyframe = { t: number; s: number[]; o?: EaseHandle; i?: EaseHandle }
type Prop =
  | { a: 0; k: number }
  | { a: 0; k: number[] }
  | { a: 1; k: NumKeyframe[] }
type Transform = { o: Prop; r: Prop; p: Prop; a: Prop; s: Prop }
type ImageAsset = { id: string; w: number; h: number; u: string; p: string; e: 1 }
type ImageLayer = {
  ddd: 0; ind: number; ty: 2; nm: string; refId: string
  sr: 1; ks: Transform; ao: 0; ip: number; op: number; st: 0; bm: 0
}
export type LottieDoc = {
  v: string; fr: number; ip: 0; op: number; w: number; h: number
  assets: ImageAsset[]; layers: ImageLayer[]
}

// ── Easing: our keys → cubic-bezier control points (mirrors EASING_CSS) ──────

type Bezier = [number, number, number, number]
const EASING_BEZIER: Record<EasingKey, Bezier> = {
  linear: [0, 0, 1, 1],
  easeIn: [0.4, 0, 1, 1],
  easeOut: [0, 0, 0.2, 1],
  easeInOut: [0.4, 0, 0.2, 1],
  'spring-gentle': [0.33, 1, 0.68, 1],
  'spring-bouncy': [0.34, 1.56, 0.64, 1],
  'spring-stiff': [0.22, 1, 0.36, 1.05],
}

// ── Property builders ────────────────────────────────────────────────────────

const staticNum = (v: number): Prop => ({ a: 0, k: v })
const staticVec = (v: number[]): Prop => ({ a: 0, k: v })

/** A 2-keyframe animated property from `from`→`to` with bezier easing.
 *  Bodymovin convention: the start keyframe carries both `o` (out) and `i`
 *  (in) handles for the segment to the next keyframe; the end keyframe is bare. */
function animed(start: number, end: number, from: number[], to: number[], bez: Bezier): Prop {
  return {
    a: 1,
    k: [
      { t: start, s: from, o: { x: [bez[0]], y: [bez[1]] }, i: { x: [bez[2]], y: [bez[3]] } },
      { t: end, s: to },
    ],
  }
}

// ── Transform from a group's entrance binding ────────────────────────────────

function transformFor(group: AnimatableGroup, cx: number, cy: number): Transform {
  const r = staticNum(0)
  const a = staticVec([cx, cy, 0]) // anchor at the group's centre (image-space)
  const baseP = [cx, cy, 0] // image (cx,cy) sits at comp (cx,cy) → image covers comp 1:1
  const anim = group.animation

  // Static, fully-visible layer: no binding, or a marker/none template.
  if (!anim || anim.template === 'none' || anim.template === 'stagger-children') {
    return { o: staticNum(100), r, p: staticVec(baseP), a, s: staticVec([100, 100, 100]) }
  }

  const p = anim.params
  const start = Math.round((anim.timing.start / 1000) * FPS)
  const dur = Math.max(1, Math.round((p.duration / 1000) * FPS))
  const end = start + dur
  const bez = EASING_BEZIER[p.easing] ?? EASING_BEZIER.easeOut
  const d = p.distance ?? 24

  // Default for every entrance template: opacity fades 0→100.
  let o: Prop = animed(start, end, [0], [100], bez)
  let pos: Prop = staticVec(baseP)
  let s: Prop = staticVec([100, 100, 100])

  switch (anim.template) {
    case 'fade-in':
    case 'draw-stroke': // approximated as fade-in in raster form
      break
    case 'slide-up':
      pos = animed(start, end, [cx, cy + d, 0], baseP, bez)
      break
    case 'slide-down':
      pos = animed(start, end, [cx, cy - d, 0], baseP, bez)
      break
    case 'slide-left':
      pos = animed(start, end, [cx + d, cy, 0], baseP, bez)
      break
    case 'slide-right':
      pos = animed(start, end, [cx - d, cy, 0], baseP, bez)
      break
    case 'scale-in': {
      const sf = (p.scaleFrom ?? 0.92) * 100
      s = animed(start, end, [sf, sf, 100], [100, 100, 100], bez)
      break
    }
    case 'pop-in': {
      const sf = (p.scaleFrom ?? 0.6) * 100
      s = animed(start, end, [sf, sf, 100], [100, 100, 100], bez)
      break
    }
  }

  return { o, r, p: pos, a, s }
}

// ── Per-group rasterization (transparent PNG, one element-set each) ──────────

type GroupRaster = { dataUrl: string; docIndex: number }

function resolveGroupEls(group: AnimatableGroup, doc: Document): Element[] {
  if (group.elementRef) {
    const el = doc.querySelector(group.elementRef)
    return el ? [el] : []
  }
  if (group.memberRefs?.length) {
    return group.memberRefs
      .map((ref) => doc.querySelector(ref))
      .filter((el): el is Element => el != null)
  }
  return []
}

async function rasterizeGroups(scene: Scene): Promise<Map<string, GroupRaster>> {
  const { width: W, height: H } = scene.viewport
  const doc = new DOMParser().parseFromString(scene.source.raw, 'image/svg+xml')
  const svg = doc.documentElement
  const ser = new XMLSerializer()

  // Shallow-clone the root <svg> so each sub-SVG inherits ALL its presentation
  // attributes — critically `fill="none"`, which many SVGs (incl. Figma exports)
  // set on the root so stroke-only paths don't fall back to the SVG default of
  // solid black. Rebuilding a bare <svg> wrapper would silently turn every
  // unfilled/stroke path into a black silhouette that covers the artwork.
  const rootTemplate = svg.cloneNode(false) as Element
  rootTemplate.setAttribute('width', String(W))
  rootTemplate.setAttribute('height', String(H))
  if (!rootTemplate.getAttribute('viewBox')) rootTemplate.setAttribute('viewBox', `0 0 ${W} ${H}`)
  // Carry <defs> (gradients, clipPaths, etc.) so each sub-SVG resolves its refs.
  const defsNodes = Array.from(svg.querySelectorAll('defs'))

  // Document order of every id'd element → paint order (later = on top).
  const order = new Map<string, number>()
  let counter = 0
  const walk = (el: Element) => {
    if (el.id) order.set(el.id, counter++)
    for (const child of Array.from(el.children)) walk(child)
  }
  walk(svg)

  const result = new Map<string, GroupRaster>()
  for (const group of scene.groups) {
    const els = resolveGroupEls(group, doc)
    if (els.length === 0) continue

    let minIdx = Infinity
    for (const el of els) {
      const id = el.getAttribute('id')
      if (id && order.has(id)) minIdx = Math.min(minIdx, order.get(id)!)
    }
    if (!Number.isFinite(minIdx)) minIdx = counter++

    // Reconstruct the sub-SVG by cloning the attribute-carrying root, then
    // appending the shared defs and this group's elements.
    const wrapper = rootTemplate.cloneNode(false) as Element
    for (const d of defsNodes) wrapper.appendChild(d.cloneNode(true))
    for (const el of els) wrapper.appendChild(el.cloneNode(true))
    const subSvg = ser.serializeToString(wrapper)
    const dataUrl = await rasterizeTransparent(subSvg, W, H)
    result.set(group.id, { dataUrl, docIndex: minIdx })
  }
  return result
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
      reject(new Error('Failed to rasterize group SVG'))
    }
    img.src = url
  })
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function buildLottie(scene: Scene): Promise<LottieDoc> {
  const { width: W, height: H } = scene.viewport

  // Total animated length → out point, plus a short hold so the final frame
  // is visible before the file (or a loop) restarts.
  let endMs = 0
  for (const g of scene.groups) {
    if (!g.animation) continue
    endMs = Math.max(endMs, g.animation.timing.start + g.animation.params.duration)
  }
  const op = Math.max(1, Math.round((endMs / 1000) * FPS) + HOLD_TAIL_FRAMES)

  const rasters = await rasterizeGroups(scene)

  // Topmost-first: a group painted later in the SVG renders on top, which in
  // Lottie means it must come earlier in the layers array.
  const ordered = scene.groups
    .filter((g) => rasters.has(g.id))
    .sort((a, b) => rasters.get(b.id)!.docIndex - rasters.get(a.id)!.docIndex)

  const assets: ImageAsset[] = []
  const layers: ImageLayer[] = []

  ordered.forEach((group, i) => {
    const id = `img_${i}`
    assets.push({ id, w: W, h: H, u: '', p: rasters.get(group.id)!.dataUrl, e: 1 })

    const cx = group.bounds.x + group.bounds.width / 2
    const cy = group.bounds.y + group.bounds.height / 2
    layers.push({
      ddd: 0, ind: i + 1, ty: 2, nm: group.label, refId: id,
      sr: 1, ks: transformFor(group, cx, cy), ao: 0, ip: 0, op, st: 0, bm: 0,
    })
  })

  return { v: '5.7.0', fr: FPS, ip: 0, op, w: W, h: H, assets, layers }
}

export async function downloadLottie(scene: Scene): Promise<void> {
  const doc = await buildLottie(scene)
  const blob = new Blob([JSON.stringify(doc)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `zenimator-lottie-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}
