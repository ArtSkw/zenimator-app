import { create } from 'zustand'

export type GenStatus = 'idle' | 'generating' | 'done' | 'error'

/** An optional reference SVG used to ground generation. */
export type Grounding = { name: string; svgText: string; pngDataUrl: string }

type GenerateState = {
  /** Whether the generate lane (prompt → Lottie) is the active surface. */
  active: boolean
  prompt: string
  grounding: Grounding | null
  /** The generated Lottie document as a JSON string, or null. */
  lottieJson: string | null
  status: GenStatus
  /** Sub-stage label shown while generating (e.g. "Refining motion…"). */
  stage: string | null
  error: string | null

  setActive: (v: boolean) => void
  setPrompt: (p: string) => void
  setGrounding: (g: Grounding | null) => void
  startGenerating: () => void
  setStage: (s: string) => void
  setResult: (json: string) => void
  setError: (msg: string) => void
  clearResult: () => void
}

/**
 * State for the generate lane. Deliberately separate from sceneStore — a
 * generated Lottie is not a Scene (no groups/SVG model), so it lives in its
 * own parallel surface and never touches the SVG pipeline.
 */
export const useGenerateStore = create<GenerateState>((set) => ({
  active: false,
  prompt: '',
  grounding: null,
  lottieJson: null,
  status: 'idle',
  stage: null,
  error: null,

  setActive: (active) => set({ active }),
  setPrompt: (prompt) => set({ prompt }),
  setGrounding: (grounding) => set({ grounding }),
  startGenerating: () => set({ status: 'generating', stage: null, error: null }),
  setStage: (stage) => set({ stage }),
  setResult: (lottieJson) => set({ lottieJson, status: 'done', stage: null, error: null }),
  setError: (error) => set({ status: 'error', stage: null, error }),
  clearResult: () => set({ lottieJson: null, status: 'idle', stage: null, error: null }),
}))
