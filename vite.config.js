import { defineConfig } from 'vite';

export default defineConfig({
  base: '/penalty-shootout/',
  build: { outDir: 'docs' },
  server: {
    port: 3000,
    host: true,
  },
});
