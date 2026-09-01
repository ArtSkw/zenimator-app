import * as React from 'react'
import { ArrowLeftRight, Plus } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { PropertyRow } from './PropertyRow'
import { ColorField, type ColorSwatchGroup } from './ColorField'
import { ScrubbableNumber } from './ScrubbableNumber'
import { hexToRgba, rgbaToHex } from './color'
import type { GradientKind, GradientValue, Rgba, ValueChange } from './types'

import { GradientStopsTrack } from './vendor/gradient-stops-track'
import { useGradientStopsController } from './vendor/gradient-stops-controller'
import {
  getGradientBackground,
  maxGradientStops,
  parseStopOpacity,
  parseStopPosition,
} from './vendor/gradient-control-utils'

/**
 * The control this whole phase exists for. A flat swatch over a gradient was a
 * lie about the artwork; this edits the real stops.
 *
 * Only `linear` and `radial` are offered — Lottie has no conic or diamond, so
 * offering them would author a value no player can render.
 */
export type GradientFieldProps = {
  label: string
  description?: string
  value: GradientValue
  authored: GradientValue
  onValueChange: ValueChange<GradientValue>
  swatches?: ColorSwatchGroup[]
  /** Taken for a uniform call site but deliberately NOT forwarded: Base UI
   *  owns the trigger's id. */
  id?: string
}

const KIND_OPTIONS: { value: GradientKind; label: string }[] = [
  { value: 'linear', label: 'Linear' },
  { value: 'radial', label: 'Radial' },
]

const sameGradient = (a: GradientValue, b: GradientValue) =>
  a.type === b.type &&
  (a.angle ?? 90) === (b.angle ?? 90) &&
  a.stops.length === b.stops.length &&
  a.stops.every((s, i) =>
    s.color.toUpperCase() === b.stops[i].color.toUpperCase() &&
    (s.opacity ?? 100) === (b.stops[i].opacity ?? 100) &&
    parseStopPosition(s.position) === parseStopPosition(b.stops[i].position)
  )

export function GradientField({
  label, description, value, authored, onValueChange, swatches,
}: GradientFieldProps) {
  const trackRef = React.useRef<HTMLDivElement>(null)
  const angle = value.angle ?? 90

  const controller = useGradientStopsController({
    angle,
    gradientType: value.type,
    name: label,
    stops: value.stops,
    trackRef,
    onValueChange: (next, meta) =>
      onValueChange(
        {
          type: next.gradientType as GradientKind,
          angle: next.angle,
          stops: [...next.stops],
        },
        meta
      ),
  })

  const background = getGradientBackground(value.type, value.stops, angle)
  const active = controller.selectedIndex == null ? null : value.stops[controller.selectedIndex]

  return (
    <PropertyRow
      label={label}
      description={description}
      modified={!sameGradient(value, authored)}
      onReset={() => onValueChange(authored, { history: 'record' })}
    >
      <Popover>
        {/* No `render` wrapper and no `id`. PopoverTrigger already renders the
            button and assigns its own id, and Base UI merges our props LAST —
            either would overwrite the identity its own toggle and dismissal
            resolve the trigger by. The label rides `aria-label` instead. */}
        <PopoverTrigger
          aria-label={`${label} - ${value.type} gradient, ${value.stops.length} stops`}
          className="flex h-8 w-full items-center gap-2 rounded-control border border-control-border bg-control px-2 transition-colors hover:bg-control-hover focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {/* The trigger shows the ACTUAL ramp — never a single averaged swatch. */}
          <span
            className="h-4 w-8 shrink-0 rounded-[4px] ring-1 ring-foreground/15"
            style={{ background }}
          />
          <span className="font-mono text-xs tabular-nums text-foreground capitalize">
            {value.type}
          </span>
          <span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground">
            {value.stops.length} stops
          </span>
        </PopoverTrigger>

        <PopoverContent className="w-72 space-y-3">
          <div className="flex items-center gap-1.5">
            {KIND_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={value.type === o.value}
                onClick={() => controller.updateGradientType(o.value)}
                className={cn(
                  'pressable h-7 flex-1 rounded-control border text-xs focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                  value.type === o.value
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-control-border bg-control text-muted-foreground hover:bg-control-hover hover:text-foreground'
                )}
              >
                {o.label}
              </button>
            ))}
            {value.type === 'linear' && (
              <ScrubbableNumber
                value={angle}
                min={0}
                max={360}
                suffix="°"
                aria-label="Gradient angle"
                className="w-16 shrink-0"
                onValueChange={(n, committed) =>
                  controller.updateAngle(n, { history: committed ? 'record' : 'merge' })
                }
              />
            )}
          </div>

          {/* Vendored: stop dragging, add-on-click, keyboard removal. */}
          <GradientStopsTrack
            gradient={background}
            stops={controller.indexedStops}
            trackRef={trackRef}
            selectedIndex={controller.selectedIndex}
            draggingIndex={controller.draggingIndex}
            onPointerDown={controller.handleTrackPointerDown}
            onPointerMove={controller.handleTrackPointerMove}
            onDragEnd={() => controller.setDraggingIndex(null)}
            onStartDrag={controller.handleStartDrag}
            onRemoveStop={(index) => controller.removeStop(index)}
            onRemoveStopByKey={(index) => controller.removeStop(index)}
          />

          {active && controller.selectedIndex != null && (
            <div className="space-y-2 border-t border-border pt-2.5">
              <ColorField
                label="Stop colour"
                value={hexToRgba(active.color, parseStopOpacity(active.opacity) / 100)}
                authored={hexToRgba(active.color, parseStopOpacity(active.opacity) / 100)}
                swatches={swatches}
                onValueChange={(rgba: Rgba, meta) =>
                  controller.updateStop(
                    controller.selectedIndex as number,
                    { color: rgbaToHex(rgba), opacity: Math.round((rgba[3] ?? 1) * 100) },
                    meta
                  )
                }
              />
              <div className="flex items-center gap-2">
                <span className="w-14 shrink-0 text-xs text-muted-foreground">Position</span>
                <ScrubbableNumber
                  value={Math.round(parseStopPosition(active.position) * 100)}
                  min={0}
                  max={100}
                  suffix="%"
                  aria-label="Stop position"
                  onValueChange={(n, committed) =>
                    controller.updateStop(
                      controller.selectedIndex as number,
                      { position: `${n}%` },
                      { history: committed ? 'record' : 'merge' }
                    )
                  }
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={value.stops.length >= maxGradientStops}
              onClick={() => controller.addStop('50%')}
              className="pressable inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-control border border-control-border bg-control text-xs text-muted-foreground hover:bg-control-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-control focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <Plus size={12} /> Add stop
            </button>
            <button
              type="button"
              aria-label="Reverse the ramp"
              onClick={() =>
                onValueChange(
                  {
                    ...value,
                    stops: [...value.stops]
                      .map((s) => ({ ...s, position: `${100 - Math.round(parseStopPosition(s.position) * 100)}%` }))
                      .reverse(),
                  },
                  { history: 'record' }
                )
              }
              className="pressable inline-flex size-7 shrink-0 items-center justify-center rounded-control border border-control-border bg-control text-muted-foreground hover:bg-control-hover hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <ArrowLeftRight size={13} />
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </PropertyRow>
  )
}
