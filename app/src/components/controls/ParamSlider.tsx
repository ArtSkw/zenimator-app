import { useEffect, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type Props = {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  format?: (n: number) => string
  /** The AI-default value: shows a tick on the track and a reset affordance when
   *  the current value has moved away from it. */
  origin?: number
  /** Called continuously during drag. */
  onChange: (value: number) => void
  /** Called once on release — typically where playback restart is triggered. */
  onCommit?: (value: number) => void
}

/**
 * A numeric slider bound to a param. The displayed value is clickable: a
 * single click opens an inline <input> pre-filled with the current value.
 * Press Enter or blur to commit; Escape cancels. Non-numeric input shows a
 * validation tooltip and keeps the field open. Out-of-range values are
 * silently clamped to [min, max].
 */
export function ParamSlider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  format,
  origin,
  onChange,
  onCommit,
}: Props) {
  // Clamp to range so an out-of-range stored value (e.g. an LLM-set 0.1 where
  // the floor is 2) never renders the thumb off the track or fills it whole.
  const clampToRange = (n: number) => Math.min(max, Math.max(min, n))
  const [local, setLocal]     = useState(clampToRange(value))
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState('')
  const [error, setError]     = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync when the prop changes from outside (store update / reset).
  useEffect(() => { setLocal(clampToRange(value)) }, [value, min, max])

  // Auto-select the entire value on entry so the user can type immediately.
  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  const display = format ? format(local) : `${local}${unit}`
  const canReset = origin != null && Math.round(local) !== Math.round(origin)
  const resetToOrigin = () => { if (origin != null) apply(origin) }

  function validate(s: string): { ok: true; n: number } | { ok: false; msg: string } {
    const trimmed = s.trim()
    if (trimmed === '') return { ok: false, msg: 'Enter a number' }
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed)) return { ok: false, msg: 'Must be a number' }
    return { ok: true, n: Math.min(max, Math.max(min, parsed)) }
  }

  function apply(n: number) {
    setLocal(n)
    setEditing(false)
    setError(null)
    onChange(n)
    onCommit?.(n)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const r = validate(draft)
      if (!r.ok) { setError(r.msg); return }
      apply(r.n)
    } else if (e.key === 'Escape') {
      setEditing(false)
      setError(null)
    }
  }

  function handleBlur() {
    // On blur with invalid input cancel rather than leaving the field stuck open.
    const r = validate(draft)
    if (!r.ok) { setEditing(false); setError(null); return }
    apply(r.n)
  }

  function handleDraftChange(s: string) {
    setDraft(s)
    const r = validate(s)
    setError(r.ok ? null : r.msg)
  }

  function startEdit() {
    setDraft(String(local))
    setError(null)
    setEditing(true)
  }

  return (
    <TooltipProvider>
      <div className="group space-y-1.5">
      {/* ── Header: label left, value/input right ── */}
      <div className="flex items-center gap-2">
        <span className="flex-1 min-w-0 truncate text-xs font-medium text-foreground/90">
          {label}
        </span>

        {canReset && (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={resetToOrigin}
                  aria-label="Reset to AI default"
                  className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <RotateCcw size={11} />
                </button>
              }
            />
            <TooltipContent side="top">Reset to AI default</TooltipContent>
          </Tooltip>
        )}

        {editing ? (
          // Distinct `key` from the idle Tooltip below: without it React
          // reconciles the two ternary branches as ONE Tooltip instance, so
          // `open` flips boolean↔undefined across edit toggles — Base UI's
          // "switching controlled/uncontrolled" warning. Separate keys keep
          // this one always-controlled and the other always-uncontrolled.
          <Tooltip key="edit" open={!!error}>
            {/* Base UI uses `render` (not `asChild`); the input is the tooltip anchor. */}
            <TooltipTrigger
              render={
                <span className="inline-flex shrink-0">
                  <input
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => handleDraftChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleBlur}
                    aria-invalid={error ? true : undefined}
                    className={[
                      'h-5 w-[4.5rem] rounded border bg-transparent px-1.5',
                      'text-right text-[11px] font-mono tabular-nums text-foreground',
                      'outline-none transition-colors',
                      'border-input focus:border-ring focus:ring-1 focus:ring-ring/50',
                      'aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20',
                    ].join(' ')}
                  />
                </span>
              }
            />
            <TooltipContent side="top">{error}</TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip key="display">
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={startEdit}
                  aria-label="Click to enter value manually"
                  className="shrink-0 max-w-[55%] truncate text-right text-[11px] font-mono tabular-nums text-muted-foreground transition-colors hover:text-foreground cursor-text"
                >
                  {display}
                </button>
              }
            />
            <TooltipContent side="top">Enter manually</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* ── Slider ── */}
      <Slider
        value={[local]}
        min={min}
        max={max}
        step={step}
        origin={origin}
        onValueChange={(v) => {
          const n = Array.isArray(v) ? v[0] : v
          // Dragging the slider while the input is open: exit edit mode silently.
          if (editing) { setEditing(false); setError(null) }
          setLocal(n)
          onChange(n)
        }}
        onValueCommitted={(v) => {
          const n = Array.isArray(v) ? v[0] : v
          onCommit?.(n)
        }}
      />
    </div>
    </TooltipProvider>
  )
}
