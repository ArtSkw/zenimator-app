import { makeDotLottieBytes } from '../exportDotLottie'
import { findTextDoc, numericValue, sidPrefix, textLineHeight, type SlotSpec } from '@/engine/lottie/slots'
import { loopStartFrame } from '@/engine/lottie/markers'
import type { PackContext, SlotFit } from './types'

/** Builds the shared context every pack file is rendered from. Parses the
 *  baked doc once; the `.lottie` bytes are produced here so `animation.json`
 *  and `animation.lottie` are guaranteed to be the same baked document. */
export function buildPackContext(
  lottieJson: string,
  loop: boolean,
  fonts: { file: string; bytes: Uint8Array }[] = [],
  slotSpecs: SlotSpec[] = [],
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
    },
    fonts,
    slotFits,
  }
}
