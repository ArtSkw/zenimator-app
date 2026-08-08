/**
 * Intro + Loop scenes (companion pattern).
 *
 * An `intro-loop` scene is ONE composition with two segments declared by
 * standard Lottie markers: `intro` runs `[0..T]` once, `loop` cycles `[T..op]`
 * forever. Marker names are contract (see the workbench player-contract) —
 * the same file drives lottie-web `playSegments`, dotLottie segments, and the
 * native runtimes' marker APIs, so nothing here is player-specific.
 */

export type LottieMarker = { tm: number; cm?: string; dr?: number }

/** The loop segment's start frame, or null when the scene has no loop marker
 *  (a plain entry or whole-comp loop). Defensive against malformed markers:
 *  the boundary must lie strictly inside the composition — a marker at 0 is
 *  a whole-comp loop and a marker past op can never be reached. */
export function loopStartFrame(doc: unknown): number | null {
  const d = doc as { markers?: LottieMarker[]; op?: number } | null
  if (!d || !Array.isArray(d.markers)) return null
  const loop = d.markers.find((m) => m?.cm === 'loop' && typeof m.tm === 'number')
  if (!loop) return null
  const op = typeof d.op === 'number' ? d.op : Infinity
  return loop.tm > 0 && loop.tm < op ? loop.tm : null
}

/** Parse + extract in one step for callers holding the JSON string. */
export function loopStartFromJson(lottieJson: string | null | undefined): number | null {
  if (!lottieJson) return null
  try {
    return loopStartFrame(JSON.parse(lottieJson))
  } catch {
    return null
  }
}

/** The full loop segment `[start..end]`, honoring the marker's `dr` when it
 *  carries one and falling back to `op`. Null when the scene has no valid
 *  loop marker — same boundary rules as `loopStartFrame`, so every consumer
 *  (player, HTML export, packs) agrees on what counts as an intro-loop. */
export function loopSegment(doc: unknown): { start: number; end: number } | null {
  const start = loopStartFrame(doc)
  if (start == null) return null
  const d = doc as { markers?: LottieMarker[]; op?: number }
  const marker = d.markers!.find((m) => m?.cm === 'loop' && typeof m.tm === 'number')!
  const end = Math.round(marker.tm + (marker.dr ?? 0)) || Math.round(d.op ?? 0)
  if (!(end > start)) return null
  return { start: Math.round(start), end }
}

/** The frame plan raster exporters share: clamp the loop start (only a
 *  boundary strictly inside the composition counts, and only when looping),
 *  and map an output-frame index into the source — indices past the first
 *  full pass cycle the `[loopStart..total]` idle segment, so an entrance
 *  renders once at the head of the file and never repeats mid-stream. */
export function loopFramePlan(
  totalFrames: number,
  opts: { loop?: boolean; loopStart?: number },
): { loopStart: number; loopSpan: number; frameAt: (i: number) => number } {
  const loopStart = opts.loop && opts.loopStart && opts.loopStart > 0 && opts.loopStart < totalFrames
    ? Math.round(opts.loopStart)
    : 0
  const loopSpan = totalFrames - loopStart
  const frameAt = (i: number) => (i < totalFrames ? i : loopStart + ((i - totalFrames) % loopSpan))
  return { loopStart, loopSpan, frameAt }
}
