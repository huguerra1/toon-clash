/**
 * Qualidade gráfica adaptativa pura (sem DOM e sem Three.js).
 * Reaproveita o FrameStats para medir o FPS médio numa janela deslizante e
 * alterna entre 'alto' e 'baixo' com histerese para evitar oscilações.
 */

import { FrameStats, PERF_WINDOW_MS } from '../ui/perf-meter';
import { type QualityLevel, defaultQualityLevel } from './quality';

/** Primeiros 2 s ignorados para descontar o carregamento inicial. */
export const WARMUP_MS = 2000;
/** Acima disto o intervalo conta como pausa longa (aba em segundo plano), não quadro lento. */
export const PAUSE_FRAME_MS = PERF_WINDOW_MS;
/** FPS médio abaixo do qual a qualidade cai para 'baixo'. */
export const LOW_FPS_THRESHOLD = 50;
/** FPS médio mínimo para voltar a 'alto' (histerese). */
export const HIGH_FPS_THRESHOLD = 58;
/** Tempo sustentado abaixo de LOW_FPS_THRESHOLD antes de reduzir para 'baixo'. */
export const DOWNGRADE_HOLD_MS = 3000;
/** Tempo sustentado acima de HIGH_FPS_THRESHOLD antes de subir para 'alto'. */
export const UPGRADE_HOLD_MS = 10000;
/** Uma queda até este tempo depois de subir conta como subida que falhou. */
export const FAILED_UPGRADE_WINDOW_MS = 15000;
/**
 * Depois de tantas subidas que falharam, fica em 'baixo' até o próximo reset. Cada falha também
 * dobra a espera da tentativa seguinte. Sem isso, um aparelho que roda a 45 FPS em 'alto' e a
 * 60 FPS em 'baixo' alternaria para sempre: rodar bem em 'baixo' não prova que aguenta 'alto'.
 */
export const MAX_FAILED_UPGRADES = 2;

const EPSILON = 1e-6;

export interface AdaptiveQualityOptions {
  warmupMs?: number;
  pauseFrameMs?: number;
  lowFps?: number;
  highFps?: number;
  downgradeMs?: number;
  upgradeMs?: number;
  windowMs?: number;
}

export class AdaptiveQuality {
  level: QualityLevel;
  private readonly warmupMs: number;
  private readonly pauseFrameMs: number;
  private readonly lowFps: number;
  private readonly highFps: number;
  private readonly downgradeMs: number;
  private readonly upgradeMs: number;
  private readonly stats: FrameStats;
  private elapsedMs = 0;
  private belowMs = 0;
  private aboveMs = 0;
  private lastNow = -1;
  private failedUpgrades = 0;
  private upgradedAtMs = Number.NEGATIVE_INFINITY;

  constructor(
    initialLevel: QualityLevel = defaultQualityLevel(),
    options: AdaptiveQualityOptions = {},
  ) {
    this.level = initialLevel;
    this.warmupMs = options.warmupMs ?? WARMUP_MS;
    this.pauseFrameMs = options.pauseFrameMs ?? PAUSE_FRAME_MS;
    this.lowFps = options.lowFps ?? LOW_FPS_THRESHOLD;
    this.highFps = options.highFps ?? HIGH_FPS_THRESHOLD;
    this.downgradeMs = options.downgradeMs ?? DOWNGRADE_HOLD_MS;
    this.upgradeMs = options.upgradeMs ?? UPGRADE_HOLD_MS;
    this.stats = new FrameStats(options.windowMs ?? PERF_WINDOW_MS);
  }

  /** Reinicia a medição a partir do nível informado. */
  reset(level: QualityLevel = defaultQualityLevel()): void {
    this.level = level;
    this.stats.clear();
    this.elapsedMs = 0;
    this.belowMs = 0;
    this.aboveMs = 0;
    this.lastNow = -1;
    this.failedUpgrades = 0;
    this.upgradedAtMs = Number.NEGATIVE_INFINITY;
  }

  /** Espera exigida para a próxima subida: dobra a cada subida que falhou. */
  get upgradeHoldMs(): number {
    return this.upgradeMs * 2 ** this.failedUpgrades;
  }

  /** O automático desistiu de voltar para 'alto' (até o próximo reset). */
  get gaveUpUpgrading(): boolean {
    return this.failedUpgrades >= MAX_FAILED_UPGRADES;
  }

  /**
   * Registra um quadro encerrado em `now` (ms), calculando `frameMs` a partir do quadro anterior.
   * Devolve o nível efetivo atual ('alto' ou 'baixo').
   */
  frame(now: number): QualityLevel {
    const frameMs = this.lastNow < 0 ? -1 : now - this.lastNow;
    this.lastNow = now;
    if (frameMs <= 0) return this.level;
    return this.add(now, frameMs);
  }

  /**
   * Registra uma amostra `(now, frameMs)` em ms e devolve o nível efetivo ('alto' ou 'baixo').
   */
  add(now: number, frameMs: number): QualityLevel {
    if (!(frameMs > 0) || !Number.isFinite(frameMs) || !Number.isFinite(now)) {
      return this.level;
    }

    // Pausa longa (ex.: aba em segundo plano): descarta a janela e não conta como lentidão.
    if (frameMs > this.pauseFrameMs) {
      this.stats.clear();
      this.belowMs = 0;
      this.aboveMs = 0;
      return this.level;
    }

    this.elapsedMs += frameMs;
    if (this.elapsedMs <= this.warmupMs + EPSILON) {
      return this.level;
    }

    this.stats.add(now, frameMs);
    // A decisão usa o FPS MÉDIO da janela e conta o tempo real decorrido enquanto a condição
    // vale (não só os quadros individualmente lentos ou rápidos).
    const windowFps = this.stats.summary(now).fps;

    if (this.level === 'alto') {
      if (windowFps < this.lowFps) {
        this.belowMs += frameMs;
        if (this.belowMs + EPSILON >= this.downgradeMs) {
          if (this.elapsedMs - this.upgradedAtMs <= FAILED_UPGRADE_WINDOW_MS) this.failedUpgrades++;
          this.switchTo('baixo');
        }
      } else {
        this.belowMs = 0;
      }
    } else if (!this.gaveUpUpgrading) {
      if (windowFps + EPSILON >= this.highFps) {
        this.aboveMs += frameMs;
        if (this.aboveMs + EPSILON >= this.upgradeHoldMs) {
          this.upgradedAtMs = this.elapsedMs;
          this.switchTo('alto');
        }
      } else {
        this.aboveMs = 0;
      }
    }

    return this.level;
  }

  private switchTo(level: QualityLevel): void {
    this.level = level;
    this.belowMs = 0;
    this.aboveMs = 0;
    // O desempenho do nível anterior não vale para o novo: a janela recomeça.
    this.stats.clear();
  }
}
