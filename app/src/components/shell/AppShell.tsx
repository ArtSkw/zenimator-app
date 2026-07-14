import { useEffect } from 'react'
import { TopBar } from './TopBar'
import { TransportBar } from './TransportBar'
import { LayersPanel } from '@/components/panels/LayersPanel'
import { ControlsPanel } from '@/components/panels/ControlsPanel'
import { PreviewCanvas } from '@/components/panels/PreviewCanvas'
import { useProjectsStore } from '@/store/projectsStore'
import { useGenerateStore } from '@/store/generateStore'
import { readProjectSlugFromUrl, findProjectIdBySlug, syncProjectUrl } from '@/lib/projectUrl'

export function AppShell() {
  // Cold-load bootstrap: if the URL names a project (?project=<slug>), restore
  // it — this is what lets a bookmarked/shared/second-tab URL open straight
  // into that project instead of the empty state.
  useEffect(() => {
    const slug = readProjectSlugFromUrl()
    if (!slug) return

    const restore = () => {
      const projects = useProjectsStore.getState().projects
      const id = findProjectIdBySlug(slug, projects)
      const project = id ? projects.find((p) => p.id === id) : null
      if (!project) { syncProjectUrl(null, projects); return }
      useGenerateStore.getState().loadProject({
        prompt: project.prompt ?? '',
        subject: project.subject,
        lottieJson: project.lottieJson,
        controls: project.controls,
        skeleton: project.skeleton,
        cast: project.cast ?? [],
        layerLabels: project.layerLabels,
        slotOverrides: project.slotOverrides,
        resultKind: project.resultKind,
      })
      useProjectsStore.getState().setActiveProjectId(project.id)
    }

    // localStorage rehydration is synchronous in practice, but guard the async
    // persist API contract rather than assume timing.
    if (useProjectsStore.persist.hasHydrated()) restore()
    else return useProjectsStore.persist.onFinishHydration(restore)
  }, [])

  // Keep the URL in sync with whichever project is active from here on —
  // covers loading a project, a fresh generation auto-saving one, resetting to
  // the empty state (logo click), and deleting the currently-open project.
  const activeProjectId = useProjectsStore((s) => s.activeProjectId)
  const projects = useProjectsStore((s) => s.projects)
  useEffect(() => { syncProjectUrl(activeProjectId, projects) }, [activeProjectId, projects])

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        <LayersPanel />
        <PreviewCanvas />
        <ControlsPanel />
      </div>

      <TransportBar />
    </div>
  )
}
