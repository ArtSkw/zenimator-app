import { useEffect, useRef, useState } from 'react'
import { Activity, ChevronDown, ChevronUp } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useStudioFeed, type FeedEntry } from '@/store/studioFeedStore'

/**
 * The studio activity feed (plan Phase 1.3): the agent's narration, de-noised
 * tool lines, and — the trust feature — its OWN verification frames as
 * clickable thumbnails, streaming while it works. Collapsed by default (the
 * pulsing header signals progress); expandable at any time to watch the
 * stream or review how the scene was made.
 */
export function StudioFeed() {
  const { entries, live, expanded, queuedPosition, setExpanded } = useStudioFeed()
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
      : `Studio activity · ${entries.length} steps${frames > 0 ? ` · ${frames} frames` : ''}`

  return (
    <div className="rounded-2xl border border-border bg-card/60 overflow-hidden animate-in fade-in-0 duration-300">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
        aria-expanded={expanded}
      >
        <Activity
          size={13}
          className={cn('shrink-0', live ? 'text-foreground animate-pulse' : 'text-muted-foreground')}
        />
        <span className="flex-1 truncate text-xs text-muted-foreground">{summary}</span>
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
