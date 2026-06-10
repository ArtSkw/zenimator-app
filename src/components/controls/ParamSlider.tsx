import { useEffect, useRef, useState } from 'react'
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
  onChange,
  onCommit,
}: Props) {
  const [local, setLocal]     = useState(value)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState('')
  const [error, setError]     = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync when the prop changes from outside (store update / reset).
  useEffect(() => { setLocal(value) }, [value])

  // Auto-select the entire value on entry so the user can type immediately.
  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  const display = format ? format(local) : `${local}${unit}`

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
    <div className="space-y-1.5">
      {/* ── Header: label left, value/input right ── */}
      <div className="flex items-center gap-2">
        <span className="flex-1 min-w-0 truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>

        {editing ? (
          <TooltipProvider>
            <Tooltip open={!!error}>
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
          </TooltipProvider>
        ) : (
          <button
            type="button"
            onClick={startEdit}
            title="Click to type a value"
            className="shrink-0 max-w-[55%] truncate text-right text-[11px] font-mono tabular-nums text-muted-foreground transition-colors hover:text-foreground cursor-text"
          >
            {display}
          </button>
        )}
      </div>

      {/* ── Slider ── */}
      <Slider
        value={[local]}
        min={min}
        max={max}
        step={step}
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
  )
}
