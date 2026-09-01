import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
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
/** Breathing room around the document at fit, so it never touches the chrome. */
const FIT_PAD = 24

/** Chrome floating over the canvas that the RESTING document should clear. The
 *  camera ignores it entirely — pan and zoom range over the whole viewport, so
 *  artwork travels under the rails exactly as it does in Figma. */
export type Inset = { top: number; right: number; bottom: number; left: number }
const NO_INSET: Inset = { top: 0, right: 0, bottom: 0, left: 0 }
/** Idle after the last zoom event before the surface re-renders crisp. */
const SETTLE_MS = 170

/**
 * Where the camera pill goes when the workspace wants it in its bottom cluster
 * rather than pinned inside the artwork's frame. A module-scoped mount point
 * rather than a DOM-id lookup: the stage SUBSCRIBES to it, so the pill appears
 * the moment the slot commits and there is no effect writing state on mount.
 */
let pillSlot: HTMLElement | null = null
const slotSubs = new Set<() => void>()
const subscribeSlot = (cb: () => void) => { slotSubs.add(cb); return () => { slotSubs.delete(cb) } }

/** Render this where the pill should live; pass `detachPill` to the stage. */
export function ZoomSlot() {
  return (
    <span
      className="contents"
      ref={(el) => { pillSlot = el; slotSubs.forEach((f) => f()) }}
    />
  )
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Where the document rests at fit: the largest box of the doc's aspect that
 *  fits the CLEAR area (the viewport minus whatever chrome floats over it),
 *  centred in that area. The camera then moves this box around freely. */
function fitBox(el: HTMLElement, aspect: number, inset: Inset) {
  const availW = Math.max(1, el.clientWidth - inset.left - inset.right - FIT_PAD * 2)
  const availH = Math.max(1, el.clientHeight - inset.top - inset.bottom - FIT_PAD * 2)
  const w = Math.min(availW, availH * aspect)
  const h = w / aspect
  return {
    w, h,
    left: inset.left + FIT_PAD + (availW - w) / 2,
    top: inset.top + FIT_PAD + (availH - h) / 2,
  }
}

/** Zoom multiplier bounds relative to fit — always reaches fit and 25%..400%. */
function zoomRange(fit: number): { min: number; max: number } {
  return { min: Math.min(MIN_PCT, fit) / fit, max: MAX_PCT / fit }
}

/** Camera that zooms `cam` to `nextZ` while pinning the content point under
 *  (cx, cy). Nothing is clamped: the document may be parked anywhere, which is
 *  what makes the canvas feel infinite rather than like a scroll box. */
function anchoredCamera(cam: Camera, nextZ: number, cx: number, cy: number): Camera {
  const k = nextZ / cam.z
  return { z: nextZ, tx: cx - (cx - cam.tx) * k, ty: cy - (cy - cam.ty) * k }
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
  aspect,
  inset = NO_INSET,
  children,
  detachPill = false,
  onBackgroundClick,
}: {
  /** Document width in animation pixels — the 100% reference. */
  docWidth: number
  /** Document aspect (w / h) — decides the resting box's shape. */
  aspect: number
  /** Chrome the RESTING document should clear. Does not constrain the camera.
   *  Pass a STABLE reference (a module constant) — it is a re-measure dep. */
  inset?: Inset
  children: (renderScale: number) => ReactNode
  /** Send the camera pill to <ZoomSlot /> instead of the canvas corner. */
  detachPill?: boolean
  /** A click on bare canvas — not on the document, not the tail of a pan. */
  onBackgroundClick?: () => void
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [cam, setCam] = useState<Camera>({ z: 1, tx: 0, ty: 0 })
  /** Debounced `cam.z` → the player's backing-store density. */
  const [committed, setCommitted] = useState(1)
  /** Where the document rests at z = 1, and what that equals in absolute
   *  percent — both measured, both re-measured on resize. */
  const [box, setBox] = useState({ w: 0, h: 0, left: 0, top: 0 })
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
    apply(anchoredCamera(ref.current.cam, pct / ref.current.fitPct, el.clientWidth / 2, el.clientHeight / 2), { commit: true })
  }

  const zoomToFit = () => apply({ z: 1, tx: 0, ty: 0 }, { commit: true })
  const zoomIn = () => zoomToPct(STOPS.find((s) => s > ref.current.cam.z * ref.current.fitPct + 0.5) ?? MAX_PCT)
  const zoomOut = () =>
    zoomToPct([...STOPS].reverse().find((s) => s < ref.current.cam.z * ref.current.fitPct - 0.5) ?? MIN_PCT)

  // Re-measure the resting box on resize. The camera is deliberately left
  // alone: a window resize must not yank a document the user has parked.
  // ResizeObserver delivers an initial entry on observe, so setState stays in
  // the async callback.
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const b = fitBox(el, aspect, inset)
      setBox(b)
      setFitPct(Math.max(1, (b.w / docWidth) * 100))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [docWidth, aspect, inset])

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
        applyRef.current(anchoredCamera(c, nextZ, e.clientX - rect.left, e.clientY - rect.top))
      } else {
        // Plain scroll pans at ANY zoom, including fit — on an infinite canvas
        // there is no "too small to move".
        e.preventDefault()
        setCam({ z: c.z, tx: c.tx - e.deltaX, ty: c.ty - e.deltaY })
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
      if (e.button !== 0) return
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
      const tx = start.tx + dx
      const ty = start.ty + dy
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

  const slot = useSyncExternalStore(subscribeSlot, () => pillSlot, () => null)

  /** In the workspace the pill belongs to the bottom cluster; everywhere else
   *  it stays pinned to the frame's corner. While a detached slot has not
   *  committed yet the pill simply waits — drawing it in the corner for one
   *  frame first would read as a glitch. */
  const portal = (ui: ReactNode) =>
    detachPill
      ? (slot ? createPortal(ui, slot) : null)
      : <div className="absolute bottom-3 right-3">{ui}</div>

  return (
    <>
      {/* The viewport is the whole canvas — no frame, no aspect box, nothing
          drawn around the document. The camera plane fills it, and the document
          is one absolutely-placed box on that plane: that is what lets artwork
          travel anywhere, under the rails included, with no visible edge. */}
      <div
        ref={viewportRef}
        className="absolute inset-0 select-none overflow-hidden [touch-action:none]"
        style={{ cursor: grabbing ? 'grabbing' : 'grab' }}
        // Empty canvas clears the selection. Only a click that landed on the
        // canvas ITSELF counts — one that reached the document bubbles up from
        // a child, and a pan's trailing click is already suppressed below.
        onClick={(e) => { if (e.target === e.currentTarget) onBackgroundClick?.() }}
      >
        <div
          className="absolute inset-0 will-change-transform"
          style={{
            transform: `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.z})`,
            transformOrigin: '0 0',
          }}
        >
          <div className="absolute" style={{ left: box.left, top: box.top, width: box.w, height: box.h }}>
            {children(committed)}
          </div>
        </div>
      </div>

      {portal(
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label="Zoom"
                className={
                  // In the rail it is a plain control among other plain
                  // controls — an edged, shadowed pill there would be the only
                  // raised thing in a panel that has no raised things. Over the
                  // canvas it still needs its own edge to be readable.
                  detachPill
                    ? 'flex h-8 items-center gap-1 rounded-full px-2.5 font-mono text-[11px] font-medium tabular-nums text-foreground transition-colors hover:bg-muted'
                    : 'flex h-8 items-center gap-1 rounded-full border border-border bg-background/80 pl-2.5 pr-2 transition-colors font-mono text-[11px] font-medium tabular-nums text-foreground backdrop-blur-sm shadow-sm'
                }
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
        </DropdownMenu>,
      )}
    </>
  )
}
