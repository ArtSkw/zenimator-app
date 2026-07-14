import { useMemo } from 'react'
import { create } from 'zustand'
import { assembleProject, TRACK_KEYS, type GenerateProject, type LayerTracks, type Track } from '@/engine/lottie/project'
import { applyControlValues, type ControlManifest } from '@/engine/controls/deriveControls'
import { castFromControls, type CastMember } from '@/engine/controls/cast'
import type { Skeleton } from '@/engine/legacy/skeleton'
import { useStudioFeed } from '@/store/studioFeedStore'

export type GenStatus = 'idle' | 'generating' | 'done' | 'error'

/** The reference SVG that grounds every studio generation. */
export type Grounding = { name: string; svgText: string; pngDataUrl: string }

/** The property axes that configure a generation. */
export type Subject = 'illustration' | 'screen'
export type Kind = 'entry' | 'loop'

type GenerateState = {
  /** Whether the generate lane is the active surface (the default landing). */
  active: boolean
  /** What's being animated — a single illustration or a whole screen. */
  subject: Subject
  /** Entry = play once then hold; Loop = continuous motion. */
  kind: Kind
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
  /** LEGACY: the retired engine's editable project. Always null now — kept in
   *  the shape so dormant legacy UI branches type-check until they're removed. */
  project: GenerateProject | null
  /** Index of the layer currently selected in the editor. */
  selectedLayer: number | null
  /** LEGACY: pre-studio saves persisted a skeleton; restored for their layer
   *  names and selection overlay. New studio projects save null. */
  skeleton: Skeleton | null
  /** Derived controls manifest (duration, per-layer visibility…). */
  controls: ControlManifest | null
  /** The creative CAST — the curated layer list shown in the Layers panel and
   *  addressed by controls/quick-edits. Derived ONCE at generation and then
   *  kept stable: control tweaks (incl. "hold still") never mutate it; only a
   *  full regenerate rebuilds it, and a chat edit reconciles it against the
   *  new doc (prune removed layers, add newly-animated ones). This is why a
   *  frozen layer no longer vanishes from the panel. */
  cast: CastMember[]
  /** Right panel shows the version-history log instead of Controls. */
  historyOpen: boolean
  /** Friendly per-layer names straight from the agent's own layer naming. */
  layerLabels: Record<string, string>
  /** User-set slot value overrides (sid → raw value). Applied on top of
   *  the defaults in the slots object to preview control changes live. */
  slotOverrides: Record<string, unknown>
  status: GenStatus
  /** Sub-stage label shown while generating (e.g. "Refining motion…"). */
  stage: string | null
  error: string | null

  setActive: (v: boolean) => void
  setSubject: (s: Subject) => void
  setKind: (k: Kind) => void
  setPrompt: (p: string) => void
  setGrounding: (g: Grounding | null) => void
  startGenerating: () => void
  setStage: (s: string) => void
  setResult: (json: string, signature: string, kind: Kind, controls?: ControlManifest | null, layerLabels?: Record<string, string>, keepOverrides?: Record<string, unknown>) => void
  setSlotOverride: (sid: string, value: unknown) => void
  /** Set several overrides atomically; `null` deletes the key (back to the
   *  authored baseline). Used by the intensity presets so one click moves all
   *  of a layer's amplitude knobs together. */
  patchSlotOverrides: (patch: Record<string, number | null>) => void
  clearSlotOverrides: () => void
  /** Edit one layer's tracks → re-assemble the Lottie (cheap, no re-raster). */
  setLayerTracks: (index: number, tracks: LayerTracks) => void
  /** Change the total length (frames), scaling every effect's timing to fit. */
  setTotalFrames: (frames: number) => void
  setSelectedLayer: (index: number | null) => void
  /** Replace the cast (generate) or set the reconciled cast (edit/revert). */
  setCast: (cast: CastMember[]) => void
  setHistoryOpen: (open: boolean) => void
  setError: (msg: string) => void
  /** Reset status to idle without clearing the existing result (e.g. after abort). */
  resetStatus: () => void
  clearResult: () => void
  /** Restore a saved project into the active generate lane. */
  loadProject: (data: {
    prompt: string
    subject?: Subject
    lottieJson: string
    controls: ControlManifest | null
    skeleton: Skeleton | null
    cast: CastMember[]
    layerLabels: Record<string, string>
    slotOverrides: Record<string, unknown>
    resultKind: Kind | null
  }) => void
}

/**
 * State for the generate lane — the single studio-driven surface.
 */
export const useGenerateStore = create<GenerateState>((set) => ({
  active: true,
  subject: 'illustration',
  kind: 'entry',
  prompt: '',
  grounding: null,
  lottieJson: null,
  resultSignature: null,
  resultKind: null,
  project: null,
  selectedLayer: null,
  skeleton: null,
  controls: null,
  cast: [],
  historyOpen: false,
  layerLabels: {},
  slotOverrides: {},
  status: 'idle',
  stage: null,
  error: null,

  setActive: (active) => set({ active }),
  setSubject: (subject) => set({ subject }),
  setKind: (kind) => set({ kind }),
  setPrompt: (prompt) => set({ prompt }),
  setGrounding: (grounding) => set({ grounding }),
  startGenerating: () => set({ status: 'generating', stage: null, error: null, historyOpen: false }),
  setStage: (stage) => set({ stage }),
  setResult: (lottieJson, resultSignature, resultKind, controls, layerLabels, keepOverrides) =>
    set({
      lottieJson, resultSignature, resultKind,
      project: null,
      controls: controls ?? null,
      layerLabels: layerLabels ?? {},
      slotOverrides: keepOverrides ?? {},
      selectedLayer: null,
      status: 'done', stage: null, error: null,
    }),
  setCast: (cast) => set({ cast }),
  setHistoryOpen: (historyOpen) => set({ historyOpen }),
  setSlotOverride: (sid, value) =>
    set((s) => ({ slotOverrides: { ...s.slotOverrides, [sid]: value } })),
  patchSlotOverrides: (patch) =>
    set((s) => {
      const next = { ...s.slotOverrides }
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) delete next[k]
        else next[k] = v
      }
      return { slotOverrides: next }
    }),
  clearSlotOverrides: () => set({ slotOverrides: {} }),
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
  resetStatus: () => set({ status: 'idle', stage: null, error: null }),
  clearResult: () => {
    // Leaving the current work (home, Clear, deleting the open project) also
    // dismisses its studio activity feed — it belongs to that generation, not
    // the next empty canvas.
    useStudioFeed.getState().clear()
    set({
      prompt: '',
      // A fresh start returns the composer axes to their defaults too —
      // otherwise Kind/Subject linger from the last-opened project (a Loop
      // scene would leave "New project" showing Loop).
      subject: 'illustration',
      kind: 'entry',
      // The attachment belongs to the work being cleared — a fresh start
      // (home, Clear, deleting the open project) must not keep it around.
      grounding: null,
      lottieJson: null, resultSignature: null, resultKind: null,
      project: null, skeleton: null, controls: null, cast: [], historyOpen: false, layerLabels: {}, slotOverrides: {},
      selectedLayer: null, status: 'idle', stage: null, error: null,
    })
  },
  loadProject: (data) => {
    // Opening a saved project shows no live feed — drop any residual activity
    // from an earlier in-session generation.
    useStudioFeed.getState().clear()
    // Program-param knobs belonged to the retired in-browser engine; the
    // program can no longer re-run, so those controls must not render on
    // legacy loads (no dead knobs) and their overrides are dropped.
    const controls = data.controls
      ? { controls: data.controls.controls.filter((c) => !c.id.startsWith('param:')) }
      : null
    const slotOverrides = Object.fromEntries(
      Object.entries(data.slotOverrides ?? {}).filter(([k]) => !k.startsWith('param:')),
    )
    // Cast: use the persisted list; legacy saves (pre-cast) fall back to
    // deriving it once from their controls so the Layers panel still populates.
    const cast = data.cast?.length ? data.cast : castFromControls(controls, data.layerLabels)
    set({
      prompt: data.prompt,
      // Restore the composer axes so the setup reflects the loaded scene: the
      // Kind follows the result's kind (a Loop stays Loop), not the default.
      subject: data.subject ?? 'illustration',
      kind: data.resultKind ?? 'entry',
      lottieJson: data.lottieJson,
      controls,
      skeleton: data.skeleton,
      cast,
      historyOpen: false,
      layerLabels: data.layerLabels,
      slotOverrides,
      resultKind: data.resultKind,
      project: null,
      status: 'done',
      stage: null,
      error: null,
      selectedLayer: null,
      resultSignature: null,
    })
  },
}))

/** Bake the current slot-control overrides (Duration, Feel, per-layer
 *  Movement/Speed/etc.) into the doc — each control re-writes the keyframes it
 *  was derived from. Shared by the live-preview hook and the imperative export
 *  getter. Returns the raw doc untouched when nothing is overridden. */
function bakeFrom(lottieJson: string | null, controls: ControlManifest | null, slotOverrides: Record<string, unknown>): string | null {
  if (!lottieJson || !controls || !Object.keys(slotOverrides).length) return lottieJson
  try {
    const values: Record<string, number> = {}
    for (const [id, v] of Object.entries(slotOverrides)) {
      if (typeof v === 'number') values[id] = v
    }
    return JSON.stringify(applyControlValues(JSON.parse(lottieJson), controls, values))
  } catch {
    return lottieJson
  }
}

/** Reactive baked doc for the live preview — recomputes only when the doc,
 *  controls, or overrides change. */
export function useBakedLottieJson(): string | null {
  const lottieJson = useGenerateStore((s) => s.lottieJson)
  const controls = useGenerateStore((s) => s.controls)
  const slotOverrides = useGenerateStore((s) => s.slotOverrides)
  return useMemo(() => bakeFrom(lottieJson, controls, slotOverrides), [lottieJson, controls, slotOverrides])
}

/** Imperative one-shot bake for export handlers — the heavy parse/clone/
 *  stringify runs on the export click, not on every control commit (which a
 *  second mounted hook would have forced). */
export function bakeLottieJson(): string {
  const { lottieJson, controls, slotOverrides } = useGenerateStore.getState()
  return bakeFrom(lottieJson, controls, slotOverrides) ?? ''
}
