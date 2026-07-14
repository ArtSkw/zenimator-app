import { useEffect, useRef, useState } from 'react'
import { useGenerateStore } from '@/store/generateStore'

/**
 * Static selection box for the v3 (agent-authored) path. Highlights the resting
 * bounds of the layer chosen in the Layers panel so it's clear which part is
 * which. Mirrors the Skottie renderer's letterbox (scale-to-fit, centred). The
 * box marks the layer's rest position; it does not follow the live motion.
 */
export function SkeletonSelectionOverlay() {
  const skeleton = useGenerateStore((s) => s.skeleton)
  const selectedLayer = useGenerateStore((s) => s.selectedLayer)
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const layer = skeleton && selectedLayer != null ? skeleton.layers[selectedLayer] : null

  let rect: { left: number; top: number; width: number; height: number } | null = null
  if (skeleton && layer && size.w > 0 && size.h > 0) {
    const scl = Math.min(size.w / skeleton.w, size.h / skeleton.h)
    const offX = (size.w - skeleton.w * scl) / 2
    const offY = (size.h - skeleton.h * scl) / 2
    const b = layer.bounds // already in comp space (includes the margin)
    rect = {
      left: offX + b.x * scl,
      top: offY + b.y * scl,
      width: b.w * scl,
      height: b.h * scl,
    }
  }

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 overflow-hidden">
      {rect && (
        <div
          className="absolute rounded-[3px] border border-emerald-500"
          style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
        >
          <Handle className="-top-[3px] -left-[3px]" />
          <Handle className="-top-[3px] -right-[3px]" />
          <Handle className="-bottom-[3px] -left-[3px]" />
          <Handle className="-bottom-[3px] -right-[3px]" />
        </div>
      )}
    </div>
  )
}

function Handle({ className }: { className: string }) {
  return <span className={`absolute size-1.5 rounded-[1px] border border-emerald-500 bg-background ${className}`} />
}
