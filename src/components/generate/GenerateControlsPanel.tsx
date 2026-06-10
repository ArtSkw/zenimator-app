import { useEffect, useState, type ReactNode } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SlidersHorizontal, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGenerateStore } from '@/store/generateStore'
import {
  TRACKS, PRESETS_BY_TRACK, PRESET_BY_ID, EASINGS, stampPreset,
  type TrackMeta, type LayerTracks, type Track, type Keyframe,
} from '@/engine/lottie/project'
import type { EasingKey } from '@/engine/lottie/core'

/** Per-layer keyframe editor. Each property is a TRACK of keyframes; presets are
 *  quick-add shortcuts that stamp keyframes. Edits commit to the store, which
 *  re-assembles the Lottie (reusing cached geometry — no re-raster). */
export function GenerateControlsPanel() {
  const { project, selectedLayer, setLayerTracks } = useGenerateStore()
  const layer = project && selectedLayer != null ? project.layers[selectedLayer] : null

  return (
    <aside className="w-[320px] border-l border-border bg-background flex flex-col shrink-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <SlidersHorizontal size={14} className="text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Controls</span>
        {layer && <span className="ml-auto text-xs text-muted-foreground truncate max-w-[120px]">{layer.name}</span>}
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {layer && selectedLayer != null ? (
          <LayerEditor
            key={selectedLayer}
            tracks={layer.tracks}
            op={project!.op}
            fps={project!.fps}
            onChange={(t) => setLayerTracks(selectedLayer, t)}
          />
        ) : (
          <Empty className="py-10 border-none">
            <EmptyHeader>
              <EmptyMedia variant="icon"><SlidersHorizontal /></EmptyMedia>
              <EmptyTitle>Nothing selected</EmptyTitle>
              <EmptyDescription>Select a layer to edit its motion.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </ScrollArea>
    </aside>
  )
}

function LayerEditor({
  tracks, op, fps, onChange,
}: {
  tracks: LayerTracks
  op: number
  fps: number
  onChange: (t: LayerTracks) => void
}) {
  const setTrack = (key: TrackMeta['key'], track: Track | undefined) => {
    const next: LayerTracks = { ...tracks }
    if (track && track.keys.length) next[key] = track
    else delete next[key]
    onChange(next)
  }

  return (
    <div className="pb-4">
      <p className="text-[11px] text-muted-foreground leading-snug px-4 pt-4 pb-2">
        Each property is a track of keyframes. Use a quick-add for a head start, then edit the
        keyframes directly — sequence anything you like.
      </p>
      {TRACKS.map((meta, i) => (
        <div key={meta.key} className={cn(i > 0 && 'border-t border-border')}>
          <TrackEditor
            meta={meta}
            track={tracks[meta.key]}
            op={op}
            fps={fps}
            onChange={(t) => setTrack(meta.key, t)}
          />
        </div>
      ))}
    </div>
  )
}

function TrackEditor({
  meta, track, op, fps, onChange,
}: {
  meta: TrackMeta
  track: Track | undefined
  op: number
  fps: number
  onChange: (t: Track | undefined) => void
}) {
  const keys = (track?.keys ?? []).slice().sort((a, b) => a.t - b.t)
  const active = keys.length > 0
  const activePreset = track?.preset

  // A keyframe edit makes the track "Custom" — drop the preset provenance.
  const setKeys = (next: Keyframe[]) => onChange(next.length ? { keys: next } : undefined)

  const updateKey = (i: number, patch: Partial<Keyframe>) =>
    setKeys(keys.map((k, idx) => (idx === i ? { ...k, ...patch } : k)))
  const removeKey = (i: number) => setKeys(keys.filter((_, idx) => idx !== i))
  const addKey = () => {
    const lastT = keys.length ? keys[keys.length - 1].t : 0
    const t = keys.length ? Math.min(op, lastT + Math.max(1, Math.round((op - lastT) / 2))) : 0
    setKeys([...keys, { t, v: meta.add, easing: 'easeOut' }])
  }

  const provenance = active ? (activePreset ? PRESET_BY_ID[activePreset]?.label ?? 'Custom' : 'Custom') : null

  return (
    <div className="px-4 py-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground">{meta.label}</p>
        {active && (
          <button
            onClick={() => onChange(undefined)}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Quick-add presets */}
      <div className="space-y-1.5">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/70">Quick add</p>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS_BY_TRACK[meta.key].map((p) => (
            <Pill key={p.id} active={activePreset === p.id} onClick={() => onChange(stampPreset(p, { op, fps }))}>
              {p.label}
            </Pill>
          ))}
        </div>
      </div>

      {/* Keyframes */}
      {active && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/70">Keyframes</p>
            {provenance && (
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 text-[9px] font-medium leading-none',
                  activePreset ? 'bg-foreground/10 text-foreground' : 'bg-muted text-muted-foreground',
                )}
              >
                {provenance}
              </span>
            )}
          </div>

          {keys.map((k, i) => (
            <div key={i} className="rounded-lg border border-border/70 bg-muted/30 p-2.5 space-y-2 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="grid place-items-center size-4 rounded bg-foreground/10 text-[9px] font-mono font-medium text-foreground tabular-nums">
                    {i + 1}
                  </span>
                  <span className="text-[10px] text-muted-foreground">Frame</span>
                  <NumField
                    value={k.t} min={0} max={op} className="w-14"
                    onCommit={(t) => updateKey(i, { t })}
                  />
                </div>
                <button
                  onClick={() => removeKey(i)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 -m-1"
                  aria-label="Remove keyframe"
                >
                  <X size={13} />
                </button>
              </div>

              <ValueEditor meta={meta} value={k.v} onCommit={(v) => updateKey(i, { v })} />

              {i < keys.length - 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-10 shrink-0">Ease</span>
                  <EaseSelect value={k.easing ?? 'easeInOut'} onChange={(e) => updateKey(i, { easing: e })} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={addKey}
        className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <Plus size={12} /> Add keyframe
      </button>
    </div>
  )
}

function ValueEditor({
  meta, value, onCommit,
}: {
  meta: TrackMeta
  value: Keyframe['v']
  onCommit: (v: Keyframe['v']) => void
}) {
  if (meta.kind === 'offset') {
    const [x, y] = Array.isArray(value) ? value : [value, 0]
    return (
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground w-10 shrink-0">Offset</span>
        <Axis label="X" value={x} min={meta.min} max={meta.max} onCommit={(n) => onCommit([n, y])} />
        <Axis label="Y" value={y} min={meta.min} max={meta.max} onCommit={(n) => onCommit([x, n])} />
      </div>
    )
  }
  const n = Array.isArray(value) ? value[0] : value
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-10 shrink-0">{meta.unit === '°' ? 'Angle' : 'Value'}</span>
      <NumField value={n} min={meta.min} max={meta.max} step={meta.step} className="w-20" onCommit={onCommit} />
      <span className="text-[10px] text-muted-foreground">{meta.unit}</span>
    </div>
  )
}

function Axis({
  label, value, min, max, onCommit,
}: {
  label: string
  value: number
  min: number
  max: number
  onCommit: (n: number) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <NumField value={value} min={min} max={max} className="w-14" onCommit={onCommit} />
    </div>
  )
}

/** Numeric field with local text state — commits a clamped value on blur/Enter,
 *  reverts on Escape or invalid input. */
function NumField({
  value, min, max, step = 1, className, onCommit,
}: {
  value: number
  min: number
  max: number
  step?: number
  className?: string
  onCommit: (n: number) => void
}) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])

  const commit = () => {
    const n = parseFloat(text)
    if (Number.isNaN(n)) { setText(String(value)); return }
    const c = Math.min(max, Math.max(min, step >= 1 ? Math.round(n) : n))
    setText(String(c))
    if (c !== value) onCommit(c)
  }

  return (
    <input
      value={text}
      inputMode="decimal"
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') { setText(String(value)); e.currentTarget.blur() }
      }}
      className={cn(
        'h-7 rounded border border-border bg-background px-2 text-xs font-mono tabular-nums',
        'focus:outline-none focus:ring-1 focus:ring-ring',
        className,
      )}
    />
  )
}

function EaseSelect({ value, onChange }: { value: EasingKey; onChange: (e: EasingKey) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as EasingKey)}>
      <SelectTrigger className="h-7 flex-1 font-mono text-[11px] bg-background">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {EASINGS.map((e) => (
          <SelectItem key={e} value={e} className="font-mono text-xs">{e}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function Pill({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full px-2.5 py-1 text-xs font-medium transition-colors border',
        active
          ? 'bg-foreground text-background border-foreground'
          : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/40',
      )}
    >
      {children}
    </button>
  )
}
