import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Play, Pause, RotateCcw, Repeat } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGeneratePlayback } from '@/store/generatePlaybackStore'
import { useGenerateStore } from '@/store/generateStore'
import { TRACK_KEYS } from '@/engine/lottie/project'

/**
 * Footer transport for the generated Lottie preview. Drives the live Skottie
 * engine, scrubs the timeline (with keyframe markers for the selected layer),
 * and exposes the total length (frames), which scales every layer's timing.
 */
export function GenerateTransport() {
  // Per-field selectors (not a whole-store subscription) so the transport does
  // NOT re-render on every frame — only the tiny <ProgressFill>/<PlayheadHandle>/
  // <FrameReadout> leaves below subscribe to the 60fps `frame`.
  const controls = useGeneratePlayback((s) => s.controls)
  const isPlaying = useGeneratePlayback((s) => s.isPlaying)
  const loop = useGeneratePlayback((s) => s.loop)
  const total = useGeneratePlayback((s) => s.total)
  const setLoop = useGeneratePlayback((s) => s.setLoop)
  const setPlaying = useGeneratePlayback((s) => s.setPlaying)
  const project = useGenerateStore((s) => s.project)
  const selectedLayer = useGenerateStore((s) => s.selectedLayer)
  const setTotalFrames = useGenerateStore((s) => s.setTotalFrames)
  const storeControls = useGenerateStore((s) => s.controls)
  const setSlotOverride = useGenerateStore((s) => s.setSlotOverride)

  // Use the engine-reported total so the display reflects bakedLottieJson (which
  // includes any Duration slider override), not just the raw project op.
  const op = total || project?.op || 0
  const disabled = !controls

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  // Keyframe times of the selected layer (deduped, sorted) — timeline markers.
  const markers = useMemo(() => {
    if (!project || selectedLayer == null) return [] as number[]
    const layer = project.layers[selectedLayer]
    if (!layer) return []
    const ts = new Set<number>()
    for (const key of TRACK_KEYS) for (const k of layer.tracks[key]?.keys ?? []) ts.add(k.t)
    return [...ts].sort((a, b) => a - b)
  }, [project, selectedLayer])

  const openEdit = () => {
    setDraft(String(op))
    setEditing(true)
  }
  const commitEdit = () => {
    const n = parseInt(draft, 10)
    if (Number.isFinite(n) && n >= 12 && n <= 1800) {
      // Route through the same applyControlValues path as the sidebar Duration
      // slider — this correctly rescales gradient matte sweep keyframes too.
      if (storeControls) setSlotOverride('dur', n)
      else setTotalFrames(n)
    }
    setEditing(false)
  }

  const toggleLoop = () => {
    const next = !loop
    controls?.setLoop(next)
    setLoop(next)
  }

  const beginScrub = () => {
    controls?.pause()
    setPlaying(false)
  }
  const seekTo = (f: number) => controls?.seek(f)

  return (
    <footer className="h-16 border-t border-border bg-background flex items-center gap-3 px-5 shrink-0">
      <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost" size="icon" className="size-8 rounded-full"
              disabled={disabled} onClick={() => controls?.toggle()}
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            </Button>
          }
        />
        <TooltipContent side="top">{isPlaying ? 'Pause' : 'Play'}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost" size="icon" className="size-8 rounded-full"
              disabled={disabled} onClick={() => controls?.replay()}
            >
              <RotateCcw size={14} />
            </Button>
          }
        />
        <TooltipContent side="top">Restart</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant={loop ? 'default' : 'ghost'} size="icon" className="size-8 rounded-full"
              disabled={disabled} onClick={toggleLoop} aria-pressed={loop}
            >
              <Repeat size={14} />
            </Button>
          }
        />
        <TooltipContent side="top">{loop ? 'Loop on' : 'Loop off'}</TooltipContent>
      </Tooltip>
      </TooltipProvider>

      <Timeline
        op={op}
        markers={markers}
        disabled={disabled}
        onScrubStart={beginScrub}
        onSeek={seekTo}
      />

      {/* Frame counter + editable total length */}
      <div className="flex items-center gap-1 font-mono text-xs tabular-nums text-muted-foreground">
        <FrameReadout />
        <span>/</span>
        {editing ? (
          <input
            autoFocus
            type="number"
            min={12}
            max={1800}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit()
              if (e.key === 'Escape') setEditing(false)
            }}
            className="w-14 h-6 rounded-md border border-input bg-background px-1.5 text-right text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        ) : (
          <button
            onClick={openEdit}
            disabled={!storeControls && !project}
            title={storeControls || project ? 'Click to change total length (frames)' : undefined}
            className="px-1 rounded cursor-pointer underline-offset-2 hover:underline text-foreground hover:bg-muted transition-colors disabled:text-muted-foreground disabled:pointer-events-none disabled:no-underline"
          >
            {op}
          </button>
        )}
        <span>f</span>
      </div>
    </footer>
  )
}

/** A frame value clamped to a 0–100% position. */
function pctOf(frame: number, op: number): number {
  return op > 0 ? Math.min(100, Math.max(0, (frame / op) * 100)) : 0
}

/** The live frame number — its own leaf so the 60fps playhead doesn't re-render
 *  the whole transport. */
function FrameReadout() {
  const frame = useGeneratePlayback((s) => s.frame)
  return <span className="text-foreground">{Math.round(frame)}</span>
}

/** Progress fill, isolated so only this tiny node re-renders each frame. */
function ProgressFill({ op }: { op: number }) {
  const frame = useGeneratePlayback((s) => s.frame)
  return <div className="absolute inset-y-0 left-0 bg-foreground rounded-full" style={{ width: `${pctOf(frame, op)}%` }} />
}

/** Playhead handle, isolated for the same reason as ProgressFill. */
function PlayheadHandle({ op }: { op: number }) {
  const frame = useGeneratePlayback((s) => s.frame)
  return (
    <span
      className="absolute top-1/2 z-10 -translate-y-1/2 -translate-x-1/2 size-3 rounded-full bg-foreground border-2 border-background shadow-sm"
      style={{ left: `${pctOf(frame, op)}%` }}
    />
  )
}

/** Clickable, draggable timeline. Click or drag anywhere to seek; keyframe
 *  markers (for the selected layer) are shown and gently snap when clicked near.
 *  The moving parts (fill, handle) live in leaf components so the timeline track
 *  and markers don't re-render on every frame. */
function Timeline({
  op, markers, disabled, onScrubStart, onSeek,
}: {
  op: number
  markers: number[]
  disabled: boolean
  onScrubStart: () => void
  onSeek: (frame: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const SNAP_PX = 6

  const frameFromClientX = (clientX: number): number => {
    const el = ref.current
    if (!el || op <= 0) return 0
    const r = el.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    let f = Math.round(ratio * op)
    // Snap to a nearby keyframe marker for precise inspection.
    for (const m of markers) {
      if (Math.abs((m / op) * r.width - ratio * r.width) <= SNAP_PX) { f = m; break }
    }
    return Math.min(op, Math.max(0, f))
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    onScrubStart()
    onSeek(frameFromClientX(e.clientX))
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragging.current) onSeek(frameFromClientX(e.clientX))
  }
  const endDrag = (e: React.PointerEvent) => {
    if (!dragging.current) return
    dragging.current = false
    e.currentTarget.releasePointerCapture?.(e.pointerId)
  }

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={cn(
        'group relative flex-1 mx-2 h-6 flex items-center select-none touch-none',
        disabled ? 'pointer-events-none opacity-60' : 'cursor-pointer',
      )}
    >
      <div className="relative w-full h-1.5 rounded-full bg-muted">
        <ProgressFill op={op} />

        {/* Keyframe markers */}
        {markers.map((m, i) => (
          <span
            key={i}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-0.5 h-2.5 rounded-full bg-foreground/30 group-hover:bg-foreground/50 transition-colors"
            style={{ left: `${op > 0 ? (m / op) * 100 : 0}%` }}
          />
        ))}

        <PlayheadHandle op={op} />
      </div>
    </div>
  )
}
