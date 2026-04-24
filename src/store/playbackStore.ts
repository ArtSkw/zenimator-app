import { create } from 'zustand'

type PlaybackState = {
  isPlaying: boolean
  animationKey: number

  play: () => void
  pause: () => void
  restart: () => void
}

export const usePlaybackStore = create<PlaybackState>((set) => ({
  isPlaying: false,
  animationKey: 0,

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  restart: () => set((s) => ({ isPlaying: true, animationKey: s.animationKey + 1 })),
}))
