import { ArrayBufferTarget, Muxer } from 'mp4-muxer'
import { createLottieFrameSource } from './lottieFrames'

const SCALE = 2          // render at 2× for crisp video (matches WebM)
const MAX_DIM = 1440
const BITRATE = 8_000_000
// H.264 profiles, most capable first; the first the encoder accepts wins.
const CODEC_CANDIDATES = ['avc1.640028', 'avc1.4d0028', 'avc1.42001f']

/** Thrown when the browser can't produce H.264 MP4 (no WebCodecs, or no AVC
 *  encoder). The menu turns this into a "use WebM instead" message. */
export class Mp4UnsupportedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'Mp4UnsupportedError'
  }
}

export type Mp4Options = {
  loop?: boolean
  /** Solid matte painted behind each frame; H.264 has no alpha, so opaque
   *  white is the default (same rationale as the WebM export). */
  background?: string
  bitrate?: number
  scale?: number
  signal?: AbortSignal
}

/**
 * Encodes a Lottie animation to H.264 MP4 — the stakeholder format (Slack,
 * Keynote, QuickTime, iMessage) that WebM isn't. Unlike the WebM path this is
 * an OFFLINE encode: frames go straight into a `VideoEncoder` + mp4 muxer with
 * no realtime pacing, so it finishes as fast as the GPU renders.
 */
export async function exportLottieMp4(
  lottieJson: string,
  opts: Mp4Options = {},
  onProgress?: (progress: number) => void,
): Promise<Blob> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
    throw new Mp4UnsupportedError('This browser has no WebCodecs support.')
  }
  const background = opts.background ?? '#ffffff'
  const bitrate = opts.bitrate ?? BITRATE

  const src = await createLottieFrameSource(lottieJson, {
    scale: opts.scale ?? SCALE,
    maxDim: MAX_DIM,
  })
  const encoderRef: { current: VideoEncoder | null } = { current: null }
  try {
    const { fps, totalFrames, canvas: glCanvas, renderFrame } = src
    // H.264 requires even dimensions; floor and stretch the blit by ≤1px.
    const w = Math.max(2, src.width & ~1)
    const h = Math.max(2, src.height & ~1)

    let codec: string | null = null
    for (const candidate of CODEC_CANDIDATES) {
      const { supported } = await VideoEncoder.isConfigSupported({
        codec: candidate, width: w, height: h, bitrate, framerate: fps,
      })
      if (supported) { codec = candidate; break }
    }
    if (!codec) throw new Mp4UnsupportedError('No H.264 encoder available in this browser.')

    const out = document.createElement('canvas')
    out.width = w
    out.height = h
    const ctx = out.getContext('2d')!

    const target = new ArrayBufferTarget()
    const muxer = new Muxer({
      target,
      video: { codec: 'avc', width: w, height: h },
      fastStart: 'in-memory',
    })

    let encodeError: unknown = null
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => { encodeError = e },
    })
    encoderRef.current = encoder
    encoder.configure({
      codec, width: w, height: h, bitrate, framerate: fps,
      // Length-prefixed AVC (not Annex B) — what the mp4 container stores.
      avc: { format: 'avc' },
    })

    // Loop kind: two passes so the file plays a couple of cycles (same rule
    // as WebM). Entry kind: a single pass that holds.
    const passes = opts.loop ? 2 : 1
    const total = passes * totalFrames
    const usPerFrame = 1e6 / fps
    const keyEvery = Math.max(1, Math.round(2 * fps))

    for (let i = 0; i < total; i++) {
      if (opts.signal?.aborted) throw new DOMException('Export cancelled', 'AbortError')
      if (encodeError) throw encodeError

      renderFrame(i % totalFrames)
      ctx.fillStyle = background
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(glCanvas, 0, 0, w, h)

      const frame = new VideoFrame(out, {
        timestamp: Math.round(i * usPerFrame),
        duration: Math.round(usPerFrame),
      })
      encoder.encode(frame, { keyFrame: i % keyEvery === 0 })
      frame.close()

      onProgress?.((i + 1) / total)
      // Yield a macrotask per frame: keeps the progress toast painting and the
      // Cancel click responsive, and lets the encoder queue drain.
      await new Promise<void>((r) => setTimeout(r))
      while (encoder.encodeQueueSize > 8) await new Promise<void>((r) => setTimeout(r))
    }

    if (encodeError) throw encodeError
    await encoder.flush()
    muxer.finalize()
    return new Blob([target.buffer], { type: 'video/mp4' })
  } finally {
    try { encoderRef.current?.close() } catch { /* already closed */ }
    src.dispose()
  }
}
