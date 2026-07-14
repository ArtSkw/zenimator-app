import { useEffect, useMemo, useRef, useState } from 'react'
import { useGenerateStore, bakeLottieJson } from '@/store/generateStore'
import { useGeneratePlayback } from '@/store/generatePlaybackStore'
import { createLayerBoundsSampler, type LayerBoundsSampler } from '@/engine/lottie/layerBounds'

/**
 * Selection highlight for studio scenes — draws a box around the layer chosen in
 * the Layers panel so it's clear which part the controls are about. The box
 * FOLLOWS the layer: a sampler (see createLayerBoundsSampler) is built once per
 * selection, then a self-throttling rAF loop reads the live playback frame and
 * repositions the box straight on the DOM node (no per-frame React renders). It
 * only samples when the frame actually changes, so a paused scene costs nothing.
 * Coordinates mirror the player's letterbox (contain-fit, centered).
 */
export function StudioSelectionOverlay() {
  const skeleton = useGenerateStore((s) => s.skeleton)
  const selectedLayer = useGenerateStore((s) => s.selectedLayer)
  const cast = useGenerateStore((s) => s.cast)
  const lottieJson = useGenerateStore((s) => s.lottieJson)
  // Overrides drive a debounced rebuild so the box matches the BAKED (rendered)
  // layer — but we bake imperatively (below), never via a second live bake hook.
  const slotOverrides = useGenerateStore((s) => s.slotOverrides)

  const containerRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const samplerRef = useRef<LayerBoundsSampler | null>(null)
  const prevNm = useRef<string | undefined>(undefined)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [samplerTick, setSamplerTick] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Legacy skeleton scenes use their own overlay; this one is studio-only.
  const nm = !skeleton && selectedLayer != null ? cast[selectedLayer]?.nm : undefined

  const docSize = useMemo(() => {
    if (!lottieJson) return null
    try {
      const d = JSON.parse(lottieJson) as { w?: number; h?: number }
      return d.w && d.h ? { w: d.w, h: d.h } : null
    } catch {
      return null
    }
  }, [lottieJson])

  // Build a sampler for the selected layer against the BAKED doc (what the
  // player actually renders, so Intensity/slider changes are reflected). A layer
  // switch rebuilds immediately; a same-layer doc/override change rebuilds after
  // a short debounce so slider drags don't thrash — and the old sampler stays
  // live until the new one is ready, so the box never flickers mid-drag.
  // 360px longest side keeps per-frame sampling cheap while staying pixel-tight.
  useEffect(() => {
    const nmChanged = prevNm.current !== nm
    prevNm.current = nm
    if (!nm) {
      samplerRef.current?.dispose(); samplerRef.current = null
      setSamplerTick((t) => t + 1)
      return
    }
    if (nmChanged) { samplerRef.current?.dispose(); samplerRef.current = null }

    let alive = true
    const build = () => {
      const baked = bakeLottieJson()
      if (!baked) return
      createLayerBoundsSampler(baked, nm, 360).then((s) => {
        if (!alive) { s?.dispose(); return }
        samplerRef.current?.dispose() // swap only once the replacement is ready
        samplerRef.current = s
        setSamplerTick((t) => t + 1) // kick the follow loop to resample now
      })
    }
    // Immediate on layer switch; debounced when only the doc/overrides moved.
    const handle = nmChanged ? (build(), undefined) : window.setTimeout(build, 140)
    return () => { alive = false; if (handle) clearTimeout(handle) }
  }, [nm, lottieJson, slotOverrides])

  // Dispose the live sampler on unmount only (dep-change swaps handle their own).
  useEffect(() => () => { samplerRef.current?.dispose(); samplerRef.current = null }, [])

  // Follow loop — repositions the box at the current frame's bounds. Runs while
  // a layer is selected; samples only when the frame (or container) changed, so
  // a paused scene is a cheap no-op each tick. Visibility is opacity-based (not
  // display) so it fades; position is written BEFORE the reveal, so a hidden box
  // never fades in at a stale spot after a layer switch.
  useEffect(() => {
    const box = boxRef.current
    let raf = 0
    let lastFrame = -1
    let lastKey = ''
    const hide = () => { if (box) box.style.opacity = '0'; lastFrame = -1 }
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const s = samplerRef.current
      if (!box) return
      if (!nm || !docSize || !s || size.w === 0 || size.h === 0) { hide(); return }

      const frame = Math.round(useGeneratePlayback.getState().frame)
      const key = `${size.w}x${size.h}`
      if (frame === lastFrame && key === lastKey) return // nothing moved
      lastFrame = frame
      lastKey = key

      const comp = s.at(frame)
      if (!comp) { hide(); return }

      const scl = Math.min(size.w / docSize.w, size.h / docSize.h)
      const offX = (size.w - docSize.w * scl) / 2
      const offY = (size.h - docSize.h * scl) / 2
      box.style.left = `${offX + comp.x * scl}px`
      box.style.top = `${offY + comp.y * scl}px`
      box.style.width = `${comp.w * scl}px`
      box.style.height = `${comp.h * scl}px`
      box.style.opacity = '1'
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [nm, size.w, size.h, docSize, samplerTick])

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Always mounted; the follow loop positions it and fades it in/out via
          opacity. Position is written straight to the node each frame (no CSS
          transition on it), so tracking stays frame-accurate with zero lag while
          only the reveal fades. */}
      <div
        ref={boxRef}
        className="absolute rounded-[3px] border border-emerald-500 transition-opacity duration-150"
        style={{ opacity: 0 }}
      >
        <Handle className="-top-[3px] -left-[3px]" />
        <Handle className="-top-[3px] -right-[3px]" />
        <Handle className="-bottom-[3px] -left-[3px]" />
        <Handle className="-bottom-[3px] -right-[3px]" />
      </div>
    </div>
  )
}

function Handle({ className }: { className: string }) {
  return <span className={`absolute size-1.5 rounded-[1px] border border-emerald-500 bg-background ${className}`} />
}
