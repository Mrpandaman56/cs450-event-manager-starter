import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    proxy: {
      '/api': {
        // TODO 2: Default to localhost outside Docker, but read environment variable for Compose service DNS
        target: process.env.API_PROXY_TARGET ?? 'http://localhost:4002',
        changeOrigin: true
      }
    }
  }
});
