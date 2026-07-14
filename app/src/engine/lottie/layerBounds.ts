import { loadCanvasKit } from '@/lib/skottie'

type Rect = { x: number; y: number; w: number; h: number }

/** A reusable bounds probe for one layer: parses the isolated scene and builds
 *  the renderer ONCE, then `.at(frame)` returns that layer's comp-space bbox at
 *  any frame — cheap enough to call every animation frame so a selection box can
 *  FOLLOW the layer as it moves. `.dispose()` frees the native anim/surface. */
export type LayerBoundsSampler = {
  at: (frame: number) => Rect | null
  dispose: () => void
}

/**
 * Build a {@link LayerBoundsSampler} for the named layer by preparing an
 * ISOLATED copy of the scene — only the target layer (plus its transform
 * ancestors, so its position resolves, and its descendants, so a rig null covers
 * the whole group it drives) is visible. Bounds come from scanning the real
 * renderer's pixels, so any shape/gradient/matte/animated-transform is correct
 * without reimplementing Lottie geometry. Returns null when the layer is absent
 * or the scene can't be rendered.
 */
export async function createLayerBoundsSampler(
  lottieJson: string,
  nm: string,
  maxDim = 420,
): Promise<LayerBoundsSampler | null> {
  const ck = await loadCanvasKit()

  type Layer = { ind?: number; nm?: string; parent?: number; ks?: { o?: unknown } }
  let doc: { w?: number; h?: number; op?: number; layers?: Layer[] }
  try {
    doc = JSON.parse(lottieJson)
  } catch {
    return null
  }
  const layers = doc.layers ?? []
  const W = Math.round(doc.w ?? 0)
  const H = Math.round(doc.h ?? 0)
  if (!W || !H || layers.length === 0) return null

  const byInd = new Map<number, Layer>()
  for (const l of layers) if (l.ind != null) byInd.set(l.ind, l)

  const selected = layers.filter((l) => l.nm === nm && l.ind != null)
  if (selected.length === 0) return null
  const selInds = new Set(selected.map((l) => l.ind as number))

  // Keep the target + its transform ancestors + its descendants.
  const keep = new Set<number>(selInds)
  for (const l of selected) {
    let p = l.parent
    for (let g = 0; p != null && byInd.has(p) && g < 60; g++) {
      keep.add(p)
      p = byInd.get(p)!.parent
    }
  }
  for (const l of layers) {
    if (l.ind == null) continue
    let p = l.parent
    for (let g = 0; p != null && g < 60; g++) {
      if (selInds.has(p)) { keep.add(l.ind); break }
      p = byInd.get(p)?.parent
    }
  }

  // Track mattes: a matted layer (`tt`) is invisible without its matte SOURCE —
  // the layer directly before it in the array (`td:1`). Keep those too, else
  // isolating a letter under a wipe matte renders zero pixels and the selection
  // box never appears. Descending so chained mattes propagate.
  for (let i = layers.length - 1; i >= 1; i--) {
    const l = layers[i] as Layer & { tt?: number }
    if (l.tt && l.ind != null && keep.has(l.ind)) {
      const m = layers[i - 1]
      if (m.ind != null) keep.add(m.ind)
    }
  }

  // Hide everything else (opacity 0). Mutating our own parsed copy only.
  for (const l of layers) {
    if (l.ind != null && !keep.has(l.ind)) l.ks = { ...(l.ks ?? {}), o: { a: 0, k: 0 } }
  }

  // Render at reduced resolution — plenty for a bbox, cheap on CPU.
  const scale = Math.min(1, maxDim / Math.max(W, H))
  const cw = Math.max(1, Math.round(W * scale))
  const ch = Math.max(1, Math.round(H * scale))

  const anim = ck.MakeManagedAnimation(JSON.stringify(doc))
  if (!anim) return null
  const surface = ck.MakeSurface(cw, ch)
  if (!surface) { anim.delete(); return null }

  const canvas = surface.getCanvas()
  const info = {
    width: cw, height: ch,
    colorType: ck.ColorType.RGBA_8888,
    alphaType: ck.AlphaType.Unpremul,
    colorSpace: ck.ColorSpace.SRGB,
  }
  const op = Math.max(1, Math.ceil(doc.op ?? 1))
  let disposed = false

  const at = (frame: number): Rect | null => {
    if (disposed) return null
    canvas.clear(ck.TRANSPARENT)
    anim.seekFrame(Math.max(0, Math.min(frame, op - 1)))
    anim.render(canvas, ck.LTRBRect(0, 0, cw, ch))
    surface.flush()
    const img = surface.makeImageSnapshot()
    const px = img.readPixels(0, 0, info) as Uint8Array | null
    img.delete()
    if (!px) return null

    let minX = cw, minY = ch, maxX = -1, maxY = -1
    for (let y = 0; y < ch; y++) {
      const row = y * cw * 4
      for (let x = 0; x < cw; x++) {
        if (px[row + x * 4 + 3] > 8) { // alpha threshold
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    if (maxX < 0) return null // nothing rendered at this frame
    // Back to comp space; pad 1px each side to cover the alpha-threshold shave.
    return {
      x: (minX - 1) / scale,
      y: (minY - 1) / scale,
      w: (maxX - minX + 2) / scale,
      h: (maxY - minY + 2) / scale,
    }
  }

  const dispose = () => {
    if (disposed) return
    disposed = true
    surface.delete()
    anim.delete()
  }

  return { at, dispose }
}

/**
 * One-shot bbox unioned over the sampled `frames` — a stable box that encloses
 * the layer across its whole motion range. Builds and disposes a sampler
 * internally; use {@link createLayerBoundsSampler} directly when sampling
 * repeatedly (e.g. a box that follows the layer during playback).
 */
export async function computeLayerCompBounds(
  lottieJson: string,
  nm: string,
  frames: number[],
): Promise<Rect | null> {
  const sampler = await createLayerBoundsSampler(lottieJson, nm)
  if (!sampler) return null
  try {
    let u: Rect | null = null
    for (const f of frames) {
      const r = sampler.at(f)
      if (!r) continue
      if (!u) { u = r; continue }
      const right = Math.max(u.x + u.w, r.x + r.w)
      const bottom = Math.max(u.y + u.h, r.y + r.h)
      u = { x: Math.min(u.x, r.x), y: Math.min(u.y, r.y), w: right - Math.min(u.x, r.x), h: bottom - Math.min(u.y, r.y) }
    }
    return u
  } finally {
    sampler.dispose()
  }
}
