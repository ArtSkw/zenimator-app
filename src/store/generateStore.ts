import { create } from 'zustand'
import { assembleProject, withHandleOrigins, TRACK_KEYS, type GenerateProject, type LayerTracks, type Track } from '@/engine/lottie/project'

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
  /** The editable project (geometry + per-layer motion) for grounded results;
   *  null for pure-prompt results, which aren't layer-editable. */
  project: GenerateProject | null
  /** Index of the layer currently selected in the editor. */
  selectedLayer: number | null
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
  setResult: (json: string, signature: string, kind: Kind, project: GenerateProject | null) => void
  /** Edit one layer's tracks → re-assemble the Lottie (cheap, no re-raster). */
  setLayerTracks: (index: number, tracks: LayerTracks) => void
  /** Change the total length (frames), scaling every effect's timing to fit. */
  setTotalFrames: (frames: number) => void
  setSelectedLayer: (index: number | null) => void
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
  project: null,
  selectedLayer: null,
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
  setResult: (lottieJson, resultSignature, resultKind, project) =>
    set({
      lottieJson, resultSignature, resultKind,
      project: project ? withHandleOrigins(project) : null,
      selectedLayer: null,
      status: 'done', stage: null, error: null,
    }),
  setLayerTracks: (index, tracks) =>
    set((s) => {
      if (!s.project) return {}
      const layers = s.project.layers.map((l, i) => (i === index ? { ...l, tracks } : l))
      const project = { ...s.project, layers }
      return { project, lottieJson: JSON.stringify(assembleProject(project)) }
    }),
  setTotalFrames: (frames) =>
    set((s) => {
      if (!s.project) return {}
      const op = Math.max(12, Math.min(1800, Math.round(frames)))
      const r = op / s.project.op
      if (r === 1) return {}
      const scaleTrack = (t: Track | undefined): Track | undefined =>
        t ? { ...t, keys: t.keys.map((k) => ({ ...k, t: Math.round(k.t * r) })) } : undefined
      const layers = s.project.layers.map((l) => {
        const tracks: LayerTracks = {}
        for (const key of TRACK_KEYS) {
          const scaled = scaleTrack(l.tracks[key])
          if (scaled) tracks[key] = scaled
        }
        return { ...l, tracks }
      })
      const project = { ...s.project, op, layers }
      return { project, lottieJson: JSON.stringify(assembleProject(project)) }
    }),
  setSelectedLayer: (selectedLayer) => set({ selectedLayer }),
  setError: (error) => set({ status: 'error', stage: null, error }),
  clearResult: () =>
    set({
      lottieJson: null, resultSignature: null, resultKind: null, project: null,
      selectedLayer: null, status: 'idle', stage: null, error: null,
    }),
}))
