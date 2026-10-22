import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

import { cloudflare } from "@cloudflare/vite-plugin";
import { apiOrigin } from './src/config/apiOrigin.ts'

export default defineConfig(({ mode, command, isPreview }) => {
  // Validate before bundling, including values overridden by the release environment.
  apiOrigin(loadEnv(mode, process.cwd(), 'VITE_').VITE_API_BASE_URL ?? '', command === 'build' || !!isPreview)
  return ({
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
  })
})
