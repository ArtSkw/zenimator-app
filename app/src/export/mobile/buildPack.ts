import { strToU8, zipSync } from 'fflate'
import { frameworkById } from './frameworks'
import { buildPackContext } from './meta'
import { renderReadme } from './readme'
import type { FrameworkId, PackFile } from './types'

export type MobilePack = {
  blob: Blob
  filename: string
  /** True when the scene needs fonts the pack couldn't include — the caller
   *  should surface a warning (the README already carries one). */
  fontsMissing: boolean
}

/** Assembles one framework's handoff zip from a baked Lottie JSON. Pure and
 *  synchronous — callers bake lazily on confirm, never on render. */
export function buildMobilePack(
  id: FrameworkId,
  args: { lottieJson: string; loop: boolean },
): MobilePack {
  const def = frameworkById(id)
  const ctx = buildPackContext(args.lottieJson, args.loop)

  const files: PackFile[] = [
    { path: 'README.md', content: renderReadme(def, ctx) },
    { path: 'animation.json', content: ctx.lottieJson },
    { path: 'animation.lottie', content: ctx.dotLottie },
    { path: def.componentPath, content: def.component(ctx) },
    ...ctx.fonts.map((f) => ({ path: `fonts/${f.file}`, content: f.bytes })),
  ]

  const zipInput: Record<string, Uint8Array> = {}
  for (const f of files) {
    zipInput[f.path] = typeof f.content === 'string' ? strToU8(f.content) : f.content
  }

  return {
    blob: new Blob([zipSync(zipInput, { level: 6 }) as BlobPart], { type: 'application/zip' }),
    filename: `zenimator-${id}-${Date.now()}.zip`,
    fontsMissing: ctx.meta.hasNativeText && ctx.fonts.length === 0,
  }
}
