import { useState } from 'react'
import { X } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { Grounding } from '@/store/generateStore'

/** Move `from` to `to`, returning a new array (state is never mutated). */
function moved<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  next.splice(to, 0, ...next.splice(from, 1))
  return next
}

type Props = {
  items: Grounding[]
  onChange: (next: Grounding[]) => void
  /** True while a job streams — the strip stays readable but stops accepting edits. */
  disabled?: boolean
}

/** Source artworks in STORY ORDER (sequence briefs, §3.8).
 *
 *  The strip lives at the TOP of the composer, above the prompt: attachments
 *  are content, so they must never push the axes or Generate around as they
 *  accumulate. Thumbnails carry the identity (filename on hover only), the
 *  ordinal badge carries the sequence the engine will animate, and a tile can
 *  be dragged — or Alt+←/→'d — to re-sequence the story.
 */
export function AttachmentStrip({ items, onChange, disabled }: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  if (!items.length) return null
  // Ordinals only appear once there's a sequence to read — a lone artwork has
  // no story order, and a "1" badge on it would be noise.
  const multi = items.length > 1

  return (
    <TooltipProvider>
      {/* pt-2.5 + the list's py-1.5 = the same 16px the card gives the tiles on
          the left, so the top-left corner reads as evenly inset. */}
      <div className="group/strip flex items-center gap-3 px-4 pt-2.5">
        {/* px-1/-mx-1: the scroll box would otherwise clip the focus ring off
            the first and last tiles. py-1.5 does the same for top/bottom. */}
        <ul
          role="list"
          aria-label="Attached artworks in story order"
          className="-mx-1 flex flex-1 items-center gap-2 overflow-x-auto px-1 py-1.5"
        >
          {items.map((g, i) => (
            <li key={g.id} className="shrink-0">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <div
                      draggable={!disabled}
                      tabIndex={0}
                      role="button"
                      aria-label={multi ? `${g.name} - ${i + 1} of ${items.length}` : g.name}
                      onDragStart={(e) => {
                        setDragIndex(i)
                        e.dataTransfer.effectAllowed = 'move'
                        // Private type — the composer's drop-to-attach zone tests for
                        // 'Files' and so ignores an in-strip re-sequence.
                        e.dataTransfer.setData('application/x-zen-attachment', String(i))
                      }}
                      onDragOver={(e) => {
                        if (dragIndex === null) return
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                        // Live reorder: tiles are uniform width, so moving the dragged
                        // item under the cursor can't thrash the way variable-size rows do.
                        if (dragIndex === i) return
                        onChange(moved(items, dragIndex, i))
                        setDragIndex(i)
                      }}
                      onDrop={(e) => {
                        // Only swallow OUR re-sequence drop; a file dropped on a
                        // tile must keep bubbling to the composer's attach zone.
                        if (dragIndex === null) return
                        e.preventDefault()
                        e.stopPropagation()
                        setDragIndex(null)
                      }}
                      onDragEnd={() => setDragIndex(null)}
                      onKeyDown={(e) => {
                        const back = e.key === 'ArrowLeft'
                        const fwd = e.key === 'ArrowRight'
                        if ((back || fwd) && (e.altKey || e.metaKey)) {
                          e.preventDefault()
                          const to = i + (fwd ? 1 : -1)
                          // Focus rides the DOM node (keys are stable ids), so the
                          // moved tile stays selected for a second nudge.
                          if (to >= 0 && to < items.length) onChange(moved(items, i, to))
                        } else if (e.key === 'Backspace' || e.key === 'Delete') {
                          e.preventDefault()
                          onChange(items.filter((_, j) => j !== i))
                        }
                      }}
                      className={cn(
                        'group/tile relative size-14 rounded-lg border border-border bg-white p-1.5',
                        'animate-in fade-in-0 zoom-in-95 duration-200 ease-out-strong',
                        'outline-none transition-[box-shadow,opacity,transform]',
                        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
                        disabled
                          ? 'cursor-default opacity-60'
                          : 'cursor-grab hover:shadow-sm active:cursor-grabbing',
                        dragIndex === i && 'scale-95 opacity-40',
                      )}
                    >
                      {/* draggable=false: without it the browser drags the image
                          itself and the tile's own drag never starts. */}
                      <img src={g.pngDataUrl} alt="" draggable={false} className="pointer-events-none size-full object-contain" />

                      {multi && (
                        <span
                          aria-hidden
                          className="absolute left-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-foreground font-mono text-[9px] font-medium tabular-nums leading-none text-background ring-2 ring-card"
                        >
                          {i + 1}
                        </span>
                      )}

                      {!disabled && (
                        <button
                          type="button"
                          onClick={() => onChange(items.filter((_, j) => j !== i))}
                          aria-label={`Remove ${g.name}`}
                          className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-foreground text-background opacity-0 outline-none ring-2 ring-card transition-opacity duration-150 hover:bg-foreground/80 focus-visible:opacity-100 group-hover/tile:opacity-100"
                        >
                          <X size={9} strokeWidth={3} />
                        </button>
                      )}
                    </div>
                  }
                />
                <TooltipContent side="top">
                  <span className="font-mono text-[11px]">{g.name}</span>
                </TooltipContent>
              </Tooltip>
            </li>
          ))}
        </ul>

        {/* Discoverability without clutter: the re-sequence affordance is
            invisible until the strip is hovered, and only when order matters. */}
        {multi && !disabled && (
          <span className="shrink-0 text-[10px] text-muted-foreground opacity-0 transition-opacity duration-200 group-hover/strip:opacity-100">
            Drag to re-sequence
          </span>
        )}
      </div>
    </TooltipProvider>
  )
}
