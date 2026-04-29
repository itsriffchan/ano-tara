import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://ano-tara-kz4es5jzu-itsriffchans-projects.vercel.app',
        changeOrigin: true,
        secure: true,
      }
    }
  }
})
