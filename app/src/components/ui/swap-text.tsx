import * as React from "react"

import { cn } from "@/lib/utils"

/** Must outlast `swap-text-out` (140ms) so the outgoing phrase is gone from the
 *  DOM only after it has finished leaving. */
const EXIT_MS = 160

/**
 * A single line of text that CROSSFADES when it changes, instead of blinking.
 *
 * The naive form — `key={value}` plus a fade-in — drops the old node the instant
 * React re-renders, so the line goes empty and then slowly fills. Keeping the
 * outgoing string mounted for one exit lets the two states overlap, which is
 * what makes a phase change read as a change rather than a flicker.
 *
 * The outgoing copy is absolutely positioned and `aria-hidden`, so it neither
 * shifts layout nor gets announced twice by a screen reader.
 */
export function SwapText({ text, className }: { text: string; className?: string }) {
  const [shown, setShown] = React.useState(text)
  const [outgoing, setOutgoing] = React.useState<{ text: string; id: number } | null>(null)
  const [lastProp, setLastProp] = React.useState(text)

  // Adjusted during render rather than in an effect: an effect would paint the
  // stale line first and then swap, which is the flicker we are removing.
  if (text !== lastProp) {
    setLastProp(text)
    // Updater form, so the id stays monotonic without reading a ref during
    // render — two identical phrases in a row must still remount and re-animate.
    setOutgoing((prev) => ({ text: shown, id: (prev?.id ?? 0) + 1 }))
    setShown(text)
  }

  React.useEffect(() => {
    if (!outgoing) return
    const t = window.setTimeout(() => setOutgoing(null), EXIT_MS)
    return () => window.clearTimeout(t)
  }, [outgoing])

  return (
    <span className={cn("relative block min-w-0", className)}>
      {outgoing && (
        <span
          key={outgoing.id}
          aria-hidden
          className="swap-text-out absolute inset-0 block truncate"
        >
          {outgoing.text}
        </span>
      )}
      <span key={shown} className="swap-text-in block truncate">
        {shown}
      </span>
    </span>
  )
}
