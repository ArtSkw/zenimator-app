import { useEffect, useRef, useState } from 'react'
import { SkottiePlayer as SkottieEngine } from '@/lib/skottie'
import type { SkottieControls } from '@/store/generatePlaybackStore'

type Props = {
  /** The Lottie animation as a JSON string. */
  lottieJson: string
  className?: string
  /** Autoplay on mount (default true). */
  autoPlay?: boolean
  /** Loop continuously (default true); false plays once and holds (entry kind). */
  loop?: boolean
  /** Receives imperative controls when ready (and null on teardown). */
  onReady?: (controls: SkottieControls | null, loop: boolean) => void
  onPlayStateChange?: (playing: boolean) => void
  onFrame?: (frame: number, total: number) => void
}

/**
 * Renders a Lottie animation via Skia's Skottie (CanvasKit). Lazy-loads the
 * ~7 MB CanvasKit wasm on first mount, so this must never be on the app's
 * critical path — only mount it inside the generate lane.
 */
export function SkottiePlayer({
  lottieJson, className, autoPlay = true, loop = true,
  onReady, onPlayStateChange, onFrame,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<SkottieEngine | null>(null)
  /** Latest exact device-pixel box from the ResizeObserver; null until the
   *  browser delivers one (or forever, where device-pixel-content-box is
   *  unsupported — then the clientWidth × dpr path stays in charge). */
  const deviceBox = useRef<{ w: number; h: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Keep callbacks in refs so changing their identity doesn't recreate the engine.
  const onReadyRef = useRef(onReady)
  const onPlayRef = useRef(onPlayStateChange)
  const onFrameRef = useRef(onFrame)
  onReadyRef.current = onReady
  onPlayRef.current = onPlayStateChange
  onFrameRef.current = onFrame

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let disposed = false

    setLoading(true)
    setError(null)

    SkottieEngine.create(
      canvas,
      lottieJson,
      {
        onPlayStateChange: (p) => onPlayRef.current?.(p),
        onFrame: (f, t) => onFrameRef.current?.(f, t),
      },
      { loop },
    )
      .then((engine) => {
        if (disposed) {
          engine.dispose()
          return
        }
        engineRef.current = engine
        // The observer's initial entry fired before the engine existed — apply
        // the exact device-pixel box it captured so the first paint is crisp.
        if (deviceBox.current) engine.resize(deviceBox.current.w, deviceBox.current.h)
        setLoading(false)
        onReadyRef.current?.(
          {
            play: () => engine.play(),
            pause: () => engine.pause(),
            toggle: () => engine.toggle(),
            replay: () => { engine.seek(0); engine.play() },
            seek: (f) => engine.seek(f),
            setLoop: (l) => engine.setLoop(l),
          },
          loop,
        )
        if (autoPlay) engine.play()
      })
      .catch((e: unknown) => {
        if (!disposed) {
          setError(e instanceof Error ? e.message : String(e))
          setLoading(false)
        }
      })

    // Keep the backing store at the EXACT physical-pixel size of the element.
    // device-pixel-content-box entries fire on layout resizes AND on browser
    // zoom / devicePixelRatio changes, and they carry the true device-pixel
    // box — no CSS-px × dpr rounding, so vector output stays crisp at any
    // zoom. (The box is stashed because the initial entry fires while the
    // engine is still loading CanvasKit.)
    const observer = new ResizeObserver((entries) => {
      const box = entries[entries.length - 1]?.devicePixelContentBoxSize?.[0]
      if (box) {
        deviceBox.current = { w: box.inlineSize, h: box.blockSize }
        engineRef.current?.resize(box.inlineSize, box.blockSize)
      } else {
        engineRef.current?.resize()
      }
    })
    try {
      observer.observe(canvas, { box: 'device-pixel-content-box' })
    } catch {
      observer.observe(canvas) // Safari < 17.2: content-box only
    }

    // Fallback for browsers without device-pixel-content-box, where zoom
    // changes devicePixelRatio WITHOUT a layout resize — the backing store
    // goes stale and vector output reads as a blurry raster. Re-listen each
    // time the ratio moves so the surface re-renders crisp.
    let dprCleanup: (() => void) | null = null
    const watchDpr = () => {
      dprCleanup?.()
      const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
      const onChange = () => {
        if (!deviceBox.current) engineRef.current?.resize()
        watchDpr()
      }
      mq.addEventListener('change', onChange, { once: true })
      dprCleanup = () => mq.removeEventListener('change', onChange)
    }
    watchDpr()

    return () => {
      disposed = true
      observer.disconnect()
      dprCleanup?.()
      onReadyRef.current?.(null, loop)
      engineRef.current?.dispose()
      engineRef.current = null
    }
  }, [lottieJson, autoPlay, loop])

  return (
    <div className={className} style={{ position: 'relative' }}>
      <canvas ref={canvasRef} className="block h-full w-full" />
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
          Loading renderer…
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-destructive">
          {error}
        </div>
      )}
    </div>
  )
}
