// Gera tools/blender/looks.json a partir de src/characters/looks.ts, para o script do Blender.
// Uso: node tools/blender/looks-json.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../..', import.meta.url));
const server = await createServer({ root, logLevel: 'error', server: { middlewareMode: true } });
try {
  const { LOOKS } = await server.ssrLoadModule('/src/characters/looks.ts');
  const out = fileURLToPath(new URL('./looks.json', import.meta.url));
  writeFileSync(out, JSON.stringify(LOOKS, null, 2));
  console.log(`looks.json gerado com ${Object.keys(LOOKS).length} lutadores`);
} finally {
  await server.close();
}
