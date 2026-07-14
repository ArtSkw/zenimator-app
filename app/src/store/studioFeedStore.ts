import { create } from 'zustand'
import type { StudioEvent } from '@/engine/studio/studioClient'

/**
 * The studio activity feed — the agent's narration, de-noised tool activity,
 * and its OWN verification frames, streamed live while a job runs (plan
 * Phase 1.3). One feed per app: a new job clears the previous run.
 */

export type FeedEntry =
  | { id: number; kind: 'narration'; text: string }
  | { id: number; kind: 'status'; text: string }
  | { id: number; kind: 'preview'; dataUrl: string; file?: string }

/** Omit that distributes over unions (plain Omit collapses them). */
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never

const MAX_ENTRIES = 300

/** Tool lines worth showing; bare tool names and stderr chatter stay out. */
function denoise(text: string): string | null {
  const t = text.trim()
  if (!t || t.length > 400) return null
  if (/^(Running|Write|Edit|Reading|Studio engine|Original session|Waiting)/.test(t)) return t
  return null
}

type StudioFeedState = {
  entries: FeedEntry[]
  /** A job is currently streaming into the feed. */
  live: boolean
  expanded: boolean
  queuedPosition: number | null
  begin: () => void
  push: (e: StudioEvent) => void
  finish: () => void
  setExpanded: (v: boolean) => void
  clear: () => void
}

let nextId = 1

export const useStudioFeed = create<StudioFeedState>((set, get) => ({
  entries: [],
  live: false,
  expanded: false,
  queuedPosition: null,

  // Starts collapsed — the header's live pulse says work is happening; the
  // detail stream stays one click away so the initial screen keeps its calm.
  begin: () => set({ entries: [], live: true, expanded: false, queuedPosition: null }),

  push: (e) => {
    const { entries } = get()
    const append = (entry: DistributiveOmit<FeedEntry, 'id'>) =>
      set({ entries: [...entries.slice(-MAX_ENTRIES + 1), { id: nextId++, ...entry }] })

    if (e.type === 'narration' && e.text?.trim()) {
      append({ kind: 'narration', text: e.text.trim() })
    } else if (e.type === 'status' && e.text) {
      const t = denoise(e.text)
      const last = entries.at(-1)
      if (t && !(last?.kind === 'status' && last.text === t)) append({ kind: 'status', text: t })
    } else if (e.type === 'preview' && e.dataUrl) {
      const last = entries.at(-1)
      if (!(last?.kind === 'preview' && last.dataUrl === e.dataUrl)) {
        append({ kind: 'preview', dataUrl: e.dataUrl, file: e.file })
      }
    } else if (e.type === 'queued') {
      set({ queuedPosition: e.position ?? null })
    }
    if (e.type !== 'queued' && get().queuedPosition !== null) set({ queuedPosition: null })
  },

  finish: () => set({ live: false, expanded: false }),
  setExpanded: (expanded) => set({ expanded }),
  clear: () => set({ entries: [], live: false, expanded: false, queuedPosition: null }),
}))
