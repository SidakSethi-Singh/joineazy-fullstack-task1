import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Local dev: the React app calls /api/... and Vite forwards it to Express.
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
