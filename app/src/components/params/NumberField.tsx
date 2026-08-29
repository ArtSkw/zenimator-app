import { PropertyRow } from './PropertyRow'
import { ScrubbableNumber } from './ScrubbableNumber'
import { Slider } from '@/components/ui/slider'
import type { ValueChange } from './types'

export type NumberFieldProps = {
  label: string
  description?: string
  value: number
  authored: number
  onValueChange: ValueChange<number>
  min?: number
  max?: number
  step?: number
  precision?: number
  suffix?: string
  /** Show a track alongside the number. Off by default — few knobs, little chrome. */
  slider?: boolean
  id?: string
}

export function NumberField({
  label, description, value, authored, onValueChange,
  min, max, step = 1, precision = 0, suffix, slider = false, id,
}: NumberFieldProps) {
  const modified = value !== authored

  return (
    <PropertyRow
      label={label}
      description={description}
      modified={modified}
      onReset={() => onValueChange(authored, { history: 'record' })}
      htmlFor={id}
    >
      <div className="flex items-center gap-2">
        {slider && min != null && max != null && (
          <Slider
            value={[value]}
            min={min}
            max={max}
            step={step}
            origin={authored}
            onValueChange={(v) =>
              onValueChange(Array.isArray(v) ? v[0] : v, { history: 'merge' })
            }
            className="flex-1"
          />
        )}
        <ScrubbableNumber
          id={id}
          value={value}
          min={min}
          max={max}
          step={step}
          precision={precision}
          suffix={suffix}
          aria-label={label}
          className={slider ? 'w-20 shrink-0' : 'w-full'}
          onValueChange={(v, committed) =>
            onValueChange(v, { history: committed ? 'record' : 'merge' })
          }
        />
      </div>
    </PropertyRow>
  )
}
