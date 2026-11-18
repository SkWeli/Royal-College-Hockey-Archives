import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// base './' lets the site work on GitHub Pages (any repo name) and Cloudflare Pages.
// `npm run build:single` makes one self-contained HTML file (handy for a demo).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [])],
}))
