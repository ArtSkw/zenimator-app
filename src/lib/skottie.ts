import type {
  CanvasKit,
  Surface,
  ManagedSkottieAnimation,
} from 'canvaskit-wasm/full'

let canvasKitPromise: Promise<CanvasKit> | null = null

/**
 * Loads (and caches) the CanvasKit WASM module. The binary is copied into
 * /public by scripts/copy-canvaskit.mjs and served at /canvaskit.wasm.
 *
 * Both the loader JS and the wasm are lazy: the `import()` is dynamic so the
 * ~hundreds-of-KB loader splits into its own chunk, and CanvasKitInit only
 * fetches the ~7 MB wasm on first call. Nothing here touches the app's boot
 * path — it downloads only when the Lottie lane is actually used.
 */
export function loadCanvasKit(): Promise<CanvasKit> {
  if (!canvasKitPromise) {
    // BASE_URL carries Vite's configured base (e.g. '/zenimator-app/' on GitHub
    // Pages), so the wasm resolves correctly in dev and under any deploy base.
    const wasmUrl = `${import.meta.env.BASE_URL}canvaskit.wasm`
    canvasKitPromise = import('canvaskit-wasm/full').then((m) =>
      m.default({ locateFile: () => wasmUrl }),
    )
  }
  return canvasKitPromise
}

/** A slottable property exposed by the animation, with its current value. */
export type AnimationSlot =
  | { id: string; type: 'scalar'; value: number }
  | { id: string; type: 'color'; value: [number, number, number, number] }
  | { id: string; type: 'vec2'; value: [number, number] }
  | { id: string; type: 'text'; value: string }

export type SkottieCallbacks = {
  /** Fired every rendered frame with the playhead and total frame count. */
  onFrame?: (currentFrame: number, totalFrames: number) => void
  onPlayStateChange?: (playing: boolean) => void
}

/**
 * Renders a Lottie animation onto a <canvas> via Skia's Skottie (CanvasKit).
 * Owns a requestAnimationFrame loop and a WebGL surface (recreated on resize).
 * The playhead is tracked in frames and advances off wall-clock time scaled by
 * the animation's fps, so it plays at native speed regardless of display rate.
 *
 * Lean by design (no pan/zoom) — this is the preview engine for the generate
 * lane and the frame source for raster export. Slot getters/setters are wired
 * for the live controls panel (Phase 3).
 */
export class SkottiePlayer {
  private surface: Surface | null = null
  private rafId = 0
  private playing = false
  private currentFrame = 0
  private lastTs = 0
  private dirty = true
  private readonly fps: number
  private readonly totalFrames: number

  private readonly ck: CanvasKit
  private readonly canvas: HTMLCanvasElement
  private readonly animation: ManagedSkottieAnimation
  private readonly callbacks: SkottieCallbacks

  private constructor(
    ck: CanvasKit,
    canvas: HTMLCanvasElement,
    animation: ManagedSkottieAnimation,
    callbacks: SkottieCallbacks = {},
  ) {
    this.ck = ck
    this.canvas = canvas
    this.animation = animation
    this.callbacks = callbacks
    this.fps = animation.fps() || 60
    this.totalFrames = Math.max(1, Math.round(animation.duration() * this.fps))
    this.resize()
    this.rafId = requestAnimationFrame(this.tick)
  }

  /** Builds a player from a Lottie JSON string, loading CanvasKit if needed. */
  static async create(
    canvas: HTMLCanvasElement,
    lottieJson: string,
    callbacks?: SkottieCallbacks,
  ): Promise<SkottiePlayer> {
    const ck = await loadCanvasKit()
    const animation = ck.MakeManagedAnimation(lottieJson)
    if (!animation) throw new Error('CanvasKit could not parse the Lottie file.')
    return new SkottiePlayer(ck, canvas, animation, callbacks)
  }

  getFps(): number {
    return this.fps
  }

  getTotalFrames(): number {
    return this.totalFrames
  }

  getCurrentFrame(): number {
    return this.currentFrame
  }

  isPlaying(): boolean {
    return this.playing
  }

  play(): void {
    if (this.playing) return
    this.playing = true
    this.lastTs = 0
    this.callbacks.onPlayStateChange?.(true)
  }

  pause(): void {
    if (!this.playing) return
    this.playing = false
    this.callbacks.onPlayStateChange?.(false)
  }

  toggle(): void {
    this.playing ? this.pause() : this.play()
  }

  /** Seeks to an absolute frame and renders it. */
  seek(frame: number): void {
    this.currentFrame = Math.max(0, Math.min(frame, this.totalFrames))
    this.dirty = true
    this.callbacks.onFrame?.(this.currentFrame, this.totalFrames)
  }

  // --- Slots (live property overrides) ------------------------------------

  getSlots(): AnimationSlot[] {
    const info = this.animation.getSlotInfo()
    const slots: AnimationSlot[] = []
    for (const id of info.scalarSlotIDs) {
      slots.push({ id, type: 'scalar', value: this.animation.getScalarSlot(id) ?? 0 })
    }
    for (const id of info.colorSlotIDs) {
      const c = this.animation.getColorSlot(id)
      slots.push({ id, type: 'color', value: c ? [c[0], c[1], c[2], c[3]] : [0, 0, 0, 1] })
    }
    for (const id of info.vec2SlotIDs) {
      const v = this.animation.getVec2Slot(id)
      slots.push({ id, type: 'vec2', value: v ? [v[0], v[1]] : [0, 0] })
    }
    for (const id of info.textSlotIDs) {
      slots.push({ id, type: 'text', value: this.animation.getTextSlot(id)?.text ?? '' })
    }
    return slots
  }

  setScalarSlot(id: string, value: number): void {
    this.animation.setScalarSlot(id, value)
    this.dirty = true
  }

  setColorSlot(id: string, rgba: [number, number, number, number]): void {
    this.animation.setColorSlot(id, this.ck.Color4f(rgba[0], rgba[1], rgba[2], rgba[3]))
    this.dirty = true
  }

  setVec2Slot(id: string, xy: [number, number]): void {
    this.animation.setVec2Slot(id, xy)
    this.dirty = true
  }

  /** Syncs the backing store to the element's CSS size; recreates the surface. */
  resize(): void {
    const dpr = window.devicePixelRatio || 1
    const width = Math.max(1, Math.floor(this.canvas.clientWidth * dpr))
    const height = Math.max(1, Math.floor(this.canvas.clientHeight * dpr))
    if (this.canvas.width === width && this.canvas.height === height && this.surface) return
    this.canvas.width = width
    this.canvas.height = height
    this.surface?.delete()
    const surface = this.ck.MakeWebGLCanvasSurface(this.canvas)
    if (!surface) throw new Error('Could not create a WebGL surface for CanvasKit.')
    this.surface = surface
    this.dirty = true
  }

  dispose(): void {
    cancelAnimationFrame(this.rafId)
    this.surface?.delete()
    this.surface = null
    this.animation.delete()
  }

  // --- Rendering ----------------------------------------------------------

  private tick = (ts: number): void => {
    if (this.playing) {
      if (this.lastTs !== 0) {
        const dt = (ts - this.lastTs) / 1000
        this.currentFrame += dt * this.fps
        if (this.currentFrame >= this.totalFrames) this.currentFrame %= this.totalFrames
      }
      this.lastTs = ts
      this.draw()
      this.callbacks.onFrame?.(this.currentFrame, this.totalFrames)
    } else if (this.dirty) {
      this.draw()
    }
    this.dirty = false
    this.rafId = requestAnimationFrame(this.tick)
  }

  private draw(): void {
    if (!this.surface) return
    const canvas = this.surface.getCanvas()
    canvas.clear(this.ck.TRANSPARENT)

    // Letterbox the w×h composition into the device-pixel canvas.
    const [w, h] = this.animation.size()
    const cw = this.canvas.width
    const ch = this.canvas.height
    const scale = Math.min(cw / w, ch / h)
    const dw = w * scale
    const dh = h * scale
    const left = (cw - dw) / 2
    const top = (ch - dh) / 2

    this.animation.seekFrame(this.currentFrame)
    this.animation.render(canvas, this.ck.LTRBRect(left, top, left + dw, top + dh))
    this.surface.flush()
  }
}
