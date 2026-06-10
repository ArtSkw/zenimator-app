import { useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import {
  SlidersHorizontal,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  RotateCw,
  Wand2,
  Loader2,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react'
import { ControlRow } from '@/components/controls/ControlRow'
import { useSceneStore } from '@/store/sceneStore'
import { useSettingsStore } from '@/store/settingsStore'
import { usePlaybackStore } from '@/store/playbackStore'
import { useGenerateStore } from '@/store/generateStore'
import { GenerateControlsPanel } from '@/components/generate/GenerateControlsPanel'
import { ParamSlider } from '@/components/controls/ParamSlider'
import { TemplatePicker } from '@/components/controls/TemplatePicker'
import { EasingPicker } from '@/components/controls/EasingPicker'
import { rasterizeSvg } from '@/engine/detector/rasterize'
import { regenerateGroupAnimation } from '@/engine/llm/regenerator'
import { humanizeLlmError } from '@/engine/llm/errors'
import type {
  Scene,
  AnimationTemplateId,
  AnimationBinding,
  AnimatableGroup,
} from '@/engine/scene/types'

const SLIDE_TEMPLATES: AnimationTemplateId[] = [
  'slide-up',
  'slide-down',
  'slide-left',
  'slide-right',
]
const SCALE_TEMPLATES: AnimationTemplateId[] = ['scale-in', 'pop-in']

// Per-template amplitude bounds, mirrors AMPLITUDE_BOUNDS in proposer.
const AMPLITUDE_CONFIG: Partial<
  Record<AnimationTemplateId, { min: number; max: number; step: number; unit?: string; format?: (n: number) => string; fallback: number }>
> = {
  breathe: { min: 0.005, max: 0.05, step: 0.005, fallback: 0.02, format: (n) => `${(n * 100).toFixed(1)}%` },
  float:   { min: 2, max: 20, step: 1, unit: 'px', fallback: 6 },
  drift:   { min: 2, max: 40, step: 1, unit: 'px', fallback: 8 },
  shimmer: { min: 0.05, max: 0.5, step: 0.05, fallback: 0.3, format: (n) => n.toFixed(2) },
}

export function ControlsPanel() {
  const {
    scene,
    selectedGroupId,
    editGroupAnimation,
    replaceGroupAnimation,
    resetGroupAnimation,
    originalBindings,
  } = useSceneStore()
  const { showRationale, apiKey, model, useLlmGrouping } = useSettingsStore()
  const { restart } = usePlaybackStore()
  const genActive = useGenerateStore((s) => s.active)
  const genProject = useGenerateStore((s) => s.project)

  // In the generate lane, edit the generated project's per-layer motion instead.
  if (genActive && genProject) return <GenerateControlsPanel />

  const selectedGroup = scene?.groups.find((g) => g.id === selectedGroupId) ?? null
  const canRegenerate =
    !!selectedGroup && !!scene && useLlmGrouping && apiKey.trim().length > 0

  return (
    <aside className="w-[320px] border-l border-border bg-background flex flex-col shrink-0">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <SlidersHorizontal size={14} className="text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Controls
        </span>
        {selectedGroup && (
          <span className="ml-auto text-xs text-muted-foreground truncate max-w-[120px]">
            {selectedGroup.label}
          </span>
        )}
      </div>

      <ScrollArea className="flex-1">
        {scene && selectedGroup ? (
          <GroupEditor
            key={selectedGroup.id}
            group={selectedGroup}
            category={scene.category}
            viewport={scene.viewport}
            showRationale={showRationale}
            onEdit={(patch) => {
              editGroupAnimation(selectedGroup.id, patch)
            }}
            onCommit={() => restart()}
            onReset={() => {
              resetGroupAnimation(selectedGroup.id)
              restart()
            }}
            canReset={
              JSON.stringify(originalBindings[selectedGroup.id]) !==
              JSON.stringify(selectedGroup.animation)
            }
            canRegenerate={canRegenerate}
            onRegenerate={async () => {
              if (!scene) return
              const svgText = scene.source.originalRaw ?? scene.source.raw
              const pngDataUrl = await rasterizeSvg(svgText)
              const result = await regenerateGroupAnimation(
                {
                  previewPngDataUrl: pngDataUrl,
                  category: scene.category,
                  targetGroup: selectedGroup,
                },
                { apiKey, model },
              )
              replaceGroupAnimation(selectedGroup.id, result.animation, result.rationale)
              restart()
            }}
          />
        ) : (
          <Empty className="py-10 border-none">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SlidersHorizontal />
              </EmptyMedia>
              <EmptyTitle>Nothing selected</EmptyTitle>
              <EmptyDescription>Select a layer to edit its animation.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </ScrollArea>
    </aside>
  )
}

// ---------------------------------------------------------------------------
// Per-selection editor
// ---------------------------------------------------------------------------

type EditorProps = {
  group: AnimatableGroup
  category: Scene['category']
  viewport: Scene['viewport']
  showRationale: boolean
  onEdit: (patch: { template?: AnimationTemplateId; params?: Partial<AnimationBinding['params']>; timing?: { start: number } }) => void
  onCommit: () => void
  onReset: () => void
  canReset: boolean
  canRegenerate: boolean
  onRegenerate: () => Promise<void>
}

function GroupEditor({
  group,
  category,
  viewport,
  showRationale,
  onEdit,
  onCommit,
  onReset,
  canReset,
  canRegenerate,
  onRegenerate,
}: EditorProps) {
  const [regenerating, setRegenerating] = useState(false)
  const [regenError, setRegenError] = useState<string | null>(null)

  const anim = group.animation
  const params = anim?.params
  const template = anim?.template ?? 'none'

  const handleRegenerate = async () => {
    setRegenerating(true)
    setRegenError(null)
    try {
      await onRegenerate()
    } catch (err) {
      setRegenError(humanizeLlmError(err))
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div className="p-4 space-y-4">
      {group.warning && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900 flex gap-2">
          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
          <span className="leading-snug">
            This group renders but can't animate:{' '}
            <span className="font-medium">{group.warning}</span>
          </span>
        </div>
      )}

      {showRationale && group.rationale && !group.warning && (
        <div className="rounded-md bg-muted/50 border border-border px-3 py-2 text-xs flex gap-2">
          <Sparkles size={12} className="shrink-0 mt-0.5 text-muted-foreground" />
          <span className="leading-snug">{group.rationale}</span>
        </div>
      )}

      <section className="space-y-1">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
          Group
        </p>
        <p className="text-sm font-medium">{group.label}</p>
        <p className="text-[11px] text-muted-foreground font-mono">{group.tag}</p>
      </section>

      <Separator />

      {anim && params ? (
        <div className="space-y-4">
          <TemplatePicker
            category={category}
            value={template}
            onChange={(t) => {
              // Rotate must use linear easing to avoid overshoot reversal at cycle end.
              onEdit({ template: t, ...(t === 'rotate' ? { params: { easing: 'linear' } } : {}) })
              onCommit()
            }}
          />

          <ParamSlider
            label="Duration"
            value={params.duration}
            min={100}
            max={category === 'ambient' ? 12000 : 2000}
            step={category === 'ambient' ? 100 : 50}
            unit="ms"
            onChange={(v) => onEdit({ params: { duration: v } })}
            onCommit={onCommit}
          />

          <ParamSlider
            label="Start"
            value={anim.timing.start}
            min={0}
            max={2500}
            step={50}
            unit="ms"
            onChange={(v) => onEdit({ timing: { start: v } })}
            onCommit={onCommit}
          />

          {/* Rotate always runs at linear speed — showing the picker would mislead */}
          {template !== 'rotate' && (
            <EasingPicker
              value={params.easing}
              onChange={(e) => {
                onEdit({ params: { easing: e } })
                onCommit()
              }}
            />
          )}

          {SLIDE_TEMPLATES.includes(template) && (
            <ParamSlider
              label="Distance"
              value={params.distance ?? 24}
              min={8}
              max={96}
              step={1}
              unit="px"
              onChange={(v) => onEdit({ params: { distance: v } })}
              onCommit={onCommit}
            />
          )}

          {SCALE_TEMPLATES.includes(template) && (
            <ParamSlider
              label="Scale from"
              value={params.scaleFrom ?? (template === 'pop-in' ? 0.6 : 0.92)}
              min={0.5}
              max={1}
              step={0.02}
              format={(n) => n.toFixed(2)}
              onChange={(v) => onEdit({ params: { scaleFrom: v } })}
              onCommit={onCommit}
            />
          )}

          {template === 'stagger-children' && (
            <ParamSlider
              label="Stagger"
              value={params.staggerMs ?? 60}
              min={0}
              max={200}
              step={10}
              unit="ms"
              onChange={(v) => onEdit({ params: { staggerMs: v } })}
              onCommit={onCommit}
            />
          )}

          {AMPLITUDE_CONFIG[template] && (
            <ParamSlider
              label="Amplitude"
              value={params.amplitude ?? AMPLITUDE_CONFIG[template]!.fallback}
              min={AMPLITUDE_CONFIG[template]!.min}
              max={AMPLITUDE_CONFIG[template]!.max}
              step={AMPLITUDE_CONFIG[template]!.step}
              unit={AMPLITUDE_CONFIG[template]!.unit}
              format={AMPLITUDE_CONFIG[template]!.format}
              onChange={(v) => onEdit({ params: { amplitude: v } })}
              onCommit={onCommit}
            />
          )}

          {template === 'drift' && (
            <ControlRow label="Axis">
              <div className="flex gap-1">
                {([
                  { value: 'x' as const, label: 'Horizontal' },
                  { value: 'y' as const, label: 'Vertical' },
                ]).map(({ value, label }) => (
                  <Button
                    key={value}
                    variant={(params.driftAxis ?? 'x') === value ? 'default' : 'secondary'}
                    size="sm"
                    className="rounded-full flex-1"
                    onClick={() => { onEdit({ params: { driftAxis: value } }); onCommit() }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </ControlRow>
          )}

          {template === 'rotate' && (
            <ControlRow label="Direction">
              <div className="flex gap-1">
                {([
                  { value: 'cw'  as const, Icon: RotateCw,  label: 'Clockwise' },
                  { value: 'ccw' as const, Icon: RotateCcw, label: 'Counter' },
                ]).map(({ value, Icon, label }) => (
                  <Button
                    key={value}
                    variant={(params.rotateDirection ?? 'cw') === value ? 'default' : 'secondary'}
                    size="sm"
                    className="rounded-full flex-1 gap-1.5"
                    onClick={() => { onEdit({ params: { rotateDirection: value } }); onCommit() }}
                  >
                    <Icon size={12} />
                    {label}
                  </Button>
                ))}
              </div>
            </ControlRow>
          )}

          {template === 'rotate' && (() => {
            const defaultX = parseFloat(((group.bounds.x + group.bounds.width / 2) / viewport.width * 100).toFixed(1))
            const defaultY = parseFloat(((group.bounds.y + group.bounds.height / 2) / viewport.height * 100).toFixed(1))
            const pivotX = params.rotateOriginX ?? defaultX
            const pivotY = params.rotateOriginY ?? defaultY
            return (
              <>
                <ParamSlider
                  label="Pivot X"
                  value={pivotX}
                  min={0}
                  max={100}
                  step={0.1}
                  format={(n) => `${n.toFixed(1)}% · ${Math.round(n / 100 * viewport.width)}px`}
                  onChange={(v) => onEdit({ params: { rotateOriginX: v } })}
                  onCommit={onCommit}
                />
                <ParamSlider
                  label="Pivot Y"
                  value={pivotY}
                  min={0}
                  max={100}
                  step={0.1}
                  format={(n) => `${n.toFixed(1)}% · ${Math.round(n / 100 * viewport.height)}px`}
                  onChange={(v) => onEdit({ params: { rotateOriginY: v } })}
                  onCommit={onCommit}
                />
                <p className="text-[10px] text-muted-foreground leading-snug">
                  Set pivot to the rotation center in the SVG (e.g. clock face center). Default is the group's bounding-box center.
                </p>
              </>
            )
          })()}

          {template === 'draw-stroke' && (
            <ControlRow label="Direction">
              <div className="flex gap-1">
                {([
                  { value: false, Icon: ArrowRight, label: 'Forward' },
                  { value: true,  Icon: ArrowLeft,  label: 'Reverse' },
                ] as const).map(({ value, Icon, label }) => (
                  <Button
                    key={label}
                    variant={!!params.drawReverse === value ? 'default' : 'secondary'}
                    size="sm"
                    className="rounded-full flex-1 gap-1.5"
                    onClick={() => { onEdit({ params: { drawReverse: value } }); onCommit() }}
                  >
                    <Icon size={12} />
                    {label}
                  </Button>
                ))}
              </div>
            </ControlRow>
          )}

          <Separator />

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full flex-1"
              onClick={onReset}
              disabled={!canReset}
            >
              <RotateCcw size={12} />
              Reset
            </Button>
            <Button
              variant="default"
              size="sm"
              className="rounded-full flex-1"
              onClick={handleRegenerate}
              disabled={!canRegenerate || regenerating}
              title={
                !canRegenerate
                  ? 'Needs an API key and LLM grouping enabled in Settings'
                  : undefined
              }
            >
              {regenerating ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Regenerating…
                </>
              ) : (
                <>
                  <Wand2 size={12} />
                  Regenerate
                </>
              )}
            </Button>
          </div>

          {regenError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive flex gap-2">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              <span className="leading-snug">{regenError}</span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          No animation assigned. The LLM didn't propose one for this group.
        </p>
      )}
    </div>
  )
}
