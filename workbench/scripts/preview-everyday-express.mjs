#!/usr/bin/env node
/**
 * CPU render of everyday-express — zoomed 2× grid of key frames.
 * Output: /tmp/preview-everyday-express.png
 */
import { readFileSync, writeFileSync } from 'fs'
import { createRequire } from 'module'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ckPath = createRequire(import.meta.url).resolve('canvaskit-wasm/full')
const CanvasKitInit = (await import(ckPath)).default

const LOTTIE = readFileSync(
  join(__dirname, '../public/projects/everyday-express/scene-1/lottie.json'), 'utf8'
)

// Key frames: top-bounce, bottom-bounce, blink, loop-check
const KEY_FRAMES = [
  { f: 0,  label: 'f0 top' },
  { f: 9,  label: 'f9 bot' },
  { f: 18, label: 'f18 top' },
  { f: 27, label: 'f27 bot' },
  { f: 35, label: 'f35 blink' },
  { f: 36, label: 'f36 reset' },
]
const COLS = 3, SCALE = 2
const W = 375, H = 133
const CW = W * SCALE, CH = H * SCALE + 20
const ROWS = Math.ceil(KEY_FRAMES.length / COLS)
const TOTAL_W = CW * COLS, TOTAL_H = CH * ROWS

const ck = await CanvasKitInit({ locateFile: () =>
  join(__dirname, '../public/canvaskit.wasm')
})

const anim = ck.MakeManagedAnimation(LOTTIE, null, null, null)
if (!anim) throw new Error('MakeManagedAnimation returned null')

const surface = ck.MakeSurface(TOTAL_W, TOTAL_H)
const canvas  = surface.getCanvas()

const bgP = new ck.Paint()
bgP.setColor(ck.Color(235, 235, 235, 1))
canvas.drawRect(ck.LTRBRect(0, 0, TOTAL_W, TOTAL_H), bgP)

for (let ci = 0; ci < KEY_FRAMES.length; ci++) {
  const { f } = KEY_FRAMES[ci]
  const col = ci % COLS, row = Math.floor(ci / COLS)
  const ox = col * CW, oy = row * CH

  // Render frame into a native-size surface then draw scaled
  const cell = ck.MakeSurface(W, H)
  const cc   = cell.getCanvas()
  const bgC  = new ck.Paint()
  bgC.setColor(ck.Color(255, 255, 255, 1))
  cc.drawRect(ck.LTRBRect(0, 0, W, H), bgC)
  anim.seekFrame(f)
  anim.render(cc, ck.LTRBRect(0, 0, W, H))
  const img = cell.makeImageSnapshot()
  bgC.delete(); cell.delete()

  // Draw scaled
  canvas.save()
  canvas.translate(ox, oy)
  canvas.scale(SCALE, SCALE)
  canvas.drawImage(img, 0, 0)
  canvas.restore()
  img.delete()
}

bgP.delete()

const snap  = surface.makeImageSnapshot()
const bytes = snap.encodeToBytes()
snap.delete(); surface.delete(); anim.delete()

writeFileSync('/tmp/preview-everyday-express.png', bytes)
console.log(`Preview: /tmp/preview-everyday-express.png  ${TOTAL_W}×${TOTAL_H}`)
