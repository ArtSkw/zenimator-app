import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Play, Pause, RotateCcw, Pencil } from 'lucide-react'
import { usePlaybackStore } from '@/store/playbackStore'
import { useSceneStore } from '@/store/sceneStore'
import { getSceneDuration, formatDuration } from '@/engine/scene/timing'

const MIN_DURATION_S = 0.5
const MAX_DURATION_S = 10

export function TransportBar() {
  const { isPlaying, animationKey, play, pause, restart } = usePlaybackStore()
  const { scene, scaleAnimationDuration } = useSceneStore()
  const disabled = !scene
  const [progressFilled, setProgressFilled] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Flip back to "Play" when the scene's longest track ends.
  useEffect(() => {
    if (!isPlaying || !scene) return
    const timer = window.setTimeout(() => pause(), getSceneDuration(scene))
    return () => window.clearTimeout(timer)
  }, [isPlaying, animationKey, scene, pause])

  // Snap bar to 0, then animate to 100% over the real scene duration.
  // Double RAF ensures the 0% paint is committed before the fill starts;
  // a single RAF can be batched with the reset into the same frame.
  useEffect(() => {
    if (!isPlaying) return
    setProgressFilled(false)
    let raf2: number
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setProgressFilled(true))
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [isPlaying, animationKey])

  // Focus + select all when edit mode opens.
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const openEdit = () => {
    if (!scene) return
    setDraft((getSceneDuration(scene) / 1000).toFixed(1))
    setEditing(true)
  }

  const commitEdit = () => {
    const secs = parseFloat(draft)
    if (!isNaN(secs) && secs >= MIN_DURATION_S && secs <= MAX_DURATION_S) {
      scaleAnimationDuration(Math.round(secs * 1000))
      restart()
    }
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commitEdit()
    if (e.key === 'Escape') setEditing(false)
  }

  const sceneDuration = scene ? getSceneDuration(scene) : 0

  return (
    <footer className="h-16 border-t border-border bg-background flex items-center gap-3 px-5 shrink-0">
      {isPlaying ? (
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-full"
          disabled={disabled}
          onClick={pause}
        >
          <Pause size={14} />
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-full"
          disabled={disabled}
          onClick={play}
        >
          <Play size={14} />
        </Button>
      )}

      <Button
        variant="ghost"
        size="icon"
        className="size-8 rounded-full"
        disabled={disabled}
        onClick={restart}
      >
        <RotateCcw size={14} />
      </Button>

      <div className="flex-1 mx-2 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-foreground rounded-full transition-all duration-100"
          style={{
            width: progressFilled ? '100%' : '0%',
            transitionDuration: progressFilled ? `${sceneDuration}ms` : '0ms',
          }}
        />
      </div>

      {/* Click-to-edit total duration */}
      {editing ? (
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            type="number"
            min={MIN_DURATION_S}
            max={MAX_DURATION_S}
            step={0.1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            className="w-16 h-7 rounded-md border border-input bg-background px-2 font-mono text-xs text-right tabular-nums shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="font-mono text-xs text-muted-foreground">s</span>
        </div>
      ) : (
        <button
          onClick={openEdit}
          disabled={!scene}
          title={scene ? 'Click to change total duration' : undefined}
          className="flex items-center gap-2 font-mono text-xs tabular-nums px-1.5 py-0.5 rounded transition-colors disabled:text-muted-foreground disabled:pointer-events-none text-foreground hover:bg-muted group"
        >
          {scene ? formatDuration(sceneDuration) : '0:00'}
          {scene && <Pencil size={12} className="text-muted-foreground group-hover:text-foreground transition-colors" />}
        </button>
      )}
    </footer>
  )
}
