import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/** Camera: `z` is zoom as a multiple of fit (1 = fit-to-viewport); `tx/ty` pan
 *  the content in viewport CSS px (transform-origin is the top-left corner). */
type Camera = { z: number; tx: number; ty: number }

/** Absolute zoom stops (percent of true size) the +/- steps and presets snap to. */
const STOPS = [25, 50, 75, 100, 125, 150, 200, 300, 400]
const MAX_PCT = 400
const MIN_PCT = 25
/** Pinch/⌘-scroll sensitivity — trackpad pinches arrive as ctrlKey wheel events. */
const WHEEL_ZOOM_K = 0.01
/** Movement (px) before a press becomes a pan — below it, the click still
 *  reaches the layer-selection overlay. */
const DRAG_THRESHOLD = 3
/** Idle after the last zoom event before the surface re-renders crisp. */
const SETTLE_MS = 170

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Clamp one pan axis: centre when content fits, else keep edges flush to the
 *  viewport (no empty gutters) — the Figma/Framer feel. */
function clampAxis(t: number, viewport: number, content: number): number {
  if (content <= viewport) return (viewport - content) / 2
  return clamp(t, viewport - content, 0)
}

/** Zoom multiplier bounds relative to fit — always reaches fit and 25%..400%. */
function zoomRange(fit: number): { min: number; max: number } {
  return { min: Math.min(MIN_PCT, fit) / fit, max: MAX_PCT / fit }
}

/** Camera that zooms `cam` to `nextZ` while pinning the content point under
 *  (cx, cy), with pan re-clamped to the viewport. */
function anchoredCamera(el: HTMLElement, cam: Camera, nextZ: number, cx: number, cy: number): Camera {
  const k = nextZ / cam.z
  const tx = clampAxis(cx - (cx - cam.tx) * k, el.clientWidth, el.clientWidth * nextZ)
  const ty = clampAxis(cy - (cy - cam.ty) * k, el.clientHeight, el.clientHeight * nextZ)
  return { z: nextZ, tx, ty }
}

/**
 * The stage's zoom + pan viewport and the top-right zoom pill. Zoom and pan are
 * a CSS transform on the content wrapper — a pure compositor operation, so
 * live pinching and dragging never touch the GPU render surface (the flash the
 * old resize-per-frame model produced is gone). Crispness is restored by
 * bumping the Skottie backing-store density (`renderScale`) once the gesture
 * settles: magnified vectors re-rasterize sharp, exactly once, with a
 * synchronous repaint so the settle is invisible.
 *
 * `children` is a render-prop receiving the settled zoom to pass down as the
 * player's `renderScale`. The selection overlay lives INSIDE the transformed
 * wrapper, so it scales and pans with the artwork for free.
 */
export function ZoomableStage({
  docWidth,
  sizingStyle,
  children,
}: {
  /** Document width in animation pixels — the 100% reference. */
  docWidth: number
  /** The viewport's sizing (aspectRatio + maxWidth) — unchanged from the
   *  pre-zoom stage, so fit is pixel-identical to the old layout. */
  sizingStyle: CSSProperties
  children: (renderScale: number) => ReactNode
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [cam, setCam] = useState<Camera>({ z: 1, tx: 0, ty: 0 })
  /** Debounced `cam.z` → the player's backing-store density. */
  const [committed, setCommitted] = useState(1)
  /** What fit equals in absolute percent (measured). */
  const [fitPct, setFitPct] = useState(100)

  // Latest values for the once-subscribed DOM listeners (synced post-render;
  // writing refs during render is off-limits under the compiler rules).
  const ref = useRef({ cam, fitPct })
  useEffect(() => {
    ref.current = { cam, fitPct }
  })

  const [grabbing, setGrabbing] = useState(false)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (settleTimer.current) clearTimeout(settleTimer.current) }, [])

  /** Apply a camera and schedule (or force) the crisp settle. Stored in a ref
   *  so the once-subscribed wheel listener calls the current version. */
  const apply = (next: Camera, opts?: { commit?: boolean }) => {
    setCam(next)
    if (settleTimer.current) clearTimeout(settleTimer.current)
    if (opts?.commit) {
      setCommitted(next.z)
    } else {
      settleTimer.current = setTimeout(() => setCommitted(ref.current.cam.z), SETTLE_MS)
    }
  }
  const applyRef = useRef(apply)
  useEffect(() => { applyRef.current = apply })

  /** Jump to an absolute percentage, anchored at the viewport centre. */
  const zoomToPct = (pct: number) => {
    const el = viewportRef.current
    if (!el) return
    apply(anchoredCamera(el, ref.current.cam, pct / ref.current.fitPct, el.clientWidth / 2, el.clientHeight / 2), { commit: true })
  }

  const zoomToFit = () => apply({ z: 1, tx: 0, ty: 0 }, { commit: true })
  const zoomIn = () => zoomToPct(STOPS.find((s) => s > ref.current.cam.z * ref.current.fitPct + 0.5) ?? MAX_PCT)
  const zoomOut = () =>
    zoomToPct([...STOPS].reverse().find((s) => s < ref.current.cam.z * ref.current.fitPct - 0.5) ?? MIN_PCT)

  // Measure what fit means, and keep pan clamped when the viewport resizes.
  // ResizeObserver delivers an initial entry on observe, so setState stays in
  // the async callback.
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setFitPct(Math.max(1, (el.clientWidth / docWidth) * 100))
      const { cam: c } = ref.current
      const tx = clampAxis(c.tx, el.clientWidth, el.clientWidth * c.z)
      const ty = clampAxis(c.ty, el.clientHeight, el.clientHeight * c.z)
      if (tx !== c.tx || ty !== c.ty) setCam({ ...c, tx, ty })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [docWidth])

  // Wheel: ⌘/ctrl (or trackpad pinch) zooms toward the cursor; plain two-finger
  // scroll pans while zoomed in. Non-passive so preventDefault can stop the
  // browser's own page zoom / scroll.
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      const { cam: c, fitPct: fit } = ref.current
      const rect = el.getBoundingClientRect()
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const { min, max } = zoomRange(fit)
        const nextZ = clamp(c.z * Math.exp(-e.deltaY * WHEEL_ZOOM_K), min, max)
        if (Math.abs(nextZ - c.z) < 1e-4) return
        applyRef.current(anchoredCamera(el, c, nextZ, e.clientX - rect.left, e.clientY - rect.top))
      } else if (c.z > 1.001) {
        e.preventDefault()
        const tx = clampAxis(c.tx - e.deltaX, el.clientWidth, el.clientWidth * c.z)
        const ty = clampAxis(c.ty - e.deltaY, el.clientHeight, el.clientHeight * c.z)
        setCam({ z: c.z, tx, ty })
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Drag to pan when zoomed in. A press only becomes a pan past DRAG_THRESHOLD,
  // so a stationary click still selects a layer through the overlay; a real
  // drag captures the pointer and suppresses the trailing click so panning
  // never selects.
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    let start: { x: number; y: number; tx: number; ty: number; id: number } | null = null
    let dragging = false
    let panned = false

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || ref.current.cam.z <= 1.001) return
      start = { x: e.clientX, y: e.clientY, tx: ref.current.cam.tx, ty: ref.current.cam.ty, id: e.pointerId }
      dragging = false
      panned = false
    }
    const onMove = (e: PointerEvent) => {
      if (!start) return
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      if (!dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      if (!dragging) {
        dragging = true
        el.setPointerCapture(start.id)
        setGrabbing(true)
      }
      e.preventDefault()
      panned = true
      const { cam: c } = ref.current
      const tx = clampAxis(start.tx + dx, el.clientWidth, el.clientWidth * c.z)
      const ty = clampAxis(start.ty + dy, el.clientHeight, el.clientHeight * c.z)
      setCam({ z: c.z, tx, ty })
    }
    const onUp = () => {
      if (start && dragging) el.releasePointerCapture(start.id)
      setGrabbing(false)
      start = null
      dragging = false
    }
    // Eat the click that follows a real pan so it doesn't select a layer.
    const onClick = (e: MouseEvent) => {
      if (panned) { e.stopPropagation(); e.preventDefault(); panned = false }
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('click', onClick, true)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('click', onClick, true)
    }
  }, [])

  const displayPct = Math.round(cam.z * fitPct)
  const pannable = cam.z > 1.001

  return (
    <>
      <div
        ref={viewportRef}
        className="relative mx-auto w-full select-none overflow-hidden [touch-action:none]"
        style={{ ...sizingStyle, cursor: grabbing ? 'grabbing' : pannable ? 'grab' : undefined }}
      >
        <div
          className="absolute inset-0 will-change-transform"
          style={{
            transform: `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.z})`,
            transformOrigin: '0 0',
          }}
        >
          {children(committed)}
        </div>
      </div>

      <div className="absolute bottom-3 right-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label="Zoom"
                className="pressable flex h-8 items-center gap-1 rounded-full border border-border bg-background/80 pl-2.5 pr-2 font-mono text-[11px] font-medium tabular-nums text-foreground backdrop-blur-sm shadow-sm"
              >
                {displayPct}%
                <ChevronDown size={11} className="opacity-60" />
              </button>
            }
          />
          <DropdownMenuContent side="top" align="end" className="w-40">
            <DropdownMenuItem onClick={zoomIn}>Zoom in</DropdownMenuItem>
            <DropdownMenuItem onClick={zoomOut}>Zoom out</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={Math.abs(cam.z - 1) < 1e-3} onClick={zoomToFit}>
              Zoom to fit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => zoomToPct(100)}>Zoom to 100%</DropdownMenuItem>
            <DropdownMenuItem onClick={() => zoomToPct(200)}>Zoom to 200%</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  )
}
