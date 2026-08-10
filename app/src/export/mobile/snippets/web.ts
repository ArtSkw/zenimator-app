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

/** MIRROR of `fitCompToContent` in app/src/engine/lottie/fitFrame.ts — see that
 *  file for why the frame gives way instead of the text. Shipped so a locale
 *  swapped at runtime in the product gets the same frame the studio showed;
 *  without it a wrapped string grows past y=0 and the player crops it. */
const FIT_FRAME_SRC = `export function fitFrame(animation) {
  const d = animation
  if (!d || !Array.isArray(d.layers) || !(d.w > 0) || !(d.h > 0)) return null
  // A slot-driven property's authority is the slots table, not its inline k.
  const live = (p) => (p && p.sid && d.slots && d.slots[p.sid] ? d.slots[p.sid].p : p)
  const samples = (p) => {
    if (!p || typeof p !== 'object') return []
    const k = p.k
    if (p.a === 1 && Array.isArray(k)) {
      const out = []
      for (const kf of k) {
        if (kf && Array.isArray(kf.s)) out.push(kf.s)
        if (kf && Array.isArray(kf.e)) out.push(kf.e)
      }
      return out
    }
    if (typeof k === 'number') return [[k]]
    if (Array.isArray(k) && k.every((n) => typeof n === 'number')) return [k]
    return []
  }
  const ext = (p, i, fb) => {
    const v = samples(p).map((s) => s[i]).filter((n) => typeof n === 'number' && isFinite(n))
    return v.length ? { lo: Math.min.apply(null, v), hi: Math.max.apply(null, v) } : { lo: fb, hi: fb }
  }
  const mul = (e, s) => {
    const c = [e.lo * s.lo, e.lo * s.hi, e.hi * s.lo, e.hi * s.hi]
    return { lo: Math.min.apply(null, c), hi: Math.max.apply(null, c) }
  }
  const xform = (b, t) => {
    if (!t) return b
    const ax = ext(live(t.a), 0, 0), ay = ext(live(t.a), 1, 0)
    let x = { lo: b.x.lo - ax.hi, hi: b.x.hi - ax.lo }
    let y = { lo: b.y.lo - ay.hi, hi: b.y.hi - ay.lo }
    const r = ext(live(t.r), 0, 0)
    if (r.lo !== 0 || r.hi !== 0) {
      const rad = Math.hypot(Math.max(Math.abs(x.lo), Math.abs(x.hi)), Math.max(Math.abs(y.lo), Math.abs(y.hi)))
      x = { lo: -rad, hi: rad }; y = { lo: -rad, hi: rad }
    }
    const sx = ext(live(t.s), 0, 100), sy = ext(live(t.s), 1, 100)
    x = mul(x, { lo: sx.lo / 100, hi: sx.hi / 100 })
    y = mul(y, { lo: sy.lo / 100, hi: sy.hi / 100 })
    const px = ext(live(t.p), 0, 0), py = ext(live(t.p), 1, 0)
    return { x: { lo: x.lo + px.lo, hi: x.hi + px.hi }, y: { lo: y.lo + py.lo, hi: y.hi + py.hi } }
  }
  const rectsOf = (items, depth) => {
    const out = []
    if (!Array.isArray(items) || depth > 64) return out
    let outset = 0
    for (const it of items) if (it && it.ty === 'st') outset = Math.max(outset, ext(live(it.w), 0, 0).hi / 2)
    for (const it of items) {
      if (it && it.ty === 'rc' && it.s && it.s.sid) {
        const size = live(it.s)
        const w = ext(size, 0, 0).hi, h = ext(size, 1, 0).hi
        const cx = ext(live(it.p), 0, 0), cy = ext(live(it.p), 1, 0)
        out.push({
          x: { lo: cx.lo - w / 2 - outset, hi: cx.hi + w / 2 + outset },
          y: { lo: cy.lo - h / 2 - outset, hi: cy.hi + h / 2 + outset },
        })
      } else if (it && it.ty === 'gr' && Array.isArray(it.it)) {
        const tr = it.it.filter((x) => x && x.ty === 'tr')[0]
        for (const b of rectsOf(it.it, depth + 1)) out.push(xform(b, tr))
      }
    }
    return out
  }
  const byInd = new Map()
  for (const l of d.layers) if (typeof l.ind === 'number') byInd.set(l.ind, l)
  let x0 = 0, y0 = 0, x1 = d.w, y1 = d.h, measured = false
  for (const layer of d.layers) {
    for (const rect of rectsOf(layer.shapes || [], 0)) {
      let b = rect, cur = layer, guard = 0
      while (cur) {
        b = xform(b, cur.ks)
        if (cur.parent == null || ++guard > d.layers.length) break
        cur = byInd.get(cur.parent)
      }
      if (!b || !isFinite(b.x.lo) || !isFinite(b.y.lo)) continue
      measured = true
      x0 = Math.min(x0, b.x.lo); y0 = Math.min(y0, b.y.lo)
      x1 = Math.max(x1, b.x.hi); y1 = Math.max(y1, b.y.hi)
    }
  }
  if (!measured) return null
  const grow = (over) => (over > 0 ? Math.ceil(over + 1) : 0)
  const dx = grow(-x0), dy = grow(-y0), right = grow(x1 - d.w), bottom = grow(y1 - d.h)
  if (!dx && !dy && !right && !bottom) return null
  // Growth past 4x the authored size is corruption, not a translation.
  if (dx + right > d.w * 4 || dy + bottom > d.h * 4) return null
  const move = (p, deltas) => {
    const t = (p && p.sid && d.slots && d.slots[p.sid]) ? d.slots[p.sid].p : p
    if (!t || typeof t !== 'object') return
    const bump = (v) => {
      if (!Array.isArray(v)) return
      for (let i = 0; i < deltas.length; i++) if (typeof v[i] === 'number') v[i] += deltas[i]
    }
    if (t.a === 1 && Array.isArray(t.k)) for (const kf of t.k) { bump(kf && kf.s); bump(kf && kf.e) }
    else bump(t.k)
  }
  for (const l of d.layers) {
    if (l.parent != null || !l.ks) continue
    if (l.ks.p && l.ks.p.s === true) { move(l.ks.px, [dx]); move(l.ks.py, [dy]) }
    else move(l.ks.p, [dx, dy])
  }
  d.w += dx + right
  d.h += dy + bottom
  return { dx: dx, dy: dy, w: d.w, h: d.h }
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
