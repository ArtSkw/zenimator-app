import { loadCanvasKit } from '@/lib/skottie'

/**
 * Render specific frames of a Lottie animation to PNG data URLs, fully
 * offscreen (Skia raster surface, no DOM canvas). These frames are fed back to
 * the model in the refine pass so it can SEE what it produced and correct it.
 *
 * Frames are drawn on a light-grey background so both black and white artwork
 * read clearly to the vision model (a transparent or white background would
 * hide white shapes).
 */
export async function renderLottieFrames(
  lottieJson: string,
  frames: number[],
  size = 320,
): Promise<string[]> {
  const ck = await loadCanvasKit()
  const anim = ck.MakeManagedAnimation(lottieJson)
  if (!anim) throw new Error('Could not parse Lottie for frame rendering.')

  const surface = ck.MakeSurface(size, size)
  if (!surface) {
    anim.delete()
    throw new Error('Could not create an offscreen render surface.')
  }

  const out: string[] = []
  try {
    const [w, h] = anim.size()
    const scale = Math.min(size / w, size / h)
    const dw = w * scale
    const dh = h * scale
    const left = (size - dw) / 2
    const top = (size - dh) / 2
    const rect = ck.LTRBRect(left, top, left + dw, top + dh)
    const bg = ck.Color4f(0.93, 0.93, 0.94, 1)

    for (const f of frames) {
      const canvas = surface.getCanvas()
      canvas.clear(bg)
      anim.seekFrame(f)
      anim.render(canvas, rect)
      surface.flush()
      const img = surface.makeImageSnapshot()
      const bytes = img.encodeToBytes()
      img.delete()
      if (bytes) out.push('data:image/png;base64,' + bytesToBase64(bytes))
    }
  } finally {
    surface.delete()
    anim.delete()
  }
  return out
}

/** Even spread of N inspection frames across [0, op): start, thirds, near-end. */
export function pickFrames(op: number, n = 4): number[] {
  const last = Math.max(0, op - 1)
  const frames: number[] = []
  for (let i = 0; i < n; i++) {
    frames.push(Math.round((last * i) / (n - 1)))
  }
  return Array.from(new Set(frames))
}

/** Close-up renders: one frame each, cropped to a comp-space box — the
 *  reviewer's magnifying glass for details a filmstrip can't settle (a stroke
 *  cap mid-draw, a seam, an overlap). Renders the full comp at a size where
 *  the box fills ~outSize, then crops via 2D canvas. Browser-only (returns []
 *  headless-node); any per-crop failure just skips that crop. */
export async function renderLottieCrops(
  lottieJson: string,
  comp: { w: number; h: number },
  reqs: Array<{ frame: number; box: [number, number, number, number] }>,
  outSize = 256,
): Promise<string[]> {
  if (typeof document === 'undefined') return []
  const out: string[] = []
  for (const req of reqs) {
    try {
      const [bx, by, bw, bh] = req.box
      // Clamp the request to the comp; refuse degenerate slivers.
      const x = Math.max(0, Math.min(comp.w - 8, bx))
      const y = Math.max(0, Math.min(comp.h - 8, by))
      const w = Math.max(24, Math.min(comp.w - x, bw))
      const h = Math.max(24, Math.min(comp.h - y, bh))
      const zoom = outSize / Math.max(w, h)
      const S = Math.round(Math.min(1200, Math.max(320, Math.max(comp.w, comp.h) * zoom)))
      const [full] = await renderLottieFrames(lottieJson, [Math.max(0, Math.round(req.frame))], S)
      if (!full) continue
      const img = await new Promise<HTMLImageElement | null>((resolve) => {
        const im = new Image()
        im.onload = () => resolve(im)
        im.onerror = () => resolve(null)
        im.src = full
      })
      if (!img) continue
      // Same fit-contain mapping renderLottieFrames used.
      const scale = Math.min(S / comp.w, S / comp.h)
      const left = (S - comp.w * scale) / 2
      const top = (S - comp.h * scale) / 2
      const cv = document.createElement('canvas')
      cv.width = outSize
      cv.height = outSize
      const ctx = cv.getContext('2d')
      if (!ctx) continue
      ctx.fillStyle = '#EDEDEF'
      ctx.fillRect(0, 0, outSize, outSize)
      // Square window centered on the requested box, so aspect is preserved.
      const side = Math.max(w, h) * scale
      ctx.drawImage(
        img,
        left + x * scale - (side - w * scale) / 2,
        top + y * scale - (side - h * scale) / 2,
        side, side,
        0, 0, outSize, outSize,
      )
      out.push(cv.toDataURL('image/png'))
    } catch {
      // skip this crop
    }
  }
  return out
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}
