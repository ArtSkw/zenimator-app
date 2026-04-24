import { GIFEncoder, quantize, applyPalette } from 'gifenc'
import type { Scene } from '@/engine/scene/types'
import { getSceneDuration } from '@/engine/scene/timing'
import { measureDrawStrokeLengths, drawSvgFrame } from './renderToCanvas'

const FPS = 30          // 30fps → 3cs delay per frame (GIF centisecond resolution)
const TRAILING_MS = 400 // shorter trailing rest than video
const MAX_DURATION_MS = 5_000
const WARN_SIZE_BYTES = 5 * 1024 * 1024

export type GifResult = {
  blob: Blob
  oversized: boolean
  sizeKb: number
}

export async function exportGif(
  scene: Scene,
  onProgress?: (progress: number) => void,
): Promise<GifResult> {
  const totalMs = Math.min(getSceneDuration(scene) + TRAILING_MS, MAX_DURATION_MS)
  const { width: w, height: h } = scene.viewport
  const bg = scene.background ?? '#ffffff'
  const frameInterval = 1000 / FPS
  const totalFrames = Math.ceil(totalMs / frameInterval)

  // Pre-load resources
  const svgDoc = new DOMParser().parseFromString(scene.source.raw, 'image/svg+xml')
  const pathLengths = measureDrawStrokeLengths(scene)

  // GIF at 1× — 2× would produce huge files for little visible benefit at 256 colours
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  const gif = GIFEncoder()

  for (let frame = 0; frame <= totalFrames; frame++) {
    const t = Math.min(frame * frameInterval, totalMs)
    const isFirst = frame === 0

    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    await drawSvgFrame(ctx, scene, svgDoc, t, w, h, pathLengths)

    const { data: rgba } = ctx.getImageData(0, 0, w, h)
    const palette = quantize(rgba, 256)
    const index = applyPalette(rgba, palette)

    gif.writeFrame(index, w, h, {
      palette,
      delay: Math.round(frameInterval),
      // First frame carries the header and loop control.
      // repeat: -1 = play once (no NETSCAPE loop extension) — suits entrance animations.
      ...(isFirst ? { repeat: -1 } : {}),
    })

    onProgress?.((frame + 1) / (totalFrames + 1))
  }

  gif.finish()
  const bytes = gif.bytesView()
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'image/gif' })

  return {
    blob,
    oversized: blob.size > WARN_SIZE_BYTES,
    sizeKb: Math.round(blob.size / 1024),
  }
}
