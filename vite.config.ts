import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Caminhos relativos para funcionar no GitHub Pages (https://<usuario>.github.io/toon-clash/)
  base: './',
  server: { port: 5173 },
  // O Three.js sozinho já passa de 500 kB minificado (~130 kB com gzip).
  build: { chunkSizeWarningLimit: 800 },
  test: { environment: 'node' },
});
