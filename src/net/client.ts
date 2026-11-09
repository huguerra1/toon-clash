import type { ClientMessage, PeerMessage, ServerMessage } from './protocol';

const URL_KEY = 'toon-clash:servidor';

/** Endereço padrão: variável de build, último usado, ou o mesmo host na porta 8787. */
export function defaultServerUrl(): string {
  try {
    const saved = localStorage.getItem(URL_KEY);
    if (saved) return saved;
  } catch {
    // Sem armazenamento: segue para os padrões.
  }
  const env = import.meta.env.VITE_NET_URL as string | undefined;
  if (env) return env;
  const secure = location.protocol === 'https:';
  return `${secure ? 'wss' : 'ws'}://${location.hostname || 'localhost'}:8787`;
}

export function rememberServerUrl(url: string): void {
  try {
    localStorage.setItem(URL_KEY, url);
  } catch {
    // Ignora: só não lembra na próxima vez.
  }
}

/** Conexão com o servidor de salas. */
export class NetClient {
  private ws: WebSocket | null = null;
  /** Ida e volta até o servidor, em ms (média móvel). */
  ping = 0;
  private pingTimer: ReturnType<typeof setInterval> | undefined;
  onServer: (msg: ServerMessage) => void = () => {};
  onPeer: (msg: PeerMessage) => void = () => {};
  onClose: () => void = () => {};

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
        return;
      }
      this.ws = ws;
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('O servidor não respondeu.'));
      }, 6000);
      ws.onopen = () => {
        clearTimeout(timeout);
        this.pingTimer = setInterval(() => this.send({ type: 'ping', t: performance.now() }), 1000);
        resolve();
      };
      ws.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Não foi possível conectar ao servidor.'));
      };
      ws.onclose = () => {
        clearInterval(this.pingTimer);
        if (this.ws === ws) {
          this.ws = null;
          this.onClose();
        }
      };
      ws.onmessage = (event) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(String(event.data)) as ServerMessage;
        } catch {
          return;
        }
        if (msg.type === 'pong') {
          const rtt = performance.now() - msg.t;
          this.ping = this.ping === 0 ? rtt : this.ping * 0.8 + rtt * 0.2;
        } else if (msg.type === 'relay') {
          this.onPeer(msg.data);
        } else {
          this.onServer(msg);
        }
      };
    });
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  sendPeer(data: PeerMessage): void {
    this.send({ type: 'relay', data });
  }

  close(): void {
    const ws = this.ws;
    this.ws = null;
    clearInterval(this.pingTimer);
    ws?.close();
  }
}
