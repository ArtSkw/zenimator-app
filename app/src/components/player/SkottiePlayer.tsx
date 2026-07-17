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
  /** Backing-store density multiplier over the element's device-pixel box
   *  (default 1). The zoom control raises this so a magnified vector stays
   *  crisp — Skottie re-rasterizes into a proportionally denser surface — WITHOUT
   *  changing the element's layout size (the CSS transform does the visual
   *  scaling). Changing it re-renders the surface once; it never recreates the
   *  engine. */
  renderScale?: number
  /** Receives imperative controls when ready (and null on teardown). */
  onReady?: (controls: SkottieControls | null, loop: boolean) => void
  onPlayStateChange?: (playing: boolean) => void
  onFrame?: (frame: number, total: number) => void
}

/** Backing-store cap: a magnified surface must never exceed the max GPU texture
 *  a mainstream device reliably allocates. Beyond this the density stops rising
 *  (the CSS upscale takes over) rather than risk a black surface. */
const MAX_BACKING = 4096

function scaledDevice(w: number, h: number, scale: number): { w: number; h: number } {
  const s = Math.max(0.25, Math.min(scale, MAX_BACKING / w, MAX_BACKING / h))
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) }
}

/**
 * Renders a Lottie animation via Skia's Skottie (CanvasKit). Lazy-loads the
 * ~7 MB CanvasKit wasm on first mount, so this must never be on the app's
 * critical path — only mount it inside the generate lane.
 */
export function SkottiePlayer({
  lottieJson, className, autoPlay = true, loop = true, renderScale = 1,
  onReady, onPlayStateChange, onFrame,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<SkottieEngine | null>(null)
  /** Latest raw device-pixel box from the ResizeObserver (element layout size ×
   *  dpr, BEFORE renderScale); null until the browser delivers one. The applied
   *  backing store is this × renderScale, so a zoom that only changes
   *  renderScale can re-derive the target without a fresh observer entry. */
  const rawBox = useRef<{ w: number; h: number } | null>(null)
  const renderScaleRef = useRef(renderScale)
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

    const applyResize = (raw: { w: number; h: number }) => {
      const d = scaledDevice(raw.w, raw.h, renderScaleRef.current)
      engineRef.current?.resize(d.w, d.h)
    }

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
        if (rawBox.current) applyResize(rawBox.current)
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

    // Keep the backing store at the EXACT physical-pixel size of the element
    // (× renderScale). device-pixel-content-box entries fire on layout resizes
    // AND on browser zoom / devicePixelRatio changes, and carry the true
    // device-pixel box — no CSS-px × dpr rounding, so vector output stays crisp.
    // (The box is stashed because the initial entry fires while the engine is
    // still loading CanvasKit.) Note: CSS transforms do NOT trigger this
    // observer, so stage-zoom density changes are driven by the renderScale
    // effect below, not here.
    const observer = new ResizeObserver((entries) => {
      const box = entries[entries.length - 1]?.devicePixelContentBoxSize?.[0]
      if (box) {
        rawBox.current = { w: box.inlineSize, h: box.blockSize }
        applyResize(rawBox.current)
      } else {
        // Safari < 17.2: no device-pixel-content-box. Derive from client size ×
        // dpr so renderScale still applies (density, not just 1×).
        const dpr = window.devicePixelRatio || 1
        rawBox.current = { w: canvas.clientWidth * dpr, h: canvas.clientHeight * dpr }
        applyResize(rawBox.current)
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
        if (rawBox.current) {
          const dpr = window.devicePixelRatio || 1
          rawBox.current = { w: canvas.clientWidth * dpr, h: canvas.clientHeight * dpr }
          applyResize(rawBox.current)
        }
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

  // Density-only change (stage zoom settled): re-render the surface at the new
  // backing scale over the same element box. One resize, no engine churn.
  useEffect(() => {
    renderScaleRef.current = renderScale
    if (rawBox.current) {
      const d = scaledDevice(rawBox.current.w, rawBox.current.h, renderScale)
      engineRef.current?.resize(d.w, d.h)
    }
  }, [renderScale])

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
