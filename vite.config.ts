import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
    },
  },
  server: {
    proxy: {
      // Browser SPA → upstream APIs (avoids CORS; keys stay in request headers)
      '/proxy/anthropic': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/proxy\/anthropic/, ''),
      },
      '/proxy/elevenlabs': {
        target: 'https://api.elevenlabs.io',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/proxy\/elevenlabs/, ''),
      },
      '/proxy/exercise': {
        target: 'https://api.exerciseapi.dev',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/proxy\/exercise/, ''),
      },
    },
  },
})
