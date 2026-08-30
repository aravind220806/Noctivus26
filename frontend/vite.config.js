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
  },
});
