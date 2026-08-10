import type { FrameworkDef, SlotFit } from '../types'
// The pack ships the studio's OWN modules, compiled — not copies of them. See
// the `portableSource` plugin in vite.config.ts.
import APPLY_SLOTS_SRC from '@/engine/lottie/portable/applySlots.ts?portable'
import FIT_FRAME_SRC from '@/engine/lottie/portable/fitFrame.ts?portable'
import TEXT_FIT_SRC from '@/engine/lottie/portable/textFit.ts?portable'

// Versions verified against npm 2026-07-16 — re-pin when they move.
const LOTTIE_WEB_VERSION = '5.13.x'
const DOTLOTTIE_WEB_VERSION = '0.56.x'

/** The localization helper the pack ships: measure → wrap → slot overrides,
 *  then grow the frame so the result can't be cropped. Generated with the
 *  scene's real numbers baked in, so the file works with zero configuration
 *  next to `animation.json` and `fonts/`.
 *
 *  Everything algorithmic here is INLINED FROM THE STUDIO'S OWN MODULES
 *  (`engine/lottie/portable/*`), compiled by the `?portable` plugin. Only the
 *  glue — font loading and the slot object — is written here, so there is no
 *  second implementation that can drift away from what the app rehearsed. */
function bubbleHelper(fit: SlotFit, loop: boolean): string {
  const font = JSON.stringify({
    family: fit.fontFamily,
    file: fit.fontFile,
    size: fit.fontSize,
    lineHeight: fit.lineHeight,
    tracking: fit.tracking,
  }, null, 2)
  const plate = JSON.stringify({
    textSlot: fit.textSid,
    sizeSlot: fit.sizeSid,
    defaultSize: fit.sizeDefault,
    padding: fit.padding,
    min: fit.min,
    max: fit.max,
    leading: fit.leading,
    textPos: fit.textPos,
    anchor: fit.anchor,
  }, null, 2)

  return `// zenimator-bubble.js — exported by ZENimator.
//
// One animation file, every language: measure the translated string in the
// scene's real font, wrap it at the design's max width, and hand the player
// the Lottie slot overrides that make the speech bubble hug the text.
//
//   import lottie from 'lottie-web'                        // >= ${LOTTIE_WEB_VERSION}
//   import { fitAnimation } from './zenimator-bubble.js'
//
//   const data = await fitAnimation(await (await fetch('animation.json')).json(),
//                                   t('onboarding.hint'))
//   lottie.loadAnimation({ container, animationData: data,
//                          renderer: 'svg', autoplay: true, loop: ${loop} })
//
// fitAnimation is the safe default: a longer translation wraps onto another
// line, the bubble grows upward, and the FRAME grows with it. Slots alone
// cannot do that — the player takes its size from the document, so a bubble
// that outgrows the artwork gets cropped.
//
// If you already load with \`path:\` and only ever ship strings that fit on one
// line, \`fitBubble(text)\` still returns plain load-time slots. Resolve it
// BEFORE loadAnimation — slots are config, not a patch. For players without
// slots support, bake instead (see applySlots).

export const FONT = ${font}

export const PLATE = ${plate}

const BASE_DOC = ${JSON.stringify(fit.baseDoc)}

let fontReady = null

/** Load the scene's font before measuring. Skipping this measures the
 *  browser's fallback face instead: the bubble renders mis-sized on first
 *  paint and "fixes itself" on reload — the classic heisenbug. */
export function ensureFont(fontUrl) {
  if (!fontReady) {
    const url = fontUrl || new URL('./fonts/' + FONT.file, import.meta.url).href
    const face = new FontFace(FONT.family, 'url("' + url + '")')
    fontReady = face.load().then(
      (loaded) => { document.fonts.add(loaded); return true },
      () => false, // measurement degrades to the fallback face, never throws
    )
  }
  return fontReady
}

/**
 * Size the bubble for a localized string.
 * Returns a Lottie "slots" object: pass it to lottie-web's loadAnimation
 * config, or bake it with applySlots for any other player.
 *
 * opts.fontUrl  — override the font location (default: ./fonts/ next to this file)
 * opts.maxWidth — override the wrap threshold from the design spec
 */
export async function fitBubble(text, opts) {
  opts = opts || {}
  await ensureFont(opts.fontUrl)
  const ctx = document.createElement('canvas').getContext('2d')
  ctx.font = FONT.size + 'px "' + FONT.family + '"'

  const max = opts.maxWidth ? [opts.maxWidth, 0] : PLATE.max
  const layout = layoutText(ctx, FONT, {
    defaultSize: PLATE.defaultSize,
    padding: PLATE.padding,
    min: PLATE.min,
    max: max,
    leading: PLATE.leading,
  }, String(text))

  const withY = function (value, y) { var out = value.slice(); out[1] = y; return out }

  const slots = {}
  slots[PLATE.textSlot] = {
    p: { k: [{ s: Object.assign({}, BASE_DOC, { t: layout.text, lh: layout.lineHeight }), t: 0 }] },
  }
  slots[PLATE.sizeSlot] = { p: { a: 0, k: [layout.w, layout.h] } }
  // Extra lines grow DOWN from the first baseline while the plate grows from
  // its center — the scene's textPos slot lifts the block so it stays centered.
  if (PLATE.textPos) {
    slots[PLATE.textPos.sid] = { p: { a: 0, k: withY(PLATE.textPos.value, PLATE.textPos.value[1] + layout.dy) } }
  }
  // The anchor slot pins the plate's BOTTOM edge (anchor y = height / 2), so a
  // taller bubble grows upward instead of closing the gap to whatever sits
  // below it — the thought trail keeps the spacing the artwork authored.
  if (PLATE.anchor) {
    slots[PLATE.anchor.sid] = { p: { a: 0, k: withY(PLATE.anchor.value, layout.h / 2) } }
  }
  return slots
}

/** Measure, wrap, and size the plate — the studio's own module, compiled.
 *  This is why a translation gets the same bubble here as in the app. */
${TEXT_FIT_SRC}

/** Bake slot overrides into a Lottie document (players without \`slots\`
 *  config, or server-side per-locale pre-baking). Mutates and returns it. */
${APPLY_SLOTS_SRC}

/** Grow the composition so a resized plate can't be cropped. The bubble is
 *  pinned by its bottom edge, so a string that wraps onto another line grows
 *  UPWARD — past the top of the frame the player clips it. Every root layer
 *  shifts by the same amount, so the scene looks identical, only larger.
 *  Returns what changed, or null when the artwork already fit. */
${FIT_FRAME_SRC}

/** The one-call path: a ready-to-load document, sized for the string.
 *  Use this instead of \`fitBubble\` whenever a translation may wrap — slots
 *  alone cannot change the frame, because the player reads its size from the
 *  document. */
export async function fitAnimation(animationData, text, opts) {
  const slots = await fitBubble(text, opts)
  const data = typeof structuredClone === 'function'
    ? structuredClone(animationData)
    : JSON.parse(JSON.stringify(animationData))
  applySlots(data, slots)
  fitFrame(data)
  return data
}
`
}

/** Scenes without an autoFit pair still get a working file, honest about why
 *  it's thin — never a helper that silently mis-sizes. */
function stubHelper(): string {
  return `// zenimator-bubble.js — exported by ZENimator.
//
// This scene publishes no autoFit slot pair (text + plate size), so there is
// nothing to measure — the animation ships as-is. If the scene gains a
// localizable speech bubble later, re-export this pack and a full fitBubble()
// helper appears here.

${APPLY_SLOTS_SRC}
`
}

export const web: FrameworkDef = {
  id: 'web',
  label: 'Web',
  badge: 'JS',
  blurb: 'lottie-web slots · fitBubble() localization helper',
  componentPath: 'zenimator-bubble.js',
  alternativeLabel: '@lottiefiles/dotlottie-web',

  component: (ctx) => (ctx.slotFits.length > 0 ? bubbleHelper(ctx.slotFits[0], ctx.loop) : stubHelper()),

  quickStart: (ctx) => {
    if (ctx.slotFits.length === 0) {
      return `1. \`npm install lottie-web\` (${LOTTIE_WEB_VERSION} at export time).
2. Copy \`animation.json\` into your assets and load it:

   \`\`\`js
   import lottie from 'lottie-web'

   lottie.loadAnimation({
     container: document.getElementById('anim'),
     path: 'animation.json',
     renderer: 'svg',
     autoplay: true,
     loop: ${ctx.loop},
   })
   \`\`\``
    }
    const load = ctx.meta.loopStart == null
      ? `   lottie.loadAnimation({
     container: document.getElementById('anim'),
     path: 'animation.json',
     renderer: 'svg',
     autoplay: true,
     loop: ${ctx.loop},
     slots,
   })`
      : `   const anim = lottie.loadAnimation({
     container: document.getElementById('anim'),
     path: 'animation.json',
     renderer: 'svg',
     autoplay: false,   // the intro/loop segments drive playback
     loop: false,
     slots,
   })

   // Entrance once, then the idle forever (markers: intro 0–${ctx.meta.loopStart},
   // loop ${ctx.meta.loopStart}–${ctx.meta.frames}). A plain \`loop: true\` would replay
   // the entrance on every cycle.
   anim.addEventListener('DOMLoaded', () => {
     anim.playSegments([0, ${ctx.meta.loopStart}], true)
     const onIntroDone = () => {
       anim.removeEventListener('complete', onIntroDone)
       anim.loop = true
       anim.playSegments([${ctx.meta.loopStart}, ${ctx.meta.frames}], true)
     }
     anim.addEventListener('complete', onIntroDone)
   })`
    return `1. \`npm install lottie-web\` (${LOTTIE_WEB_VERSION} at export time).
2. Copy \`animation.json\`, \`zenimator-bubble.js\` and \`fonts/\` side by side
   into your source tree.
3. Localize at load time — one animation file, every language:

   \`\`\`js
   import lottie from 'lottie-web'
   import { fitBubble } from './zenimator-bubble.js'

   const slots = await fitBubble(t('onboarding.hint'))   // your i18n string
${load}
   \`\`\`

   \`fitBubble\` awaits the scene font, measures the string, wraps it at the
   design's max width (\`\\r\` line breaks) and returns the slot overrides that
   size the plate — resolve it BEFORE \`loadAnimation\`.`
  },

  alternative: (ctx) => {
    const bake = ctx.slotFits.length > 0
      ? `\`\`\`js
import { DotLottie } from '@lottiefiles/dotlottie-web'
import { fitBubble, applySlots } from './zenimator-bubble.js'
import animation from './animation.json'

const doc = applySlots(structuredClone(animation), await fitBubble(str))
new DotLottie({
  canvas: document.getElementById('anim'),
  data: JSON.stringify(doc),
  autoplay: true,
  loop: ${ctx.loop},
})
\`\`\`

The same bake works server-side to pre-render one JSON per locale at build
time — no client measurement at all.`
      : `\`\`\`js
import { DotLottie } from '@lottiefiles/dotlottie-web'

new DotLottie({
  canvas: document.getElementById('anim'),
  src: 'animation.lottie',
  autoplay: true,
  loop: ${ctx.loop},
})
\`\`\``
    return `Already on \`@lottiefiles/dotlottie-web\` (${DOTLOTTIE_WEB_VERSION})? Bake the slots into the document instead of passing load-time config:

${bake}`
  },
}
