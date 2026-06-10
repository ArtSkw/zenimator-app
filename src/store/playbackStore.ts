import { create } from 'zustand'

type PlaybackState = {
  isPlaying: boolean
  animationKey: number
  /** When true, the scene replays automatically after its longest animation
   *  ends. Has no effect on scenes that already contain infinite-iteration
   *  animations — those loop indefinitely via WAAPI on their own. */
  loop: boolean

  play: () => void
  pause: () => void
  restart: () => void
  setLoop: (loop: boolean) => void
}

export const usePlaybackStore = create<PlaybackState>((set) => ({
  isPlaying: false,
  animationKey: 0,
  loop: false,

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  restart: () => set((s) => ({ isPlaying: true, animationKey: s.animationKey + 1 })),
  setLoop: (loop) => set({ loop }),
}))
