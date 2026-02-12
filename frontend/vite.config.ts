import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom']
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dnd', 'react-dnd-html5-backend']
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    hmr: {
      clientPort: 8080,  // Use the gateway port for HMR
      protocol: 'ws',
      host: 'localhost'
    },
    watch: {
      usePolling: true,  // Required for Docker volume watching
      interval: 1000
    }
  }
})
