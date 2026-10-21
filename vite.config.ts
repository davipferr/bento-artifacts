import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The app lives in ./app. `base: './'` plus hash routing lets the build run from any
// sub-path, e.g. https://<user>.github.io/bento-artifacts/.
export default defineConfig({
  root: 'app',
  base: './',
  plugins: [react()],
  build: { outDir: '../dist', emptyOutDir: true },
})
