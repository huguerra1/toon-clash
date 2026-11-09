import { describe, expect, it } from 'vitest';
import { FixedStepClock, TICK_MS } from './loop';

describe('FixedStepClock', () => {
  it('roda um tick a cada 1/60 s', () => {
    const clock = new FixedStepClock();
    expect(clock.advance(TICK_MS)).toBe(1);
    expect(clock.advance(TICK_MS * 3)).toBe(3);
  });

  it('acumula frames curtos até completar um tick', () => {
    const clock = new FixedStepClock();
    expect(clock.advance(TICK_MS / 2)).toBe(0);
    expect(clock.alpha).toBeCloseTo(0.5);
    expect(clock.advance(TICK_MS / 2)).toBe(1);
  });

  it('limita a recuperação depois de uma pausa longa', () => {
    const clock = new FixedStepClock();
    expect(clock.advance(10_000)).toBe(15);
  });

  it('ignora tempo negativo', () => {
    const clock = new FixedStepClock();
    expect(clock.advance(-50)).toBe(0);
  });
});
