import * as React from 'react'
import { RotateCcw } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * One parameter, one row. Carries the two halves of the controls contract that
 * every knob owes the user: it is EXPLAINED (an optional plain-language line)
 * and ANCHORED (an origin tick at the authored default, reset always one click
 * away). The reset recomputes from the pristine value — it never un-does the
 * last drag, so repeated edits cannot compound.
 */
export type PropertyRowProps = {
  label: string
  description?: string
  /** True when the live value differs from what the engine authored. */
  modified?: boolean
  onReset?: () => void
  /**
   * `stacked` — control under the label (fields, sliders).
   * `row` — control ON the label line, right-aligned (switches, compact picks).
   * `inline` — control under the label but laid out horizontally.
   */
  layout?: 'inline' | 'stacked' | 'row'
  htmlFor?: string
  children: React.ReactNode
  className?: string
}

export function PropertyRow({
  label,
  description,
  modified = false,
  onReset,
  layout = 'stacked',
  htmlFor,
  children,
  className,
}: PropertyRowProps) {
  const showReset = modified && onReset != null

  const resetButton = showReset && (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={onReset}
            aria-label={`Reset ${label} to the authored value`}
            className="-mr-1 pressable inline-flex size-5 shrink-0 items-center justify-center rounded-control text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
        }
      >
        <RotateCcw size={12} strokeWidth={2} />
      </TooltipTrigger>
      <TooltipContent>Back to the authored value</TooltipContent>
    </Tooltip>
  )

  return (
    <div className={cn('space-y-1.5', className)} data-slot="property-row">
      <div className="flex min-h-5 items-center justify-between gap-2">
        <label
          htmlFor={htmlFor}
          className="flex items-center gap-1.5 text-xs font-medium text-foreground"
        >
          {label}
          {/* The origin tick: present whenever the value has moved off the
              authored default, absent when it sits on it. */}
          <span
            aria-hidden
            className={cn(
              'size-1 rounded-full bg-foreground/40 transition-opacity',
              modified ? 'opacity-100' : 'opacity-0'
            )}
          />
        </label>

        {layout === 'row' ? (
          <div className="flex shrink-0 items-center gap-1.5">
            {resetButton}
            {children}
          </div>
        ) : (
          resetButton
        )}
      </div>

      {layout !== 'row' && (
        <div className={cn(layout === 'inline' && 'flex items-center gap-2')}>{children}</div>
      )}

      {description && (
        <p className="text-xs leading-snug text-muted-foreground">{description}</p>
      )}
    </div>
  )
}
