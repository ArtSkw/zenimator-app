import { Switch } from '@/components/ui/switch'
import { RotateCcw } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

type Props = {
  label: string
  checked: boolean
  /** AI-default state — shows a reset affordance when changed. */
  origin?: boolean
  onChange: (checked: boolean) => void
}

/**
 * A boolean toggle for on/off motion controls (e.g. "Enable blink", "Draw on").
 * Visually a labeled row with a Switch; reset affordance when changed from default.
 */
export function ParamSwitch({ label, checked, origin, onChange }: Props) {
  const canReset = origin != null && checked !== origin

  return (
    <TooltipProvider>
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
                  onClick={() => onChange(origin!)}
                  aria-label="Reset to AI default"
                  className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <RotateCcw size={11} />
                </button>
              }
            />
            <TooltipContent side="top">Reset to AI default</TooltipContent>
          </Tooltip>
        )}

        <Switch
          size="sm"
          checked={checked}
          onCheckedChange={onChange}
          aria-label={label}
        />
      </div>
    </TooltipProvider>
  )
}
