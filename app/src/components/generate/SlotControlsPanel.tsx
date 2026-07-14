/**
 * Phase 3 — Parametric controls panel.
 *
 * Renders the controls derived from the agent's finished animation
 * (engine/controls/deriveControls): auto basics plus the agent's bespoke knobs.
 * A control may be a slider (amplitude / timing), a select (named steps or the
 * "feel"/easing presets), or a toggle (on/off). All commit ON RELEASE / change —
 * each apply re-writes the underlying keyframes and reparses Skottie, so we keep
 * dragging smooth by committing once. Values are stored as numbers in the store.
 */

import { useGenerateStore } from '@/store/generateStore'
import type { ParamControl, ControlManifest } from '@/engine/controls/deriveControls'
import { ParamSlider } from '@/components/controls/ParamSlider'
import { ParamSelect } from '@/components/controls/ParamSelect'
import { ParamSwitch } from '@/components/controls/ParamSwitch'

interface SlotControlsPanelProps {
  manifest: ControlManifest
}

export function SlotControlsPanel({ manifest }: SlotControlsPanelProps) {
  const { slotOverrides, setSlotOverride } = useGenerateStore()
  if (!manifest.controls.length) return null

  return (
    <div className="space-y-6">
      {manifest.controls.map((ctrl) => {
        const stored = slotOverrides[ctrl.id]
        const value = typeof stored === 'number' ? stored : ctrl.value
        return (
          <div key={ctrl.id} className="space-y-1">
            <ControlRow ctrl={ctrl} value={value} onCommit={(n) => setSlotOverride(ctrl.id, n)} />
            {ctrl.description && (
              <p className="text-xs leading-snug text-muted-foreground">{ctrl.description}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ControlRow({ ctrl, value, onCommit }: { ctrl: ParamControl; value: number; onCommit: (n: number) => void }) {
  if (ctrl.control === 'select' && ctrl.options?.length) {
    return (
      <ParamSelect
        label={ctrl.label}
        value={String(value)}
        originValue={String(ctrl.value)}
        options={ctrl.options.map((o) => ({ label: o.label, value: String(o.value) }))}
        onChange={(v) => onCommit(Number(v))}
      />
    )
  }

  if (ctrl.control === 'toggle') {
    const off = ctrl.offValue ?? 0
    return (
      <ParamSwitch
        label={ctrl.label}
        checked={value !== off}
        origin={ctrl.value !== off}
        onChange={(on) => onCommit(on ? ctrl.value : off)}
      />
    )
  }

  return (
    <ParamSlider
      label={ctrl.label}
      value={value}
      min={ctrl.min ?? 0}
      max={ctrl.max ?? 100}
      step={ctrl.step ?? 1}
      unit={ctrl.unit ?? ''}
      origin={ctrl.value}
      onChange={() => {}}
      onCommit={onCommit}
    />
  )
}
