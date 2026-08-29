import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * A numeric readout you can DRAG to scrub or CLICK to type into. Lifted as a
 * pattern (not code) from toolcraft's editable slider value label, because a
 * parameter panel with a slider per row is a wall of tracks — this gives fine
 * control in the width of a number.
 *
 * Numbers are JetBrains Mono with tabular figures, per the house rule: a value
 * must not reflow while it changes.
 */
export type ScrubbableNumberProps = {
  value: number
  onValueChange: (value: number, committed: boolean) => void
  min?: number
  max?: number
  /** Units per pixel of horizontal drag. */
  step?: number
  precision?: number
  suffix?: string
  disabled?: boolean
  'aria-label'?: string
  className?: string
  id?: string
}

const clampTo = (n: number, min?: number, max?: number) =>
  Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n))

export function ScrubbableNumber({
  value,
  onValueChange,
  min,
  max,
  step = 1,
  precision = 0,
  suffix,
  disabled,
  className,
  id,
  ...aria
}: ScrubbableNumberProps) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState('')
  const dragRef = React.useRef<{ x: number; from: number; moved: boolean } | null>(null)

  const display = value.toFixed(precision)

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (disabled || editing) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { x: e.clientX, from: value, moved: false }
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.x
    if (!d.moved && Math.abs(dx) < 3) return // a click is not a drag
    d.moved = true
    // Shift = fine, Alt = coarse. Same modifier vocabulary as the timeline.
    const scale = e.shiftKey ? 0.1 : e.altKey ? 10 : 1
    onValueChange(clampTo(d.from + dx * step * scale, min, max), false)
  }

  function onPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    const d = dragRef.current
    dragRef.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
    if (!d) return
    if (d.moved) onValueChange(value, true)
    else {
      setDraft(display)
      setEditing(true)
    }
  }

  function commitDraft() {
    const parsed = Number.parseFloat(draft)
    setEditing(false)
    if (Number.isFinite(parsed)) onValueChange(clampTo(parsed, min, max), true)
  }

  const shell =
    'h-7 w-full rounded-control border border-control-border bg-control px-2 text-left font-mono text-xs tabular-nums text-foreground transition-colors'

  if (editing) {
    return (
      <input
        id={id}
        autoFocus
        value={draft}
        inputMode="decimal"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitDraft()
          if (e.key === 'Escape') setEditing(false)
        }}
        className={cn(shell, 'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50', className)}
      />
    )
  }

  return (
    <button
      id={id}
      type="button"
      disabled={disabled}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={(e) => {
        const bump = e.shiftKey ? step * 10 : step
        if (e.key === 'ArrowUp') { e.preventDefault(); onValueChange(clampTo(value + bump, min, max), true) }
        if (e.key === 'ArrowDown') { e.preventDefault(); onValueChange(clampTo(value - bump, min, max), true) }
      }}
      className={cn(
        shell,
        'pressable cursor-ew-resize select-none hover:bg-control-hover focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...aria}
    >
      {display}
      {suffix && <span className="ml-0.5 text-muted-foreground">{suffix}</span>}
    </button>
  )
}
