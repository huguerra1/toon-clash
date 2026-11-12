/**
 * Anúncios dos portais de jogos (Poki, CrazyGames, GameDistribution…).
 *
 * O jogo só conversa com a interface `AdProvider`. Cada portal tem a própria SDK, carregada
 * pela página dele; quando um portal for integrado, basta criar uma implementação nova aqui e
 * escolhê-la por `VITE_ADS` no build. Hoje só existe `NoAdsProvider` (nenhum anúncio), que é a
 * usada no GitHub Pages e no Itch.io. Nenhuma SDK real nem chave fica neste repositório.
 *
 * Regras de onde aparece anúncio (exigidas pelos portais e boas para o jogador):
 * - nunca no meio de um round, só entre lutas (`commercialBreak`);
 * - nunca no online (o outro jogador ficaria esperando);
 * - enquanto o anúncio passa, o jogo para o loop e o som (`PauseTarget`).
 */

export interface AdProvider {
  /** Nome curto, para log e para o contador de desempenho. */
  readonly name: string;
  /** Carrega a SDK do portal. Falha não pode travar o jogo. */
  init(): Promise<void>;
  /** O jogador entrou num trecho jogável (luta). */
  gameplayStart(): void;
  /** O jogador saiu do trecho jogável (menu, pausa, fim da luta). */
  gameplayStop(): void;
  /** Intervalo comercial. Resolve quando o jogo pode continuar (com ou sem anúncio). */
  commercialBreak(): Promise<void>;
  /** Anúncio premiado. Resolve `true` se o jogador ganhou a recompensa. */
  rewardedBreak(): Promise<boolean>;
}

/** Sem anúncio nenhum: tudo resolve na hora e a recompensa sempre é dada. */
export class NoAdsProvider implements AdProvider {
  readonly name = 'nenhum';
  init(): Promise<void> {
    return Promise.resolve();
  }
  gameplayStart(): void {}
  gameplayStop(): void {}
  commercialBreak(): Promise<void> {
    return Promise.resolve();
  }
  rewardedBreak(): Promise<boolean> {
    return Promise.resolve(true);
  }
}

/** O que o anúncio precisa parar enquanto passa: loop do jogo e som. */
export interface PauseTarget {
  pause(): void;
  resume(): void;
}

export interface AdsOptions {
  /** Tempo mínimo entre dois intervalos comerciais, em ms (os portais pedem algo como 2–3 min). */
  minBreakIntervalMs?: number;
  /** Relógio em ms; injetado nos testes. */
  now?: () => number;
}

/** Intervalo padrão entre anúncios: 3 minutos. */
export const DEFAULT_BREAK_INTERVAL_MS = 3 * 60 * 1000;

/**
 * Fica entre o jogo e o `AdProvider`: evita chamadas repetidas de gameplayStart/Stop, respeita
 * o intervalo mínimo entre anúncios, não deixa dois anúncios ao mesmo tempo e pausa o jogo
 * durante o anúncio — mesmo que a SDK falhe.
 */
export class Ads {
  private playing = false;
  private busy = false;
  private lastBreak = -Infinity;
  private readonly minInterval: number;
  private readonly now: () => number;

  constructor(
    readonly provider: AdProvider,
    private readonly target: PauseTarget,
    options: AdsOptions = {},
  ) {
    this.minInterval = options.minBreakIntervalMs ?? DEFAULT_BREAK_INTERVAL_MS;
    this.now = options.now ?? (() => performance.now());
  }

  /** Anúncio passando agora. */
  get showing(): boolean {
    return this.busy;
  }

  async init(): Promise<void> {
    try {
      await this.provider.init();
    } catch {
      // SDK bloqueada (ad blocker, rede): o jogo segue sem anúncio.
    }
  }

  gameplayStart(): void {
    if (this.playing) return;
    this.playing = true;
    this.safely(() => this.provider.gameplayStart());
  }

  gameplayStop(): void {
    if (!this.playing) return;
    this.playing = false;
    this.safely(() => this.provider.gameplayStop());
  }

  /**
   * Intervalo comercial entre lutas. Resolve `true` se o provedor foi chamado e `false` se foi
   * pulado (outro anúncio passando ou cedo demais desde o último).
   */
  async commercialBreak(): Promise<boolean> {
    if (this.busy || this.now() - this.lastBreak < this.minInterval) return false;
    await this.run(() => this.provider.commercialBreak());
    this.lastBreak = this.now();
    return true;
  }

  /** Anúncio premiado (ex.: continuar no Arcade). Não conta para o intervalo comercial. */
  async rewardedBreak(): Promise<boolean> {
    if (this.busy) return false;
    let rewarded = false;
    await this.run(async () => {
      rewarded = await this.provider.rewardedBreak();
    });
    return rewarded;
  }

  private async run(show: () => Promise<void>): Promise<void> {
    this.busy = true;
    this.gameplayStop();
    this.target.pause();
    try {
      await show();
    } catch {
      // Anúncio que falha não pode deixar o jogo parado.
    } finally {
      this.busy = false;
      this.target.resume();
    }
  }

  private safely(call: () => void): void {
    try {
      call();
    } catch {
      // Idem: erro da SDK não derruba o jogo.
    }
  }
}

/** Escolhe o provedor pelo nome configurado no build (`VITE_ADS`). Desconhecido = nenhum. */
export function createAdProvider(name: string | undefined): AdProvider {
  switch ((name ?? '').trim().toLowerCase()) {
    // Portais entram aqui quando forem integrados, ex.: case 'poki': return new PokiProvider();
    default:
      return new NoAdsProvider();
  }
}
