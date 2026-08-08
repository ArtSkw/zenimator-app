import { useLayoutEffect, type RefObject } from 'react'

/**
 * Grow a textarea to fit its content, up to `maxPx`, then scroll.
 *
 * `deps` must include every state change that MOUNTS the field, not just the
 * text — a freshly mounted textarea has never been measured, so an effect keyed
 * on the value alone leaves it at its CSS floor with the content clipped. That
 * exact gap made the same brief render at two different heights depending on
 * which screen the user arrived from.
 */
export function useAutoGrow(
  ref: RefObject<HTMLTextAreaElement | null>,
  maxPx: number,
  deps: unknown[],
): void {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const natural = el.scrollHeight
    el.style.height = `${Math.min(natural, maxPx)}px`
    el.style.overflowY = natural > maxPx ? 'auto' : 'hidden'
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, maxPx, ...deps])
}
