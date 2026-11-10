import type { App, OnlineHooks, Screen } from '../app';
import { STAGES } from '../render/stages';
import type { CharacterId } from '../combat/types';
import { mergeInputs } from '../core/input';
import type { MatchState } from '../game/match';
import type { MenuItem } from '../ui/menu';
import { NetClient, defaultServerUrl, rememberServerUrl } from './client';
import type { InputPacket, PeerMessage } from './protocol';
import { RollbackSession } from './rollback';

/** Ticks sem conseguir avançar antes de mostrar o aviso de conexão. */
const STALL_WARNING = 20;

/** Registra o modo online no menu principal. */
export function registerOnline(app: App): void {
  app.onlineScreen = (a) => lobbyScreen(a);
}

function panel(inner: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'screen';
  el.innerHTML = `<div class="panel online">${inner}</div>`;
  return el;
}

function messageScreen(app: App, title: string, text: string): Screen {
  const el = panel(`<h2>${title}</h2><p>${text}</p><p class="blink">ENTER para voltar</p>`);
  const back = () => app.show(app.mainMenu());
  el.addEventListener('click', back);
  return {
    el,
    handle: (e) =>
      (e.action === 'confirm' || e.action === 'pause' || e.action === 'back') && back(),
  };
}

function lobbyScreen(app: App): Screen {
  const el = panel(`
    <h2>Online</h2>
    <p>Crie uma sala e mande o código para um amigo, ou entre na sala dele.</p>
    <label class="field">Servidor<input class="server" spellcheck="false" /></label>
    <div class="row"><button class="btn create">Criar sala</button></div>
    <div class="row"><input class="code" maxlength="4" placeholder="CÓDIGO" spellcheck="false" />
      <button class="btn join">Entrar</button></div>
    <p class="status"></p>
    <button class="btn back">Voltar</button>`);
  const server = el.querySelector<HTMLInputElement>('.server')!;
  const code = el.querySelector<HTMLInputElement>('.code')!;
  const status = el.querySelector<HTMLElement>('.status')!;
  server.value = defaultServerUrl();

  const client = new NetClient();
  let busy = false;
  const setStatus = (text: string, error = false) => {
    status.textContent = text;
    status.classList.toggle('error', error);
  };
  const leave = () => {
    client.close();
    app.show(app.mainMenu());
  };

  client.onServer = (msg) => {
    switch (msg.type) {
      case 'created':
        setStatus(`Sala ${msg.room} criada! Passe o código para seu amigo. Esperando…`);
        el.querySelector('.room-code')?.remove();
        status.insertAdjacentHTML('afterend', `<div class="room-code">${msg.room}</div>`);
        break;
      case 'peer-joined':
        client.startDirect();
        startSelection(app, client, 0);
        break;
      case 'joined':
        startSelection(app, client, msg.side);
        break;
      case 'error':
        busy = false;
        setStatus(msg.message, true);
        break;
    }
  };
  client.onClose = () => {
    busy = false;
    setStatus('Conexão com o servidor perdida.', true);
  };

  const connectAnd = async (then: () => void) => {
    if (busy) return;
    busy = true;
    const url = server.value.trim();
    setStatus('Conectando…');
    const slow = setTimeout(
      () => setStatus('Acordando o servidor… isso pode levar até 1 minuto na primeira vez.'),
      4000,
    );
    try {
      await client.connect(url);
      rememberServerUrl(url);
      then();
    } catch (error) {
      busy = false;
      setStatus(
        `${(error as Error).message} Confira o endereço e se o servidor está rodando (npm run server).`,
        true,
      );
    } finally {
      clearTimeout(slow);
    }
  };
  const create = () => void connectAnd(() => client.send({ type: 'create' }));
  const join = () => {
    const room = code.value.trim().toUpperCase();
    if (room.length !== 4) return setStatus('O código tem 4 letras.', true);
    void connectAnd(() => client.send({ type: 'join', room }));
  };

  el.querySelector('.create')!.addEventListener('click', create);
  el.querySelector('.join')!.addEventListener('click', join);
  el.querySelector('.back')!.addEventListener('click', leave);
  code.addEventListener('keydown', (e) => e.key === 'Enter' && join());

  return {
    el,
    handle: (e) => {
      if (e.action === 'pause' || e.action === 'back') leave();
    },
  };
}

/** Cada jogador escolhe o próprio lutador; o anfitrião (lado 0) sorteia o cenário e começa. */
function startSelection(app: App, client: NetClient, side: 0 | 1): void {
  let mine: CharacterId | null = null;
  let theirs: CharacterId | null = null;
  let match: OnlineMatch | null = null;

  const maybeStart = () => {
    if (side !== 0 || !mine || !theirs || match) return;
    const stage = STAGES[Math.floor(Math.random() * STAGES.length)]!.id;
    const characters: [CharacterId, CharacterId] = [mine, theirs];
    client.sendPeer({ type: 'start', characters, stage });
    match = new OnlineMatch(app, client, side);
    app.startOnline(characters, stage, match);
  };

  client.onPeer = (msg) => {
    if (msg.type === 'hello') {
      theirs = msg.character;
      maybeStart();
    } else if (msg.type === 'start' && !match) {
      match = new OnlineMatch(app, client, side);
      app.startOnline(msg.characters, msg.stage, match);
    } else {
      match?.receive(msg);
    }
  };
  /** Fecha a conexão sem deixar callbacks antigos trocando a tela depois. */
  const disconnect = () => {
    client.onServer = () => {};
    client.onPeer = () => {};
    client.onClose = () => {};
    client.close();
    match?.dispose();
    app.online = null;
  };
  const gone = (text: string) => {
    disconnect();
    app.show(messageScreen(app, 'Fim da conexão', text));
  };
  const cancel = () => {
    disconnect();
    app.show(app.mainMenu());
  };
  client.onServer = (msg) => {
    if (msg.type === 'peer-left') gone('O outro jogador saiu.');
  };
  client.onClose = () => gone('A conexão com o servidor caiu.');

  app.show(
    app.selectScreen(
      'online',
      'medio',
      (chars) => {
        mine = chars[0];
        client.sendPeer({ type: 'hello', character: mine });
        const wait = panel(
          '<h2>Pronto!</h2><p class="blink">Esperando o outro jogador escolher…</p>',
        );
        app.show({
          el: wait,
          handle: (e) => (e.action === 'pause' || e.action === 'back') && cancel(),
        });
        maybeStart();
      },
      cancel,
    ),
  );
}

/** Uma partida online: liga o rollback aos inputs locais e à rede. */
class OnlineMatch implements OnlineHooks {
  readonly labels: [string, string];
  private session: RollbackSession | null = null;
  private game = 0;
  private pending: InputPacket[] = [];
  private stalled = 0;
  private wantRematch = false;
  private theyWantRematch = false;
  private readonly badge = document.createElement('div');

  constructor(
    private readonly app: App,
    private readonly client: NetClient,
    private readonly side: 0 | 1,
  ) {
    this.labels = side === 0 ? ['VOCÊ', 'AMIGO'] : ['AMIGO', 'VOCÊ'];
    this.badge.className = 'net-badge';
    app.hud.el.appendChild(this.badge);
  }

  start(initial: MatchState): void {
    this.game++;
    this.wantRematch = false;
    this.theyWantRematch = false;
    this.session = new RollbackSession(initial, this.side);
    this.session.onDesync = (frame) =>
      console.warn(`Toon Clash: dessincronização no frame ${frame}`);
    for (const p of this.pending.filter((p) => p.game === this.game)) this.session.receive(p);
    this.pending = [];
  }

  receive(msg: PeerMessage): void {
    switch (msg.type) {
      case 'input':
        if (this.session && msg.game === this.game) this.session.receive(msg);
        else if ((msg.game ?? 0) > this.game) this.pending.push(msg);
        break;
      case 'checksum':
        if (msg.game === this.game) this.session?.compareChecksum(msg.frame, msg.value);
        break;
      case 'rematch':
        this.theyWantRematch = true;
        this.maybeRematch();
        break;
    }
  }

  tick(): void {
    const session = this.session;
    if (!session) return;
    const input = mergeInputs(this.app.controls.read(0), this.app.controls.read(1));
    this.client.sendPeer({ ...session.pushLocal(input), game: this.game });
    const result = session.advance();
    if (!result) {
      this.stalled++;
    } else {
      this.stalled = 0;
      this.app.present(result.match, result.events);
    }
    for (const { frame, value } of session.takeChecksums()) {
      this.client.sendPeer({ type: 'checksum', game: this.game, frame, value });
    }
    const ping = this.ping();
    const route = this.client.direct ? ' · direto' : '';
    this.badge.textContent =
      this.stalled > STALL_WARNING
        ? 'Aguardando o outro jogador…'
        : ping
          ? `ping ${ping} ms${route}`
          : '';
    this.badge.classList.toggle('warn', this.stalled > STALL_WARNING);
  }

  resultItems(): MenuItem[] {
    return [
      {
        label: () => (this.wantRematch ? 'Esperando o amigo…' : 'Revanche'),
        action: () => {
          if (this.wantRematch) return;
          this.wantRematch = true;
          this.client.sendPeer({ type: 'rematch' });
          this.maybeRematch();
        },
      },
      {
        label: 'Sair',
        action: () => {
          this.client.close();
          this.dispose();
          this.app.online = null;
          this.app.show(this.app.mainMenu());
        },
      },
    ];
  }

  ping(): number {
    return Math.round(this.client.ping);
  }

  dispose(): void {
    this.badge.remove();
  }

  private maybeRematch(): void {
    if (this.wantRematch && this.theyWantRematch) this.app.beginFight();
  }
}
