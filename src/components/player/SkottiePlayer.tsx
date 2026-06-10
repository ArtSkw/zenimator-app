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
        setLoading(false)
        onReadyRef.current?.(
          {
            play: () => engine.play(),
            pause: () => engine.pause(),
            toggle: () => engine.toggle(),
            replay: () => { engine.seek(0); engine.play() },
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

    const observer = new ResizeObserver(() => engineRef.current?.resize())
    observer.observe(canvas)

    return () => {
      disposed = true
      observer.disconnect()
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
