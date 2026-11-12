import { inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { ITCH_MAX_FILES, checkItchBuild, createZip } from './zip.mjs';

/** Leitor mínimo do diretório central, só para conferir o que o createZip gravou. */
function readZip(zip) {
  const end = zip.length - 22;
  expect(zip.readUInt32LE(end)).toBe(0x06054b50);
  const count = zip.readUInt16LE(end + 10);
  let p = zip.readUInt32LE(end + 16);
  const out = {};
  for (let i = 0; i < count; i++) {
    expect(zip.readUInt32LE(p)).toBe(0x02014b50);
    const method = zip.readUInt16LE(p + 10);
    const size = zip.readUInt32LE(p + 20);
    const nameLength = zip.readUInt16LE(p + 28);
    const offset = zip.readUInt32LE(p + 42);
    const name = zip.toString('utf8', p + 46, p + 46 + nameLength);
    const localNameLength = zip.readUInt16LE(offset + 26);
    const start = offset + 30 + localNameLength;
    const body = zip.subarray(start, start + size);
    out[name] = (method === 8 ? inflateRawSync(body) : body).toString('utf8');
    p += 46 + nameLength;
  }
  return out;
}

describe('createZip', () => {
  it('grava os arquivos com caminho e conteúdo, comprimidos ou não', () => {
    const repetido = 'soco '.repeat(500);
    const zip = createZip([
      { name: 'index.html', data: Buffer.from('<html></html>') },
      { name: 'assets/jogo.js', data: Buffer.from(repetido) },
      { name: 'assets/ç.txt', data: Buffer.from('x') },
    ]);
    expect(readZip(zip)).toEqual({
      'index.html': '<html></html>',
      'assets/jogo.js': repetido,
      'assets/ç.txt': 'x',
    });
    // O arquivo repetitivo encolheu.
    expect(zip.length).toBeLessThan(repetido.length);
  });

  it('é reproduzível: mesma entrada, mesmo .zip', () => {
    const entries = [{ name: 'a.txt', data: Buffer.from('a') }];
    expect(createZip(entries).equals(createZip(entries))).toBe(true);
  });
});

describe('checkItchBuild', () => {
  const ok = '<script type="module" src="./assets/index.js"></script>';

  it('aceita build com index.html na raiz e caminhos relativos', () => {
    expect(checkItchBuild([{ name: 'index.html', size: 10 }], ok)).toEqual([]);
  });

  it('acusa falta do index.html, caminho absoluto e arquivos demais', () => {
    const many = Array.from({ length: ITCH_MAX_FILES + 1 }, (_, i) => ({
      name: `f${i}`,
      size: 1,
    }));
    const problems = checkItchBuild(many, '<script src="/assets/index.js"></script>');
    expect(problems).toHaveLength(3);
  });

  it('não confunde URL com protocolo relativo (//fonts…) com caminho absoluto', () => {
    const html = '<link href="//fonts.example.com/x.css" rel="stylesheet">';
    expect(checkItchBuild([{ name: 'index.html', size: 1 }], html)).toEqual([]);
  });
});
