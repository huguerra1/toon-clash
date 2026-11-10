import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AdaptiveQuality,
  DOWNGRADE_HOLD_MS,
  PAUSE_FRAME_MS,
  UPGRADE_HOLD_MS,
  WARMUP_MS,
} from './adaptive-quality';

/** Alimenta `seconds` segundos de quadros na taxa `fps` a partir de `start`; devolve o tempo final. */
function feedSeconds(aq: AdaptiveQuality, start: number, seconds: number, fps: number): number {
  const frameMs = 1000 / fps;
  const frames = Math.round((seconds * 1000) / frameMs);
  let now = start;
  for (let i = 0; i < frames; i++) {
    now += frameMs;
    aq.add(now, frameMs);
  }
  return now;
}

afterEach(() => vi.unstubAllGlobals());

describe('AdaptiveQuality', () => {
  it('começa em alto por padrão e em baixo em aparelhos de toque', () => {
    vi.stubGlobal('window', undefined);
    expect(new AdaptiveQuality().level).toBe('alto');

    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
    expect(new AdaptiveQuality().level).toBe('baixo');
  });

  it('estável em 60 FPS permanece em alto', () => {
    const aq = new AdaptiveQuality('alto');
    feedSeconds(aq, 0, 15, 60);
    expect(aq.level).toBe('alto');
  });

  it('ignora os primeiros 2 segundos de carregamento mesmo com FPS baixo', () => {
    const aq = new AdaptiveQuality('alto');
    // 2 s de carregamento travado a 25 FPS + 2,5 s a 40 FPS (< 3 s pós-aquecimento).
    let now = feedSeconds(aq, 0, WARMUP_MS / 1000, 25);
    expect(aq.level).toBe('alto');
    now = feedSeconds(aq, now, 2.5, 40);
    expect(aq.level).toBe('alto');
    // Mais 0,5 s a 40 FPS completa os 3 s pós-aquecimento e derruba para baixo.
    feedSeconds(aq, now, 0.5, 40);
    expect(aq.level).toBe('baixo');
  });

  it('queda sustentada abaixo de 50 FPS por 3 segundos desce para baixo', () => {
    const aq = new AdaptiveQuality('alto');
    const now = feedSeconds(aq, 0, 3, 60);
    expect(aq.level).toBe('alto');

    // + 1 s: tempo para a média da janela (1 s) cair abaixo do limite.
    feedSeconds(aq, now, DOWNGRADE_HOLD_MS / 1000 + 1, 35);
    expect(aq.level).toBe('baixo');
  });

  it('queda curta abaixo de 50 FPS não desce para baixo', () => {
    const aq = new AdaptiveQuality('alto');
    let now = feedSeconds(aq, 0, 3, 60);
    // Queda de 2 s (< 3 s) seguida de recuperação para 60 FPS.
    now = feedSeconds(aq, now, 2, 35);
    expect(aq.level).toBe('alto');

    now = feedSeconds(aq, now, 2, 60);
    expect(aq.level).toBe('alto');

    // Outra queda curta de 2 s não acumula com a anterior.
    feedSeconds(aq, now, 2, 35);
    expect(aq.level).toBe('alto');
  });

  it('recuperação curta acima de 58 FPS não sobe para alto', () => {
    const aq = new AdaptiveQuality('baixo');
    let now = feedSeconds(aq, 0, WARMUP_MS / 1000, 60);
    // 8 s a 60 FPS (< 10 s necessários para subir).
    now = feedSeconds(aq, now, 8, 60);
    expect(aq.level).toBe('baixo');

    // Queda para 45 FPS zera a contagem de recuperação; mais 5 s a 60 FPS ainda não sobe.
    now = feedSeconds(aq, now, 1, 45);
    feedSeconds(aq, now, 5, 60);
    expect(aq.level).toBe('baixo');
  });

  it('recuperação longa acima de 58 FPS por 10 segundos sobe de volta para alto', () => {
    const aq = new AdaptiveQuality('alto');
    let now = feedSeconds(aq, 0, 3, 60);
    now = feedSeconds(aq, now, DOWNGRADE_HOLD_MS / 1000 + 1, 35);
    expect(aq.level).toBe('baixo');

    feedSeconds(aq, now, UPGRADE_HOLD_MS / 1000 + 1, 60);
    expect(aq.level).toBe('alto');
  });

  it('faixa de histerese (50 a 58 FPS) mantém o nível atual sem alternar', () => {
    const high = new AdaptiveQuality('alto');
    feedSeconds(high, 0, 15, 54);
    expect(high.level).toBe('alto');

    const low = new AdaptiveQuality('baixo');
    feedSeconds(low, 0, 15, 54);
    expect(low.level).toBe('baixo');
  });

  it('pausa longa (aba em segundo plano) não conta como quadro lento', () => {
    const aq = new AdaptiveQuality('alto');
    let now = feedSeconds(aq, 0, 3, 60);
    // 2 s lentos antes de trocar de aba.
    now = feedSeconds(aq, now, 2, 35);

    // Pausa de 5 s em segundo plano (> PAUSE_FRAME_MS): limpa a janela e não derruba.
    now += PAUSE_FRAME_MS * 5;
    expect(aq.add(now, PAUSE_FRAME_MS * 5)).toBe('alto');

    // Mais 2 s lentos depois de voltar não somam com os 2 s anteriores.
    now = feedSeconds(aq, now, 2, 35);
    expect(aq.level).toBe('alto');

    // Várias pausas longas seguidas também não derrubam a qualidade.
    for (let i = 0; i < 5; i++) {
      now += PAUSE_FRAME_MS * 2;
      expect(aq.add(now, PAUSE_FRAME_MS * 2)).toBe('alto');
    }
  });

  it('frame(now) calcula o intervalo entre quadros e reset() reinicia o estado', () => {
    const aq = new AdaptiveQuality('alto');
    let now = 0;
    aq.frame(now);
    const frameMs = 1000 / 35;
    const totalFrames = Math.ceil((WARMUP_MS + DOWNGRADE_HOLD_MS) / frameMs) + 2;
    for (let i = 0; i < totalFrames; i++) {
      now += frameMs;
      aq.frame(now);
    }
    expect(aq.level).toBe('baixo');

    aq.reset('alto');
    expect(aq.level).toBe('alto');

    // O reset reinicia o aquecimento: quadros lentos logo depois não derrubam a qualidade.
    now = feedSeconds(aq, now, (WARMUP_MS - 100) / 1000, 20);
    expect(aq.level).toBe('alto');
    // Passado o aquecimento, a regra normal volta a valer.
    feedSeconds(aq, now, DOWNGRADE_HOLD_MS / 1000 + 1, 20);
    expect(aq.level).toBe('baixo');
  });

  it('usa o FPS médio: quadros alternando 16 e 25 ms (~49 FPS) descem em cerca de 3 s', () => {
    const aq = new AdaptiveQuality('alto');
    let now = feedSeconds(aq, 0, WARMUP_MS / 1000 + 1, 60);
    const start = now;
    let i = 0;
    while (aq.level === 'alto' && now - start < 10000) {
      const frameMs = i++ % 2 === 0 ? 16 : 25;
      now += frameMs;
      aq.add(now, frameMs);
    }
    expect(aq.level).toBe('baixo');
    // Janela de 1 s para a média cair + 3 s sustentados.
    expect(now - start).toBeLessThan(DOWNGRADE_HOLD_MS + 1500);
  });

  it('não oscila para sempre quando o alto não se sustenta (45 FPS em alto, 60 em baixo)', () => {
    const aq = new AdaptiveQuality('alto');
    let now = 0;
    let changes = 0;
    let last = aq.level;
    // 5 minutos simulados: o FPS depende do nível atual.
    while (now < 300_000) {
      const frameMs = aq.level === 'alto' ? 1000 / 45 : 1000 / 60;
      now += frameMs;
      aq.add(now, frameMs);
      if (aq.level !== last) {
        changes++;
        last = aq.level;
      }
    }
    expect(aq.level).toBe('baixo');
    expect(aq.gaveUpUpgrading).toBe(true);
    // Desce, tenta subir duas vezes (com espera dobrada) e desiste: no máximo 5 trocas.
    expect(changes).toBeLessThanOrEqual(5);
  });

  it('espera para subir dobra a cada subida que falhou', () => {
    const aq = new AdaptiveQuality('alto');
    expect(aq.upgradeHoldMs).toBe(UPGRADE_HOLD_MS);
    let now = feedSeconds(aq, 0, WARMUP_MS / 1000 + 1, 60);
    now = feedSeconds(aq, now, DOWNGRADE_HOLD_MS / 1000 + 1.5, 40);
    expect(aq.level).toBe('baixo');
    now = feedSeconds(aq, now, UPGRADE_HOLD_MS / 1000 + 1.5, 60);
    expect(aq.level).toBe('alto');
    // Cai de novo logo depois de subir: conta como falha.
    feedSeconds(aq, now, DOWNGRADE_HOLD_MS / 1000 + 1.5, 40);
    expect(aq.level).toBe('baixo');
    expect(aq.upgradeHoldMs).toBe(UPGRADE_HOLD_MS * 2);
  });
});
