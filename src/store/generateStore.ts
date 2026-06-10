import { create } from 'zustand'

export type GenStatus = 'idle' | 'generating' | 'done' | 'error'

/** An optional reference SVG used to ground generation. */
export type Grounding = { name: string; svgText: string; pngDataUrl: string }

/** The three property axes that configure a generation (Phase B). */
export type Subject = 'illustration' | 'screen'
export type Kind = 'entry' | 'loop'
export type Method = 'manual' | 'auto'

type GenerateState = {
  /** Whether the generate lane is the active surface (the default landing). */
  active: boolean
  /** What's being animated — a single illustration or a whole screen. */
  subject: Subject
  /** Entry = play once then hold; Loop = continuous motion. */
  kind: Kind
  /** Manual = describe it; Auto = propose from the SVG alone. */
  method: Method
  prompt: string
  grounding: Grounding | null
  /** The generated Lottie document as a JSON string, or null. */
  lottieJson: string | null
  /** Signature of the properties the current result was generated with; used to
   *  detect when the user has changed properties and a regenerate is needed. */
  resultSignature: string | null
  /** The Kind the current result was generated with — drives the preview's
   *  loop/hold behaviour, independent of the live Kind selector so toggling it
   *  never disturbs the running preview. */
  resultKind: Kind | null
  status: GenStatus
  /** Sub-stage label shown while generating (e.g. "Refining motion…"). */
  stage: string | null
  error: string | null

  setActive: (v: boolean) => void
  setSubject: (s: Subject) => void
  setKind: (k: Kind) => void
  setMethod: (m: Method) => void
  setPrompt: (p: string) => void
  setGrounding: (g: Grounding | null) => void
  startGenerating: () => void
  setStage: (s: string) => void
  setResult: (json: string, signature: string, kind: Kind) => void
  setError: (msg: string) => void
  clearResult: () => void
}

/**
 * State for the generate lane. Deliberately separate from sceneStore — a
 * generated Lottie is not a Scene (no groups/SVG model), so it lives in its
 * own parallel surface and never touches the SVG pipeline.
 */
export const useGenerateStore = create<GenerateState>((set) => ({
  active: true,
  subject: 'illustration',
  kind: 'entry',
  method: 'manual',
  prompt: '',
  grounding: null,
  lottieJson: null,
  resultSignature: null,
  resultKind: null,
  status: 'idle',
  stage: null,
  error: null,

  setActive: (active) => set({ active }),
  setSubject: (subject) => set({ subject }),
  setKind: (kind) => set({ kind }),
  setMethod: (method) => set({ method }),
  setPrompt: (prompt) => set({ prompt }),
  setGrounding: (grounding) => set({ grounding }),
  startGenerating: () => set({ status: 'generating', stage: null, error: null }),
  setStage: (stage) => set({ stage }),
  setResult: (lottieJson, resultSignature, resultKind) =>
    set({ lottieJson, resultSignature, resultKind, status: 'done', stage: null, error: null }),
  setError: (error) => set({ status: 'error', stage: null, error }),
  clearResult: () =>
    set({ lottieJson: null, resultSignature: null, resultKind: null, status: 'idle', stage: null, error: null }),
}))
