/**
 * Export-pack guard: build the mobile pack for a reference scene, EXECUTE the
 * shipped helper, and assert it sizes a string exactly as the studio does.
 *
 * The helper is generated from `engine/lottie/portable/*` via the `?portable`
 * plugin, so the two cannot hold different algorithms — but they can still be
 * wired together wrongly (a constant not passed through, a renamed export, a
 * helper that no longer parses). That is what this catches, by running the
 * real artifact rather than inspecting it.
 *
 *   npm run verify:pack
 */
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

const server = await createServer({
  configFile: 'vite.config.ts',
  server: { middlewareMode: true },
  logLevel: 'error',
})
const { web } = await server.ssrLoadModule('/src/export/mobile/snippets/web.ts')
const { buildPackContext } = await server.ssrLoadModule('/src/export/mobile/meta.ts')
const slots = await server.ssrLoadModule('/src/engine/lottie/slots.ts')

const base = new URL(
  '../../workbench/public/projects/live-onboarding-companion-szpq/scene-1/',
  import.meta.url,
).pathname
const lottieJson = readFileSync(base + 'lottie.json', 'utf8')
const controlsJson = readFileSync(base + 'controls.json', 'utf8')

const ctx = buildPackContext(lottieJson, true, [], slots.parseSlotSpecs(controlsJson))
if (ctx.slotFits.length === 0) {
  console.error('FAIL: reference scene published no autoFit slot pair to test.')
  process.exit(1)
}
const helperText = web.component(ctx)
console.log(`helper: ${helperText.length} bytes, ${ctx.slotFits.length} slot fit(s)`)

// A deterministic stand-in for the real font face, shared by BOTH sides — the
// point is to compare algorithms, not to re-measure a font.
const ctxFor = () => ({ font: '', measureText: (t) => ({ width: t.length * 7.4 }) })
globalThis.document = { createElement: () => ({ getContext: ctxFor }) }

// Font loading is the one part the helper owns and the studio doesn't; stub it.
const runnable = helperText.replace(
  /export function ensureFont[\s\S]*?\n}/,
  'export function ensureFont() { return Promise.resolve(true) }',
)
const shipped = await import(
  'data:text/javascript;base64,' + Buffer.from(runnable).toString('base64')
)

const STRINGS = [
  'One moment…',                                      // the authored default
  'No to lecimy dalej!',                              // wraps to 2 lines
  'Un momento por favor mientras preparamos todo',    // wraps to 3
  'x',                                                // clamps to the minimum
]
const metas = slots.deriveSlotMetas(JSON.parse(lottieJson), controlsJson)
const textMeta = metas.find((m) => m.kind === 'text')
const sizeMeta = metas.find((m) => m.kind === 'size' && m.autoFit)

let allMatch = true
for (const s of STRINGS) {
  const app = slots.layoutSlotText(ctxFor(), textMeta, sizeMeta, s)
  const out = await shipped.fitAnimation(JSON.parse(lottieJson), s)
  const size = out.slots[sizeMeta.sid].p.k
  const text = out.slots[textMeta.sid].p.k[0].s.t
  const same = app.w === size[0] && app.h === size[1] && app.text === text
  allMatch &&= same
  console.log(
    `  ${same ? '✓' : '✗'} "${s.slice(0, 32)}" — studio ${app.w}x${app.h}, ` +
    `shipped ${size[0]}x${size[1]}, frame ${out.w}x${out.h}`,
  )
}

// The helper must never mutate the document its caller handed in.
const untouched = JSON.parse(lottieJson)
await shipped.fitAnimation(untouched, 'No to lecimy dalej!')
const clean = untouched.w === 240 && untouched.h === 240
console.log(`  ${clean ? '✓' : '✗'} caller's document left untouched`)

await server.close()
if (!allMatch || !clean) {
  console.error("\nFAIL: the shipped helper disagrees with the studio.")
  process.exit(1)
}
console.log('PASS — the exported pack matches the studio exactly.')
