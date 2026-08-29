import * as React from 'react'
import { Pipette } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { PropertyRow } from './PropertyRow'
import { hexToRgba, hsvToRgb, isLight, rgbaToCss, rgbaToHex, rgbToHsv, type Hsv } from './color'
import type { Rgba, ValueChange } from './types'

/** Alpha is shown over this, so a transparent colour cannot read as white. */
const CHECKERBOARD =
  'repeating-conic-gradient(color-mix(in srgb, currentColor 12%, transparent) 0% 25%, transparent 0% 50%) 0 0 / 8px 8px'

export type ColorSwatchGroup = { label: string; colors: string[] }

export type ColorFieldProps = {
  label: string
  description?: string
  value: Rgba
  authored: Rgba
  onValueChange: ValueChange<Rgba>
  /** P3 fills these: the source artwork's own palette, then the ZEN tokens. */
  swatches?: ColorSwatchGroup[]
  showAlpha?: boolean
  id?: string
}

const sameRgba = (a: Rgba, b: Rgba) => a.every((n, i) => Math.abs(n - b[i]) < 0.002)

/** Drag anywhere on a rect and get 0..1 coordinates, pointer-captured. */
function useDragArea(onMove: (x: number, y: number) => void) {
  const ref = React.useRef<HTMLDivElement>(null)
  const dragging = React.useRef(false)

  const emit = React.useCallback((e: { clientX: number; clientY: number }) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    onMove(
      Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    )
  }, [onMove])

  return {
    ref,
    onPointerDown: (e: React.PointerEvent) => {
      dragging.current = true
      e.currentTarget.setPointerCapture(e.pointerId)
      emit(e)
    },
    onPointerMove: (e: React.PointerEvent) => { if (dragging.current) emit(e) },
    onPointerUp: (e: React.PointerEvent) => {
      dragging.current = false
      e.currentTarget.releasePointerCapture(e.pointerId)
    },
  }
}

export function ColorField({
  label, description, value, authored, onValueChange,
  swatches, showAlpha = true, id,
}: ColorFieldProps) {
  // Hue and saturation are kept locally while the popover is open: dragging to
  // pure black or pure white destroys them in RGB, and a picker that forgets
  // where you were is unusable.
  const [hsv, setHsv] = React.useState<Hsv>(() => rgbToHsv(value[0], value[1], value[2]))
  const [hexDraft, setHexDraft] = React.useState<string | null>(null)
  const [open, setOpen] = React.useState(false)

  // While the popover is OPEN the local HSV is the source of truth; re-derive
  // from the incoming value only once it closes. Adjusted during render, not in
  // an effect, so a colour arriving from elsewhere costs no extra paint.
  const [syncedFrom, setSyncedFrom] = React.useState<string | null>(null)
  const incoming = `${rgbaToHex(value)}:${value[3] ?? 1}`
  if (!open && syncedFrom !== incoming) {
    setSyncedFrom(incoming)
    setHsv(rgbToHsv(value[0], value[1], value[2]))
  }

  const alpha = value[3] ?? 1
  const commit = (next: Hsv, a = alpha, history: 'merge' | 'record' = 'merge') => {
    setHsv(next)
    const [r, g, b] = hsvToRgb(next)
    onValueChange([r, g, b, a], { history })
  }

  const surface = useDragArea((x, y) => commit({ ...hsv, s: x, v: 1 - y }))
  const hueBar = useDragArea((x) => commit({ ...hsv, h: x * 360 }))
  const alphaBar = useDragArea((x) => onValueChange([value[0], value[1], value[2], x], { history: 'merge' }))

  const hex = rgbaToHex(value)
  const solid = rgbaToCss([value[0], value[1], value[2], 1])

  async function pickFromScreen() {
    const EyeDropper = (window as unknown as { EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> } }).EyeDropper
    if (!EyeDropper) return
    try {
      const { sRGBHex } = await new EyeDropper().open()
      const next = hexToRgba(sRGBHex, alpha)
      setHsv(rgbToHsv(next[0], next[1], next[2]))
      onValueChange(next, { history: 'record' })
    } catch { /* the user dismissed the dropper */ }
  }

  const hasEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window

  return (
    <PropertyRow
      label={label}
      description={description}
      modified={!sameRgba(value, authored)}
      onReset={() => onValueChange(authored, { history: 'record' })}
      htmlFor={id}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              id={id}
              type="button"
              aria-label={`${label} — ${hex}`}
              className="pressable flex h-8 w-full items-center gap-2 rounded-control border border-control-border bg-control px-2 hover:bg-control-hover focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            />
          }
        >
          <span
            className="size-4 shrink-0 rounded-[4px] ring-1 ring-foreground/15 text-foreground"
            // A bare colour is only legal as the LAST layer of the `background`
            // shorthand, so `rgba(...), <checkerboard>` drops the whole
            // declaration and every swatch renders empty. Wrap it as a
            // one-stop gradient — a real image layer — to sit over the board.
            style={{ background: `linear-gradient(${rgbaToCss(value)}, ${rgbaToCss(value)}), ${CHECKERBOARD}` }}
          />
          <span className="font-mono text-xs tabular-nums text-foreground">{hex}</span>
          {showAlpha && alpha < 0.999 && (
            <span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground">
              {Math.round(alpha * 100)}%
            </span>
          )}
        </PopoverTrigger>

        <PopoverContent className="w-60 space-y-2.5">
          {/* saturation × value */}
          <div
            {...surface}
            className="relative h-32 w-full cursor-crosshair rounded-control ring-1 ring-foreground/10"
            style={{
              background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h} 100% 50%))`,
            }}
          >
            <span
              className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
              style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: solid }}
            />
          </div>

          {/* hue */}
          <div
            {...hueBar}
            className="relative h-3 w-full cursor-ew-resize rounded-full ring-1 ring-foreground/10"
            style={{ background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}
          >
            <span
              className="pointer-events-none absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
              style={{ left: `${(hsv.h / 360) * 100}%`, background: `hsl(${hsv.h} 100% 50%)` }}
            />
          </div>

          {/* alpha */}
          {showAlpha && (
            <div
              {...alphaBar}
              className="relative h-3 w-full cursor-ew-resize rounded-full text-foreground ring-1 ring-foreground/10"
              style={{ background: `linear-gradient(to right, transparent, ${solid}), ${CHECKERBOARD}` }}
            >
              <span
                className="pointer-events-none absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
                style={{ left: `${alpha * 100}%`, background: rgbaToCss(value) }}
              />
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <input
              value={hexDraft ?? hex}
              onChange={(e) => setHexDraft(e.target.value)}
              onBlur={() => {
                if (hexDraft && /^#?[0-9a-f]{3,8}$/i.test(hexDraft.trim())) {
                  const next = hexToRgba(hexDraft, alpha)
                  setHsv(rgbToHsv(next[0], next[1], next[2]))
                  onValueChange(next, { history: 'record' })
                }
                setHexDraft(null)
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              aria-label="Hex value"
              className="h-7 min-w-0 flex-1 rounded-control border border-control-border bg-control px-2 font-mono text-xs tabular-nums uppercase transition-colors outline-none hover:bg-control-hover focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            {hasEyeDropper && (
              <button
                type="button"
                onClick={pickFromScreen}
                aria-label="Pick a colour from the screen"
                className="pressable inline-flex size-7 shrink-0 items-center justify-center rounded-control border border-control-border bg-control text-muted-foreground hover:bg-control-hover hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <Pipette size={13} />
              </button>
            )}
          </div>

          {swatches?.map((group) => (
            <div key={group.label} className="space-y-1">
              <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                {group.label}
              </p>
              <div className="flex flex-wrap gap-1">
                {group.colors.map((c) => {
                  const rgba = hexToRgba(c, alpha)
                  const active = rgbaToHex(rgba) === hex
                  return (
                    <button
                      key={`${group.label}-${c}`}
                      type="button"
                      title={c}
                      onClick={() => {
                        setHsv(rgbToHsv(rgba[0], rgba[1], rgba[2]))
                        onValueChange(rgba, { history: 'record' })
                      }}
                      className={cn(
                        'pressable size-5 rounded-[5px] ring-1 motion-safe:hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        active ? 'ring-2 ring-foreground' : 'ring-foreground/15'
                      )}
                      style={{ background: c }}
                    >
                      {active && (
                        <span className={cn('block size-1 rounded-full mx-auto', isLight(rgba) ? 'bg-black/70' : 'bg-white/90')} />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </PopoverContent>
      </Popover>
    </PropertyRow>
  )
}
