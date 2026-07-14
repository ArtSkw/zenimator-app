import { create } from 'zustand'
import type { EngineStatus } from '@/engine/studio/studioClient'

/** Drives the "Connect the studio engine" modal. Opened on first load when the
 *  (remote) engine isn't reachable/authorized, and again if a generation is
 *  attempted while disconnected — so a teammate is guided to paste their token
 *  instead of watching a doomed run. */
type EngineConnectState = {
  open: boolean
  /** Why it opened: 'unauthorized' (needs/wrong token) · 'unreachable' (engine down)
   *  · null (opened manually / first-run welcome). */
  reason: EngineStatus | null
  show: (reason?: EngineStatus | null) => void
  hide: () => void
}

export const useEngineConnect = create<EngineConnectState>((set) => ({
  open: false,
  reason: null,
  show: (reason = null) => set({ open: true, reason }),
  hide: () => set({ open: false }),
}))
