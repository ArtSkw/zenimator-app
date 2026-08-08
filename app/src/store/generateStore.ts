import { useMemo } from 'react'
import { create } from 'zustand'
import { assembleProject, TRACK_KEYS, type GenerateProject, type LayerTracks, type Track } from '@/engine/lottie/project'
import { applyControlValues, deriveControls, type ControlManifest } from '@/engine/controls/deriveControls'
import { castFromControls, type CastMember } from '@/engine/controls/cast'
import { labelsFromDoc } from '@/engine/studio/studioClient'
import { sceneLayers } from '@/engine/lottie/sceneRoot'
import { applySlotOverride, SLOT_OVERRIDE_PREFIX } from '@/engine/lottie/slots'
import type { Skeleton } from '@/engine/legacy/skeleton'
import { useStudioFeed } from '@/store/studioFeedStore'

export type GenStatus = 'idle' | 'generating' | 'done' | 'error'

/** The reference SVG that grounds every studio generation. `id` is a stable
 *  React key: attachments get re-sequenced by drag, and an index-based key
 *  would re-mount the wrong tile (dropping focus and the entrance animation). */
export type Grounding = { id: string; name: string; svgText: string; pngDataUrl: string }

/** The property axes that configure a generation. */
export type Subject = 'illustration' | 'screen'
/** intro-loop (v1.2, the companion pattern): an entrance that settles into an
 *  endless idle — the scene carries `intro`/`loop` markers; players run the
 *  intro once, then cycle the loop segment. */
export type Kind = 'entry' | 'loop' | 'intro-loop'

type GenerateState = {
  /** Whether the generate lane is the active surface (the default landing). */
  active: boolean
  /** What's being animated — a single illustration or a whole screen. */
  subject: Subject
  /** Entry = play once then hold; Loop = continuous motion. */
  kind: Kind
  prompt: string
  /** Attached source artworks in story order (sequence briefs, v1.2 §3.8). */
  groundings: Grounding[]
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
  /** The agent's RAW controls.json for the scene — the slot specs (labels,
   *  autoFit padding/min/max) live here and can't be re-derived from the doc.
   *  Feeds slot metas and the localized web pack. */
  agentControlsJson: string | null
  setAgentControlsJson: (json: string | null) => void
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
  setGroundings: (g: Grounding[]) => void
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
  /** Open a project whose scene is still being authored: adopt its setup and
   *  clear any previously-loaded result, so the canvas can't keep showing the
   *  LAST project's animation while this one is still building. */
  openPendingJob: (job: {
    prompt: string
    subject: Subject
    kind: Kind
    groundings?: Grounding[]
    stage: string | null
    error: string | null
  }) => void
  /** Restore a saved project into the active generate lane. */
  loadProject: (data: {
    prompt: string
    subject?: Subject
    /** The project's own source artworks — restored into the composer so Edit
     *  setup and Regenerate operate on THIS project's files. */
    groundings?: Grounding[]
    lottieJson: string
    controls: ControlManifest | null
    agentControlsJson?: string | null
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
/** Everything scene-shaped, reset to empty. One list, spread wherever a view
 *  leaves the current scene behind (clear, open-pending, load) — a new scene
 *  field lands here once instead of being hand-threaded into each literal. */
const SCENE_RESET = {
  lottieJson: null, resultSignature: null, resultKind: null,
  project: null, skeleton: null, controls: null, agentControlsJson: null,
  cast: [], historyOpen: false, layerLabels: {}, slotOverrides: {},
  selectedLayer: null,
} satisfies Partial<GenerateState>

export const useGenerateStore = create<GenerateState>((set) => ({
  active: true,
  subject: 'illustration',
  kind: 'entry',
  prompt: '',
  groundings: [],
  lottieJson: null,
  resultSignature: null,
  resultKind: null,
  project: null,
  selectedLayer: null,
  skeleton: null,
  controls: null,
  agentControlsJson: null,
  setAgentControlsJson: (agentControlsJson) => set({ agentControlsJson }),
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
  setGroundings: (groundings) => set({ groundings }),
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
      groundings: [],
      ...SCENE_RESET,
      status: 'idle', stage: null, error: null,
    })
  },
  openPendingJob: (job) => {
    useStudioFeed.getState().clear()
    set({
      prompt: job.prompt,
      subject: job.subject,
      kind: job.kind,
      groundings: job.groundings ?? [],
      // Everything scene-shaped is cleared: a build in progress has no result,
      // and showing the previous project's would be a lie.
      ...SCENE_RESET,
      status: job.error ? 'error' : 'generating',
      stage: job.stage,
      error: job.error,
    })
  },

  loadProject: (data) => {
    // Opening a saved project shows no live feed — drop any residual activity
    // from an earlier in-session generation.
    useStudioFeed.getState().clear()
    // Program-param knobs belonged to the retired in-browser engine; the
    // program can no longer re-run, so those controls must not render on
    // legacy loads (no dead knobs) and their overrides are dropped.
    const stripped = data.controls
      ? { controls: data.controls.controls.filter((c) => !c.id.startsWith('param:')) }
      : null
    const slotOverrides = Object.fromEntries(
      Object.entries(data.slotOverrides ?? {}).filter(([k]) => !k.startsWith('param:')),
    )
    // Repair a manifest saved before controls could see inside a precomp: it
    // has no per-layer knobs at all, because derivation only ever looked at a
    // screen scene's two plumbing layers. Re-derive from the document rather
    // than making someone regenerate a twenty-minute scene. Control ids are
    // layer-name-based, so any saved overrides still land on their knob; the
    // agent's own controls.json isn't persisted, so its bespoke LABELS return
    // on the next generation while the mechanisms come back now.
    const repairable =
      !data.skeleton &&
      !!data.lottieJson &&
      !stripped?.controls.some((c) => c.layerNm)
    let controls = stripped
    let layerLabels = data.layerLabels
    if (repairable) {
      try {
        const doc = JSON.parse(data.lottieJson)
        if (sceneLayers<unknown>(doc).length > 1) {
          layerLabels = Object.keys(layerLabels ?? {}).length ? layerLabels : labelsFromDoc(data.lottieJson)
          const rederived = deriveControls(doc, layerLabels, [], data.resultKind !== 'loop')
          if (rederived.controls.some((c) => c.layerNm)) controls = rederived
        }
      } catch {
        /* keep what was saved */
      }
    }
    // Cast: use the persisted list; legacy saves (pre-cast) and repaired
    // manifests fall back to deriving it so the Layers panel populates.
    const cast = data.cast?.length ? data.cast : castFromControls(controls, layerLabels)
    set({
      prompt: data.prompt,
      // Restore the composer axes so the setup reflects the loaded scene: the
      // Kind follows the result's kind (a Loop stays Loop), not the default.
      subject: data.subject ?? 'illustration',
      kind: data.resultKind ?? 'entry',
      // THIS project's artworks, never the session's leftovers — a stale
      // attachment here wouldn't just mislabel Edit setup, Regenerate would
      // silently build from the wrong file. Legacy saves carry none.
      groundings: data.groundings ?? [],
      lottieJson: data.lottieJson,
      controls,
      agentControlsJson: data.agentControlsJson ?? null,
      skeleton: data.skeleton,
      cast,
      historyOpen: false,
      layerLabels,
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
  if (!lottieJson || !Object.keys(slotOverrides).length) return lottieJson
  // Single-entry memo on input identity: the store replaces these objects on
  // every change, so identity equality is exact — and one memo makes a second
  // mounted useBakedLottieJson (the transport's loop tick needs one) free
  // instead of doubling a parse+rewrite+stringify of a hundreds-of-KB doc.
  const hit = bakeMemo
  if (hit && hit.lottieJson === lottieJson && hit.controls === controls && hit.slotOverrides === slotOverrides) {
    return hit.result
  }
  let result: string | null
  try {
    const values: Record<string, number> = {}
    for (const [id, v] of Object.entries(slotOverrides)) {
      if (typeof v === 'number') values[id] = v
    }
    const doc = controls
      ? applyControlValues(JSON.parse(lottieJson), controls, values)
      : (JSON.parse(lottieJson) as ReturnType<typeof JSON.parse>)
    // Content slots (companion pattern): overrides under `slot:` REWRITE the
    // slot's default in the document itself, so the same bake feeds the
    // preview, every export, and the saved project — what a teammate sees
    // trying a locale string is exactly what ships.
    for (const [id, v] of Object.entries(slotOverrides)) {
      if (id.startsWith(SLOT_OVERRIDE_PREFIX)) applySlotOverride(doc, id.slice(SLOT_OVERRIDE_PREFIX.length), v)
    }
    result = JSON.stringify(doc)
  } catch {
    result = lottieJson
  }
  bakeMemo = { lottieJson, controls, slotOverrides, result }
  return result
}
let bakeMemo: {
  lottieJson: string
  controls: ControlManifest | null
  slotOverrides: Record<string, unknown>
  result: string | null
} | null = null

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
