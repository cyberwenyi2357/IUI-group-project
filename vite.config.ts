import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/token': 'http://localhost:3001'
    },
    host: true,
    port: 5001
  }
})
