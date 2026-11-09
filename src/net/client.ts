import type { ClientMessage, PeerMessage, RtcSignal, ServerMessage } from './protocol';

const URL_KEY = 'toon-clash:servidor';
/** STUN público: descobre o endereço externo de cada jogador para a conexão direta. */
const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

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
          if (msg.data.type === 'rtc') this.onSignal(msg.data);
          else this.onPeer(msg.data);
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
    // Pelo canal direto só vai o que pode se perder: inputs se repetem, somas são só conferência.
    if (this.direct && (data.type === 'input' || data.type === 'checksum'))
      this.channel!.send(JSON.stringify(data));
    else this.send({ type: 'relay', data });
  }

  /** true quando inputs vão direto ao outro jogador (WebRTC), sem passar pelo servidor. */
  get direct(): boolean {
    return this.channel?.readyState === 'open';
  }

  /**
   * Anfitrião: tenta abrir um canal WebRTC direto com o outro jogador, usando o servidor como
   * sinalização. Se não conectar (rede bloqueada, navegador sem WebRTC), segue pelo WebSocket.
   */
  startDirect(): void {
    const pc = this.peerConnection();
    if (!pc) return;
    this.useChannel(pc.createDataChannel('inputs', { ordered: false, maxRetransmits: 0 }));
    this.signal(async () => {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.sendPeer({ type: 'rtc', description: { type: offer.type, sdp: offer.sdp } });
    });
  }

  close(): void {
    const ws = this.ws;
    this.ws = null;
    clearInterval(this.pingTimer);
    ws?.close();
    this.channel?.close();
    this.pc?.close();
    this.channel = null;
    this.pc = null;
  }

  private pc: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private signals: Promise<void> = Promise.resolve();

  private peerConnection(): RTCPeerConnection | null {
    if (this.pc) return this.pc;
    if (typeof RTCPeerConnection === 'undefined') return null;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = (e) => {
      if (e.candidate) this.sendPeer({ type: 'rtc', candidate: e.candidate.toJSON() });
    };
    pc.ondatachannel = (e) => this.useChannel(e.channel);
    this.pc = pc;
    return pc;
  }

  private useChannel(channel: RTCDataChannel): void {
    this.channel = channel;
    channel.onmessage = (event) => {
      try {
        this.onPeer(JSON.parse(String(event.data)) as PeerMessage);
      } catch {
        // Pacote corrompido: o próximo repete os mesmos inputs.
      }
    };
  }

  /** Convidado responde à oferta; os dois lados trocam candidatos ICE. */
  private onSignal(msg: RtcSignal): void {
    const pc = this.peerConnection();
    if (!pc) return;
    this.signal(async () => {
      if (msg.description) {
        await pc.setRemoteDescription(msg.description);
        if (msg.description.type !== 'offer') return;
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.sendPeer({ type: 'rtc', description: { type: answer.type, sdp: answer.sdp } });
      } else if (msg.candidate) {
        await pc.addIceCandidate(msg.candidate);
      }
    });
  }

  /** Roda os passos da negociação em ordem; se um falhar, só a conexão direta desiste. */
  private signal(step: () => Promise<void>): void {
    this.signals = this.signals.then(step).catch(() => {});
  }
}
