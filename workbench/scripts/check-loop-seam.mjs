#!/usr/bin/env node
/**
 * Loop-seam pixel check.
 *
 *   node scripts/check-loop-seam.mjs <project> [scene-N] [markerName]
 *
 * Renders the first and last frame of a repeatable marker segment and DIFFS
 * THE PICTURES. For a scrolling ambient field the per-layer keyframe values
 * deliberately differ across the seam — each tile ends one whole lap along,
 * standing in for the one ahead of it — so a keyframe comparison reports a
 * "mismatch" on a perfectly good scene and says nothing about what a viewer
 * sees. Only a picture-level diff tells a clean seam from a broken one.
 *
 * Exits 1 with the diff's bounding box when the two frames disagree, so a
 * missing strip is reported as a location to go and look at, not as a number.
 */
import { readFileSync, readdirSync } from 'fs'
import { createRequire } from 'module'
import { join, dirname, extname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const [project, sceneArg, markerArg] = process.argv.slice(2)
if (!project) {
  console.error('usage: node scripts/check-loop-seam.mjs <project> [scene-N] [markerName]')
  process.exit(2)
}
const scene = sceneArg && sceneArg.startsWith('scene') ? sceneArg : 'scene-1'
const wanted = (sceneArg && !sceneArg.startsWith('scene') ? sceneArg : markerArg) || null

const sceneDir = join(__dirname, `../public/projects/${project}/${scene}`)
const LOTTIE = readFileSync(join(sceneDir, 'lottie.json'), 'utf8')
const doc = JSON.parse(LOTTIE)

const markers = (doc.markers ?? []).filter((m) => typeof m?.tm === 'number' && (m.dr ?? 0) > 0)
const loop = wanted
  ? markers.find((m) => m.cm === wanted)
  : markers.find((m) => /loop|float|idle/i.test(m.cm ?? ''))
if (!loop) {
  console.log(`No repeatable marker to check in ${project}/${scene} — nothing to prove.`)
  process.exit(0)
}
const start = loop.tm, end = loop.tm + loop.dr

const require = createRequire(import.meta.url)
const ckPath = require.resolve('canvaskit-wasm/bin/full/canvaskit.js')
const CanvasKitInit = (await import(ckPath)).default
const ck = await CanvasKitInit({ locateFile: () => join(__dirname, '../public/canvaskit.wasm') })

const assets = {}
for (const f of readdirSync(sceneDir)) {
  if (['.png', '.jpg', '.jpeg', '.webp', '.ttf', '.otf', '.ttc'].includes(extname(f).toLowerCase())) {
    assets[f] = readFileSync(join(sceneDir, f))
  }
}
const anim = ck.MakeManagedAnimation(LOTTIE, assets)
if (!anim) { console.error('MakeManagedAnimation returned null.'); process.exit(2) }

const W = doc.w, H = doc.h
function frameBytes(f) {
  const surface = ck.MakeSurface(W, H)
  const canvas = surface.getCanvas()
  canvas.clear(ck.TRANSPARENT)
  anim.seekFrame(f)
  anim.render(canvas, ck.LTRBRect(0, 0, W, H))
  surface.flush()
  const px = surface.getCanvas().readPixels(0, 0, {
    width: W, height: H, colorType: ck.ColorType.RGBA_8888,
    alphaType: ck.AlphaType.Unpremul, colorSpace: ck.ColorSpace.SRGB,
  })
  const copy = Uint8Array.from(px)
  surface.delete()
  return copy
}

const a = frameBytes(start), b = frameBytes(end)
// Per-channel tolerance. Two renders of the SAME picture still disagree by a
// little where a curve's antialiasing lands — measured at up to 21/255 on a
// handful of edge pixels of a passing scene. A real seam break is an element
// present in one frame and absent in the other, which is full stroke-versus-
// background contrast: the sabotage test measures ~200. 40 sits clear of the
// first and far below the second.
const TOL = 40
let differing = 0, x0 = W, y0 = H, x1 = -1, y1 = -1
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4
    if (Math.abs(a[i] - b[i]) > TOL || Math.abs(a[i + 1] - b[i + 1]) > TOL ||
        Math.abs(a[i + 2] - b[i + 2]) > TOL || Math.abs(a[i + 3] - b[i + 3]) > TOL) {
      differing++
      if (x < x0) x0 = x; if (y < y0) y0 = y
      if (x > x1) x1 = x; if (y > y1) y1 = y
    }
  }
}
const pct = (100 * differing) / (W * H)
console.log(`Loop seam "${loop.cm}": frames ${start} vs ${end} of ${project}/${scene}`)
if (!differing) {
  console.log(`  ✓ identical — the segment repeats with no visible seam.`)
  process.exit(0)
}
console.log(`  ✗ ${differing} px differ (${pct.toFixed(2)}% of frame), bounding box ` +
  `x ${x0}..${x1}, y ${y0}..${y1} (${x1 - x0 + 1}×${y1 - y0 + 1})`)
console.log('  → Render both frames and look at that box. A clock whose period does not divide')
console.log('    the segment, or an ambient field crossing a fractional number of laps, lands here.')
process.exit(1)
