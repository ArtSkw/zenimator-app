import { create } from 'zustand'
import type { Kind, Subject, Grounding } from './generateStore'

/**
 * Projects whose scene is still being authored.
 *
 * A generation takes minutes, so the project must exist the moment Generate is
 * pressed — listed, named and openable — exactly like a chat session that
 * appears before the assistant has finished answering. The run itself is owned
 * here rather than by the view that started it, so browsing to another project
 * mid-run neither cancels the job nor loses its progress: the stream keeps
 * writing here, and its result lands on the project id captured at click time
 * whatever the user is looking at when it finishes.
 *
 * Entries live only for the session. A reload drops them (the engine keeps
 * building; the scene is fetchable afterwards), which is why nothing here is
 * persisted — a half-built row surviving into the next session would be a lie.
 */
export type PendingJob = {
  /** The project id this run will become — captured before the job starts. */
  id: string
  name: string
  prompt: string
  subject: Subject
  kind: Kind
  /** The artworks this run was started FROM, snapshotted at click time. The
   *  job — not the live composer — is the source of truth for them: opening
   *  the in-flight project swaps the composer's contents, so reading them
   *  back from the store at completion would save an empty attachment list
   *  and leave the finished project unable to regenerate. */
  groundings: Grounding[]
  studioSlug: string
  startedAt: number
  /** Human status line from the engine's narration. */
  stage: string | null
  /** Set when the run failed; the row stays so the reason is readable. */
  error: string | null
  /** The user pressed Stop. The project SURVIVES as an editable draft — its
   *  brief and artwork stay put so Generate can re-run into the same project,
   *  rather than the row vanishing and dumping them back on the home screen. */
  stopped?: boolean
  /** Cancels the run (the Stop button, or deleting the row). */
  abort: () => void
}

type PendingJobsState = {
  jobs: Record<string, PendingJob>
  start: (job: PendingJob) => void
  setStage: (id: string, stage: string) => void
  setName: (id: string, name: string) => void
  fail: (id: string, error: string) => void
  /** Cancelled by the user: keep the row as an editable draft. */
  stop: (id: string) => void
  /** Run finished (or was cancelled): drop the placeholder. */
  finish: (id: string) => void
}

export const usePendingJobs = create<PendingJobsState>((set) => {
  /** Guard-then-patch one job; a stale id (row already finished) is a no-op. */
  const patch = (id: string, p: Partial<PendingJob>) =>
    set((s) => (s.jobs[id] ? { jobs: { ...s.jobs, [id]: { ...s.jobs[id], ...p } } } : s))
  return {
    jobs: {},
    start: (job) => set((s) => ({ jobs: { ...s.jobs, [job.id]: job } })),
    setStage: (id, stage) => patch(id, { stage }),
    setName: (id, name) => patch(id, { name }),
    fail: (id, error) => patch(id, { error }),
    stop: (id) => patch(id, { stopped: true, stage: null }),
    finish: (id) =>
      set((s) => {
        if (!s.jobs[id]) return s
        const { [id]: _done, ...rest } = s.jobs
        return { jobs: rest }
      }),
  }
})

/** Pending rows for the sidebar, newest first. */
export function pendingList(jobs: Record<string, PendingJob>): PendingJob[] {
  return Object.values(jobs).sort((a, b) => b.startedAt - a.startedAt)
}
