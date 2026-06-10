// Copies the CanvasKit wasm binary into /public so Vite serves it at /canvaskit.wasm.
// Runs on postinstall; safe to run manually: `node scripts/copy-canvaskit.mjs`.
// CanvasKit powers the Skottie (Lottie) renderer used by the generate-mode lane.
import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

try {
  // Use the "full" build — it includes the Skottie (Lottie) module.
  const src = resolve(require.resolve('canvaskit-wasm/full'), '../canvaskit.wasm')
  const dest = resolve(__dirname, '../public/canvaskit.wasm')
  await mkdir(dirname(dest), { recursive: true })
  await copyFile(src, dest)
  console.log(`Copied CanvasKit wasm -> ${dest}`)
} catch (err) {
  // Don't fail the whole install if canvaskit isn't present yet (e.g. a fresh
  // clone before the dep resolves). The next install/build will copy it.
  console.warn('[copy-canvaskit] skipped:', err?.message ?? err)
}
