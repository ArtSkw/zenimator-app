#!/usr/bin/env node
/**
 * Generic deterministic scene previewer (CanvasKit in Node — the verification
 * method this project standardized on; no browser needed).
 *
 *   node scripts/preview-scene.mjs <project> [scene-N] [f1,f2,...] [--out /tmp/x.png] [--zoom 1.5]
 *
 * Renders the given frames of public/projects/<project>/<scene>/lottie.json
 * as a labeled grid PNG (default /tmp/preview-<project>.png). With no frame
 * list, picks start / quarters / end. Exits non-zero on parse/render failure,
 * so it doubles as a validity check.
 */
import { readFileSync, writeFileSync } from 'fs'
import { createRequire } from 'module'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const flags = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const i = process.argv.indexOf(a)
    return [a.slice(2), process.argv[i + 1]]
  }),
)
const project = args[0]
if (!project) {
  console.error('usage: node scripts/preview-scene.mjs <project> [scene-N] [f1,f2,...]')
  process.exit(2)
}
const scene = args[1] && args[1].startsWith('scene') ? args[1] : 'scene-1'
const scenePath = join(__dirname, `../public/projects/${project}/${scene}/lottie.json`)
const LOTTIE = readFileSync(scenePath, 'utf8')
const doc = JSON.parse(LOTTIE)

const frameArg = args.find((a) => /^\d+(,\d+)*$/.test(a))
const last = Math.max(0, Math.ceil(doc.op) - 1)
const frames = frameArg
  ? frameArg.split(',').map(Number)
  : [0, Math.round(last * 0.25), Math.round(last * 0.5), Math.round(last * 0.75), last]

const SCALE = Number(flags.zoom ?? 1.5)
const W = Math.round(doc.w), H = Math.round(doc.h)
const CW = Math.round(W * SCALE), CH = Math.round(H * SCALE) + 20
const COLS = Math.min(4, frames.length)
const ROWS = Math.ceil(frames.length / COLS)

const ckPath = createRequire(import.meta.url).resolve('canvaskit-wasm/full')
const CanvasKitInit = (await import(ckPath)).default
const ck = await CanvasKitInit({ locateFile: () => join(__dirname, '../public/canvaskit.wasm') })

const anim = ck.MakeManagedAnimation(LOTTIE, null, null, null)
if (!anim) {
  console.error('MakeManagedAnimation returned null — the JSON does not render.')
  process.exit(1)
}
const surface = ck.MakeSurface(CW * COLS, CH * ROWS)
const canvas = surface.getCanvas()
const bg = new ck.Paint()
bg.setColor(ck.Color(235, 235, 235, 1))
canvas.drawRect(ck.LTRBRect(0, 0, CW * COLS, CH * ROWS), bg)

const font = new ck.Font(null, 12)
const ink = new ck.Paint()
ink.setColor(ck.Color(40, 40, 40, 1))

frames.forEach((f, i) => {
  const ox = (i % COLS) * CW
  const oy = Math.floor(i / COLS) * CH
  anim.seekFrame(Math.min(f, last))
  canvas.save()
  canvas.translate(ox, oy + 20)
  canvas.scale(SCALE, SCALE)
  anim.render(canvas, ck.LTRBRect(0, 0, W, H))
  canvas.restore()
  canvas.drawText(`f${f}`, ox + 6, oy + 14, ink, font)
})

const out = flags.out ?? `/tmp/preview-${project}.png`
const img = surface.makeImageSnapshot()
writeFileSync(out, Buffer.from(img.encodeToBytes()))
console.log(`Wrote ${out} — frames [${frames.join(', ')}] of ${project}/${scene} (${doc.op}f @ ${doc.fr}fps)`)
