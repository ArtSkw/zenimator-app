/**
 * Recolors a Lottie document for dark backgrounds: every SOLID BLACK fill
 * (`fl` with c.k == [0,0,0,1]) becomes white. Gradient fills (`gf`) are left
 * untouched — they drive reveal mattes, not the artwork's ink color. This is the
 * same light/dark split the static logo ships (zenimator-logo-light/dark.svg),
 * just applied in memory. Returns a NEW document; the input is not mutated.
 *
 * Used when baking the dark-theme splash video (white logo on the dark boot
 * background) — see src/export/bakeSplashVideos.ts.
 */
const BLACK = '[0,0,0,1]'

export function recolorLottieForDark<T>(doc: T): T {
  const clone = structuredClone(doc)
  const paint = (node: unknown): void => {
    if (Array.isArray(node)) { node.forEach(paint); return }
    if (!node || typeof node !== 'object') return
    const n = node as Record<string, unknown>
    if (n.ty === 'fl') {
      const c = n.c as { k?: unknown } | undefined
      if (c && JSON.stringify(c.k) === BLACK) c.k = [1, 1, 1, 1]
    }
    for (const key of Object.keys(n)) paint(n[key])
  }
  paint(clone)
  return clone
}
