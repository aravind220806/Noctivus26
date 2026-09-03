import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
  server: {
    port: 5173,
    allowedHosts: ['posted-foothold-crabbing.ngrok-free.dev', 'localhost', '127.0.0.1'],
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('motion') || id.includes('framer-motion') || id.includes('motion-dom')) {
              return 'vendor-motion';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-lucide';
            }
            if (id.includes('swiper')) {
              return 'vendor-swiper';
            }
            if (id.includes('html5-qrcode') || id.includes('qrcode')) {
              return 'vendor-qrcode';
            }
            if (id.includes('recharts') || id.includes('d3-')) {
              return 'vendor-charts';
            }
            if (id.includes('ogl')) {
              return 'vendor-ogl';
            }
            if (id.includes('maplibre-gl')) {
              return 'vendor-maplibre';
            }
            if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
              return 'vendor-react';
            }
          }
        },
      },
    },
  },
});
