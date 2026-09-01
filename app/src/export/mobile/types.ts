/** Mobile handoff packs (plan §3.7): one zip per framework carrying the same
 *  baked animation in both formats plus a paste-ready component and a README
 *  that teaches both runtime lanes (dotlottie players / airbnb lineage). */

export type FrameworkId = 'react-native' | 'ios' | 'android' | 'flutter' | 'web'

/** Everything the web helper needs to size a bubble for a localized string —
 *  extracted from the scene's slots + the agent's autoFit spec, baked into
 *  the generated `zenimator-bubble.js` as constants. */
export type SlotFit = {
  textSid: string
  sizeSid: string
  fontFamily: string
  /** Filename inside the pack's `fonts/` dir. */
  fontFile: string
  fontSize: number
  lineHeight: number
  /** Lottie `tr`: thousandths of an em per character. */
  tracking: number
  /** The authored text document (t, f, s, lh, fc, j, ls…) — the helper
   *  rebuilds slot values from it so nothing but the string changes. */
  baseDoc: Record<string, unknown>
  sizeDefault: [number, number]
  padding: [number, number]
  min: [number, number]
  /** Wrap threshold; null when the scene predates the stage-safety spec. */
  max: [number, number] | null
  /** The `.textPos` plumbing slot (sid + authored position) when the scene
   *  carries one — wrapped text recenters by shifting its y. Skottie ignores
   *  text-doc `ls`, so this slot IS the centering mechanism. */
  textPos: { sid: string; value: number[] } | null
  /** The `.anchor` plumbing slot — y = plate height / 2 pins the bottom edge
   *  so the bubble grows upward, away from whatever sits beneath it; x shifts
   *  by `layout.dx` to hold the pinned side. */
  anchor: { sid: string; value: number[] } | null
  /** Which way the plate widens: `'right'` pins its left edge, `'left'` pins
   *  its right, `'center'` spreads both ways. */
  grow: 'center' | 'left' | 'right'
  /** Extra px added to the line height when the string wraps. */
  leading: number
}

export type PackFile = { path: string; content: string | Uint8Array }

export type PackParameter = {
  id: string
  sid: string
  kind: string
  label: string
  /** Human-readable form of the shipped value — a hex, a size, a ramp summary. */
  shown: string
}

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
  /** Intro→loop boundary frame (intro-loop marker contract), or null. */
  loopStart: number | null
  /** Content slot ids (companion pattern) — the scene's localization surface. */
  slotIds: string[]
  /** Declared content parameters with the value the pack actually ships, so a
   *  developer can see what is swappable at runtime without opening the JSON. */
  parameters: PackParameter[]
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
  /** Localizable bubble fits (companion pattern) — powers the web pack's
   *  fitBubble helper. Empty when the scene has no autoFit-paired slots. */
  slotFits: SlotFit[]
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
