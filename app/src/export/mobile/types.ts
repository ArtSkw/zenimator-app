/** Mobile handoff packs (plan §3.7): one zip per framework carrying the same
 *  baked animation in both formats plus a paste-ready component and a README
 *  that teaches both runtime lanes (dotlottie players / airbnb lineage). */

export type FrameworkId = 'react-native' | 'ios' | 'android' | 'flutter'

export type PackFile = { path: string; content: string | Uint8Array }

export type PackMeta = {
  w: number
  h: number
  fps: number
  frames: number
  durationMs: number
  /** w / h, rounded — snippets use it for layout so exports never distort. */
  aspectRatio: number
  /** True when the scene uses native Lottie text (`fonts.list` present). */
  hasNativeText: boolean
}

export type PackContext = {
  /** The baked Lottie JSON (control overrides applied). */
  lottieJson: string
  /** The same doc packaged as a single-animation dotLottie. */
  dotLottie: Uint8Array
  loop: boolean
  meta: PackMeta
  /** Font sidecars for native-text scenes. Empty until the §3.2 fonts
   *  pipeline lands — the README carries a warning when text is present
   *  but fonts aren't. */
  fonts: { file: string; bytes: Uint8Array }[]
}

export type FrameworkDef = {
  id: FrameworkId
  label: string
  /** Short mono badge for the picker (house style: no brand icons). */
  badge: string
  /** One-liner under the label in the picker. */
  blurb: string
  /** Filename of the paste-ready component inside the pack. */
  componentPath: string
  /** The component file's source. */
  component: (ctx: PackContext) => string
  /** README "Quick start" section body (headline lane), markdown. */
  quickStart: (ctx: PackContext) => string
  /** README "Alternative player" section body (second lane), markdown. */
  alternative: (ctx: PackContext) => string
  /** Heading for the alternative section, e.g. "lottie-react-native". */
  alternativeLabel: string
}
