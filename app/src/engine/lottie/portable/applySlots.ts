/**
 * Slot baking — write slot overrides into a Lottie document.
 *
 * PORTABLE: no imports. Used by players without a `slots` config, and for
 * server-side per-locale pre-baking. Mutates and returns the document.
 */

export function applySlots(
  animation: { slots?: Record<string, unknown> } | null | undefined,
  slots: Record<string, unknown>,
): unknown {
  if (!animation || !animation.slots) return animation
  for (const sid of Object.keys(slots)) {
    if (sid in animation.slots) animation.slots[sid] = slots[sid]
  }
  return animation
}
