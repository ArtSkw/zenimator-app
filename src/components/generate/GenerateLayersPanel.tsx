import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGenerateStore } from '@/store/generateStore'
import { tracksSummary } from '@/engine/lottie/project'

/** Layers list for a generated project — each layer is selectable to edit its
 *  motion in the controls panel. */
export function GenerateLayersPanel() {
  const { project, selectedLayer, setSelectedLayer } = useGenerateStore()
  const layers = project?.layers ?? []

  return (
    <aside className="w-[280px] border-r border-border bg-background flex flex-col shrink-0">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Layers size={14} className="text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Layers
        </span>
        <span className="ml-auto font-mono text-xs text-muted-foreground tabular-nums">
          {layers.length}
        </span>
      </div>

      <ScrollArea
        className="flex-1 min-h-0"
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest('button')) setSelectedLayer(null)
        }}
      >
        <div className="py-1">
          {layers.map((layer, i) => (
            <button
              key={i}
              onClick={() => setSelectedLayer(selectedLayer === i ? null : i)}
              className={cn(
                'w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-muted/60',
                selectedLayer === i && 'bg-muted',
              )}
            >
              <span className="flex-1 text-sm truncate font-medium">{layer.name}</span>
              <Badge variant="outline" className="shrink-0 font-mono text-[10px] h-4 px-1.5">
                {tracksSummary(layer.tracks)}
              </Badge>
            </button>
          ))}
        </div>
      </ScrollArea>
    </aside>
  )
}
