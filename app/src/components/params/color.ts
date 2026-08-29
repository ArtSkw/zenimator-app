/**
 * Colour maths for the parameter fields. Lottie stores colour as `[r,g,b,a]`
 * floats in 0..1; the pickers speak hex and HSV. One conversion layer, used by
 * ColorField and by the gradient bridge, so rounding behaviour is identical in
 * both places.
 */
import { clamp01, hexToRgb, rgbToHex } from '@/engine/lottie/color'
import type { Rgba } from './types'


export function rgbaToHex(rgba: Rgba): string {
  return rgbToHex(rgba[0], rgba[1], rgba[2])
}

export function hexToRgba(hex: string, alpha = 1): Rgba {
  const [r, g, b] = hexToRgb(hex)
  return [r, g, b, clamp01(alpha)]
}

export function rgbaToCss(rgba: Rgba): string {
  const [r, g, b, a] = rgba
  return `rgba(${Math.round(clamp01(r) * 255)}, ${Math.round(clamp01(g) * 255)}, ${Math.round(clamp01(b) * 255)}, ${clamp01(a ?? 1)})`
}

export type Hsv = { h: number; s: number; v: number }

export function rgbToHsv(r: number, g: number, b: number): Hsv {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max === 0 ? 0 : d / max, v: max }
}

export function hsvToRgb({ h, s, v }: Hsv): [number, number, number] {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  const seg = Math.floor(h / 60) % 6
  const [r, g, b] =
    seg === 0 ? [c, x, 0] : seg === 1 ? [x, c, 0] : seg === 2 ? [0, c, x]
    : seg === 3 ? [0, x, c] : seg === 4 ? [x, 0, c] : [c, 0, x]
  return [r + m, g + m, b + m]
}

/** Perceptual-ish luminance — decides whether a swatch needs a light or dark tick. */
export function isLight(rgba: Rgba): boolean {
  return 0.299 * rgba[0] + 0.587 * rgba[1] + 0.114 * rgba[2] > 0.6
}
