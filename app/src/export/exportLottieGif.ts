import { GIFEncoder, quantize, applyPalette } from 'gifenc'
import { createLottieFrameSource } from './lottieFrames'

const MAX_DIM = 512 // cap dimension — 256-colour GIFs balloon fast at large sizes
const WARN_SIZE_BYTES = 5 * 1024 * 1024

export type GifResult = {
  blob: Blob
  oversized: boolean
  sizeKb: number
}

/**
 * Encodes a Lottie animation to an animated GIF by rendering every Skottie frame
 * and quantizing it to a 256-colour palette. GIF has no real alpha, so each frame
 * is composited onto a white matte (matching the WebM path).
 */
export async function exportLottieGif(
  lottieJson: string,
  opts: { loop?: boolean; signal?: AbortSignal } = {},
  onProgress?: (progress: number) => void,
): Promise<GifResult> {
  const src = await createLottieFrameSource(lottieJson, { maxDim: MAX_DIM })
  try {
    const { width: w, height: h, fps, totalFrames, canvas: glCanvas, renderFrame } = src
    const delay = Math.round(1000 / fps)

    // 2D matte canvas: composite the transparent frame onto white, then read RGBA.
    const out = document.createElement('canvas')
    out.width = w
    out.height = h
    const ctx = out.getContext('2d', { willReadFrequently: true })!

    const gif = GIFEncoder()

    for (let frame = 0; frame < totalFrames; frame++) {
      // Bail cleanly if the user cancelled — src.dispose() runs in finally.
      if (opts.signal?.aborted) throw new DOMException('Export cancelled', 'AbortError')
      renderFrame(frame)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(glCanvas, 0, 0)

      const { data: rgba } = ctx.getImageData(0, 0, w, h)
      const palette = quantize(rgba, 256)
      const index = applyPalette(rgba, palette)

      gif.writeFrame(index, w, h, {
        palette,
        delay,
        // First frame carries loop control: repeat 0 = forever (loop kind),
        // -1 = play once and hold (entry kind).
        ...(frame === 0 ? { repeat: opts.loop ? 0 : -1 } : {}),
      })

      onProgress?.((frame + 1) / totalFrames)
      // Yield periodically so the progress toast paints and the tab stays responsive.
      if (frame % 8 === 0) await new Promise((r) => setTimeout(r))
    }

    gif.finish()
    const bytes = gif.bytesView()
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'image/gif' })

    return {
      blob,
      oversized: blob.size > WARN_SIZE_BYTES,
      sizeKb: Math.round(blob.size / 1024),
    }
  } finally {
    src.dispose()
  }
}
