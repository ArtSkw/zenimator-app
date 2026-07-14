import { useState, useEffect, useRef } from 'react'
import { Trash2, Clapperboard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useProjectsStore, type SavedProject } from '@/store/projectsStore'
import { useGenerateStore } from '@/store/generateStore'
import { projectHref } from '@/lib/projectUrl'
import {
  SidebarSectionLabel, SIDEBAR_ITEM, SIDEBAR_ITEM_IDLE, SIDEBAR_ITEM_ACTIVE,
} from '@/components/generate/GenerateLayersPanel'

/** Projects section of the left sidebar. Click to restore, right-click to delete. */
export function ProjectsPanel() {
  const projects = useProjectsStore((s) => s.projects)
  const activeProjectId = useProjectsStore((s) => s.activeProjectId)
  const deleteProject = useProjectsStore((s) => s.deleteProject)
  const setActiveProjectId = useProjectsStore((s) => s.setActiveProjectId)
  const loadProject = useGenerateStore((s) => s.loadProject)
  const clearResult = useGenerateStore((s) => s.clearResult)

  const [ctx, setCtx] = useState<{ x: number; y: number; id: string } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ctx) return
    const dismiss = () => setCtx(null)
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [ctx])

  const handleLoad = (p: SavedProject) => {
    loadProject({
      prompt: p.prompt ?? '',
      subject: p.subject,
      lottieJson: p.lottieJson,
      controls: p.controls,
      skeleton: p.skeleton,
      cast: p.cast ?? [],
      layerLabels: p.layerLabels,
      slotOverrides: p.slotOverrides,
      resultKind: p.resultKind,
    })
    setActiveProjectId(p.id)
  }

  const handleContextMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    setCtx({ x: e.clientX, y: e.clientY, id })
  }

  return (
    // Fixed cap (≈3–4 rows) instead of a viewport percentage — keeps Projects
    // deliberately compact so Layers, the working surface, always owns the
    // majority of the sidebar. Beyond the cap the list scrolls INSIDE (the
    // ScrollArea below) rather than pushing Layers down. `max-h-44` = 11rem.
    <div className="flex flex-col shrink-0 max-h-44">
      <SidebarSectionLabel title="Projects" count={projects.length} />

      <ScrollArea className="flex-1 min-h-0 px-2.5">
        <div className="space-y-0.5">
          {projects.length === 0 ? (
            <p className="px-2.5 py-1.5 text-xs italic text-muted-foreground/80">
              No saved projects yet.
            </p>
          ) : (
            projects.map((p) => (
              // A real <a href> — a plain click loads in place (SPA nav below),
              // but ctrl/cmd/middle-click falls through to the browser's native
              // new-tab handling, so a project can be opened in a second tab.
              <a
                key={p.id}
                href={projectHref(p.id, projects)}
                onClick={(e) => {
                  if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return // let the browser open a new tab
                  e.preventDefault()
                  handleLoad(p)
                }}
                onContextMenu={(e) => handleContextMenu(e, p.id)}
                className={cn(
                  SIDEBAR_ITEM,
                  'cursor-pointer',
                  activeProjectId === p.id ? SIDEBAR_ITEM_ACTIVE : SIDEBAR_ITEM_IDLE,
                )}
              >
                <Clapperboard size={14} className="shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{sentenceCase(p.name)}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground/70 tabular-nums">
                  {relativeTime(p.createdAt)}
                </span>
              </a>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Right-click context menu — scales in from the cursor (origin-aware),
          never from nothing. */}
      {ctx && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', left: ctx.x, top: ctx.y, zIndex: 100 }}
          className="min-w-[140px] origin-top-left rounded-lg border border-border bg-popover py-1 text-sm shadow-lg animate-in fade-in-0 zoom-in-95 duration-150 ease-out-strong"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              // Deleting the currently-open project must also leave its view —
              // otherwise the animation stays on screen with no project backing it.
              if (activeProjectId === ctx.id) clearResult()
              deleteProject(ctx.id)
              setCtx(null)
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-destructive hover:bg-muted/70 transition-colors"
          >
            <Trash2 size={13} />
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

function sentenceCase(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
