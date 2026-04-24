import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  label: string
  value?: string
  children: ReactNode
  className?: string
}

/**
 * A label + control + value row. All controls in the panel use this so the
 * visual rhythm stays consistent (label top-left, value top-right in mono,
 * control below).
 */
export function ControlRow({ label, value, children, className }: Props) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        {value !== undefined && (
          <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
            {value}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}
