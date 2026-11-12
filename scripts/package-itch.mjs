// Empacota o build (dist/) num .zip pronto para subir no Itch.io como jogo HTML.
//
// Uso: npm run package:itch   (roda o build antes e grava release/toon-clash-itch-<versão>.zip)
//
// No Itch.io: Kind of project = HTML, suba o .zip e marque "This file will be played in the
// browser". Para o online funcionar lá, faça o build com VITE_NET_URL=wss://… (veja .env.example).
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkItchBuild, createZip } from './zip.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');

function listFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

let paths;
try {
  paths = listFiles(dist).sort();
} catch {
  console.error('Não achei dist/. Rode "npm run build" antes (ou use "npm run package:itch").');
  process.exit(1);
}

const files = paths.map((path) => ({
  name: relative(dist, path).split(sep).join('/'),
  path,
  size: statSync(path).size,
}));
const indexHtml = readFileSync(join(dist, 'index.html'), 'utf8');
const problems = checkItchBuild(files, indexHtml);
if (problems.length > 0) {
  console.error('O build não está pronto para o Itch.io:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const zip = createZip(files.map((f) => ({ name: f.name, data: readFileSync(f.path) })));
const outDir = join(root, 'release');
mkdirSync(outDir, { recursive: true });
const out = join(outDir, `toon-clash-itch-${version}.zip`);
writeFileSync(out, zip);

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1);
const total = files.reduce((sum, f) => sum + f.size, 0);
console.log(
  `${relative(root, out)}: ${files.length} arquivos, ${mb(total)} MB → ${mb(zip.length)} MB`,
);
