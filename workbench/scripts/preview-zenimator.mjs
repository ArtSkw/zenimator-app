#!/usr/bin/env node
/**
 * CPU render of the zenimator entrance — grid of key frames.
 * Output: /tmp/preview-zenimator.png
 */
import { readFileSync, writeFileSync } from 'fs'
import { createRequire } from 'module'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ckPath = createRequire(import.meta.url).resolve('canvaskit-wasm/full')
const CanvasKitInit = (await import(ckPath)).default

const LOTTIE = readFileSync(
  join(__dirname, '../public/projects/zenimator/scene-1/lottie.json'), 'utf8'
)

const KEY_FRAMES = [
  { f: 0, label: 'f0 start' },
  { f: 14, label: 'f14 tracing' },
  { f: 27, label: 'f27 trace-end' },
  { f: 34, label: 'f34 crossfade' },
  { f: 42, label: 'f42 slide+Z' },
  { f: 54, label: 'f54 slide-end' },
  { f: 62, label: 'f62 ZEN' },
  { f: 74, label: 'f74 mid-word' },
  { f: 90, label: 'f90 near-end' },
  { f: 98, label: 'f98 word-done' },
  { f: 115, label: 'f115 hold' },
  { f: 129, label: 'f129 last' },
]
const COLS = 3, SCALE = 6
const W = 135, H = 24
const CW = W * SCALE, CH = H * SCALE + 20
const ROWS = Math.ceil(KEY_FRAMES.length / COLS)
const TOTAL_W = CW * COLS, TOTAL_H = CH * ROWS

const ck = await CanvasKitInit({ locateFile: () =>
  join(__dirname, '../public/canvaskit.wasm')
})

const anim = ck.MakeManagedAnimation(LOTTIE, null, null, null)
if (!anim) throw new Error('MakeManagedAnimation returned null')

const surface = ck.MakeSurface(TOTAL_W, TOTAL_H)
const canvas = surface.getCanvas()

const bgP = new ck.Paint()
bgP.setColor(ck.Color(60, 60, 60, 1))
canvas.drawRect(ck.LTRBRect(0, 0, TOTAL_W, TOTAL_H), bgP)

for (let ci = 0; ci < KEY_FRAMES.length; ci++) {
  const { f } = KEY_FRAMES[ci]
  const col = ci % COLS, row = Math.floor(ci / COLS)
  const ox = col * CW, oy = row * CH

  const cell = ck.MakeSurface(W, H)
  const cc = cell.getCanvas()
  const bgC = new ck.Paint()
  bgC.setColor(ck.Color(235, 235, 235, 1))
  cc.drawRect(ck.LTRBRect(0, 0, W, H), bgC)
  anim.seekFrame(f)
  anim.render(cc, ck.LTRBRect(0, 0, W, H))
  const img = cell.makeImageSnapshot()
  bgC.delete(); cell.delete()

  canvas.save()
  canvas.translate(ox, oy)
  canvas.scale(SCALE, SCALE)
  canvas.drawImage(img, 0, 0)
  canvas.restore()
  img.delete()
}

bgP.delete()

const snap = surface.makeImageSnapshot()
const bytes = snap.encodeToBytes()
snap.delete(); surface.delete(); anim.delete()

writeFileSync('/tmp/preview-zenimator.png', bytes)
console.log(`Preview: /tmp/preview-zenimator.png  ${TOTAL_W}×${TOTAL_H}`)
