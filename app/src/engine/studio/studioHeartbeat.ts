/**
 * The studio heartbeat — warm, humorous reassurance for long quiet stretches.
 *
 * The agent's status line advances on tool events (read/write/run/render). But
 * a single deep turn — the model thinking hard, or a big build script grinding
 * — can go minutes with no event, freezing the status line and making a
 * healthy run look stalled. When the stream goes quiet past a threshold, the
 * UI switches the status line to a rotating heartbeat that carries the elapsed
 * time, so the wait reads as "the animator is in the zone," never "it hung."
 */

/** Quiet gap before the heartbeat takes over the status line. */
export const HEARTBEAT_QUIET_MS = 14_000
/** How often the heartbeat re-checks / advances while quiet. */
export const HEARTBEAT_TICK_MS = 4_000

const LINES = [
  'Still animating — good motion takes a beat',
  'Deep in the keyframes, this is the fun part',
  'Working the in-betweens — hang tight',
  'Fussing over the easing; it won’t ship a wobble',
  'Squinting at frames like a real animator',
  'Nudging curves by a pixel or two',
  'Making the loop seamless — worth the wait',
  'Still here, still drawing',
  'Chasing the last 10% of polish',
  'No rushing a good bounce',
  'Tightening the timing, frame by frame',
  'The cup must not spill — steadying it',
]

/** "45s" · "2m 10s" — compact, human. */
export function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return `${m}m ${(s % 60).toString().padStart(2, '0')}s`
}

/** A heartbeat status line: a rotating warm line + elapsed, e.g.
 *  "Deep in the keyframes, this is the fun part · 2m 10s in". */
export function heartbeatLine(tick: number, elapsedMs: number): string {
  return `${LINES[tick % LINES.length]} · ${formatElapsed(elapsedMs)} in`
}
