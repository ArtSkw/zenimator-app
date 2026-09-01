import { useState } from 'react'

/**
 * The entrance a VIEW plays when you arrive at it — home → project, project →
 * project, back to home.
 *
 * Rules borrowed from the better-ui skill, and the reasons they are rules:
 *
 * - **Stagger semantic CHUNKS, not elements** (~100ms apart). Two or three
 *   pieces that mean different things — the greeting, then the thing you type
 *   into; the artwork, then the controls under it. Staggering every element
 *   instead produces a wave, which reads as decoration rather than as
 *   hierarchy.
 * - **A small fixed translate, never a height animation.** Heights reflow
 *   everything around them; a 8px rise costs one compositor property.
 * - **ease-out in both directions**, and an exit softer than its enter.
 * - **Never on first render.** A cold load has nothing to transition FROM, so
 *   an entrance there is just a delay before the app is usable. `useViewReveal`
 *   returns `animate: false` until the view actually changes once.
 *
 * Keyframes are the right tool here precisely because this is a staged sequence
 * that runs once per arrival — the same skill reserves them for exactly that,
 * and forbids them for interactive state changes, which stay CSS transitions.
 */

/** Chunk one: fades and rises immediately. */
export const REVEAL = 'animate-in fade-in-0 slide-in-from-bottom-2 duration-300 ease-out-strong'

/** Chunk two: the same entrance, one beat later. `fill-mode-backwards` holds it
 *  at its starting values through the delay — without it the element paints in
 *  full first and then jumps back to animate, which is worse than no stagger. */
export const REVEAL_LATE = `${REVEAL} [animation-delay:100ms] fill-mode-backwards`

/**
 * Tracks which view is on screen and whether arriving at it should animate.
 *
 * `key` is meant for React's `key` so the entrance actually REPLAYS on a switch
 * (a CSS animation only runs on mount; re-rendering the same element does
 * nothing). `animate` is false for the very first view of a session.
 *
 * Written as a render-phase adjustment — the sanctioned "derive state from a
 * changed prop" pattern this codebase already uses for `setupProjectId` — so a
 * switch costs no extra commit the way an effect would.
 */
export function useViewReveal(view: string): { key: string; animate: boolean } {
  const [shown, setShown] = useState(view)
  const [arrived, setArrived] = useState(false)
  if (shown !== view) {
    setShown(view)
    setArrived(true)
  }
  return { key: view, animate: arrived }
}
