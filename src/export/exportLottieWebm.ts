import { createLottieFrameSource } from './lottieFrames'

const SCALE = 2          // render at 2× for crisp video
const MAX_DIM = 1440     // but cap the long edge so big screens don't explode
const BITRATE = 8_000_000

function preferredMimeType(): string {
  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  return candidates.find((t) => {
    try { return MediaRecorder.isTypeSupported(t) } catch { return false }
  }) ?? 'video/webm'
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * Records a Lottie animation to WebM. Each Skottie frame is blitted onto a 2D
 * capture canvas (white matte — WebM alpha is unreliable across browsers), then
 * pushed to the MediaRecorder via a manually-driven capture stream so timing is
 * exact and the recorder never sees a half-drawn frame.
 */
export async function exportLottieWebm(
  lottieJson: string,
  opts: { loop?: boolean } = {},
  onProgress?: (progress: number) => void,
): Promise<Blob> {
  const src = await createLottieFrameSource(lottieJson, { scale: SCALE, maxDim: MAX_DIM })
  try {
    const { width: w, height: h, fps, totalFrames, canvas: glCanvas, renderFrame } = src
    const frameInterval = 1000 / fps

    const out = document.createElement('canvas')
    out.width = w
    out.height = h
    const ctx = out.getContext('2d')!

    const mimeType = preferredMimeType()
    // captureStream(0) → no automatic capture; we requestFrame() after each draw.
    const stream = out.captureStream(0)
    const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: BITRATE })
    const chunks: Blob[] = []
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

    // Loop kind: record two passes so the WebM plays a couple of cycles before
    // the player's own loop kicks in. Entry kind: a single pass that holds.
    const passes = opts.loop ? 2 : 1
    recorder.start()

    for (let pass = 0; pass < passes; pass++) {
      for (let frame = 0; frame < totalFrames; frame++) {
        const start = performance.now()
        renderFrame(frame)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, w, h)
        ctx.drawImage(glCanvas, 0, 0)
        track.requestFrame()

        const done = (pass * totalFrames + frame + 1) / (passes * totalFrames)
        onProgress?.(done)

        const remaining = frameInterval - (performance.now() - start)
        if (remaining > 1) await sleep(remaining)
      }
    }

    return await new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }))
      recorder.onerror = () => reject(new Error('MediaRecorder error'))
      recorder.stop()
    })
  } finally {
    src.dispose()
  }
}
