import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// "base" must match your GitHub repo name when deploying to GitHub Pages,
// e.g. https://<user>.github.io/<repo-name>/
export default defineConfig({
  base: '/mgx-pc/',
  plugins: [react(), tailwindcss()],
})
