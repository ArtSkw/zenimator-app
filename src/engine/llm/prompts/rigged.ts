/**
 * Rigged category — character motion (walk cycles, waves, idle sway).
 * Reserved for v1.2. Throws if invoked — the category selector is the
 * gatekeeper.
 */
export function riggedPrompt(): string {
  throw new Error(
    "Rigged category is reserved for v1.2. The category selector should prevent reaching here.",
  )
}
