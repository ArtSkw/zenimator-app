import {
  ColorField, GradientField, NumberField, SelectField, SizeField,
  TextField, ToggleField, type GradientValue, type Rgba,
} from '@/components/params'
import { PARAM_OVERRIDE_PREFIX } from '@/engine/lottie/parameters'
import { useGenerateStore } from '@/store/generateStore'
import type { ResolvedParameter } from '@/store/useParameters'
import { useScenePalette } from '@/store/useScenePalette'

/**
 * Declared content parameters. Where the legacy slot section infers a kind from
 * the value's SHAPE, these carry the kind the studio authored — which is the
 * only way a gradient can ever get a gradient editor rather than a swatch that
 * silently stands in for one stop of four.
 *
 * Every write lands on `param:<id>` and is applied by the same bake that feeds
 * the preview, the exports and the saved project.
 */
export function ParametersSection({ params }: { params: ResolvedParameter[] }) {
  const setSlotOverride = useGenerateStore((s) => s.setSlotOverride)
  const swatches = useScenePalette()
  if (!params.length) return null

  return (
    <div className="space-y-4">
      {params.map(({ spec, value, authored }) => {
        const key = PARAM_OVERRIDE_PREFIX + spec.id
        const commit = (v: unknown) => setSlotOverride(key, v)
        const common = { label: spec.label, description: spec.description, id: spec.id }

        switch (spec.kind) {
          case 'gradient':
            return (
              <GradientField
                key={spec.id} {...common} swatches={swatches}
                value={value as GradientValue}
                authored={authored as GradientValue}
                onValueChange={commit}
              />
            )
          case 'color':
            return (
              <ColorField
                key={spec.id} {...common} swatches={swatches}
                value={toRgba(value)}
                authored={toRgba(authored)}
                onValueChange={(v) => commit([...v])}
              />
            )
          case 'text':
            return (
              <TextField
                key={spec.id} {...common}
                value={String(value ?? '')}
                authored={String(authored ?? '')}
                onValueChange={commit}
              />
            )
          case 'size':
            return (
              <SizeField
                key={spec.id} {...common}
                value={toPair(value)}
                authored={toPair(authored)}
                min={1}
                onValueChange={(v) => commit([...v])}
              />
            )
          case 'number':
            return (
              <NumberField
                key={spec.id} {...common}
                value={Number(value) || 0}
                authored={Number(authored) || 0}
                onValueChange={commit}
              />
            )
          case 'toggle':
            return (
              <ToggleField
                key={spec.id} {...common}
                value={Boolean(value)}
                authored={Boolean(authored)}
                onValueChange={commit}
              />
            )
          case 'select':
            return (
              <SelectField
                key={spec.id} {...common}
                value={String(value ?? '')}
                authored={String(authored ?? '')}
                options={spec.options ?? []}
                onValueChange={commit}
              />
            )
        }
      })}
    </div>
  )
}

const toRgba = (v: unknown): Rgba => {
  const a = Array.isArray(v) ? v.map(Number) : []
  return [a[0] ?? 0, a[1] ?? 0, a[2] ?? 0, a[3] ?? 1]
}
const toPair = (v: unknown): [number, number] => {
  const a = Array.isArray(v) ? v.map(Number) : []
  return [a[0] ?? 0, a[1] ?? 0]
}
