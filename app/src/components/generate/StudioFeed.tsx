import { useEffect, useRef, useState } from 'react'
import { Activity, ChevronDown, ChevronUp } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatElapsed } from '@/engine/studio/studioHeartbeat'
import { useNow } from '@/hooks/useNow'
import { useStudioFeed, useFeedChannel, type FeedEntry } from '@/store/studioFeedStore'

/**
 * The studio activity feed (plan Phase 1.3): the agent's narration, de-noised
 * tool lines, and — the trust feature — its OWN verification frames as
 * clickable thumbnails, streaming while it works. Collapsed by default (the
 * pulsing header signals progress); expandable at any time to watch the
 * stream or review how the scene was made.
 *
 * `channel` is the run this feed belongs to (the project id), so a job keeps
 * its own history while the user browses elsewhere.
 */
export function StudioFeed({ channel }: { channel: string }) {
  const { entries, startedAt, endedAt, live, expanded, queuedPosition } = useFeedChannel(channel)
  const setExpanded = useStudioFeed((s) => s.setExpanded)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Follow the newest entry while streaming (the user can still scroll up;
  // we only pin when already near the bottom).
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !live) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (nearBottom) el.scrollTop = el.scrollHeight
  }, [entries, live])

  if (entries.length === 0 && !live) return null

  const frames = entries.filter((e) => e.kind === 'preview').length
  const summary =
    queuedPosition != null
      ? `Waiting for a studio slot — position ${queuedPosition}`
      : `Studio activity · ${entries.length} step${entries.length === 1 ? '' : 's'}${frames > 0 ? ` · ${frames} frame${frames === 1 ? '' : 's'}` : ''}`

  return (
    <div className="rounded-2xl border border-border bg-card/60 overflow-hidden animate-in fade-in-0 duration-300">
      <button
        type="button"
        onClick={() => setExpanded(channel, !expanded)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
        aria-expanded={expanded}
      >
        <Activity
          size={13}
          className={cn('shrink-0', live ? 'text-foreground animate-pulse' : 'text-muted-foreground')}
        />
        <span className="flex-1 truncate text-xs text-muted-foreground">{summary}</span>
        <Elapsed startedAt={startedAt} endedAt={endedAt} live={live} />
        {expanded ? (
          <ChevronUp size={13} className="shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown size={13} className="shrink-0 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        /* Compact by design — a viewport-relative cap (not a fixed height) so
           the feed stays a peek into the work, never dominating the canvas or
           pushing the composer out of reach on small windows. */
        <div ref={scrollRef} className="max-h-[min(11rem,26dvh)] overflow-y-auto border-t border-border px-4 py-3 space-y-2 animate-in fade-in-0 slide-in-from-top-1 duration-200 ease-out-strong">
          {entries.length === 0 ? (
            <p className="text-xs text-muted-foreground">Waiting for the studio…</p>
          ) : (
            entries.map((e) => <Entry key={e.id} entry={e} onZoom={setLightbox} />)
          )}
        </div>
      )}

      {/* Lightbox for verification frames */}
      <Dialog open={lightbox !== null} onOpenChange={(open) => !open && setLightbox(null)}>
        <DialogContent className="max-w-4xl p-2">
          <DialogTitle className="sr-only">Verification frame</DialogTitle>
          {lightbox && (
            <img src={lightbox} alt="Studio verification frame" className="h-auto w-full rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

/**
 * The run's own clock, always on rather than only surfacing once the engine
 * goes quiet (the heartbeat's job) — a wait you can measure is a wait you can
 * sit through. Freezes at the finish, so it doubles as "what this scene cost".
 *
 * Its own component because it is the only thing that ticks: kept in the card,
 * a 1Hz `setNow` would re-render every feed entry (up to 300 of them, none
 * memoised) once a second to move one number.
 */
function Elapsed({ startedAt, endedAt, live }: { startedAt: number | null; endedAt: number | null; live: boolean }) {
  const now = useNow(live)
  if (startedAt === null) return null
  return (
    <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
      {formatElapsed((endedAt ?? now) - startedAt)}
    </span>
  )
}

/** Each entry eases in as it arrives — a 200ms fade+rise, so the stream reads
 *  as work happening rather than lines popping into existence. */
const ENTRY_IN = 'animate-in fade-in-0 slide-in-from-bottom-1 duration-200 ease-out-strong'

function Entry({ entry, onZoom }: { entry: FeedEntry; onZoom: (dataUrl: string) => void }) {
  if (entry.kind === 'narration') {
    return <p className={`text-[13px] leading-relaxed text-foreground/85 whitespace-pre-wrap ${ENTRY_IN}`}>{entry.text}</p>
  }
  if (entry.kind === 'status') {
    return <p className={`truncate font-mono text-[11px] text-muted-foreground ${ENTRY_IN}`}>{entry.text}</p>
  }
  return (
    <button
      type="button"
      onClick={() => onZoom(entry.dataUrl)}
      className={`block overflow-hidden rounded-lg border border-border transition-opacity hover:opacity-80 ${ENTRY_IN}`}
      title={entry.file ? `Verification frames — ${entry.file}` : 'Verification frames'}
    >
      <img src={entry.dataUrl} alt="The studio's own verification frames" className="max-h-28 w-auto" />
    </button>
  )
}
