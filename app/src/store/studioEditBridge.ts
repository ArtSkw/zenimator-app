import { create } from 'zustand'

/**
 * A tiny bridge between GenerateView (which owns the studio session, feed,
 * abort, and save-back) and panels in other subtrees. Currently: the History
 * panel calls `revert`, and reads `applying` to disable itself mid-run.
 */

type StudioEditBridge = {
  /** Restore a scene version — set by GenerateView, called by the History panel. */
  revert: ((version: number) => void) | null
  /** Mirrors GenerateView's applying state for cross-tree consumers. */
  applying: boolean
  setRevert: (fn: StudioEditBridge['revert']) => void
  setApplying: (v: boolean) => void
}

export const useStudioEditBridge = create<StudioEditBridge>((set) => ({
  revert: null,
  applying: false,
  setRevert: (revert) => set({ revert }),
  setApplying: (applying) => set({ applying }),
}))
