import type { FrameworkDef, PackContext } from './types'

const fmtSeconds = (ms: number) => `${(ms / 1000).toFixed(2).replace(/\.?0+$/, '')} s`

/** Renders the pack README: facts, files, quick start (headline lane), the
 *  alternative lane, fonts (when relevant), and the parity/controls notes. */
export function renderReadme(def: FrameworkDef, ctx: PackContext): string {
  const { meta } = ctx
  const date = new Date().toISOString().slice(0, 10)

  const fontFiles = ctx.fonts.map((f) => `- \`fonts/${f.file}\``).join('\n')
  const fontsSection = !meta.hasNativeText
    ? ''
    : ctx.fonts.length > 0
      ? `
## Fonts

This scene uses native Lottie text; its fonts ship in the pack:

${fontFiles}

Register each font with your player before loading the animation (font/asset
provider APIs vary per player) — the family name inside \`animation.json\`
(\`fonts.list[].fFamily\`) must match the font file's embedded family name.
`
      : `
## Fonts

> **Warning:** this scene uses native Lottie text, but the pack could not
> include its font files (the engine that produced it predates the fonts
> pipeline). Text may render in a fallback font on device. Re-export after
> the fonts update, or ask the design team for a vector-text variant.
`

  const segmentSection = meta.loopStart == null
    ? ''
    : `
## Intro + Loop playback

This scene is an ENTRANCE that settles into an ENDLESS IDLE. The boundary is
declared with standard Lottie markers (\`intro\`, \`loop\`; the idle begins at
frame ${meta.loopStart}). Play the intro once, then cycle the loop segment:

- **lottie-web**: \`anim.playSegments([[0, ${meta.loopStart}], [${meta.loopStart}, ${meta.frames}]], true)\`
- **dotlottie players**: play segment \`"intro"\` once, then loop segment \`"loop"\`
- **iOS (lottie-ios)**: \`play(fromMarker: "intro", toMarker: "loop")\` then \`play(marker: "loop", loopMode: .loop)\`
- **Android**: \`setMinAndMaxFrame(0, ${meta.loopStart})\` for the first pass, then \`setMinAndMaxFrame(${meta.loopStart}, ${meta.frames})\` with \`repeatCount = INFINITE\`

Letting the whole file loop instead replays the entrance every cycle — it
works, but it isn't the design.
`

  const parametersSection = meta.parameters.length === 0
    ? ''
    : `
## Content parameters (swap at runtime)

The studio declared these as editable content. The pack already ships them at the
values below — override them in code when you need a variant, instead of asking
for a re-export.

| Parameter | Slot id | Type | Ships as |
| --- | --- | --- | --- |
${meta.parameters.map((p) => `| ${p.label} | \`${p.sid}\` | ${p.kind} | ${p.shown} |`).join('\n')}

**lottie-web (≥ 5.12)** — pass overrides as \`slots\` at load time. The shape
mirrors the \`slots\` object inside \`animation.json\`, so copy the entry you want to
change and edit its value:

\`\`\`js
lottie.loadAnimation({
  container: el,
  path: 'animation.json',
  renderer: 'svg',
  loop: true,
  autoplay: true,
  slots: {
    // a colour: [r, g, b, a] in 0..1, NOT 0..255
    // accentColor: { p: { a: 0, k: [0.13, 0.89, 0.26, 1] } },
    // a gradient ramp: 4x stops colour numbers, then 2x stops opacity numbers
    // ${meta.parameters[0]?.sid ?? 'ramp'}: { p: { p: 2, k: { a: 0, k: [0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 1, 1] } } },
  },
})
\`\`\`

**dotlottie players** — per-parameter theming arrives with the interactive
release; until then load \`animation.json\` through lottie-web for overrides, or
ship a second export.

**iOS / Android** — the airbnb-lineage runtimes have no slot API. Use a value
provider keyed by the layer name (\`AnimationKeypath\` / \`KeyPath\`), or take the
variant as its own file.
`

  const localizationSection = meta.slotIds.length === 0
    ? ''
    : `
## Localization (editable text)

The scene's strings are REAL text layers bound to Lottie slots
(${meta.slotIds.map((s) => `\`${s}\``).join(', ')}) — re-word them in code, don't re-export
per language:

- **dotlottie players**: theming/slots API — override the slot by id.
- **lottie-web (≥5.12)**: pass \`slots\` in the animation config, or
  \`anim.updateDocumentData\` on the text layer.
- **iOS**: \`AnimationTextProvider\` keyed by the text layer's name.
- **Android**: \`TextDelegate\` keyed by the text layer's name.

If the scene declares a size slot with \`autoFit\` (see \`controls.json\` in
ZENimator), size the bubble plate from the localized string: measure the text
in the scene's font, add 2×padding, and write the result to the size slot —
three lines in any runtime. Fonts for measuring ship in \`fonts/\`.

One catch worth knowing before you ship a translation: the bubble is pinned by
its bottom edge, so a string that wraps onto another line grows UPWARD, and a
player crops whatever leaves the composition. Resizing the plate is not enough
on its own — the frame has to grow too, and it takes its size from the
document, not from the slots. The web pack handles this for you
(\`fitAnimation\` in \`zenimator-bubble.js\`). On iOS and Android, grow \`w\`/\`h\` in
the JSON by the overflow and shift every layer WITHOUT a parent by the same
amount: the scene then looks identical, only framed larger.
`

  return `# ZENimator animation — ${def.label} pack

Authored by the ZENimator studio engine and verified frame-by-frame on Skia
(Skottie). Control values were baked in at export time.

| size | fps | frames | duration | loop |
|---|---|---|---|---|
| ${meta.w}×${meta.h} | ${meta.fps} | ${meta.frames} | ${fmtSeconds(meta.durationMs)} | ${ctx.loop ? 'yes' : 'no'} |

## Files

- \`animation.lottie\` — dotLottie package (for the dotlottie players)
- \`animation.json\` — plain Lottie (for lottie-web / airbnb players)
- \`${def.componentPath}\` — paste-ready component, wired for this animation
- \`README.md\` — this file
${ctx.fonts.length > 0 ? ctx.fonts.map((f) => `- \`fonts/${f.file}\` — required by the scene's native text`).join('\n') + '\n' : ''}
## Quick start

${def.quickStart(ctx)}

## Alternative: ${def.alternativeLabel}

${def.alternative(ctx)}
${segmentSection}${parametersSection}${localizationSection}${fontsSection}
## Rendering parity

The animation was authored and verified on Skia. All dotlottie runtimes (web,
iOS, Android, React Native, Flutter) share the ThorVG engine, so they render
alike across platforms. If a frame looks off in your player, try the
plain-JSON lane — and report it back to the design team so the scene can be
adjusted.

## Changing it

Slider values are baked into these files. To tweak motion, timing, or
intensity, re-export from ZENimator — don't hand-edit the JSON.

---
Generated by ZENimator · ${date}
`
}
