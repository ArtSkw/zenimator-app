import { readFileSync } from 'node:fs'
import { defineConfig, transformWithOxc, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFile } from 'node:fs/promises'
import path from 'path'

/** `import src from './x.ts?portable'` → the module's COMPILED JavaScript, as a
 *  string.
 *
 *  The mobile export pack ships runnable helpers (bubble fitting, frame
 *  fitting, slot baking) that cannot import app code. They used to be
 *  hand-maintained copies of the studio's own algorithms, with a comment asking
 *  future editors to change both — the kind of contract that holds right up
 *  until it doesn't, and then ships a mis-sized bubble to production.
 *
 *  Now the shipped text IS the app's module, type-checked and executed in the
 *  studio, compiled here with the same esbuild pass Vite already uses. Drift
 *  stops being something to police and becomes impossible. */
function portableSource(): Plugin {
  const SUFFIX = '?portable'
  return {
    name: 'zenimator-portable-source',
    enforce: 'pre',
    async resolveId(id, importer) {
      if (!id.endsWith(SUFFIX)) return null
      const resolved = await this.resolve(id.slice(0, -SUFFIX.length), importer, { skipSelf: true })
      return resolved ? resolved.id + SUFFIX : null
    },
    async load(id) {
      if (!id.endsWith(SUFFIX)) return null
      const file = id.slice(0, -SUFFIX.length)
      this.addWatchFile(file) // editing the source re-generates the pack in dev
      // Oxc is Vite 8's own transformer — no extra toolchain to keep installed.
      const { code } = await transformWithOxc(await readFile(file, 'utf8'), file, {
        lang: 'ts',
        target: 'es2020',
      })
      return `export default ${JSON.stringify(code.trimEnd())}`
    },
  }
}

// The UI shows the app version; read it from package.json so there is exactly
// ONE place it is written down.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig({
  base: '/zenimator-app/',
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [portableSource(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // CanvasKit (Skottie) is reached only via a dynamic import() in the Lottie
  // lane. Without this, Vite discovers it lazily on first use, re-optimizes,
  // and the in-flight import fails ("Failed to fetch dynamically imported
  // module"). Pre-bundling it at startup makes the first Generate work.
  optimizeDeps: {
    include: ['canvaskit-wasm/full'],
  },
  build: {
    rollupOptions: {
      output: {
        // Split the cache-stable framework/UI vendor code out of the app chunk
        // so a code change doesn't bust the (large, rarely-changing) vendor
        // cache — and so neither chunk trips the size warning on its own.
        // Rolldown (Vite 8) only accepts the function form of manualChunks.
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react-vendor'
          if (/node_modules\/(@base-ui|lucide-react)\//.test(id)) return 'ui-vendor'
        },
      },
    },
  },
})
