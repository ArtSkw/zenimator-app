import { exportLottieWebm } from './exportLottieWebm'
import { recolorLottieForDark } from '@/lib/themeLottie'

/**
 * One-time owner utility: bakes the two boot-splash videos from the current
 * animation and downloads them. Drop the files into /public and commit; the
 * boot splash (src/boot/splash.ts) plays the theme-appropriate one.
 *
 * Two files because a WebM can't reliably carry transparency, so each is baked
 * on the SOLID splash background for its theme (so it blends with no visible
 * box), with the logo recolored to suit:
 *   • light — white background, ink logo as authored
 *   • dark  — near-black background, logo recolored white
 *
 * Backgrounds MUST match #app-loader in index.html. A boot-friendly bitrate
 * keeps the files light (they sit on the critical boot path), traded against
 * the 8 Mbps quality used for the general WebM export.
 */

// Keep in sync with index.html's #app-loader / html.dark #app-loader.
const LIGHT_BG = '#ffffff'
const DARK_BG = '#0D0D0F'
const SPLASH_BITRATE = 2_500_000
const SPLASH_SCALE = 2

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export async function bakeSplashVideos(
  lottieJson: string,
  onProgress?: (progress: number) => void,
): Promise<void> {
  // Entry kind (play once, hold) — a splash never loops.
  const light = await exportLottieWebm(
    lottieJson,
    { loop: false, background: LIGHT_BG, bitrate: SPLASH_BITRATE, scale: SPLASH_SCALE },
    (p) => onProgress?.(p * 0.5),
  )
  download(light, 'logo-splash-light.webm')

  const darkJson = JSON.stringify(recolorLottieForDark(JSON.parse(lottieJson)))
  const dark = await exportLottieWebm(
    darkJson,
    { loop: false, background: DARK_BG, bitrate: SPLASH_BITRATE, scale: SPLASH_SCALE },
    (p) => onProgress?.(0.5 + p * 0.5),
  )
  download(dark, 'logo-splash-dark.webm')
}
