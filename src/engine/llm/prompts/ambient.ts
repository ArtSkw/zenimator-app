/**
 * Ambient category — continuous, looping, subtle motion. Reserved for v1.1.
 * The prompt body is not built until the release lands. Calling this
 * function throws, which is the correct behavior if anything attempts to
 * route an Ambient upload through the grouper in v1.
 */
export function ambientPrompt(): string {
  throw new Error(
    "Ambient category is reserved for v1.1. The category selector should prevent reaching here.",
  )
}
