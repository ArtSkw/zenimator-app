import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  base: '/zenimator-app/',
  plugins: [react(), tailwindcss()],
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
