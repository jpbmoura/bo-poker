import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Toda a API vive na :3001 (/api/auth do Better Auth e /api/rooms).
      // Sem este proxy o cliente chamaria a própria :5173 e o dev server
      // devolveria index.html com 200 — o res.json() estoura com um erro de
      // parse que não aponta para a causa.
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
