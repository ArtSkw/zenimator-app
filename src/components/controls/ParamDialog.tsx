import { useState } from 'react'
import { Settings2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { EasingKey } from '@/engine/lottie/core'
import type { Track, Keyframe } from '@/engine/lottie/project'
import { EASINGS } from '@/engine/lottie/project'

type Props = {
  label: string
  hint: string
  track: Track
  onChange: (t: Track) => void
}

/**
 * A labeled button that opens a dialog for editing track keyframe details —
 * used when the model flags a control as 'dialog' to avoid cluttering the panel.
 * The dialog shows each keyframe's value and easing in an editable table.
 */
export function ParamDialog({ label, hint, track, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const keys = [...track.keys].sort((a, b) => a.t - b.t)

  const updateEasing = (i: number, easing: EasingKey) => {
    const next: Keyframe[] = keys.map((k, idx) => idx === i ? { ...k, easing } : k)
    onChange({ ...track, keys: next, preset: undefined })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
      >
        <span className="truncate">{label}</span>
        <Settings2 size={12} className="shrink-0 ml-2" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">{label}</DialogTitle>
          </DialogHeader>

          <p className="text-xs text-muted-foreground leading-relaxed">{hint}</p>

          {keys.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Keyframe easing
              </p>
              <div className="space-y-1.5">
                {keys.map((k, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-12 shrink-0 text-[10px] font-mono text-foreground/60">
                      f{k.t}
                    </span>
                    {i < keys.length - 1 ? (
                      <Select
                        value={k.easing ?? 'easeInOut'}
                        onValueChange={(v) => updateEasing(i, v as EasingKey)}
                      >
                        <SelectTrigger className="h-7 flex-1 text-[11px] font-mono bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EASINGS.map((e) => (
                            <SelectItem key={e} value={e} className="font-mono text-xs">{e}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-[10px] text-foreground/40 italic">last keyframe</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-foreground/40 italic">No keyframes on this track.</p>
          )}

          <DialogClose asChild>
            <button
              type="button"
              className="mt-1 w-full rounded-md border border-border py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Done
            </button>
          </DialogClose>
        </DialogContent>
      </Dialog>
    </>
  )
}
