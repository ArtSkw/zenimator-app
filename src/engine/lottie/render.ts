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

function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}
