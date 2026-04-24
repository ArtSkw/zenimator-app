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
  Wand2,
  Loader2,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react'
import { ControlRow } from '@/components/controls/ControlRow'
import { useSceneStore } from '@/store/sceneStore'
import { useSettingsStore } from '@/store/settingsStore'
import { usePlaybackStore } from '@/store/playbackStore'
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
              onEdit({ template: t })
              onCommit()
            }}
          />

          <ParamSlider
            label="Duration"
            value={params.duration}
            min={100}
            max={2000}
            step={50}
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

          <EasingPicker
            value={params.easing}
            onChange={(e) => {
              onEdit({ params: { easing: e } })
              onCommit()
            }}
          />

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
