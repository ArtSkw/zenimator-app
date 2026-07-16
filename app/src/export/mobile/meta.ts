import { makeDotLottieBytes } from '../exportDotLottie'
import type { PackContext } from './types'

/** Builds the shared context every pack file is rendered from. Parses the
 *  baked doc once; the `.lottie` bytes are produced here so `animation.json`
 *  and `animation.lottie` are guaranteed to be the same baked document. */
export function buildPackContext(lottieJson: string, loop: boolean): PackContext {
  const doc = JSON.parse(lottieJson) as {
    w?: number
    h?: number
    fr?: number
    ip?: number
    op?: number
    fonts?: { list?: unknown[] }
  }
  const w = doc.w ?? 512
  const h = doc.h ?? 512
  const fps = doc.fr ?? 60
  const frames = Math.max(1, Math.round((doc.op ?? 0) - (doc.ip ?? 0)))
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
    },
    fonts: [],
  }
}
