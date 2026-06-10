import { Button } from '@/components/ui/button'
import { Play, Pause, RotateCcw, Repeat } from 'lucide-react'
import { useGeneratePlayback } from '@/store/generatePlaybackStore'

/**
 * Footer transport for the generated Lottie preview. Drives the live Skottie
 * engine through the controls the player attaches to the playback bridge.
 */
export function GenerateTransport() {
  const { controls, isPlaying, loop, frame, total, setLoop } = useGeneratePlayback()
  const pct = total > 0 ? Math.min(100, (frame / total) * 100) : 0
  const disabled = !controls

  const toggleLoop = () => {
    const next = !loop
    controls?.setLoop(next)
    setLoop(next)
  }

  return (
    <footer className="h-16 border-t border-border bg-background flex items-center gap-3 px-5 shrink-0">
      <Button
        variant="ghost"
        size="icon"
        className="size-8 rounded-full"
        disabled={disabled}
        onClick={() => controls?.toggle()}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause size={14} /> : <Play size={14} />}
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="size-8 rounded-full"
        disabled={disabled}
        onClick={() => controls?.replay()}
        title="Play again from the start"
      >
        <RotateCcw size={14} />
      </Button>

      <Button
        variant={loop ? 'default' : 'ghost'}
        size="icon"
        className="size-8 rounded-full"
        disabled={disabled}
        onClick={toggleLoop}
        aria-pressed={loop}
        title={loop ? 'Looping — click to play once' : 'Play once — click to loop'}
      >
        <Repeat size={14} />
      </Button>

      <div className="flex-1 mx-2 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-foreground rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </footer>
  )
}
