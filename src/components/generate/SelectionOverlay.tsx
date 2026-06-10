import { useEffect, useRef, useState } from 'react'
import { useGenerateStore } from '@/store/generateStore'
import { useGeneratePlayback } from '@/store/generatePlaybackStore'
import { sampleTracks } from '@/engine/lottie/project'

/**
 * Selection box drawn over the preview canvas for the layer chosen in the Layers
 * panel, so it's clear what's being edited. It mirrors the Skottie renderer's
 * letterbox (the composition is scaled to fit and centred), places the layer's
 * rest bounding box, then FOLLOWS the animation — sampling the layer's tracks at
 * the live frame and applying the same translate / scale / rotation about the
 * layer's centre, so the box tracks the moving artwork. Purely visual.
 */
export function SelectionOverlay() {
  const project = useGenerateStore((s) => s.project)
  const selectedLayer = useGenerateStore((s) => s.selectedLayer)
  const frame = useGeneratePlayback((s) => s.frame)
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

  const layer = project && selectedLayer != null ? project.layers[selectedLayer] : null

  let rect: { left: number; top: number; width: number; height: number } | null = null
  let transform = ''
  if (project && layer && size.w > 0 && size.h > 0) {
    // Same letterbox the renderer uses: scale-to-fit, centred.
    const scl = Math.min(size.w / project.w, size.h / project.h)
    const offX = (size.w - project.w * scl) / 2
    const offY = (size.h - project.h * scl) / 2
    const b = layer.bounds
    rect = { left: offX + b.x * scl, top: offY + b.y * scl, width: b.w * scl, height: b.h * scl }

    // Follow the live transform. Position is a user-space offset → comp px (×scale)
    // → screen px (×scl). Scale/rotation pivot the layer's centre = the box centre.
    const s = sampleTracks(layer.tracks, frame)
    const tx = s.dx * project.scale * scl
    const ty = s.dy * project.scale * scl
    transform = `translate(${tx}px, ${ty}px) rotate(${s.rotation}deg) scale(${s.scale / 100})`
  }

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 overflow-hidden">
      {rect && (
        <div
          className="absolute rounded-[3px] border border-emerald-500"
          style={{
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            transform,
            transformOrigin: 'center',
          }}
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

/** A small Figma-style corner handle: white square with the accent border. */
function Handle({ className }: { className: string }) {
  return <span className={`absolute size-1.5 rounded-[1px] border border-emerald-500 bg-background ${className}`} />
}
