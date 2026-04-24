import { useEffect, useState } from 'react'
import { Slider } from '@/components/ui/slider'
import { ControlRow } from './ControlRow'

type Props = {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  format?: (n: number) => string
  /** Called continuously during drag. */
  onChange: (value: number) => void
  /** Called once on release — typically where playback restart is triggered. */
  onCommit?: (value: number) => void
}

/**
 * A numeric slider bound to a param. Drags update the display value and the
 * underlying state (via `onChange`). Releasing the slider triggers
 * `onCommit` — that's where the preview restarts for a smooth replay.
 */
export function ParamSlider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  format,
  onChange,
  onCommit,
}: Props) {
  const [local, setLocal] = useState<number>(value)

  useEffect(() => {
    setLocal(value)
  }, [value])

  const display = format ? format(local) : `${local}${unit}`

  return (
    <ControlRow label={label} value={display}>
      <Slider
        value={[local]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => {
          const n = typeof v === 'number' ? v : v[0]
          setLocal(n)
          onChange(n)
        }}
        onValueCommitted={(v) => {
          const n = typeof v === 'number' ? v : v[0]
          onCommit?.(n)
        }}
      />
    </ControlRow>
  )
}
