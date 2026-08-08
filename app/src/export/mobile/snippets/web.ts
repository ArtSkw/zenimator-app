import type { FrameworkDef, SlotFit } from '../types'

// Versions verified against npm 2026-07-16 — re-pin when they move.
const LOTTIE_WEB_VERSION = '5.13.x'
const DOTLOTTIE_WEB_VERSION = '0.56.x'

/** `applySlots` ships in both the full helper and the stub — one source. */
const APPLY_SLOTS_SRC = `export function applySlots(animation, slots) {
  if (!animation || !animation.slots) return animation
  for (const sid of Object.keys(slots)) {
    if (sid in animation.slots) animation.slots[sid] = slots[sid]
  }
  return animation
}`

/** The localization helper the pack ships: measure → wrap → slot overrides.
 *  Generated with the scene's real numbers baked in so the file works with
 *  zero configuration next to `animation.json` and `fonts/`.
 *
 *  MIRROR of `measureSlotText`/`wrapSlotText`/`layoutSlotText` in
 *  app/src/engine/lottie/slots.ts — the shipped file must size a string
 *  exactly as the in-app rehearsal does, and it can't import app code, so any
 *  change to the fit algorithm lands in BOTH places. */
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
//   import { fitBubble } from './zenimator-bubble.js'
//
//   const slots = await fitBubble(t('onboarding.hint'))
//   lottie.loadAnimation({ container, path: 'animation.json', slots,
//                          renderer: 'svg', autoplay: true, loop: ${loop} })
//
// Resolve fitBubble BEFORE loadAnimation — slots are load-time config, not a
// patch. For players without slots support, bake instead (see applySlots).

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

function measure(ctx, text) {
  const base = ctx.measureText(text).width
  return base + (FONT.tracking / 1000) * FONT.size * Math.max(0, text.length - 1)
}

function wrapText(ctx, text, maxInnerW) {
  const words = text.split(/\\s+/).filter(Boolean)
  if (words.length === 0) return [text.trim()]
  const lines = []
  let line = words[0]
  for (const word of words.slice(1)) {
    const candidate = line + ' ' + word
    if (measure(ctx, candidate) <= maxInnerW) line = candidate
    else { lines.push(line); line = word }
  }
  lines.push(line)
  return lines
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

  const maxW = opts.maxWidth || (PLATE.max ? PLATE.max[0] : null)
  const str = String(text)
  const lines = maxW ? wrapText(ctx, str, maxW - 2 * PLATE.padding[0]) : [str]
  // Wrapped lines get extra leading; a single line keeps the design's spec.
  const lineHeight = lines.length > 1 ? FONT.lineHeight + (PLATE.leading || 0) : FONT.lineHeight

  let widest = 0
  for (const line of lines) widest = Math.max(widest, measure(ctx, line))
  const w = Math.max(PLATE.min[0], Math.min(maxW || Infinity, Math.round(widest + 2 * PLATE.padding[0])))
  // Same height rule as the app's layoutSlotText: only a single line WITHOUT a
  // wrap threshold keeps the authored height — with one, height follows the
  // measured content, so the shipped bubble matches the in-app rehearsal.
  const h = lines.length === 1 && !maxW
    ? PLATE.defaultSize[1]
    : Math.max(PLATE.min[1], Math.round(2 * PLATE.padding[1] + lineHeight * lines.length))

  const withY = function (value, y) { var out = value.slice(); out[1] = y; return out }

  const slots = {}
  slots[PLATE.textSlot] = {
    p: { k: [{ s: Object.assign({}, BASE_DOC, { t: lines.join('\\r'), lh: lineHeight }), t: 0 }] },
  }
  slots[PLATE.sizeSlot] = { p: { a: 0, k: [w, h] } }
  // Extra lines grow DOWN from the first baseline while the plate grows from
  // its center — the scene's textPos slot lifts the block half a lineHeight
  // per extra line so it stays vertically centered. (Text-doc "ls" looks like
  // the tool for this, but Skottie ignores it — don't be tempted.)
  if (PLATE.textPos) {
    const dy = -((lines.length - 1) * lineHeight) / 2
    slots[PLATE.textPos.sid] = { p: { a: 0, k: withY(PLATE.textPos.value, PLATE.textPos.value[1] + dy) } }
  }
  // The anchor slot pins the plate's BOTTOM edge (anchor y = height / 2), so a
  // taller bubble grows upward instead of closing the gap to whatever sits
  // below it — the thought trail keeps the spacing the artwork authored.
  if (PLATE.anchor) {
    slots[PLATE.anchor.sid] = { p: { a: 0, k: withY(PLATE.anchor.value, h / 2) } }
  }
  return slots
}

/** Bake slot overrides into a Lottie document (players without \`slots\`
 *  config, or server-side per-locale pre-baking). Mutates and returns it. */
${APPLY_SLOTS_SRC}
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
