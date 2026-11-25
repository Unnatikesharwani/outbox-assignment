import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Everything under /api, /auth and /admin is forwarded to the Express server
const target = 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': target, '/auth': target, '/admin': target } },
});
