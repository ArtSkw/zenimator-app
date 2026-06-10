import { useEffect, useRef, useState } from 'react'
import { SkottiePlayer as SkottieEngine } from '@/lib/skottie'

type Props = {
  /** The Lottie animation as a JSON string. */
  lottieJson: string
  className?: string
  /** Autoplay on mount (default true). */
  autoPlay?: boolean
}

/**
 * Renders a Lottie animation via Skia's Skottie (CanvasKit). Lazy-loads the
 * ~7 MB CanvasKit wasm on first mount, so this component must never be on the
 * app's critical path — only mount it inside the generate lane.
 *
 * The engine owns its own rAF loop; this wrapper just manages lifecycle and
 * surfaces load errors.
 */
export function SkottiePlayer({ lottieJson, className, autoPlay = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<SkottieEngine | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let disposed = false

    setLoading(true)
    setError(null)

    SkottieEngine.create(canvas, lottieJson)
      .then((engine) => {
        if (disposed) {
          engine.dispose()
          return
        }
        engineRef.current = engine
        setLoading(false)
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
      engineRef.current?.dispose()
      engineRef.current = null
    }
  }, [lottieJson, autoPlay])

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
