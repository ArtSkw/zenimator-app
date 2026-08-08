import { create } from 'zustand'
import type { StudioEvent } from '@/engine/studio/studioClient'

/**
 * The studio activity feed — the agent's narration, de-noised tool activity,
 * and its OWN verification frames, streamed live while a job runs (plan
 * Phase 1.3).
 *
 * Feeds are keyed by CHANNEL — the project the run belongs to — never global.
 * A run streams into its own channel whether or not the user is looking at it,
 * and navigating between projects only changes which channel is displayed. A
 * single shared feed had two failure modes that read as one bug: opening
 * another project cleared the entries, and events that arrived while the job
 * was in the background were dropped on the floor — so coming back to a
 * running job showed a feed that appeared to restart from step 1.
 */

export type FeedEntry =
  | { id: number; kind: 'narration'; text: string }
  | { id: number; kind: 'status'; text: string }
  | { id: number; kind: 'preview'; dataUrl: string; file?: string }

/** Omit that distributes over unions (plain Omit collapses them). */
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never

const MAX_ENTRIES = 300

export type FeedChannel = {
  entries: FeedEntry[]
  /** A job is currently streaming into this channel. */
  live: boolean
  expanded: boolean
  queuedPosition: number | null
  /** Monotonic tick of the last write — drives pruning, and deliberately not a
   *  clock (a counter can't go backwards or tie). */
  touched: number
}

/** How many finished feeds to keep. Entries include the agent's verification
 *  frames as data URLs, so channels are not cheap: a session that generates a
 *  dozen scenes would otherwise retain every frame of all of them. Live
 *  channels are never pruned regardless of this cap. */
const MAX_IDLE_CHANNELS = 6

/** Returned by reference for channels that have no run, so a selector never
 *  mints a new object per render (which would re-render on every store tick). */
export const EMPTY_CHANNEL: FeedChannel = { entries: [], live: false, expanded: false, queuedPosition: null, touched: 0 }

/** Runs that don't belong to a project yet — Propose from a blank composer. */
export const DRAFT_CHANNEL = 'draft'

/** Tool lines worth showing; bare tool names and stderr chatter stay out. */
function denoise(text: string): string | null {
  const t = text.trim()
  if (!t || t.length > 400) return null
  if (/^(Running|Write|Edit|Reading|Studio engine|Original session|Waiting)/.test(t)) return t
  return null
}

type StudioFeedState = {
  channels: Record<string, FeedChannel>
  begin: (channel: string) => void
  push: (channel: string, e: StudioEvent) => void
  finish: (channel: string) => void
  setExpanded: (channel: string, v: boolean) => void
  /** Drop a channel entirely — its project was deleted, or the draft channel
   *  is being reset for a fresh start. */
  clear: (channel: string) => void
}

let nextId = 1
let tick = 1

/** Drop the oldest IDLE channels past the cap. Live ones always survive — a
 *  background job must never lose the feed it is still writing to. */
function prune(channels: Record<string, FeedChannel>): Record<string, FeedChannel> {
  const idle = Object.entries(channels).filter(([, c]) => !c.live)
  if (idle.length <= MAX_IDLE_CHANNELS) return channels
  const doomed = idle
    .sort((a, b) => a[1].touched - b[1].touched)
    .slice(0, idle.length - MAX_IDLE_CHANNELS)
  const out = { ...channels }
  for (const [id] of doomed) delete out[id]
  return out
}

export const useStudioFeed = create<StudioFeedState>((set, get) => {
  const patch = (channel: string, p: Partial<FeedChannel>) =>
    set((s) => ({
      channels: {
        ...s.channels,
        [channel]: { ...(s.channels[channel] ?? EMPTY_CHANNEL), ...p, touched: tick++ },
      },
    }))

  /** Patch a channel and collect stale ones. Used at the two moments the set
   *  of idle channels can grow — a run starting, and a run ending — so the cap
   *  is an actual invariant rather than something enforced a step late. */
  const patchAndPrune = (channel: string, p: Partial<FeedChannel>) =>
    set((s) => ({
      channels: prune({
        ...s.channels,
        [channel]: { ...(s.channels[channel] ?? EMPTY_CHANNEL), ...p, touched: tick++ },
      }),
    }))

  return {
    channels: {},

    // Starts collapsed — the header's live pulse says work is happening; the
    // detail stream stays one click away so the initial screen keeps its calm.
    begin: (channel) =>
      patchAndPrune(channel, { entries: [], live: true, expanded: false, queuedPosition: null }),

    push: (channel, e) => {
      const current = get().channels[channel] ?? EMPTY_CHANNEL
      const { entries } = current
      const append = (entry: DistributiveOmit<FeedEntry, 'id'>) =>
        patch(channel, { entries: [...entries.slice(-MAX_ENTRIES + 1), { id: nextId++, ...entry }] })

      if (e.type === 'queued') {
        patch(channel, { queuedPosition: e.position ?? null })
        return
      }
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
      }
      // Any non-queued event means the job left the queue.
      if (current.queuedPosition !== null) patch(channel, { queuedPosition: null })
    },

    finish: (channel) => patchAndPrune(channel, { live: false, expanded: false }),
    setExpanded: (channel, expanded) => patch(channel, { expanded }),

    clear: (channel) =>
      set((s) => {
        if (!s.channels[channel]) return s
        const { [channel]: _gone, ...rest } = s.channels
        return { channels: rest }
      }),
  }
})

/** The feed for one channel — a stable empty channel when it has no run. */
export function useFeedChannel(channel: string | null | undefined): FeedChannel {
  return useStudioFeed((s) => (channel ? s.channels[channel] ?? EMPTY_CHANNEL : EMPTY_CHANNEL))
}

/** The channel a run belongs to: its project, or the draft channel for work
 *  that has no project yet (Propose from a blank composer). */
export const feedChannelFor = (projectId: string | null | undefined): string => projectId ?? DRAFT_CHANNEL
