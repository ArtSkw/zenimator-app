/**
 * Converts a raw Anthropic SDK / fetch error into a one-line user-facing
 * message. Checks `.status` (set by the SDK on every APIError) before
 * falling back to the error message text.
 */
export function humanizeLlmError(err: unknown): string {
  if (!(err instanceof Error)) return 'Unknown LLM error'

  const status = (err as { status?: number }).status

  if (status === 401) return 'Invalid API key — check Settings'
  if (status === 403) return 'API key lacks access to this model'
  if (status === 429) return 'Rate limit exceeded — try again shortly'
  if (status === 529) return 'Claude is overloaded — try again shortly'
  if (/network|fetch|failed to fetch|connect/i.test(err.message))
    return 'Network error — check your connection'

  return err.message.length > 120 ? err.message.slice(0, 120) + '…' : err.message
}
