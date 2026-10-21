import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Expõe na rede local (Wi-Fi) para acesso pelo celular
    port: 5173,
  },
})
