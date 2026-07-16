import { strToU8, zipSync } from 'fflate'

/**
 * Packages a baked Lottie JSON as a single-animation dotLottie (`.lottie`) —
 * a zip with a v1 manifest, the format every dotlottie player (web, iOS,
 * Android, React Native, Flutter) accepts out of the box. The v2 additions
 * (state machines, themes) extend this same module at the interactive
 * flagship; keep the v1 manifest as the base.
 *
 * Rasters embedded as data URIs inside the JSON stay inline — no `images/`
 * directory. Fonts have no standard dotLottie slot; scenes with native text
 * ship their font files beside the `.lottie` in the mobile packs instead.
 */

export type DotLottieOptions = {
  /** Written into the manifest so players honor the scene's loop intent. */
  loop?: boolean
}

export function makeDotLottieBytes(lottieJson: string, opts: DotLottieOptions = {}): Uint8Array {
  const manifest = {
    version: '1',
    generator: 'ZENimator',
    animations: [{ id: 'animation', autoplay: true, loop: opts.loop ?? true, speed: 1 }],
  }
  return zipSync(
    {
      'manifest.json': strToU8(JSON.stringify(manifest)),
      'animations/animation.json': strToU8(lottieJson),
    },
    { level: 6 },
  )
}

export function makeDotLottie(lottieJson: string, opts: DotLottieOptions = {}): Blob {
  return new Blob([makeDotLottieBytes(lottieJson, opts) as BlobPart], { type: 'application/zip' })
}
