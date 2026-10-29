import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    open: true,
    // Keep the browser on one origin in development while forwarding API and
    // uploaded media requests to the public backend service.
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_PROXY_TARGET || 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: process.env.VITE_DEV_API_PROXY_TARGET || 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
})
