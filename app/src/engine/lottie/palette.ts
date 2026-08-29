/**
 * The scene's own colours, ordered by how much of the artwork they carry.
 *
 * Feeds the "From your artwork" swatch row, so retinting an accent starts from
 * a colour the scene already uses instead of a hex hunt.
 *
 * Deliberately reads the LOTTIE DOC, not the source SVG the plan named. The doc
 * is already in memory (no round trip, no empty result when the engine is down
 * or the assets were pruned) and it is what the viewer is actually looking at —
 * a source colour that never made it into the scene is a worse suggestion than
 * one that did. The SVG-side extractor the generative-vector work needs is a
 * different job anyway: it wants stroke widths, caps and joins, none of which a
 * swatch row has any use for.
 */


import { channelToHex } from './color'

/** A ready-made 0..1 triple, so callers do not spread into `rgbToHex`. */
const toHex = (rgb: readonly number[]): string =>
  `#${channelToHex(rgb[0])}${channelToHex(rgb[1])}${channelToHex(rgb[2])}`.toUpperCase()

const isRgb = (v: unknown): v is number[] =>
  Array.isArray(v) && v.length >= 3 && v.every((n) => typeof n === 'number')

/**
 * Weighted by appearances, so the colour that dominates the artwork leads the
 * row. A fully transparent fill contributes nothing — it is not a colour the
 * viewer can see.
 */
export function extractPalette(doc: unknown, limit = 10): string[] {
  const tally = new Map<string, number>()
  const add = (hex: string, weight = 1) => {
    tally.set(hex, (tally.get(hex) ?? 0) + weight)
  }

  const seen = new Set<unknown>()
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object' || seen.has(node)) return
    seen.add(node)

    if (!Array.isArray(node)) {
      const o = node as Record<string, unknown>

      // Flat fill / stroke. An animated colour contributes its first keyframe:
      // that is the pose the artwork rests in.
      if ((o.ty === 'fl' || o.ty === 'st') && o.c && typeof o.c === 'object') {
        const c = o.c as { a?: number; k?: unknown }
        const k = c.a === 1 && Array.isArray(c.k) ? (c.k[0] as { s?: unknown })?.s : c.k
        if (isRgb(k) && (k[3] ?? 1) > 0.02) add(toHex(k), 2)
      }

      // Gradient ramp — every colour stop counts, so a four-stop sweep offers
      // all four rather than whichever one a flat control happened to name.
      if ((o.ty === 'gf' || o.ty === 'gs') && o.g && typeof o.g === 'object') {
        const g = o.g as { p?: number; k?: { k?: unknown } }
        const ramp = g.k?.k
        const stops = Number(g.p) || 0
        if (Array.isArray(ramp) && stops > 0) {
          for (let i = 0; i < stops; i++) {
            const slice = ramp.slice(i * 4 + 1, i * 4 + 4)
            if (isRgb(slice)) add(toHex(slice))
          }
        }
      }

      // Solid layers carry a plain hex string.
      if (o.ty === 1 && typeof o.sc === 'string' && /^#[0-9a-f]{6}$/i.test(o.sc)) {
        add(o.sc.toUpperCase(), 2)
      }
    }

    for (const v of Array.isArray(node) ? node : Object.values(node as object)) walk(v)
  }
  walk(doc)

  // Slot-bound properties carry NO inline value — a slotted fill is literally
  // `{ "sid": "brandColor" }` and the colour lives only in `doc.slots`. Missing
  // these skipped precisely the colours a scene meant to be editable.
  const slots = (doc as { slots?: Record<string, { p?: unknown }> } | null)?.slots
  if (slots && typeof slots === 'object') {
    for (const entry of Object.values(slots)) {
      const prop = entry?.p as { k?: unknown; p?: number } | undefined
      if (!prop || typeof prop !== 'object') continue
      if (isRgb(prop.k) && ((prop.k as number[])[3] ?? 1) > 0.02) {
        add(toHex(prop.k as number[]), 2)
        continue
      }
      // A slotted gradient: `{ p: <stops>, k: { k: [...] } }`.
      const ramp = (prop.k as { k?: unknown } | undefined)?.k
      const stops = Number(prop.p) || 0
      if (Array.isArray(ramp) && stops > 0) {
        for (let i = 0; i < stops; i++) {
          const slice = ramp.slice(i * 4 + 1, i * 4 + 4)
          if (isRgb(slice)) add(toHex(slice))
        }
      }
    }
  }

  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([hex]) => hex)
}
