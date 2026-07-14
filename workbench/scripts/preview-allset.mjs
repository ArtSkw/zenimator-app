#!/usr/bin/env node
/**
 * CPU render of all-set — zoomed grid of key frames.
 * Output: /tmp/preview-allset.png
 */
import { readFileSync, writeFileSync } from 'fs'
import { createRequire } from 'module'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ckPath = createRequire(import.meta.url).resolve('canvaskit-wasm/full')
const CanvasKitInit = (await import(ckPath)).default

const LOTTIE = readFileSync(
  join(__dirname, '../public/projects/all-set/scene-1/lottie.json'), 'utf8'
)

const KEY_FRAMES = [
  { f: 0,   label: 'f0 start' },
  { f: 6,   label: 'f6 spark rise' },
  { f: 27,  label: 'f27 dip L' },
  { f: 42,  label: 'f42 ribbon mid' },
  { f: 54,  label: 'f54 center/blink' },
  { f: 81,  label: 'f81 dip R' },
  { f: 84,  label: 'f84 ribbon full' },
  { f: 108, label: 'f108 center' },
  { f: 135, label: 'f135 dip L' },
  { f: 162, label: 'f162 center/blink' },
  { f: 189, label: 'f189 dip R' },
  { f: 215, label: 'f215 loop end' },
]
const COLS = 4, SCALE = 1.5
const W = 257, H = 256
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
bgP.setColor(ck.Color(235, 235, 235, 1))
canvas.drawRect(ck.LTRBRect(0, 0, TOTAL_W, TOTAL_H), bgP)

for (let ci = 0; ci < KEY_FRAMES.length; ci++) {
  const { f } = KEY_FRAMES[ci]
  const col = ci % COLS, row = Math.floor(ci / COLS)
  const ox = col * CW, oy = row * CH

  const cell = ck.MakeSurface(W, H)
  const cc = cell.getCanvas()
  const bgC = new ck.Paint()
  bgC.setColor(ck.Color(255, 255, 255, 1))
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

writeFileSync('/tmp/preview-allset.png', bytes)
console.log(`Preview: /tmp/preview-allset.png  ${TOTAL_W}×${TOTAL_H}`)
