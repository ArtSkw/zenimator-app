import { create } from 'zustand'

/** Imperative controls the footer transport calls on the live Skottie preview. */
export type SkottieControls = {
  play: () => void
  pause: () => void
  toggle: () => void
  /** Seek to frame 0 and play — "play it once more" for entry animations. */
  replay: () => void
  setLoop: (loop: boolean) => void
}

type GeneratePlaybackState = {
  controls: SkottieControls | null
  isPlaying: boolean
  loop: boolean
  frame: number
  total: number

  attach: (controls: SkottieControls, loop: boolean) => void
  detach: () => void
  setPlaying: (playing: boolean) => void
  setProgress: (frame: number, total: number) => void
  setLoop: (loop: boolean) => void
}

/**
 * Bridges the Skottie preview engine (owned by the SkottiePlayer component) to
 * the footer TransportBar, which lives in a different part of the tree. The
 * player attaches its controls on mount; the transport reads state and drives
 * playback through them.
 */
export const useGeneratePlayback = create<GeneratePlaybackState>((set) => ({
  controls: null,
  isPlaying: false,
  loop: true,
  frame: 0,
  total: 0,

  attach: (controls, loop) => set({ controls, loop }),
  detach: () => set({ controls: null, isPlaying: false, frame: 0, total: 0 }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setProgress: (frame, total) => set({ frame, total }),
  setLoop: (loop) => set({ loop }),
}))
