/**
 * Contador de desempenho opcional (FPS, pior quadro, quadros lentos e ping).
 * Só mede o desenho; não participa das regras do jogo.
 */

export const PERF_KEY = 'toon-clash:desempenho';
/** Janela de medição: o último segundo. */
export const PERF_WINDOW_MS = 1000;
/** Quadro acima disto conta como lento (abaixo de 50 FPS). */
export const SLOW_FRAME_MS = 20;
/** Intervalo mínimo entre atualizações do texto (no máximo 4 vezes por segundo). */
export const PERF_REFRESH_MS = 250;

export interface PerfSummary {
  /** FPS médio da janela. */
  fps: number;
  /** Maior tempo de quadro da janela, em ms. */
  worstMs: number;
  /** Porcentagem (0..100) de quadros acima de SLOW_FRAME_MS. */
  slowPercent: number;
  /** Quantidade de quadros na janela. */
  frames: number;
}

/**
 * Amostras de tempo de quadro numa janela deslizante, guardadas num buffer circular
 * de tamanho fixo (não aloca memória por quadro). O tempo sempre entra como parâmetro.
 */
export class FrameStats {
  private readonly ends: Float64Array;
  private readonly durations: Float64Array;
  /** Índice da amostra mais antiga. */
  private start = 0;
  private count = 0;

  constructor(
    readonly windowMs = PERF_WINDOW_MS,
    readonly capacity = 512,
  ) {
    this.ends = new Float64Array(capacity);
    this.durations = new Float64Array(capacity);
  }

  get size(): number {
    return this.count;
  }

  /** Registra um quadro que terminou em `now` (ms) e levou `frameMs` (ms). */
  add(now: number, frameMs: number): void {
    if (!(frameMs >= 0)) return; // Descarta negativo e NaN.
    if (this.count === this.capacity) {
      // Buffer cheio: a amostra mais antiga dá lugar à nova.
      this.start = (this.start + 1) % this.capacity;
      this.count--;
    }
    const index = (this.start + this.count) % this.capacity;
    this.ends[index] = now;
    this.durations[index] = frameMs;
    this.count++;
    this.prune(now);
  }

  /** Remove as amostras que terminaram antes da janela que acaba em `now`. */
  prune(now: number): void {
    const limit = now - this.windowMs;
    while (this.count > 0 && this.ends[this.start]! <= limit) {
      this.start = (this.start + 1) % this.capacity;
      this.count--;
    }
  }

  clear(): void {
    this.start = 0;
    this.count = 0;
  }

  /** Resumo da janela; se `now` vier, descarta antes as amostras que já saíram dela. */
  summary(now?: number): PerfSummary {
    if (now !== undefined) this.prune(now);
    let total = 0;
    let worst = 0;
    let slow = 0;
    for (let i = 0; i < this.count; i++) {
      const ms = this.durations[(this.start + i) % this.capacity]!;
      total += ms;
      if (ms > worst) worst = ms;
      if (ms > SLOW_FRAME_MS) slow++;
    }
    return {
      fps: total > 0 ? (this.count * 1000) / total : 0,
      worstMs: worst,
      slowPercent: this.count > 0 ? (slow * 100) / this.count : 0,
      frames: this.count,
    };
  }
}

/** Texto do painel. O ping só aparece quando já foi medido (maior que zero). */
export function formatPerf(summary: PerfSummary, ping?: number): string {
  // Sem quadros na janela (início ou aba que estava em segundo plano): "—" em vez de um 0 enganoso.
  const line =
    summary.frames === 0
      ? 'FPS — · medindo…'
      : `FPS ${Math.round(summary.fps)} · pior ${Math.round(summary.worstMs)} ms` +
        ` · lentos ${Math.round(summary.slowPercent)}%`;
  return ping !== undefined && ping > 0 ? `${line}\nping ${Math.round(ping)} ms` : line;
}

/** Lê a preferência salva; padrão é não mostrar. */
export function loadShowPerf(): boolean {
  try {
    return globalThis.localStorage?.getItem(PERF_KEY) === 'sim';
  } catch {
    return false;
  }
}

export function saveShowPerf(show: boolean): void {
  try {
    globalThis.localStorage?.setItem(PERF_KEY, show ? 'sim' : 'nao');
  } catch {
    /* Armazenamento bloqueado não deve interromper o jogo. */
  }
}

/** Painel fixo no canto superior direito. Recebe um `frame(now)` por quadro desenhado. */
export class PerfMeter {
  readonly el: HTMLDivElement;
  private readonly stats = new FrameStats();
  private visible: boolean;
  private last = -1;
  private lastPaint = -Infinity;
  private text = '';
  /** Linha extra: placa de vídeo em uso e qualidade gráfica (ajuda a achar lentidão). */
  device = '';

  constructor(parent: HTMLElement, visible = loadShowPerf()) {
    this.visible = visible;
    this.el = document.createElement('div');
    this.el.className = 'perf-meter';
    this.el.setAttribute('aria-hidden', 'true');
    // Centro da parte de baixo: no topo, cobria o nome do jogador 2 (issue #17); nos cantos de
    // baixo ficam os controles de toque do celular.
    Object.assign(this.el.style, {
      position: 'fixed',
      bottom: 'max(4px, env(safe-area-inset-bottom))',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: '50',
      padding: '2px 6px',
      borderRadius: '4px',
      background: 'rgba(0, 0, 0, 0.55)',
      color: '#fff',
      font: '11px/1.35 ui-monospace, Menlo, Consolas, monospace',
      whiteSpace: 'pre',
      textAlign: 'center',
      pointerEvents: 'none',
      display: visible ? 'block' : 'none',
    });
    parent.appendChild(this.el);
  }

  get shown(): boolean {
    return this.visible;
  }

  /** Liga ou desliga na hora e salva a escolha no navegador. */
  setVisible(visible: boolean): void {
    this.visible = visible;
    saveShowPerf(visible);
    this.el.style.display = visible ? 'block' : 'none';
    // Recomeça a medição para não contar o tempo em que ficou desligado.
    this.stats.clear();
    this.last = -1;
    this.lastPaint = -Infinity;
    this.text = '';
    this.el.textContent = '';
  }

  /** Chamado uma vez por quadro desenhado. `ping` em ms, só no modo online. */
  frame(now: number, ping?: number): void {
    if (!this.visible) return;
    const frameMs = this.last < 0 ? -1 : now - this.last;
    this.last = now;
    // Intervalo maior que a janela inteira: a aba estava em segundo plano, recomeça.
    if (frameMs > this.stats.windowMs) this.stats.clear();
    else if (frameMs >= 0) this.stats.add(now, frameMs);
    if (now - this.lastPaint < PERF_REFRESH_MS) return;
    this.lastPaint = now;
    const perf = formatPerf(this.stats.summary(now), ping);
    const text = this.device ? `${perf}\n${this.device}` : perf;
    if (text !== this.text) {
      this.text = text;
      this.el.textContent = text;
    }
  }
}
