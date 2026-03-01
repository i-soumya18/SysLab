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
    strictPort: false, // Allow fallback to other ports if 5173 is in use
    middlewareMode: false,
    hmr: {
      // Gateway proxies HMR through localhost:8080
      host: 'localhost',
      port: 8080,
      protocol: 'ws',
    },
    watch: {
      // Polling required for Docker volumes
      usePolling: true,
      interval: 500, // Reduced from 1000 for faster reload
      binaryInterval: 1000
    },
    // Chrome DevTools friendly
    fs: {
      allow: ['..']
    }
  },
  build: {
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'dnd-vendor': ['react-dnd', 'react-dnd-html5-backend']
        }
      }
    }
  }
})

