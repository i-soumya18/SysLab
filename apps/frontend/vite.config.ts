import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const hmrHost = env.VITE_HMR_HOST || 'localhost';
  const hmrClientPort = Number(env.VITE_HMR_CLIENT_PORT || 5173);
  const hmrPath = env.VITE_HMR_PATH || '/';

  return {
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
        host: hmrHost,
        clientPort: hmrClientPort,
        protocol: 'ws',
        path: hmrPath
      },
      proxy: {
        // Proxy API requests to backend
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '/api/v1'),
        },
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
  };
});
