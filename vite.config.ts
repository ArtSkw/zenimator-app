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
})
