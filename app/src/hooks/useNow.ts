import { useEffect, useState } from 'react'

/**
 * A clock that ticks only while something is running.
 *
 * Live durations have to advance on their own: the studio's event stream goes
 * quiet for minutes at a time (the same silence the heartbeat exists for), and
 * a timer that only moved when events arrived would freeze exactly when the
 * user most needs to see that time is still passing. Idle callers stop ticking
 * entirely, so a finished run costs nothing.
 *
 * The clock is only re-read on the interval, never during render (`Date.now`
 * is impure, and a render-phase re-seed is what the React compiler rejects).
 * So a card that was already on screen when a run starts can carry a stale
 * timestamp for up to one tick — which is why every reader clamps its
 * subtraction at zero: the counter simply reads 0s for that first second,
 * exactly as a timer starting from zero should.
 */
export function useNow(active: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [active, intervalMs])

  return now
}
