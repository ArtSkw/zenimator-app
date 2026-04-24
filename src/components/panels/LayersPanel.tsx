import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Layers, AlertTriangle, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSceneStore } from '@/store/sceneStore'
import type { AnimatableGroup, GroupTag } from '@/engine/scene/types'

const TAG_LABELS: Record<GroupTag, string> = {
  icon: 'icon',
  illustration: 'illus',
  text: 'text',
  'list-item': 'list',
  button: 'btn',
  card: 'card',
  background: 'bg',
  decoration: 'decor',
  'whole-image': 'image',
  unknown: '?',
}

function GroupRow({
  group,
  selected,
  onSelect,
}: {
  group: AnimatableGroup
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors',
        'hover:bg-muted/60 focus-visible:outline-none focus-visible:bg-muted',
        selected && 'bg-muted',
      )}
      title={group.warning ?? group.rationale}
    >
      <span className="flex-1 text-sm truncate font-medium flex items-center gap-1.5">
        {group.label}
        {group.warning && (
          <AlertTriangle size={11} className="text-amber-600 shrink-0" />
        )}
      </span>
      <Badge variant="outline" className="shrink-0 font-mono text-[10px] h-4 px-1.5">
        {TAG_LABELS[group.tag]}
      </Badge>
    </button>
  )
}

export function LayersPanel() {
  const { scene, selectedGroupId, selectGroup } = useSceneStore()

  return (
    <aside className="w-[280px] border-r border-border bg-background flex flex-col shrink-0">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Layers size={14} className="text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Layers
        </span>
        {scene && (
          <div className="ml-auto flex items-center gap-1.5">
            {scene.groupingSource === 'llm' && (
              <Sparkles size={11} className="text-muted-foreground" />
            )}
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {scene.groups.length}
            </span>
          </div>
        )}
      </div>

      <ScrollArea
        className="flex-1"
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest('button')) selectGroup(null)
        }}
      >
        {scene ? (
          <div className="py-1">
            {scene.groups.map((group) => (
              <GroupRow
                key={group.id}
                group={group}
                selected={selectedGroupId === group.id}
                onSelect={() => selectGroup(selectedGroupId === group.id ? null : group.id)}
              />
            ))}
          </div>
        ) : (
          <Empty className="py-10 border-none">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Layers />
              </EmptyMedia>
              <EmptyTitle>No file loaded</EmptyTitle>
              <EmptyDescription>Upload an SVG file to see groups here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </ScrollArea>

      {scene?.groupingSource === 'heuristic' && (
        <div className="border-t border-border px-4 py-2.5 bg-amber-50 text-amber-900">
          <p className="text-[11px] leading-snug flex items-start gap-1.5">
            <AlertTriangle size={11} className="shrink-0 mt-0.5" />
            <span>
              Using heuristic fallback grouping. Set a Claude API key in Settings
              for semantic grouping.
            </span>
          </p>
        </div>
      )}
    </aside>
  )
}
