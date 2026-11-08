import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Escuta em todas as interfaces (localhost e rede local / LAN)
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5170',
        changeOrigin: true,
      },
    },
  },
})
