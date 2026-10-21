import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig(({ mode, command, isPreview }) => ({
  // Yerelde standart Vite proxy'si kullanılır; web Worker'ı iş/API mantığı içermez.
  plugins: [react(), ...(command === 'build' || isPreview ? [cloudflare()] : [])],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '^/api(?:/|$)': {
        target: loadEnv(mode, process.cwd(), 'API_').API_PROXY_TARGET || 'http://localhost:8787',
      },
    },
  },
}))
