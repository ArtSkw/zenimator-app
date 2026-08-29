import { Link2, Unlink2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { PropertyRow } from './PropertyRow'
import { ScrubbableNumber } from './ScrubbableNumber'
import type { ValueChange } from './types'

export type SizeValue = [number, number]

export type SizeFieldProps = {
  label: string
  description?: string
  value: SizeValue
  authored: SizeValue
  onValueChange: ValueChange<SizeValue>
  min?: number
  max?: number
  /** Lock the aspect ratio; scaling one axis scales the other. */
  linked?: boolean
  onLinkedChange?: (linked: boolean) => void
  suffix?: string
  id?: string
}

export function SizeField({
  label, description, value, authored, onValueChange,
  min = 0, max, linked = false, onLinkedChange, suffix = 'px', id,
}: SizeFieldProps) {
  const modified = value[0] !== authored[0] || value[1] !== authored[1]

  function setAxis(axis: 0 | 1, next: number, committed: boolean) {
    const meta = { history: committed ? ('record' as const) : ('merge' as const) }
    if (!linked) {
      const out: SizeValue = axis === 0 ? [next, value[1]] : [value[0], next]
      return onValueChange(out, meta)
    }
    // Ratio is taken from the CURRENT pair, so a locked drag preserves whatever
    // proportion the user is looking at rather than the authored one.
    const from = value[axis] || 1
    const ratio = next / from
    onValueChange(
      axis === 0 ? [next, value[1] * ratio] : [value[0] * ratio, next],
      meta
    )
  }

  return (
    <PropertyRow
      label={label}
      description={description}
      modified={modified}
      onReset={() => onValueChange(authored, { history: 'record' })}
      htmlFor={id}
    >
      <div className="flex items-center gap-1.5">
        <ScrubbableNumber
          id={id} value={value[0]} min={min} max={max} suffix={suffix}
          aria-label={`${label} width`}
          onValueChange={(n, c) => setAxis(0, n, c)}
        />
        <span className="text-xs text-muted-foreground">×</span>
        <ScrubbableNumber
          value={value[1]} min={min} max={max} suffix={suffix}
          aria-label={`${label} height`}
          onValueChange={(n, c) => setAxis(1, n, c)}
        />
        {onLinkedChange && (
          <button
            type="button"
            onClick={() => onLinkedChange(!linked)}
            aria-label={linked ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
            aria-pressed={linked}
            className={cn(
              'pressable inline-flex size-7 shrink-0 items-center justify-center rounded-control border border-control-border bg-control hover:bg-control-hover focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
              linked ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            {linked ? <Link2 size={13} /> : <Unlink2 size={13} />}
          </button>
        )}
      </div>
    </PropertyRow>
  )
}
