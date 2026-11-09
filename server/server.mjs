// Servidor de salas do Toon Clash: junta dois jogadores por um código de 4 letras e repassa
// as mensagens entre eles. Não roda a partida — cada navegador simula a luta (rollback).
//
// Uso: npm run server            (porta 8787 ou a variável de ambiente PORT)
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const IDLE_MS = 30 * 60 * 1000;
const MAX_MESSAGE_BYTES = 4096;

function send(ws, message) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
}

/**
 * Sobe o servidor. Devolve a porta real (útil com port = 0 nos testes) e uma função para fechar.
 * @param {number} port
 * @returns {Promise<{ port: number; close: () => Promise<void> }>}
 */
export function startServer(port = Number(process.env.PORT ?? 8787)) {
  /** @type {Map<string, { players: import('ws').WebSocket[]; touched: number }>} */
  const rooms = new Map();

  const newCode = () => {
    for (;;) {
      let code = '';
      for (let i = 0; i < 4; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
      if (!rooms.has(code)) return code;
    }
  };

  const leave = (ws) => {
    const code = ws.room;
    if (!code) return;
    ws.room = undefined;
    const room = rooms.get(code);
    if (!room) return;
    room.players = room.players.filter((p) => p !== ws);
    for (const other of room.players) send(other, { type: 'peer-left' });
    if (room.players.length === 0) rooms.delete(code);
  };

  const http = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`Toon Clash server ok — ${rooms.size} sala(s)\n`);
  });

  const wss = new WebSocketServer({ server: http, maxPayload: MAX_MESSAGE_BYTES });

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => (ws.isAlive = true));

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return send(ws, { type: 'error', message: 'Mensagem inválida.' });
      }
      switch (msg?.type) {
        case 'create': {
          leave(ws);
          const code = newCode();
          rooms.set(code, { players: [ws], touched: Date.now() });
          ws.room = code;
          send(ws, { type: 'created', room: code });
          break;
        }
        case 'join': {
          const code = String(msg.room ?? '')
            .toUpperCase()
            .trim();
          const room = rooms.get(code);
          if (!room) return send(ws, { type: 'error', message: `Sala ${code} não existe.` });
          if (room.players.length >= 2) return send(ws, { type: 'error', message: 'Sala cheia.' });
          leave(ws);
          room.players.push(ws);
          room.touched = Date.now();
          ws.room = code;
          send(ws, { type: 'joined', room: code, side: 1 });
          send(room.players[0], { type: 'peer-joined' });
          break;
        }
        case 'ping':
          send(ws, { type: 'pong', t: msg.t });
          break;
        case 'relay': {
          const room = rooms.get(ws.room);
          if (!room) return;
          room.touched = Date.now();
          for (const other of room.players) {
            if (other !== ws) send(other, { type: 'relay', data: msg.data });
          }
          break;
        }
      }
    });

    ws.on('close', () => leave(ws));
    // Erro de um cliente (ex.: mensagem grande demais) derruba só a conexão dele.
    ws.on('error', () => {
      leave(ws);
      ws.terminate();
    });
  });

  // Derruba conexões mortas e salas esquecidas.
  const sweep = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
    const now = Date.now();
    for (const [code, room] of rooms) {
      if (now - room.touched > IDLE_MS) {
        for (const p of room.players) p.close();
        rooms.delete(code);
      }
    }
  }, 15_000);

  return new Promise((resolve) => {
    http.listen(port, () => {
      const address = http.address();
      resolve({
        port: typeof address === 'object' && address ? address.port : port,
        close: () =>
          new Promise((done) => {
            clearInterval(sweep);
            for (const ws of wss.clients) ws.terminate();
            wss.close();
            http.close(() => done());
          }),
      });
    });
  });
}

// Rodando direto (npm run server), sobe na porta padrão.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { port } = await startServer();
  console.log(`Toon Clash server ouvindo em ws://localhost:${port}`);
}
