/**
 * Content slots (companion pattern) — the localization surface of a scene.
 *
 * A studio scene may carry top-level Lottie `slots`: named values that
 * properties reference via `sid`. The companion contract uses them for the
 * strings and geometry a product team edits after export — `bubble.text`
 * (a text document) and `bubble.size` (the plate's vec2) — with the slot's
 * default being the design value, so the file works untouched.
 *
 * The app edits slots by REWRITING THE DEFAULT in the JSON (bakeFrom), not
 * through a live player API: the same bake feeds the preview, every export,
 * and the saved project, so what a teammate sees is exactly what ships.
 */

import { measureText, layoutText, type FitFont, type TextLayout } from './portable/textFit'

export type TextSlotMeta = {
  kind: 'text'
  sid: string
  label: string
  value: string
  /** Measurement inputs, read from the default text document. */
  font: string
  size: number
  tracking: number
  lineHeight: number
}

export type SizeSlotMeta = {
  kind: 'size'
  sid: string
  label: string
  /** Layout-plumbing slot (`.textPos`, `.anchor`): no editor, no pairing. */
  internal?: boolean
  value: [number, number]
  /** Components past the first two (a vec3 position's z) — written back
   *  unchanged so a 3-component slot never becomes a 2-component one. */
  extra?: number[]
  /** From controls.json: keep this slot at text extents + 2×padding. Past
   *  `max[0]` the string WRAPS onto more lines (the plate grows in lineHeight
   *  steps instead of running off the stage); `max[1]` documents the tallest
   *  plate the scene has headroom for. */
  autoFit?: {
    text: string
    padding: [number, number]
    min?: [number, number]
    max?: [number, number]
    /** Extra px added to the line height when the string WRAPS — single-line
     *  text keeps the authored spec exactly, while stacked lines get the air
     *  they need to stay readable. */
    leading?: number
  }
}

export type ColorSlotMeta = { kind: 'color'; sid: string; label: string; value: [number, number, number, number] }

/** The companion naming convention, stated once: slots pair by shared id
 *  prefix (`bubble.size` ↔ `bubble.text`), and `.textPos`/`.anchor` are
 *  layout plumbing — driven by tools, never shown as editors. */
export const sidPrefix = (sid: string): string => sid.replace(/\.[^.]*$/, '')
export const INTERNAL_SLOT_RE = /\.(textPos|anchor)$/

/** Lottie text-doc line height, with the fallback every consumer must agree
 *  on (≈1.27em) when the doc doesn't carry one. */
export const textLineHeight = (lh: unknown, fontSize: number): number =>
  Number(lh) || Math.round(fontSize * 1.27)

export type SlotMeta = TextSlotMeta | SizeSlotMeta | ColorSlotMeta

export type SlotSpec = {
  sid: string
  label: string
  autoFit?: SizeSlotMeta['autoFit']
  /** Plumbing slots (e.g. `.textPos`) — driven by layout math, never shown
   *  as editors and never prefix-paired as a plate. */
  internal?: boolean
}

/** The agent's slot labels/autoFit from controls.json (`controls` array —
 *  the same file that carries layerControls). Defensive like
 *  parseLayerControlSpecs: model-authored, so malformed entries drop. */
export function parseSlotSpecs(controlsJson: string | null | undefined): SlotSpec[] {
  if (!controlsJson) return []
  try {
    const raw = JSON.parse(controlsJson) as { controls?: unknown }
    if (!Array.isArray(raw.controls)) return []
    const out: SlotSpec[] = []
    for (const item of raw.controls.slice(0, 32)) {
      const s = item as Record<string, unknown>
      if (typeof s.sid !== 'string' || !s.sid.trim()) continue
      const spec: SlotSpec = {
        sid: s.sid.trim(),
        label: typeof s.label === 'string' && s.label.trim() ? s.label.trim().slice(0, 40) : prettySid(s.sid),
        // Plumbing slots are internal by convention even without the flag.
        ...(s.internal === true || INTERNAL_SLOT_RE.test(s.sid.trim()) ? { internal: true } : {}),
      }
      const af = s.autoFit as Record<string, unknown> | undefined
      if (af && typeof af.text === 'string' && Array.isArray(af.padding) && af.padding.length === 2) {
        const pair = (v: unknown): [number, number] | null =>
          Array.isArray(v) && v.length === 2 ? [Number(v[0]) || 0, Number(v[1]) || 0] : null
        const min = pair(af.min)
        const max = pair(af.max)
        spec.autoFit = {
          text: af.text,
          padding: [Number(af.padding[0]) || 0, Number(af.padding[1]) || 0],
          ...(min ? { min } : {}),
          ...(max && max[0] > 0 ? { max } : {}),
          ...(Number(af.leading) > 0 ? { leading: Number(af.leading) } : {}),
        }
      }
      out.push(spec)
    }
    return out
  } catch {
    return []
  }
}

/** The first text document inside a slot's property value, wherever the
 *  authoring nested it — `{p:{k:[{s:{t,f,s…}}]}}` is the recipe shape, but a
 *  static `{p:{k:{t…}}}` must work too. A text doc is recognized by its
 *  string `t` (the string) next to a font `f`. */
export function findTextDoc(value: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 6 || !value || typeof value !== 'object') return null
  const o = value as Record<string, unknown>
  if (typeof o.t === 'string' && typeof o.f === 'string') return o
  for (const v of Object.values(o)) {
    const found = Array.isArray(v)
      ? v.map((x) => findTextDoc(x, depth + 1)).find(Boolean) ?? null
      : findTextDoc(v, depth + 1)
    if (found) return found
  }
  return null
}

/** Static numeric value of a slot property (vec2 size, color), if it is one. */
export function numericValue(p: unknown): number[] | null {
  const o = p as { a?: number; k?: unknown } | null
  const k = o && typeof o === 'object' ? o.k : null
  if (Array.isArray(k) && k.every((n) => typeof n === 'number')) return k as number[]
  return null
}

/** Enumerate a document's slots as editable metas, labeled/configured by the
 *  agent's controls.json specs when present. Order: specs first (the agent's
 *  curation), then any unlisted slots. */
export function deriveSlotMetas(doc: unknown, controlsJson?: string | null): SlotMeta[] {
  const d = doc as { slots?: Record<string, { p?: unknown }> } | null
  if (!d?.slots || typeof d.slots !== 'object') return []
  const specs = parseSlotSpecs(controlsJson)
  const specBy = new Map(specs.map((s) => [s.sid, s]))
  const sids = [...specs.map((s) => s.sid).filter((sid) => sid in d.slots!),
    ...Object.keys(d.slots).filter((sid) => !specBy.has(sid))]

  const out: SlotMeta[] = []
  for (const sid of sids) {
    const p = d.slots[sid]?.p
    const spec = specBy.get(sid)
    const label = spec?.label ?? prettySid(sid)
    const textDoc = findTextDoc(p)
    if (textDoc) {
      const fontSize = Number(textDoc.s) || 24
      out.push({
        kind: 'text', sid, label,
        value: String(textDoc.t ?? ''),
        font: String(textDoc.f ?? ''),
        size: fontSize,
        tracking: Number(textDoc.tr) || 0,
        lineHeight: textLineHeight(textDoc.lh, fontSize),
      })
      continue
    }
    const nums = numericValue(p)
    // 2 components = a size/extent; 3 = a Lottie POSITION or anchor (vec3 —
    // the plumbing slots that keep a growable plate laid out). Both are edited
    // through the first two components; anything past them rides along
    // untouched so the value written back keeps its original shape.
    if (nums && (nums.length === 2 || nums.length === 3)) {
      out.push({
        kind: 'size', sid, label, value: [nums[0], nums[1]], extra: nums.slice(2),
        ...(spec?.autoFit ? { autoFit: spec.autoFit } : {}),
        ...(spec?.internal || INTERNAL_SLOT_RE.test(sid) ? { internal: true } : {}),
      })
    } else if (nums && nums.length === 4) {
      out.push({ kind: 'color', sid, label, value: [nums[0], nums[1], nums[2], nums[3]] })
    }
    // Scalars and other shapes stay agent-territory for now — no dead editors.
  }
  return out
}

/** Rewrite a slot's DEFAULT value in a parsed document (mutates `doc`).
 *  Unknown sids and shape mismatches are no-ops — a stale saved override must
 *  never corrupt a scene. */
export function applySlotOverride(doc: unknown, sid: string, value: unknown): void {
  const d = doc as { slots?: Record<string, { p?: unknown }> } | null
  const p = d?.slots?.[sid]?.p
  if (!p) return
  if (typeof value === 'string') {
    const textDoc = findTextDoc(p)
    // Only the string changes here. Vertical recentering of wrapped text goes
    // through the scene's `.textPos` slot (layoutSlotText computes the shift) —
    // text-doc `ls` looks right but Skottie IGNORES it, measured 2026-08-05.
    if (textDoc) textDoc.t = value
    return
  }
  // `{t, lh}`: a wrapped string plus the line height its stacked lines need.
  if (isTextOverride(value)) {
    const textDoc = findTextDoc(p)
    if (textDoc) {
      textDoc.t = value.t
      if (typeof value.lh === 'number') textDoc.lh = value.lh
    }
    return
  }
  if (Array.isArray(value) && value.every((n) => typeof n === 'number')) {
    const o = p as { a?: number; k?: unknown }
    const current = numericValue(p)
    if (current && current.length === value.length) {
      o.a = 0
      o.k = [...value]
    }
  }
}

/** Pair every size slot with its text slot by id prefix — `bubble.size`
 *  auto-fits `bubble.text`. Explicit controls.json `autoFit` (when the metas
 *  came with one) wins; the prefix pairing is the fallback that makes the
 *  behavior work even when the agent forgot to publish the numbers. */
export function autoFitTextSid(size: SizeSlotMeta, metas: SlotMeta[]): string | null {
  if (size.autoFit) return size.autoFit.text
  if (size.internal) return null // plumbing (.textPos) is never the plate
  const prefix = size.sid.replace(/\.[^.]*$/, '')
  const text = metas.find((m) => m.kind === 'text' && m.sid.replace(/\.[^.]*$/, '') === prefix)
  return text ? text.sid : null
}

/** The `.textPos` plumbing slot for a text slot, when the scene carries one —
 *  wrapped text keeps its block centered by shifting this slot's y. */
export function textPosMeta(textSid: string, metas: SlotMeta[]): SizeSlotMeta | null {
  const prefix = textSid.replace(/\.[^.]*$/, '')
  const meta = metas.find(
    (m): m is SizeSlotMeta => m.kind === 'size' && m.sid === `${prefix}.textPos`,
  )
  return meta ?? null
}

/** The scene's font metrics, in the portable module's shape. */
const fontOf = (meta: TextSlotMeta): FitFont => ({
  size: meta.size, lineHeight: meta.lineHeight, tracking: meta.tracking,
})

/** Point `ctx` at the scene's face before measuring. Skipping this measures
 *  whatever font the canvas last had — silently wrong by a few percent. */
const useSceneFont = (ctx: CanvasRenderingContext2D, meta: TextSlotMeta): void => {
  ctx.font = `${meta.size}px "${meta.font}"`
}

/** Measured width of a slot string in the scene's font. The font must already
 *  be registered with `document.fonts` under its family name — pass the canvas
 *  the caller keeps around so measurement doesn't allocate per keystroke. */
export function measureSlotText(ctx: CanvasRenderingContext2D, meta: TextSlotMeta, value: string): number {
  useSceneFont(ctx, meta)
  return measureText(ctx, fontOf(meta), value)
}

/** The full auto-fit layout for a string: wrapped text plus the plate size that
 *  hugs it. The algorithm itself lives in `portable/textFit.ts`, which the
 *  mobile pack SHIPS (compiled) — so a translation is sized by this exact code
 *  in the studio and in production, with no copy to keep in step. What stays
 *  here is the studio's own defaulting: without an autoFit spec, padding and
 *  bounds self-calibrate from the authored design values. */
export function layoutSlotText(
  ctx: CanvasRenderingContext2D, meta: TextSlotMeta, size: SizeSlotMeta, raw: string,
): TextLayout {
  useSceneFont(ctx, meta)
  const font = fontOf(meta)
  const [defaultW, defaultH] = size.value
  const fit = size.autoFit
  const padX = fit ? fit.padding[0] : Math.max(8, (defaultW - measureText(ctx, font, meta.value)) / 2)
  const padY = fit ? fit.padding[1] : Math.max(4, (defaultH - meta.lineHeight) / 2)
  return layoutText(ctx, font, {
    defaultSize: [defaultW, defaultH],
    padding: [padX, padY],
    min: [fit?.min?.[0] ?? Math.max(defaultH, 2 * padX + 16), fit?.min?.[1] ?? defaultH],
    max: fit?.max ?? null,
    leading: fit?.leading ?? 0,
  }, raw)
}

/** The `<prefix>.anchor` plumbing slot: the plate layer's anchor point. Tools
 *  set its y to HALF the plate height, which pins the plate's bottom edge —
 *  so a growing bubble expands upward, away from the thought trail beneath it,
 *  instead of swallowing the gap the artwork authored. */
export function anchorMeta(textSid: string, metas: SlotMeta[]): SizeSlotMeta | null {
  const prefix = textSid.replace(/\.[^.]*$/, '')
  return metas.find(
    (m): m is SizeSlotMeta => m.kind === 'size' && m.sid === `${prefix}.anchor`,
  ) ?? null
}

/** Replace a vec's y while keeping every other component (a vec3's z). */
export function withY(meta: SizeSlotMeta, y: number): number[] {
  return [meta.value[0], y, ...(meta.extra ?? [])]
}

/** A text override carrying the wrapped string and its line height. Plain
 *  strings stay valid — saved projects from before wrapping keep working. */
export type TextOverride = { t: string; lh?: number }
export function isTextOverride(v: unknown): v is TextOverride {
  return typeof v === 'object' && v !== null && typeof (v as TextOverride).t === 'string'
}
/** The string inside a text override, whatever shape it was stored in. */
export function textOverrideValue(v: unknown, fallback: string): string {
  if (typeof v === 'string') return v
  if (isTextOverride(v)) return v.t
  return fallback
}

/** Override keys are namespaced so they can never collide with control ids. */
export const SLOT_OVERRIDE_PREFIX = 'slot:'

function prettySid(sid: string): string {
  const clean = sid.replace(/[._-]+/g, ' ').trim()
  return (clean.charAt(0).toUpperCase() + clean.slice(1)).slice(0, 40) || sid
}
