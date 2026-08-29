/**
 * Hex ⇄ Lottie colour, in one place.
 *
 * Lottie stores colour as floats in 0..1; every editor, palette and handoff doc
 * speaks hex. Four copies of this conversion appeared while the parameter work
 * landed — the kind of duplication that stays harmless until one copy rounds
 * differently from the others and a swatch stops matching its own render.
 */

export const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n)

/** One 0..1 channel as a two-digit hex pair. */
export const channelToHex = (n: number) =>
  Math.round(clamp01(n) * 255).toString(16).padStart(2, '0')

export const rgbToHex = (r: number, g: number, b: number): string =>
  `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`.toUpperCase()

/** Tolerates `#abc`, `abc`, `#aabbcc` and a short/ragged string, because these
 *  values arrive from hand-typed input and from model-authored JSON alike. */
export function hexToRgb(hex: string): [number, number, number] {
  const h = String(hex ?? '').replace('#', '').trim()
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0')
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as [number, number, number]
}
