import { useEffect, useMemo, useState } from 'react'
import { SlidersHorizontal, MousePointerClick, X, RotateCcw, Layers, Film, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { TrendingUp, Waves } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Switch } from '@/components/ui/switch'
import { Check } from 'lucide-react'
import { SlotControlsPanel } from '@/components/generate/SlotControlsPanel'
import { useGenerateStore } from '@/store/generateStore'
import { useProjectsStore } from '@/store/projectsStore'
import { useStudioEditBridge } from '@/store/studioEditBridge'
import { studioHistory, type SceneVersion } from '@/engine/studio/studioClient'
import { INTENSITY_FEEL_PREFIX, type ParamControl } from '@/engine/controls/deriveControls'

/** Right-hand controls: a global "Animation" section plus a section for the
 *  layer selected in the Layers panel / canvas, kept in sync with the
 *  selection. For studio scenes the motion itself is authored by the engine —
 *  the panel says so instead of faking sliders that would fight the build
 *  script (no dead knobs). */
export function ControlsPanel() {
  const { lottieJson, controls, skeleton, selectedLayer, layerLabels, slotOverrides, setSlotOverride, cast: storeCast, historyOpen, setHistoryOpen } = useGenerateStore()
  const activeSlug = useProjectsStore((s) => s.projects.find((p) => p.id === s.activeProjectId)?.studioSlug)
  const isStudioScene = Boolean(activeSlug)

  const all = (lottieJson && controls?.controls) || []
  // Selection indexes the same list the Layers panel shows: skeleton parts for
  // legacy saves, the persisted stable cast (store) for studio scenes.
  const cast = skeleton ? [] : storeCast
  const selNm =
    selectedLayer == null
      ? undefined
      : skeleton
        ? skeleton.layers[selectedLayer]?.nm
        : cast[selectedLayer]?.nm

  // A leaf's motion often lives on its parent RIG NULL (the program moves the
  // whole figure through one transform-carrier the Layers panel never lists) —
  // attribute those controls to every selected member, or they'd be orphaned.
  const ancestorNms = useMemo(() => {
    const out = new Set<string>()
    if (!lottieJson || !selNm) return out
    try {
      const doc = JSON.parse(lottieJson) as { layers: { nm: string; ind: number; parent?: number }[] }
      const byInd = new Map(doc.layers.map((l) => [l.ind, l]))
      let cur = doc.layers.find((l) => l.nm === selNm)
      while (cur && cur.parent != null) {
        const p = byInd.get(cur.parent)
        if (!p || out.has(p.nm)) break
        out.add(p.nm)
        cur = p
      }
    } catch {
      // fall through with what we have
    }
    return out
  }, [lottieJson, selNm])

  const general = all.filter((c) => !c.layerNm)
  const selName = selNm
    ? (layerLabels[selNm] ?? cast.find((m) => m.nm === selNm)?.label ?? selNm)
    : undefined
  // The selected layer's controls plus any borrowed from a rig ancestor, then
  // collapsed to ONE control per kind (preferring the layer's own) — a leaf can
  // both own a knob and inherit the same knob from its rig, which would
  // otherwise show twice (e.g. two "Delay"s).
  const layerControls = (() => {
    if (!selNm) return []
    const matched = all.filter(
      (c) => c.layerNm === selNm || (c.layerNm != null && ancestorNms.has(c.layerNm)),
    )
    const byKind = new Map<string, ParamControl>()
    for (const c of matched) {
      const prev = byKind.get(c.binding.kind)
      if (!prev || (c.layerNm === selNm && prev.layerNm !== selNm)) byKind.set(c.binding.kind, c)
    }
    return [...byKind.values()].sort((a, b) => kindOrder(a) - kindOrder(b))
  })()
  // "Motion" is the on/off master for the layer: lift it to the top of the
  // section, and when it's off hide the rest (they can't affect a still layer).
  const movesControl = layerControls.find((c) => c.binding.kind === 'layer-motion')
  const otherControls = layerControls.filter((c) => c.binding.kind !== 'layer-motion')
  const movesOn = movesControl
    ? (slotOverrides[movesControl.id] ?? movesControl.value) !== (movesControl.offValue ?? 0)
    : true
  // Intensity presets scale the amplitude knobs the layer itself OWNS (not an
  // ancestor rig's — scaling those from a child selection would surprise by
  // moving siblings too). No owned amplitudes → no segmented control.
  const AMP_KINDS = new Set(['pos-amp', 'rot-amp', 'scale-amp'])
  const ownedAmpControls = selNm
    ? all.filter((c) => c.layerNm === selNm && AMP_KINDS.has(c.binding.kind))
    : []
  // The layer's own speed knob, if it has one (seamless-loop layers don't — see
  // deriveControls) — Intensity nudges it as part of the character bundle.
  const ownedSpeedControl = selNm
    ? all.find((c) => c.layerNm === selNm && c.binding.kind === 'layer-speed')
    : undefined

  // History replaces the Controls panel (closable). Placed AFTER every hook
  // above so the hook order is stable whether or not history is open.
  if (isStudioScene && historyOpen && activeSlug) {
    return <HistoryPanel slug={activeSlug} onClose={() => setHistoryOpen(false)} />
  }

  return (
    <aside className="w-[320px] border-l border-border bg-background flex flex-col shrink-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <SlidersHorizontal size={14} className="text-foreground" />
        <span className="text-[13px] font-semibold text-foreground">Controls</span>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {all.length === 0 ? (
          <Empty className="py-10 border-none">
            <EmptyHeader>
              <EmptyMedia variant="icon"><SlidersHorizontal /></EmptyMedia>
              <EmptyTitle>{lottieJson ? 'No controls' : 'Nothing to tune yet'}</EmptyTitle>
              <EmptyDescription>
                {lottieJson
                  ? 'This scene has no knobs to turn.'
                  : 'Bring a scene to life and its knobs show up here.'}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="p-4 space-y-5">
            {general.length > 0 && (
              <Section title="Animation" icon={Film}>
                <SlotControlsPanel manifest={{ controls: general }} />
              </Section>
            )}

            {/* Divider makes it unambiguous which controls are scene-wide vs.
                scoped to the selected layer. */}
            {general.length > 0 && <div className="border-t border-border" />}

            {selNm ? (
              <Section title={selName ?? 'Layer'} icon={Layers}>
                {/* Motion is the master on/off for the layer — always at the top,
                    label + tooltip (no helper paragraph). */}
                {movesControl && (
                  <TooltipProvider>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-foreground/90">Motion</span>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <span className="inline-flex">
                              <Switch
                                checked={movesOn}
                                onCheckedChange={(c) =>
                                  setSlotOverride(movesControl.id, c ? movesControl.value : (movesControl.offValue ?? 0))
                                }
                                aria-label="Motion"
                              />
                            </span>
                          }
                        />
                        <TooltipContent side="left">Applies motion to this part — off holds it still</TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>
                )}
                {movesOn ? (
                  <>
                    {otherControls.length > 0 ? (
                      <SlotControlsPanel manifest={{ controls: stripLayerPrefix(otherControls) }} />
                    ) : (
                      !movesControl && (
                        <p className="text-xs leading-snug text-muted-foreground">
                          {isStudioScene
                            ? 'This layer’s motion is authored by the studio — nudge it below or ask in chat.'
                            : 'This layer has no adjustable motion.'}
                        </p>
                      )
                    )}
                    {ownedAmpControls.length > 0 && selNm && (
                      <IntensityControl layerNm={selNm} ampControls={ownedAmpControls} speedControl={ownedSpeedControl} />
                    )}
                  </>
                ) : (
                  <p className="text-xs leading-snug text-muted-foreground">
                    Motion is off for this layer — turn it on to adjust or tweak it.
                  </p>
                )}
              </Section>
            ) : (
              <div className="flex items-start gap-2 text-xs leading-snug text-muted-foreground">
                <MousePointerClick size={14} className="mt-0.5 shrink-0" />
                <span>Select a layer to adjust just that part.</span>
              </div>
            )}

          </div>
        )}
      </ScrollArea>
    </aside>
  )
}

/** "just now" · "5m ago" · "2h ago" · "3d ago" */
function relTime(at: number): string {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000))
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

/** History log — replaces the Controls panel when opened. The service
 *  snapshots the scene before every edit/revert, so each entry restores (and
 *  the restore is itself undoable). Reverts go through the edit bridge so the
 *  result lands in the same store/save path as an edit. */
function HistoryPanel({ slug, onClose }: { slug: string; onClose: () => void }) {
  const revert = useStudioEditBridge((s) => s.revert)
  const applying = useStudioEditBridge((s) => s.applying)
  // 'loading' → fetching · null → engine has no /history (needs restart) ·
  // [] → engine present, no edits · [...] → versions.
  const [versions, setVersions] = useState<SceneVersion[] | null | 'loading'>('loading')

  const refresh = () => { void studioHistory(slug).then((v) => setVersions(v)) }
  useEffect(refresh, [slug])
  // Reload after an applied revert finishes (a new snapshot was written).
  useEffect(() => { if (!applying) refresh() }, [applying]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <aside className="w-[320px] border-l border-border bg-background flex flex-col shrink-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <RotateCcw size={14} className="text-foreground" />
        <span className="text-[13px] font-semibold text-foreground">History</span>
        {/* Same ghost icon button the Settings / dossier sheets use for close —
            one close-button shape everywhere. */}
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close history" className="ml-auto">
          <X />
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {versions === 'loading' ? (
          <p className="px-4 py-4 text-xs text-muted-foreground">Loading…</p>
        ) : versions === null ? (
          <Empty className="py-10 border-none">
            <EmptyHeader>
              <EmptyMedia variant="icon"><RotateCcw /></EmptyMedia>
              <EmptyTitle>History unavailable</EmptyTitle>
              <EmptyDescription>The studio engine needs a restart to record version history — run <span className="font-mono">npm run agent</span> again.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : versions.length === 0 ? (
          <Empty className="py-10 border-none">
            <EmptyHeader>
              <EmptyMedia variant="icon"><RotateCcw /></EmptyMedia>
              <EmptyTitle>No edits yet</EmptyTitle>
              <EmptyDescription>This is the original scene. Every change you make can be rolled back from here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="p-3 space-y-1.5">
            <p className="px-1 pb-1 text-[11px] leading-relaxed text-muted-foreground">
              Restore any earlier state — the current one is saved first, so this is always undoable.
            </p>
            {versions.map((v) => (
              <button
                key={v.v}
                type="button"
                disabled={applying || !revert}
                onClick={() => revert?.(v.v)}
                className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-left transition-colors hover:bg-muted disabled:opacity-40 disabled:pointer-events-none"
              >
                <RotateCcw size={13} className="shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-foreground">{v.note || 'Edit'}</span>
                  <span className="block text-[10px] text-muted-foreground">Version {v.v} · {relTime(v.at)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </aside>
  )
}

// Intensity presets: deterministic factors over the AUTHORED amplitudes.
// Each preset is a whole motion CHARACTER, not a single number: it moves the
// layer's amplitude (travel), its easing (feel), and — where the layer exposes
// one — its speed, together. `feel` indexes the engine's FEEL presets
// (1 = Gentle, 3 = Snappy); 0 leaves easing as authored. Targets are always
// computed from the studio's originals, so switching never compounds and
// "Original" is always one click back to the authored motion.
const INTENSITY_MODES = [
  { key: 'steadier', label: 'Calmer', icon: Waves, amp: 0.6, feel: 1, speed: 1.25, hint: 'Calmer — less travel, gentler easing, a touch slower' },
  { key: 'default', label: 'Original', icon: Check, amp: 1, feel: 0, speed: 1, hint: 'The studio’s original motion' },
  { key: 'stronger', label: 'Bolder', icon: TrendingUp, amp: 1.4, feel: 3, speed: 0.8, hint: 'Bolder — more travel, snappier easing, more impact' },
] as const
type IntensityMode = (typeof INTENSITY_MODES)[number]
type IntensityKey = IntensityMode['key']

/** The preset value for one amplitude control at a given factor. Scale runs
 *  around its 100% rest point; position/rotation scale from zero. Clamped to
 *  the control's own range. */
function intensityValue(c: ParamControl, factor: number): number {
  const raw = c.binding.kind === 'scale-amp' ? 100 + (c.value - 100) * factor : c.value * factor
  return Math.round(Math.min(c.max ?? Infinity, Math.max(c.min ?? 0, raw)))
}

/**
 * Intensity — one segmented control that tunes the selected layer's whole
 * motion character in a single click: it scales every amplitude knob the layer
 * owns (movement / rotation / scale), shifts its easing (feel), and, when the
 * layer has an adjustable speed, nudges that too. All client-side through the
 * same bake as the sliders — instant, exclusive, reversible ("Original" clears
 * the bundle). Active state derives from the overrides themselves, so it
 * survives reload and honestly drops to no-selection once any one dimension is
 * hand-tuned. Easing rides a reserved `intensity-feel:<layerNm>` override so it
 * needs no visible Feel control.
 */
function IntensityControl({
  layerNm, ampControls, speedControl,
}: { layerNm: string; ampControls: ParamControl[]; speedControl?: ParamControl }) {
  const slotOverrides = useGenerateStore((s) => s.slotOverrides)
  const patchSlotOverrides = useGenerateStore((s) => s.patchSlotOverrides)
  const feelKey = `${INTENSITY_FEEL_PREFIX}${layerNm}`

  // Every dimension a preset drives, each with its authored baseline and a
  // per-mode target. Bundling amplitude + speed + feel here keeps `apply` and
  // the active-state check reading from one source of truth.
  const clampSpeed = (raw: number) =>
    Math.round(Math.min(speedControl!.max ?? Infinity, Math.max(speedControl!.min ?? 1, raw)))
  const dims = [
    ...ampControls.map((c) => ({ key: c.id, baseline: c.value, isFeel: false, target: (m: IntensityMode) => intensityValue(c, m.amp) })),
    ...(speedControl ? [{ key: speedControl.id, baseline: speedControl.value, isFeel: false, target: (m: IntensityMode) => clampSpeed(speedControl.value * m.speed) }] : []),
    { key: feelKey, baseline: 0, isFeel: true, target: (m: IntensityMode) => m.feel },
  ]

  // Absent override reads as the authored baseline; feel matches exactly,
  // numbers within rounding. A mode is active only when EVERY dimension lands.
  const currentOf = (d: (typeof dims)[number]) =>
    typeof slotOverrides[d.key] === 'number' ? (slotOverrides[d.key] as number) : d.baseline
  const matches = (m: IntensityMode) =>
    dims.every((d) => (d.isFeel ? currentOf(d) === d.target(m) : Math.abs(currentOf(d) - d.target(m)) <= 1))
  const current: IntensityKey | 'custom' = INTENSITY_MODES.find(matches)?.key ?? 'custom'

  const apply = (key: IntensityKey) => {
    const m = INTENSITY_MODES.find((x) => x.key === key)!
    const patch: Record<string, number | null> = {}
    for (const d of dims) {
      const t = d.target(m)
      // Target == baseline → clear the override entirely (back to authored).
      patch[d.key] = Math.abs(t - d.baseline) < (d.isFeel ? 0.5 : 1) ? null : t
    }
    patchSlotOverrides(patch)
  }

  return (
    <div className="space-y-1.5">
      <p className="flex-1 min-w-0 truncate text-xs font-medium text-foreground/90">Intensity</p>
      <TooltipProvider>
        <div className="grid grid-cols-3 gap-1.5">
          {INTENSITY_MODES.map((m) => {
            const Icon = m.icon
            const active = current === m.key
            return (
              <Tooltip key={m.key}>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => apply(m.key)}
                      className={
                        'pressable flex items-center justify-center gap-1 rounded-lg border px-1.5 py-1.5 text-[11px] ' +
                        (active
                          ? 'border-primary bg-primary/10 text-foreground font-medium'
                          : 'border-border text-foreground/90 hover:bg-muted')
                      }
                    >
                      <Icon size={12} className={active ? 'shrink-0 text-primary' : 'shrink-0 text-muted-foreground'} />
                      <span className="truncate">{m.label}</span>
                    </button>
                  }
                />
                <TooltipContent side="top">{m.hint}</TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </TooltipProvider>
    </div>
  )
}

function Section({ title, icon: Icon, children }: { title: string; icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      {/* Same section-label recipe as the left sidebar — one voice everywhere.
          A layer section carries the layer glyph so it's clear WHICH part is
          being edited. */}
      <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-foreground/70 truncate">
        {Icon && <Icon size={13} className="shrink-0 text-muted-foreground" />}
        <span className="truncate">{title}</span>
      </p>
      {children}
    </div>
  )
}

/** Reading order within a layer's section: what it does, then how it draws on,
 *  then its timing. */
function kindOrder(c: ParamControl): number {
  const order: Record<string, number> = {
    'program-param': -1, // the motion's own tunables lead
    'pos-amp': 0, 'rot-amp': 1, 'scale-amp': 2, feel: 3, 'trim-dur': 4,
    'layer-speed': 5, 'layer-delay': 6, 'layer-motion': 8,
  }
  return order[c.binding.kind] ?? 9
}

/** Inside a layer's section the layer name is already the header, so drop the
 *  "<Layer> · " prefix from each control label (e.g. "Checkmark · Draw-on" → "Draw-on"). */
function stripLayerPrefix(controls: ParamControl[]): ParamControl[] {
  return controls.map((c) => {
    const i = c.label.indexOf('·')
    return i >= 0 ? { ...c, label: c.label.slice(i + 1).trim() } : c
  })
}
