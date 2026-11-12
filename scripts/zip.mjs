// Gerador de .zip mínimo (sem dependências) e checagens do pacote para o Itch.io.
// Usado por scripts/package-itch.mjs; testado em scripts/zip.test.mjs.
import { crc32, deflateRawSync } from 'node:zlib';

/** Data fixa (01/01/2026 00:00) para o mesmo build gerar sempre o mesmo .zip. */
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

/**
 * Monta um .zip na memória.
 * @param {{ name: string; data: Buffer }[]} entries caminhos com "/" e sem "/" no começo
 * @returns {Buffer}
 */
export function createZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBytes = Buffer.from(name, 'utf8');
    const deflated = deflateRawSync(data, { level: 9 });
    // Arquivo que não encolhe (imagem, .glb comprimido) vai guardado sem compressão.
    const stored = deflated.length >= data.length;
    const body = stored ? data : deflated;
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // versão necessária
    local.writeUInt16LE(0x0800, 6); // nomes em UTF-8
    local.writeUInt16LE(stored ? 0 : 8, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBytes, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // feito por
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(stored ? 0 : 8, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);

    offset += local.length + nameBytes.length + body.length;
  }
  const centralSize = centrals.reduce((sum, b) => sum + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

/** Limites do Itch.io para jogos HTML (https://itch.io/docs/creators/html5). */
export const ITCH_MAX_FILES = 1000;
export const ITCH_MAX_TOTAL_BYTES = 500 * 1024 * 1024;
export const ITCH_MAX_FILE_BYTES = 200 * 1024 * 1024;

/**
 * Confere se o build roda no Itch.io. Devolve a lista de problemas (vazia = tudo certo).
 * @param {{ name: string; size: number }[]} files
 * @param {string} indexHtml
 * @returns {string[]}
 */
export function checkItchBuild(files, indexHtml) {
  const problems = [];
  if (!files.some((f) => f.name === 'index.html')) {
    problems.push('Falta o index.html na raiz do pacote.');
  }
  if (files.length > ITCH_MAX_FILES) {
    problems.push(`${files.length} arquivos; o Itch.io aceita até ${ITCH_MAX_FILES}.`);
  }
  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (total > ITCH_MAX_TOTAL_BYTES) problems.push('Pacote passa de 500 MB descompactado.');
  for (const f of files) {
    if (f.size > ITCH_MAX_FILE_BYTES) problems.push(`${f.name} passa de 200 MB.`);
  }
  // O Itch serve o jogo numa subpasta: caminho começando com "/" não acha os arquivos.
  const absolute = indexHtml.match(/(?:src|href)="\/(?!\/)[^"]*"/g);
  if (absolute) {
    problems.push(`Caminhos absolutos no index.html (use base './'): ${absolute.join(', ')}`);
  }
  return problems;
}
