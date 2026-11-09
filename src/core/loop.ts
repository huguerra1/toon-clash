/** Passo fixo da lógica: 60 atualizações por segundo, independente do FPS da tela. */
export const TICK_RATE = 60;
export const TICK_MS = 1000 / TICK_RATE;

/** Limite para não tentar "recuperar" segundos inteiros depois de a aba ficar em segundo plano. */
const MAX_FRAME_MS = 250;

/**
 * Acumulador de tempo do game loop com passo fixo.
 * Separado do requestAnimationFrame para poder ser testado sem navegador.
 */
export class FixedStepClock {
  private accumulator = 0;

  /** Recebe o tempo real decorrido e devolve quantos ticks de lógica devem rodar agora. */
  advance(elapsedMs: number): number {
    this.accumulator += Math.min(Math.max(elapsedMs, 0), MAX_FRAME_MS);
    // A margem evita perder um tick por erro de arredondamento (ex.: 250 / 16,666… = 14,999…).
    const ticks = Math.floor(this.accumulator / TICK_MS + 1e-9);
    this.accumulator = Math.max(this.accumulator - ticks * TICK_MS, 0);
    return ticks;
  }

  /** Fração (0..1) entre o último tick e o próximo, para interpolar o desenho. */
  get alpha(): number {
    return this.accumulator / TICK_MS;
  }
}

export interface LoopCallbacks {
  /** Lógica do jogo: sempre chamada com passo fixo. */
  update(): void;
  /** Desenho: chamado uma vez por quadro da tela. */
  render(alpha: number): void;
}

/** Inicia o loop no navegador. Devolve uma função para parar. */
export function startLoop({ update, render }: LoopCallbacks): () => void {
  const clock = new FixedStepClock();
  let last = performance.now();
  let frameId = 0;

  const frame = (now: number) => {
    const ticks = clock.advance(now - last);
    last = now;
    for (let i = 0; i < ticks; i++) update();
    render(clock.alpha);
    frameId = requestAnimationFrame(frame);
  };

  frameId = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(frameId);
}
