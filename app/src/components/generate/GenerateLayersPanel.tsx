import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { SquarePen, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGenerateStore } from '@/store/generateStore'
import { useProjectsStore } from '@/store/projectsStore'
import { tracksSummary } from '@/engine/lottie/project'
import { ProjectsPanel } from '@/components/panels/ProjectsPanel'

/** Row style shared by every clickable sidebar item — an inset rounded pill,
 *  never a full-bleed bordered row. Selection = filled pill; hover = soft
 *  tint; press = solid tint (feedback on pointer-down). */
export const SIDEBAR_ITEM =
  'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors'
export const SIDEBAR_ITEM_IDLE = 'text-foreground/85 hover:bg-muted/60 active:bg-muted'
export const SIDEBAR_ITEM_ACTIVE = 'bg-muted text-foreground font-medium'

/** Quiet section label — hierarchy from typography and spacing, not chrome.
 *  Left padding aligns the label with item TEXT (container px-2.5 + item
 *  px-2.5 = 20px). */
export function SidebarSectionLabel({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-baseline justify-between px-5 pt-4 pb-1.5 shrink-0">
      <span className="text-xs font-semibold tracking-wide text-foreground/70">{title}</span>
      {count != null && (
        <span className="font-mono text-[11px] text-muted-foreground/70 tabular-nums">{count}</span>
      )}
    </div>
  )
}

/** Left sidebar: New project · Projects · Layers.
 *  Layers shows the studio scene's creative CAST — only the pieces that own
 *  live controls (rig roots, eyes, steam…), most-animated first; static
 *  fragments stay out. Legacy saves fall back to skeleton parts / project
 *  layers. */
export function GenerateLayersPanel() {
  const { project, skeleton, cast: storeCast, layerLabels, selectedLayer, setSelectedLayer, status, lottieJson, clearResult } = useGenerateStore()
  const activeProjectId = useProjectsStore((s) => s.activeProjectId)
  const setActiveProjectId = useProjectsStore((s) => s.setActiveProjectId)
  // "New project" is active on the home/initial canvas (no project open) and
  // idle once a project is loaded/generated.
  const atHome = activeProjectId === null
  const handleNewProject = () => { clearResult(); setActiveProjectId(null) }

  // Legacy skeleton path — only once the animation is complete, so the
  // (still unnamed) parts don't flash into the panel mid-generation. Rig nulls
  // (invisible transform-carriers) are hidden from the panel; we keep each part's
  // ORIGINAL index in skeleton.layers so the selection overlay still resolves it.
  const v3Layers =
    !project && skeleton && lottieJson && status === 'done'
      ? skeleton.layers.map((layer, i) => ({ layer, i })).filter(({ layer }) => layer.role !== 'rig')
      : null

  // Studio path: the persisted, stable cast (store) — kept intact across
  // control tweaks so freezing a layer never drops it from this list.
  const cast = !project && !skeleton && lottieJson && status === 'done' ? storeCast : []
  const count = v3Layers ? v3Layers.length : cast.length > 0 ? cast.length : (project?.layers.length ?? 0)

  /** Cast entries cascade in when a scene lands — 30ms stagger, capped, purely
   *  decorative (never blocks clicks). `backwards` fill keeps delayed items
   *  hidden until their turn. */
  const staggerStyle = (i: number) => ({
    animationDelay: `${Math.min(i, 8) * 30}ms`,
    animationFillMode: 'backwards' as const,
  })
  const STAGGER_IN = 'animate-in fade-in-0 slide-in-from-bottom-1 duration-200 ease-out-strong'

  return (
    <aside className="w-[280px] border-r border-border bg-background flex flex-col shrink-0">
      {/* New project — the one action item; active on the home canvas. */}
      <div className="px-2.5 pt-2.5">
        <button
          onClick={handleNewProject}
          aria-current={atHome ? 'page' : undefined}
          className={cn(SIDEBAR_ITEM, 'font-medium', atHome ? SIDEBAR_ITEM_ACTIVE : SIDEBAR_ITEM_IDLE)}
        >
          <SquarePen size={14} className="shrink-0 text-muted-foreground" />
          New project
        </button>
      </div>

      <ProjectsPanel />

      <SidebarSectionLabel title="Layers" count={count} />
      <ScrollArea
        className="flex-1 min-h-0 px-2.5 pb-2.5"
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest('button')) setSelectedLayer(null)
        }}
      >
        <div className="space-y-0.5">
          {v3Layers ? (
            v3Layers.map(({ layer, i }, order) => (
              <button
                key={layer.ind}
                onClick={() => setSelectedLayer(selectedLayer === i ? null : i)}
                style={staggerStyle(order)}
                className={cn(SIDEBAR_ITEM, STAGGER_IN, selectedLayer === i ? SIDEBAR_ITEM_ACTIVE : SIDEBAR_ITEM_IDLE)}
              >
                <Layers size={14} className="shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">
                  {sentenceCase(layerLabels[layer.nm] ?? layer.label ?? humanize(layer.nm))}
                </span>
              </button>
            ))
          ) : cast.length > 0 ? (
            cast.map((member, i) => (
              <button
                key={member.nm}
                onClick={() => setSelectedLayer(selectedLayer === i ? null : i)}
                style={staggerStyle(i)}
                className={cn(SIDEBAR_ITEM, STAGGER_IN, selectedLayer === i ? SIDEBAR_ITEM_ACTIVE : SIDEBAR_ITEM_IDLE)}
              >
                <Layers size={14} className="shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{sentenceCase(member.label)}</span>
              </button>
            ))
          ) : (project?.layers ?? []).length > 0 ? (
            (project?.layers ?? []).map((layer, i) => (
              <button
                key={i}
                onClick={() => setSelectedLayer(selectedLayer === i ? null : i)}
                className={cn(SIDEBAR_ITEM, selectedLayer === i ? SIDEBAR_ITEM_ACTIVE : SIDEBAR_ITEM_IDLE)}
              >
                <Layers size={14} className="shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{sentenceCase(layer.name)}</span>
                <Badge variant="outline" className="shrink-0 font-mono text-[10px] h-4 px-1.5">
                  {tracksSummary(layer.tracks)}
                </Badge>
              </button>
            ))
          ) : (
            <p className="px-2.5 py-1.5 text-xs italic text-muted-foreground/80">
              Layers appear once a scene is generated.
            </p>
          )}
        </div>
      </ScrollArea>
    </aside>
  )
}

function sentenceCase(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

/** Fallback display name when the agent didn't label a layer. */
function humanize(nm: string): string {
  const clean = nm.replace(/^layer_/, 'Layer ').replace(/[-_]/g, ' ').trim()
  return clean.charAt(0).toUpperCase() + clean.slice(1)
}
