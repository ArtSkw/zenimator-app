import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval'
import type { Kind, Subject, Grounding } from './generateStore'

/**
 * IndexedDB-backed storage for the projects store. localStorage caps around
 * ~5 MB, which two big scenes already flirt with — past it, `setItem` throws
 * and saves silently stop persisting. IndexedDB has no such practical cap.
 *
 * Migration is transparent and loss-safe: the first read finds IDB empty,
 * pulls the value from the old localStorage slot, copies it into IDB, and only
 * then drops the localStorage copy — so a failed IDB write leaves the original
 * untouched. After migration, everything lives in IDB.
 */
const idbStorage: StateStorage = {
  getItem: async (name) => {
    const existing = await idbGet(name)
    if (existing != null) return existing as string
    if (typeof localStorage !== 'undefined') {
      const legacy = localStorage.getItem(name)
      if (legacy != null) {
        await idbSet(name, legacy) // copy into IDB first…
        localStorage.removeItem(name) // …then retire the old slot (never before)
        return legacy
      }
    }
    return null
  },
  setItem: async (name, value) => { await idbSet(name, value) },
  removeItem: async (name) => { await idbDel(name) },
}
import type { Skeleton } from '@/engine/legacy/skeleton'
import type { CastMember } from '@/engine/controls/cast'
import type { ControlManifest } from '@/engine/controls/deriveControls'

export type SavedProject = {
  id: string
  name: string
  prompt: string
  /** The composer axes the scene was made with — restored so the setup
   *  reflects the project (e.g. a Loop stays Loop) instead of resetting. */
  subject?: Subject
  /** The source artworks this project was generated FROM, in story order —
   *  restored into the composer on load so Edit setup shows (and Regenerate
   *  uses) THIS project's files, never whatever the session last attached.
   *  Absent on legacy saves → the composer shows none. */
  groundings?: Grounding[]
  lottieJson: string
  controls: ControlManifest | null
  /** The agent's raw controls.json — slot autoFit specs (padding/min/max)
   *  exist only here. Absent on legacy saves. */
  agentControlsJson?: string | null
  /** LEGACY loads only — new studio saves write null. */
  skeleton: Skeleton | null
  /** The curated layer list, frozen at generation and kept stable across edits
   *  (see generateStore `cast`). Absent on legacy saves → derived on load. */
  cast?: CastMember[]
  layerLabels: Record<string, string>
  slotOverrides: Record<string, unknown>
  resultKind: Kind | null
  createdAt: number
  /** LEGACY: the retired in-browser engine's motion program. Never written by
   *  new saves; kept optional so old localStorage payloads still parse. */
  programSource?: string | null
  /** Workbench project slug when the scene was made by the STUDIO engine
   *  (headless Claude Code in workbench/) — chat edits resume that session. */
  studioSlug?: string | null
  /** Conventional path of the scene's learnings doc in the workbench
   *  (docs/<slug>-animation.md) — surfaced as the dossier in Phase 2. */
  sceneDoc?: string | null
  /** Epoch ms of the last studio session activity for this scene. */
  sessionAt?: number | null
  /** The canvas fill this scene is VIEWED against, [r,g,b,a] 0..1. A viewing
   *  preference only — it is never part of the document, so every export still
   *  ships the animation on transparency. Absent = follow the theme. */
  canvasBg?: [number, number, number, number] | null
}

/**
 * Newest first, by the timestamp the rows actually SHOW.
 *
 * The list used to be in write order, which quietly stopped meaning "newest":
 * a project's `createdAt` is minted once at generation and never re-derived,
 * while a save moves it to the front — and plenty of saves have nothing to do
 * with the user. A chat edit, a finished background run, the controls-spec
 * sync that fires on merely OPENING a scene: each shuffled an old project to
 * the top while its row went on reading "23d ago". Ordering by the same number
 * the row prints is what makes the list legible.
 */
const byNewest = (list: SavedProject[]): SavedProject[] =>
  [...list].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))

type ProjectsState = {
  projects: SavedProject[]
  activeProjectId: string | null
  /** `activate: false` saves WITHOUT stealing focus — a background run that
   *  finishes while the user is reading another project must not yank their
   *  view to the one that just landed. */
  saveProject: (p: SavedProject, opts?: { activate?: boolean }) => void
  updateProject: (id: string, patch: Partial<Pick<SavedProject, 'name' | 'lottieJson' | 'slotOverrides' | 'groundings' | 'canvasBg'>>) => void
  deleteProject: (id: string) => void
  setActiveProjectId: (id: string | null) => void
}

export const useProjectsStore = create<ProjectsState>()(
  persist(
    (set) => ({
      projects: [],
      activeProjectId: null,

      saveProject: (p, opts) =>
        set((s) => {
          const filtered = s.projects.filter((x) => x.id !== p.id)
          // Keep the 10 newest projects — the engine's own re-saves must not
          // decide which one falls off the end.
          return {
            projects: byNewest([p, ...filtered]).slice(0, 10),
            activeProjectId: opts?.activate === false ? s.activeProjectId : p.id,
          }
        }),

      updateProject: (id, patch) =>
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),

      deleteProject: (id) =>
        set((s) => ({
          projects: s.projects.filter((x) => x.id !== id),
          activeProjectId: s.activeProjectId === id ? null : s.activeProjectId,
        })),

      setActiveProjectId: (id) => set({ activeProjectId: id }),
    }),
    {
      name: 'zenimator.projects',
      storage: createJSONStorage(() => idbStorage),
      // Don't persist activeProjectId — on reload nothing should appear pre-selected.
      partialize: (s) => ({ projects: s.projects }),
      // Sort on the way IN as well: lists persisted before the rule above was
      // in place come back in write order, and a user should not have to save
      // something to see their projects straighten out.
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<ProjectsState>),
        projects: byNewest(((persisted as Partial<ProjectsState>)?.projects ?? []) as SavedProject[]),
      }),
    },
  ),
)
