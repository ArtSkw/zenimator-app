/**
 * Bubble text fitting — measure, wrap, and size the plate that hugs a string.
 *
 * PORTABLE: no imports, no app types, no DOM beyond a 2D measuring context.
 * The studio runs this module directly and the mobile pack SHIPS it, compiled,
 * so the plate a teammate gets for a translation is sized by the same code that
 * sized it in the in-app rehearsal — not by a copy of it that drifted.
 *
 * The caller configures the context's font before measuring: this module knows
 * nothing about loading faces, which is what keeps it portable.
 */

/** Metrics read from the scene's text document. */
export type FitFont = {
  /** px — matches the `size` the caller set on the context's font. */
  size: number
  lineHeight: number
  /** Thousandths of an em per character, Lottie-style. */
  tracking: number
}

/** The plate's geometry spec, already resolved (the studio fills its own
 *  defaults in before calling, so the algorithm here has no branches for
 *  "the agent didn't publish numbers"). */
export type FitPlate = {
  defaultSize: [number, number]
  padding: [number, number]
  min: [number, number]
  /** Past `max[0]` a string WRAPS instead of running off the stage. Null keeps
   *  the legacy single-line behavior: width follows, height stays authored. */
  max: [number, number] | null
  /** Extra px added to the line height when the string wraps; single-line text
   *  keeps the authored spec exactly. */
  leading: number
}

/** Just enough of CanvasRenderingContext2D to measure with. */
export type TextMeasurer = { measureText(text: string): { width: number } }

export type TextLayout = {
  /** The wrapped string, `\r`-separated — Skottie honors those in point text. */
  text: string
  w: number
  h: number
  /** Shift for the text block so wrapped lines stay vertically centered. */
  dy: number
  lineHeight: number
  lines: number
}

/** Width of a string in the scene's font: glyph advance plus tracking. */
export function measureText(ctx: TextMeasurer, font: FitFont, text: string): number {
  const base = ctx.measureText(text).width
  const tracking = (font.tracking / 1000) * font.size * Math.max(0, text.length - 1)
  return base + tracking
}

/** Greedy word-wrap: each line as wide as fits within `maxInnerW`. A single
 *  word wider than the limit gets its own line whole — mid-word breaks would
 *  corrupt localized text. */
export function wrapText(
  ctx: TextMeasurer, font: FitFont, text: string, maxInnerW: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return [text.trim()]
  const lines: string[] = []
  let line = words[0]
  for (const word of words.slice(1)) {
    const candidate = `${line} ${word}`
    if (measureText(ctx, font, candidate) <= maxInnerW) line = candidate
    else { lines.push(line); line = word }
  }
  lines.push(line)
  return lines
}

/** The full layout for a string: the wrapped text plus the plate that hugs it. */
export function layoutText(
  ctx: TextMeasurer, font: FitFont, plate: FitPlate, raw: string,
): TextLayout {
  const padX = plate.padding[0], padY = plate.padding[1]
  const maxW = plate.max ? plate.max[0] : null

  const lines = maxW ? wrapText(ctx, font, raw, maxW - 2 * padX) : [raw]
  const lineHeight = lines.length > 1 ? font.lineHeight + (plate.leading || 0) : font.lineHeight
  let widest = 0
  for (const line of lines) widest = Math.max(widest, measureText(ctx, font, line))

  const w = Math.max(plate.min[0], Math.min(maxW === null ? Infinity : maxW, Math.round(widest + 2 * padX)))
  // Content wins over the documented headroom: a string needing more lines than
  // the design planned for still renders whole — a too-tall plate beats clipped
  // text. Growing past the FRAME is handled separately, by fitFrame.
  const h = lines.length === 1 && maxW === null
    ? plate.defaultSize[1]
    : Math.max(plate.min[1], Math.round(2 * padY + lineHeight * lines.length))
  // Extra lines grow DOWN from the first baseline while the plate grows from
  // its center, so the block must rise half a lineHeight per extra line to stay
  // centered. (Text-doc `ls` looks like the tool for this — Skottie ignores it.)
  const dy = -((lines.length - 1) * lineHeight) / 2

  return { text: lines.join('\r'), w, h, dy, lineHeight, lines: lines.length }
}
