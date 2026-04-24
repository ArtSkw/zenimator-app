import type { Scene } from './types'

/**
 * Total playback duration of a scene in milliseconds — the end time of
 * the last-finishing animated group. Used by the transport bar and the
 * proportional scaling action.
 *
 * Falls back to 400ms to match SvgPlayer's whole-SVG fade when nothing
 * resolves.
 */
export function getSceneDuration(scene: Scene): number {
  let max = 0
  for (const group of scene.groups) {
    const anim = group.animation
    if (!anim || anim.template === 'none' || anim.template === 'stagger-children') continue
    const end = Math.max(0, anim.timing.start) + Math.max(0, anim.params.duration)
    if (end > max) max = end
  }
  return max || 400
}

/** Format ms as a compact seconds string, e.g. 2500 → "2.5s", 400 → "0.4s" */
export function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`
}
