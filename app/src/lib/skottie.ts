import type {
  CanvasKit,
  Surface,
  ManagedSkottieAnimation,
  GrDirectContext,
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
  /** WebGL context + Skia GrContext are owned explicitly (not via the managed
   *  helper) so they can be released on dispose — preventing a slow GPU-resource
   *  leak across the engine recreations that happen on every edit. */
  private grContext: GrDirectContext | null = null
  private glHandle = 0
  /** 0 when the RAF loop is idle (paused & clean); otherwise the pending id. */
  private rafId = 0
  private disposed = false
  private playing = false
  private currentFrame = 0
  private lastTs = 0
  private dirty = true
  /** When false the animation plays once and holds the last frame (entry kind). */
  private loop = true
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
    this.scheduleTick()
  }

  /** Wake the render loop if it's idle. Cheap to over-call (guarded). */
  private scheduleTick(): void {
    if (this.disposed || this.rafId !== 0) return
    this.rafId = requestAnimationFrame(this.tick)
  }

  /** Builds a player from a Lottie JSON string, loading CanvasKit if needed. */
  static async create(
    canvas: HTMLCanvasElement,
    lottieJson: string,
    callbacks?: SkottieCallbacks,
    opts?: { loop?: boolean },
  ): Promise<SkottiePlayer> {
    const ck = await loadCanvasKit()
    const animation = ck.MakeManagedAnimation(lottieJson)
    if (!animation) throw new Error('CanvasKit could not parse the Lottie file.')
    const player = new SkottiePlayer(ck, canvas, animation, callbacks)
    if (opts?.loop === false) player.loop = false
    return player
  }

  /** Toggle looping; when turned off the playhead holds at the final frame. */
  setLoop(loop: boolean): void {
    this.loop = loop
    this.dirty = true
    this.scheduleTick()
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
    // If parked at the end (a finished entry animation), Play restarts it.
    if (this.currentFrame >= this.totalFrames) this.currentFrame = 0
    this.playing = true
    this.lastTs = 0
    this.callbacks.onPlayStateChange?.(true)
    this.scheduleTick()
  }

  pause(): void {
    if (!this.playing) return
    this.playing = false
    this.callbacks.onPlayStateChange?.(false)
    // Sync the playhead exactly — throttling may have skipped the last frame.
    this.callbacks.onFrame?.(this.currentFrame, this.totalFrames)
  }

  toggle(): void {
    if (this.playing) this.pause()
    else this.play()
  }

  /** Seeks to an absolute frame and renders it. */
  seek(frame: number): void {
    this.currentFrame = Math.max(0, Math.min(frame, this.totalFrames))
    this.dirty = true
    this.callbacks.onFrame?.(this.currentFrame, this.totalFrames)
    this.scheduleTick()
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
    this.scheduleTick()
  }

  setColorSlot(id: string, rgba: [number, number, number, number]): void {
    this.animation.setColorSlot(id, this.ck.Color4f(rgba[0], rgba[1], rgba[2], rgba[3]))
    this.dirty = true
    this.scheduleTick()
  }

  setVec2Slot(id: string, xy: [number, number]): void {
    this.animation.setVec2Slot(id, xy)
    this.dirty = true
    this.scheduleTick()
  }

  /** Syncs the backing store to the element's physical size; recreates the
   *  surface (reusing the GrContext, so only the surface churns on resize).
   *  Pass the exact device-pixel box when the caller has it (ResizeObserver's
   *  device-pixel-content-box) — clientWidth × dpr can land a fraction of a
   *  pixel off, and the GPU stretch of that mismatch reads as blur. */
  resize(deviceWidth?: number, deviceHeight?: number): void {
    const dpr = window.devicePixelRatio || 1
    const width = Math.max(1, Math.floor(deviceWidth ?? this.canvas.clientWidth * dpr))
    const height = Math.max(1, Math.floor(deviceHeight ?? this.canvas.clientHeight * dpr))
    if (this.canvas.width === width && this.canvas.height === height && this.surface) return
    this.canvas.width = width
    this.canvas.height = height
    this.surface?.delete()
    this.surface = this.makeSurface(width, height)
    // Paint the current frame SYNCHRONOUSLY: a freshly (re)created GL surface
    // starts blank, and waiting for the next rAF tick shows a one-frame flash
    // on every resize — very visible while zooming. Drawing now removes it.
    this.draw()
    this.dirty = false
    if (this.playing) this.scheduleTick()
  }

  /** Create an on-screen GL surface. Owns the WebGL context + GrContext so they
   *  can be freed on dispose; falls back to the managed helper if the low-level
   *  path is unavailable (the helper leaks the context, but never breaks). */
  private makeSurface(width: number, height: number): Surface {
    if (!this.grContext) {
      const handle = this.ck.GetWebGLContext(this.canvas)
      if (handle) {
        const gr = this.ck.MakeWebGLContext(handle)
        if (gr) { this.glHandle = handle; this.grContext = gr }
        else this.ck.deleteContext(handle)
      }
    }
    if (this.grContext) {
      const s = this.ck.MakeOnScreenGLSurface(this.grContext, width, height, this.ck.ColorSpace.SRGB)
      if (s) return s
    }
    const fallback = this.ck.MakeWebGLCanvasSurface(this.canvas)
    if (!fallback) throw new Error('Could not create a WebGL surface for CanvasKit.')
    return fallback
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.rafId)
    this.rafId = 0
    this.surface?.delete()
    this.surface = null
    this.animation.delete()
    this.grContext?.delete()
    this.grContext = null
    if (this.glHandle) { this.ck.deleteContext(this.glHandle); this.glHandle = 0 }
  }

  // --- Rendering ----------------------------------------------------------

  private tick = (ts: number): void => {
    this.rafId = 0 // mark idle; reschedule below only if there's more work
    if (this.disposed) return

    if (this.playing) {
      if (this.lastTs !== 0) {
        const dt = (ts - this.lastTs) / 1000
        this.currentFrame += dt * this.fps
        if (this.currentFrame >= this.totalFrames) {
          if (this.loop) {
            this.currentFrame %= this.totalFrames
          } else {
            // Entry kind: hold the final frame and stop advancing.
            this.currentFrame = this.totalFrames
            this.playing = false
            this.callbacks.onPlayStateChange?.(false)
          }
        }
      }
      this.lastTs = ts
      this.draw()
      // Notify every drawn frame so imperative/leaf consumers stay as smooth as
      // the canvas. The cost is kept low on the React side by isolating the
      // playhead/readout into tiny leaf components (see GenerateTransport).
      this.callbacks.onFrame?.(this.currentFrame, this.totalFrames)
    } else if (this.dirty) {
      this.draw()
    }
    this.dirty = false

    // Keep the loop alive only while playing; otherwise go idle (a paused, clean
    // preview costs nothing). play()/seek()/slot edits re-arm it via scheduleTick.
    if (this.playing) this.scheduleTick()
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
