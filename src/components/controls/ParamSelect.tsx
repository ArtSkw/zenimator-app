import { RotateCcw } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

type Option = { value: string; label: string }

type Props = {
  label: string
  value: string
  options: Option[]
  /** AI-default option value — shows a reset affordance when changed. */
  originValue?: string
  onChange: (value: string) => void
}

/**
 * A labeled dropdown for discrete choices (e.g. easing curve, loop style).
 * Operates on string option values; the caller maps to/from numeric handle indices.
 */
export function ParamSelect({ label, value, options, originValue, onChange }: Props) {
  const canReset = originValue != null && value !== originValue

  return (
    <TooltipProvider>
      <div className="group space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="flex-1 min-w-0 truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </span>

          {canReset && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={() => onChange(originValue!)}
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
        </div>

        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="h-7 w-full text-[11px] bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </TooltipProvider>
  )
}
