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
import { NumberField, SelectField, ToggleField } from '@/components/params'

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
          <ControlRow
            key={ctrl.id}
            ctrl={ctrl}
            value={value}
            onCommit={(n) => setSlotOverride(ctrl.id, n)}
          />
        )
      })}
    </div>
  )
}

/**
 * Scene-wide knobs render through the SAME field family as content parameters
 * and layer controls. There is no second styling for "engine" controls: one
 * look, one reset affordance, one origin tick — see BRIEF, "The control
 * surface". The three bespoke Param* components this replaced were used only
 * here and are gone.
 */
function ControlRow({ ctrl, value, onCommit }: { ctrl: ParamControl; value: number; onCommit: (n: number) => void }) {
  if (ctrl.control === 'select' && ctrl.options?.length) {
    return (
      <SelectField
        label={ctrl.label}
        description={ctrl.description}
        value={String(value)}
        authored={String(ctrl.value)}
        options={ctrl.options.map((o) => ({ label: o.label, value: String(o.value) }))}
        onValueChange={(v) => onCommit(Number(v))}
      />
    )
  }

  if (ctrl.control === 'toggle') {
    const off = ctrl.offValue ?? 0
    return (
      <ToggleField
        label={ctrl.label}
        description={ctrl.description}
        value={value !== off}
        authored={ctrl.value !== off}
        onValueChange={(on) => onCommit(on ? ctrl.value : off)}
      />
    )
  }

  const step = ctrl.step ?? 1
  return (
    <NumberField
      label={ctrl.label}
      description={ctrl.description}
      value={value}
      authored={ctrl.value}
      min={ctrl.min ?? 0}
      max={ctrl.max ?? 100}
      step={step}
      // Fractional steps (0.1s) need a decimal readout; whole steps must not
      // grow a trailing ".0".
      precision={Number.isInteger(step) ? 0 : 1}
      suffix={ctrl.unit ?? undefined}
      slider
      onValueChange={onCommit}
    />
  )
}
