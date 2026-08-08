import { useState, useEffect, useRef } from 'react'
import { Trash2, Clapperboard, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useProjectsStore, type SavedProject } from '@/store/projectsStore'
import { useGenerateStore } from '@/store/generateStore'
import { usePendingJobs, pendingList } from '@/store/pendingJobsStore'
import { projectHref } from '@/lib/projectUrl'
import {
  SidebarSectionLabel, SIDEBAR_ITEM, SIDEBAR_ITEM_IDLE, SIDEBAR_ITEM_ACTIVE,
} from '@/components/generate/GenerateLayersPanel'

/** Projects section of the left sidebar. Click to restore, right-click to delete. */
export function ProjectsPanel() {
  const projects = useProjectsStore((s) => s.projects)
  const activeProjectId = useProjectsStore((s) => s.activeProjectId)
  // Runs in flight appear as real rows the moment Generate is pressed, so a
  // multi-minute build is browsable instead of invisible. A pending row for a
  // project that ALSO has a saved scene (a regenerate) isn't listed twice —
  // the saved row carries the working indicator instead.
  const jobs = usePendingJobs((s) => s.jobs)
  const savedIds = new Set(projects.map((p) => p.id))
  const pending = pendingList(jobs).filter((j) => !savedIds.has(j.id))
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
      groundings: p.groundings,
      lottieJson: p.lottieJson,
      controls: p.controls,
      agentControlsJson: p.agentControlsJson,
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
      <SidebarSectionLabel title="Projects" count={projects.length + pending.length} />

      <ScrollArea className="flex-1 min-h-0 px-2.5">
        <div className="space-y-0.5">
          {/* Still building: openable, cancellable, and never lost by
              navigating away — the run lives in the store, not this view. */}
          {pending.map((job) => (
            <button
              key={job.id}
              onClick={() => {
                // Adopt the job's own setup and drop the previously-open
                // scene — otherwise the canvas keeps showing the last
                // project's animation under this project's name.
                useGenerateStore.getState().openPendingJob(job)
                setActiveProjectId(job.id)
              }}
              onContextMenu={(e) => handleContextMenu(e, job.id)}
              className={cn(
                SIDEBAR_ITEM,
                'w-full cursor-pointer text-left',
                activeProjectId === job.id ? SIDEBAR_ITEM_ACTIVE : SIDEBAR_ITEM_IDLE,
              )}
            >
              {job.error ? (
                <AlertCircle size={14} className="shrink-0 text-destructive" />
              ) : job.stopped ? (
                // A stopped run is a draft waiting to be re-run — no pulse,
                // because nothing is happening.
                <Clapperboard size={14} className="shrink-0 text-muted-foreground" />
              ) : (
                <WorkingDot />
              )}
              <span className="flex-1 truncate">{sentenceCase(job.name)}</span>
              <span className="shrink-0 text-[10px] text-muted-foreground/70">
                {job.error ? 'failed' : job.stopped ? 'draft' : 'working'}
              </span>
            </button>
          ))}
          {projects.length === 0 && pending.length === 0 ? (
            <p className="px-2.5 py-1.5 text-xs italic text-muted-foreground/80">
              No saved projects yet.
            </p>
          ) : (
            projects.map((p) => {
              // A regenerate reuses this row (same id), so the row itself
              // carries the working state rather than a duplicate below.
              const running = !!jobs[p.id] && !jobs[p.id].error && !jobs[p.id].stopped
              return (
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
                  {running ? <WorkingDot /> : <Clapperboard size={14} className="shrink-0 text-muted-foreground" />}
                  <span className="flex-1 truncate">{sentenceCase(p.name)}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground/70 tabular-nums">
                    {running ? 'working' : relativeTime(p.createdAt)}
                  </span>
                </a>
              )
            })
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
              // A pending row is a run, not a saved scene: cancel it and drop
              // the placeholder rather than calling deleteProject on an id
              // that was never saved.
              const job = usePendingJobs.getState().jobs[ctx.id]
              if (job) {
                if (!job.stopped && !job.error) job.abort()
                usePendingJobs.getState().finish(ctx.id)
                if (activeProjectId === ctx.id) { clearResult(); setActiveProjectId(null) }
                setCtx(null)
                return
              }
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

/** The pulsing "engine is on this" dot — same mark for pending and saved rows. */
function WorkingDot() {
  return (
    <span className="relative flex size-3.5 shrink-0 items-center justify-center">
      <span className="absolute inline-flex size-2 animate-ping rounded-full bg-foreground/40" />
      <span className="relative inline-flex size-1.5 rounded-full bg-foreground" />
    </span>
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
