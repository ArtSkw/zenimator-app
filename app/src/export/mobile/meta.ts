import { makeDotLottieBytes } from '../exportDotLottie'
import { findTextDoc, numericValue, sidPrefix, textLineHeight, type SlotSpec } from '@/engine/lottie/slots'
import { loopStartFrame } from '@/engine/lottie/markers'
import type { PackContext, PackParameter, SlotFit } from './types'
import {
  readParameterValue, type GradientValue, type ParameterSpec,
} from '@/engine/lottie/parameters'
import { rgbToHex } from '@/engine/lottie/color'

/** What a developer needs to see in a README: the shipped value, readable. */
function showParameter(kind: string, value: unknown): string {
  if (value == null) return '—'
  if (kind === 'gradient') {
    const g = value as GradientValue
    const stops = (g.stops ?? []).map((s) => s.color).join(' → ')
    return `${g.type}, ${g.stops?.length ?? 0} stops (${stops})`
  }
  if (kind === 'color') {
    const c = (value as { k?: number[] })?.k ?? (value as number[])
    if (Array.isArray(c) && c.length >= 3) return rgbToHex(c[0], c[1], c[2])
  }
  if (kind === 'size') {
    const v = (value as { k?: number[] })?.k ?? (value as number[])
    if (Array.isArray(v) && v.length >= 2) return `${Math.round(v[0])} × ${Math.round(v[1])}`
  }
  if (kind === 'text') {
    const t = (value as { k?: { t?: string } })?.k
    if (t && typeof t === 'object' && 't' in t) return `"${String(t.t).slice(0, 40)}"`
  }
  return typeof value === 'object' ? '—' : String(value)
}

/** Builds the shared context every pack file is rendered from. Parses the
 *  baked doc once; the `.lottie` bytes are produced here so `animation.json`
 *  and `animation.lottie` are guaranteed to be the same baked document. */
export function buildPackContext(
  lottieJson: string,
  loop: boolean,
  fonts: { file: string; bytes: Uint8Array }[] = [],
  slotSpecs: SlotSpec[] = [],
  parameters: ParameterSpec[] = [],
): PackContext {
  const doc = JSON.parse(lottieJson) as {
    w?: number
    h?: number
    fr?: number
    ip?: number
    op?: number
    fonts?: { list?: unknown[] }
    markers?: { tm: number; cm?: string }[]
    slots?: Record<string, { p?: unknown }>
  }
  const w = doc.w ?? 512
  const h = doc.h ?? 512
  const fps = doc.fr ?? 60
  const frames = Math.max(1, Math.round((doc.op ?? 0) - (doc.ip ?? 0)))
  const loopStart = loopStartFrame(doc)

  // Pair each autoFit spec with its live slot values — the web helper's
  // constants. Specs whose slots don't exist in the doc drop silently.
  const slotFits: SlotFit[] = []
  for (const spec of slotSpecs) {
    const fit = spec.autoFit
    if (!fit) continue
    const textDoc = findTextDoc(doc.slots?.[fit.text]?.p)
    const sizeVal = numericValue(doc.slots?.[spec.sid]?.p)
    if (!textDoc || !sizeVal || sizeVal.length !== 2) continue
    const family = String(textDoc.f ?? '')
    const fontSize = Number(textDoc.s) || 24
    const prefix = sidPrefix(fit.text)
    const posSid = `${prefix}.textPos`
    const posVal = numericValue(doc.slots?.[posSid]?.p)
    const anchorSid = `${prefix}.anchor`
    const anchorVal = numericValue(doc.slots?.[anchorSid]?.p)
    slotFits.push({
      textSid: fit.text,
      sizeSid: spec.sid,
      fontFamily: family,
      fontFile: `${family}.ttf`,
      fontSize,
      lineHeight: textLineHeight(textDoc.lh, fontSize),
      tracking: Number(textDoc.tr) || 0,
      baseDoc: { ...textDoc },
      sizeDefault: [sizeVal[0], sizeVal[1]],
      padding: fit.padding,
      min: fit.min ?? [2 * fit.padding[0] + 16, sizeVal[1]],
      max: fit.max ?? null,
      textPos: posVal && posVal.length >= 2 ? { sid: posSid, value: posVal } : null,
      anchor: anchorVal && anchorVal.length >= 2 ? { sid: anchorSid, value: anchorVal } : null,
      leading: fit.leading ?? 0,
    })
  }

  return {
    lottieJson,
    dotLottie: makeDotLottieBytes(lottieJson, { loop }),
    loop,
    meta: {
      w,
      h,
      fps,
      frames,
      durationMs: Math.round((frames / fps) * 1000),
      aspectRatio: Number((w / h).toFixed(4)),
      hasNativeText: Array.isArray(doc.fonts?.list) && doc.fonts.list.length > 0,
      loopStart: loopStart != null && loopStart < frames ? Math.round(loopStart) : null,
      slotIds: doc.slots ? Object.keys(doc.slots) : [],
      // Read from the BAKED doc, so the README quotes what the pack actually
      // contains rather than what the scene was authored with.
      parameters: parameters.map<PackParameter>((spec) => ({
        id: spec.id,
        sid: spec.sid,
        kind: spec.kind,
        label: spec.label,
        shown: showParameter(spec.kind, readParameterValue(doc, spec)),
      })),
    },
    fonts,
    slotFits,
  }
}
