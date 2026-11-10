import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FrameStats,
  PERF_KEY,
  SLOW_FRAME_MS,
  formatPerf,
  loadShowPerf,
  saveShowPerf,
} from './perf-meter';

/** Alimenta `count` quadros de `frameMs` a partir de `start`; devolve o tempo final. */
function feed(stats: FrameStats, start: number, count: number, frameMs: number): number {
  let now = start;
  for (let i = 0; i < count; i++) {
    now += frameMs;
    stats.add(now, frameMs);
  }
  return now;
}

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe('FrameStats', () => {
  it('sem amostras, tudo zerado', () => {
    expect(new FrameStats().summary()).toEqual({ fps: 0, worstMs: 0, slowPercent: 0, frames: 0 });
  });

  it('FPS estável de 60 quadros por segundo', () => {
    const stats = new FrameStats();
    const now = feed(stats, 0, 120, 1000 / 60);
    const s = stats.summary(now);
    expect(s.fps).toBeCloseTo(60, 5);
    expect(s.worstMs).toBeCloseTo(1000 / 60, 5);
    expect(s.slowPercent).toBe(0);
    // A janela de 1 s guarda só o último segundo.
    expect(s.frames).toBeGreaterThanOrEqual(59);
    expect(s.frames).toBeLessThanOrEqual(60);
  });

  it('conta quadros lentos e o pior quadro', () => {
    const stats = new FrameStats();
    let now = feed(stats, 0, 45, 16);
    now = feed(stats, now, 4, 25);
    now = feed(stats, now, 1, 40);
    const s = stats.summary(now);
    expect(s.frames).toBe(50);
    expect(s.worstMs).toBe(40);
    expect(s.slowPercent).toBe(10);
    expect(s.fps).toBeCloseTo((50 * 1000) / (45 * 16 + 4 * 25 + 40), 5);
  });

  it('quadro de exatamente 20 ms não conta como lento', () => {
    const stats = new FrameStats();
    const now = feed(stats, 0, 10, SLOW_FRAME_MS);
    expect(stats.summary(now).slowPercent).toBe(0);
  });

  it('janela deslizante esquece quadros com mais de 1 s', () => {
    const stats = new FrameStats();
    // Meio segundo travado a 50 ms por quadro...
    let now = feed(stats, 0, 10, 50);
    expect(stats.summary(now).worstMs).toBe(50);
    // ...e depois 1,2 s liso: o engasgo sai da janela.
    now = feed(stats, now, 120, 10);
    const s = stats.summary(now);
    expect(s.worstMs).toBe(10);
    expect(s.slowPercent).toBe(0);
    expect(s.fps).toBeCloseTo(100, 5);
    expect(s.frames).toBe(100);
  });

  it('summary(now) descarta amostras antigas mesmo sem quadros novos', () => {
    const stats = new FrameStats();
    const now = feed(stats, 0, 30, 16);
    expect(stats.summary(now + 2000).frames).toBe(0);
    expect(stats.summary().fps).toBe(0);
  });

  it('buffer cheio descarta a amostra mais antiga', () => {
    const stats = new FrameStats(1000, 8);
    let now = feed(stats, 0, 8, 30);
    now = feed(stats, now, 8, 10);
    const s = stats.summary(now);
    expect(s.frames).toBe(8);
    expect(s.worstMs).toBe(10);
  });

  it('ignora tempos negativos ou inválidos', () => {
    const stats = new FrameStats();
    stats.add(10, -5);
    stats.add(20, Number.NaN);
    expect(stats.size).toBe(0);
  });

  it('clear zera a janela', () => {
    const stats = new FrameStats();
    feed(stats, 0, 10, 16);
    stats.clear();
    expect(stats.summary().frames).toBe(0);
  });
});

describe('formatPerf', () => {
  const summary = { fps: 59.6, worstMs: 18.4, slowPercent: 2.2, frames: 60 };

  it('mostra FPS, pior quadro e lentos', () => {
    expect(formatPerf(summary)).toBe('FPS 60 · pior 18 ms · lentos 2%');
  });

  it('acrescenta o ping quando houver', () => {
    expect(formatPerf(summary, 45.3)).toBe('FPS 60 · pior 18 ms · lentos 2%\nping 45 ms');
  });

  it('ping zero (ainda não medido) não aparece', () => {
    expect(formatPerf(summary, 0)).toBe('FPS 60 · pior 18 ms · lentos 2%');
  });

  it('sem quadros na janela mostra "medindo" em vez de FPS 0', () => {
    const empty = { fps: 0, worstMs: 0, slowPercent: 0, frames: 0 };
    expect(formatPerf(empty)).toBe('FPS — · medindo…');
    expect(formatPerf(empty, 30)).toBe('FPS — · medindo…\nping 30 ms');
  });
});

describe('preferência de desempenho', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('padrão é não mostrar', () => {
    expect(loadShowPerf()).toBe(false);
  });

  it('salva e lê de volta', () => {
    saveShowPerf(true);
    expect(localStorage.getItem(PERF_KEY)).toBe('sim');
    expect(loadShowPerf()).toBe(true);
    saveShowPerf(false);
    expect(localStorage.getItem(PERF_KEY)).toBe('nao');
    expect(loadShowPerf()).toBe(false);
  });

  it('valor inválido volta ao padrão', () => {
    vi.stubGlobal('localStorage', memoryStorage({ [PERF_KEY]: 'talvez' }));
    expect(loadShowPerf()).toBe(false);
  });

  it('armazenamento bloqueado não quebra', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    });
    expect(loadShowPerf()).toBe(false);
    expect(() => saveShowPerf(true)).not.toThrow();
  });
});
