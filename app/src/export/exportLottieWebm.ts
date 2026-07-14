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

export type WebmOptions = {
  loop?: boolean
  /** Solid matte painted behind each frame. Defaults to white (WebM alpha is
   *  unreliable across browsers, so opaque is the safe default). Pass a CSS
   *  color to match a specific surface — e.g. the splash background per theme.
   *  Pass null to attempt a transparent capture (browser support varies). */
  background?: string | null
  /** Target video bitrate (bits/s). Lower it for smaller files where quality
   *  can bend — e.g. a boot-splash clip that must stay light. */
  bitrate?: number
  /** Render supersampling factor (crispness vs. file size). Defaults to 2×. */
  scale?: number
  /** Abort the render mid-flight (user cancelled the export). */
  signal?: AbortSignal
}

/**
 * Records a Lottie animation to WebM. Each Skottie frame is blitted onto a 2D
 * capture canvas over a solid matte (see `background`), then pushed to the
 * MediaRecorder via a manually-driven capture stream so timing is exact and the
 * recorder never sees a half-drawn frame.
 */
export async function exportLottieWebm(
  lottieJson: string,
  opts: WebmOptions = {},
  onProgress?: (progress: number) => void,
): Promise<Blob> {
  const background = opts.background === undefined ? '#ffffff' : opts.background
  const bitrate = opts.bitrate ?? BITRATE
  const scale = opts.scale ?? SCALE
  const src = await createLottieFrameSource(lottieJson, { scale, maxDim: MAX_DIM })
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
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitrate })
    const chunks: Blob[] = []
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

    // Loop kind: record two passes so the WebM plays a couple of cycles before
    // the player's own loop kicks in. Entry kind: a single pass that holds.
    const passes = opts.loop ? 2 : 1
    const totalPaced = passes * totalFrames
    // Pace against an absolute start-time deadline (not a per-frame remainder)
    // so per-iteration overhead (render, sleep/timer slop) doesn't accumulate —
    // a few ms of drift per frame otherwise stretches the recorded duration
    // noticeably over hundreds of frames.
    const recordingStart = performance.now()
    recorder.start()

    for (let pass = 0; pass < passes; pass++) {
      for (let frame = 0; frame < totalFrames; frame++) {
        // User cancelled: stop the recorder and bail (src disposed in finally).
        if (opts.signal?.aborted) {
          try { recorder.stop() } catch { /* already inactive */ }
          throw new DOMException('Export cancelled', 'AbortError')
        }
        renderFrame(frame)
        if (background) {
          ctx.fillStyle = background
          ctx.fillRect(0, 0, w, h)
        } else {
          ctx.clearRect(0, 0, w, h)
        }
        ctx.drawImage(glCanvas, 0, 0)
        track.requestFrame()

        const paced = pass * totalFrames + frame + 1
        onProgress?.(paced / totalPaced)

        const deadline = recordingStart + paced * frameInterval
        const remaining = deadline - performance.now()
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
