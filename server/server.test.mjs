import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { originAllowed, parseOrigins, startServer } from './server.mjs';

describe('origens permitidas', () => {
  it('lê a lista separada por vírgula, sem barra no fim e em minúsculas', () => {
    expect(parseOrigins(' https://A.github.io/ , https://*.itch.zone,,')).toEqual([
      'https://a.github.io',
      'https://*.itch.zone',
    ]);
    expect(parseOrigins(undefined)).toEqual([]);
  });

  it('lista vazia libera qualquer site', () => {
    expect(originAllowed('https://qualquer.site', [])).toBe(true);
    expect(originAllowed(undefined, [])).toBe(true);
  });

  it('confere origem exata e subdomínio com curinga', () => {
    const allowed = parseOrigins('https://huguerra1.github.io,https://*.itch.zone');
    expect(originAllowed('https://huguerra1.github.io', allowed)).toBe(true);
    expect(originAllowed('https://html-classic.itch.zone', allowed)).toBe(true);
    expect(originAllowed('https://itch.zone', allowed)).toBe(false);
    expect(originAllowed('http://html-classic.itch.zone', allowed)).toBe(false);
    expect(originAllowed('https://evilitch.zone', allowed)).toBe(false);
    expect(originAllowed('https://outro.github.io', allowed)).toBe(false);
    expect(originAllowed(undefined, allowed)).toBe(false);
  });
});

describe('servidor', () => {
  let server;
  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it('responde o healthcheck em /healthz', async () => {
    server = await startServer(0, { allowedOrigins: [] });
    const res = await fetch(`http://localhost:${server.port}/healthz`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, rooms: 0, players: 0 });
  });

  it('recusa WebSocket de site fora da lista e aceita os da lista', async () => {
    server = await startServer(0, { allowedOrigins: ['https://jogo.exemplo'] });
    const url = `ws://localhost:${server.port}`;
    const open = (origin) =>
      new Promise((resolve) => {
        const ws = new WebSocket(url, { origin });
        ws.on('open', () => {
          ws.close();
          resolve('aberto');
        });
        ws.on('error', () => resolve('recusado'));
      });
    await expect(open('https://outro.exemplo')).resolves.toBe('recusado');
    await expect(open('https://jogo.exemplo')).resolves.toBe('aberto');
  });
});
