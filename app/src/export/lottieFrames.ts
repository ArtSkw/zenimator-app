import { loadCanvasKit } from '@/lib/skottie'

/**
 * A headless Skottie frame source for raster export. Loads CanvasKit, parses the
 * Lottie, and renders any frame synchronously onto an offscreen WebGL canvas.
 *
 * Both the GIF and WebM encoders sit on this: render frame N, then read pixels
 * (GIF) or blit into a capture canvas (WebM) *synchronously* — before yielding —
 * so the WebGL back-buffer is always valid without `preserveDrawingBuffer`.
 */
export type LottieFrameSource = {
  width: number
  height: number
  fps: number
  totalFrames: number
  /** The offscreen WebGL canvas the current frame is rendered onto. */
  canvas: HTMLCanvasElement
  /** Renders frame `n` (clamped to 0..totalFrames) onto `canvas`. Synchronous. */
  renderFrame: (n: number) => void
  /** Releases the animation and GPU surface. Always call when done. */
  dispose: () => void
}

export async function createLottieFrameSource(
  lottieJson: string,
  opts: { scale?: number; maxDim?: number } = {},
): Promise<LottieFrameSource> {
  const ck = await loadCanvasKit()
  const animation = ck.MakeManagedAnimation(lottieJson)
  if (!animation) throw new Error('CanvasKit could not parse the Lottie file.')

  const [nativeW, nativeH] = animation.size()
  let scale = opts.scale ?? 1
  if (opts.maxDim) scale = Math.min(scale, opts.maxDim / Math.max(nativeW, nativeH))
  const width = Math.max(1, Math.round(nativeW * scale))
  const height = Math.max(1, Math.round(nativeH * scale))

  const fps = animation.fps() || 60
  const totalFrames = Math.max(1, Math.round(animation.duration() * fps))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const surface = ck.MakeWebGLCanvasSurface(canvas)
  if (!surface) {
    animation.delete()
    throw new Error('Could not create a WebGL surface for export.')
  }

  const renderFrame = (n: number) => {
    const skCanvas = surface.getCanvas()
    skCanvas.clear(ck.TRANSPARENT)
    animation.seekFrame(Math.max(0, Math.min(n, totalFrames)))
    animation.render(skCanvas, ck.LTRBRect(0, 0, width, height))
    surface.flush()
  }

  const dispose = () => {
    surface.delete()
    animation.delete()
  }

  return { width, height, fps, totalFrames, canvas, renderFrame, dispose }
}
