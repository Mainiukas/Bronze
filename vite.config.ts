import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // Relative asset URLs, so the build works from any folder or sub-path
  // (GitHub Pages, a storage bucket, or opened straight from disk).
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    // `npm run build:single` inlines all JS, CSS and fonts into one index.html.
    ...(mode === 'single' ? [viteSingleFile()] : []),
  ],
  build: mode === 'single' ? { outDir: 'dist-single' } : {},
}))
