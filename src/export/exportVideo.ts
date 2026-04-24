import type { Scene } from '@/engine/scene/types'
import { getSceneDuration } from '@/engine/scene/timing'
import { measureDrawStrokeLengths, drawSvgFrame } from './renderToCanvas'

const FPS = 60
const SCALE = 2
const BITRATE = 5_000_000
const TRAILING_MS = 500
const MAX_DURATION_MS = 5_000

function preferredMimeType(): string {
  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  return candidates.find((t) => {
    try { return MediaRecorder.isTypeSupported(t) } catch { return false }
  }) ?? 'video/webm'
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export async function exportWebm(
  scene: Scene,
  onProgress?: (progress: number) => void,
): Promise<Blob> {
  const totalMs = Math.min(getSceneDuration(scene) + TRAILING_MS, MAX_DURATION_MS)
  const { width: w, height: h } = scene.viewport
  const bg = scene.background ?? '#ffffff'
  const frameInterval = 1000 / FPS
  const totalFrames = Math.ceil(totalMs / frameInterval)

  // Pre-load all resources before the recorder starts
  const svgDoc = new DOMParser().parseFromString(scene.source.raw, 'image/svg+xml')
  const pathLengths = measureDrawStrokeLengths(scene)

  const canvas = document.createElement('canvas')
  canvas.width = w * SCALE
  canvas.height = h * SCALE
  const ctx = canvas.getContext('2d')!

  const mimeType = preferredMimeType()

  // captureStream(0) disables automatic frame capture. We call track.requestFrame()
  // manually only AFTER each draw completes, so the recorder never sees the blank
  // canvas that exists during async SVG image loading.
  const stream = canvas.captureStream(0)
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: BITRATE,
  })
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  async function paintFrame(t: number) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.scale(SCALE, SCALE)
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    await drawSvgFrame(ctx, scene, svgDoc, t, w, h, pathLengths)
    ctx.restore()
    // Capture this frame only after drawing is fully complete
    track.requestFrame()
  }

  recorder.start()

  for (let frame = 0; frame <= totalFrames; frame++) {
    const t = Math.min(frame * frameInterval, totalMs)
    const frameStart = performance.now()

    await paintFrame(t)
    onProgress?.(Math.min(t / totalMs, 1))

    // Sleep for the remainder of the frame interval to keep video timing correct.
    // If rendering took longer than frameInterval the sleep is skipped.
    const elapsed = performance.now() - frameStart
    const remaining = frameInterval - elapsed
    if (remaining > 1) await sleep(remaining)
  }

  return new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }))
    recorder.onerror = () => reject(new Error('MediaRecorder error'))
    recorder.stop()
  })
}
