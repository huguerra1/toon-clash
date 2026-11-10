import { describe, expect, it } from 'vitest';
import { neutralPose } from './fighter-model';
import { strikeTimeline } from './poses';

const base = neutralPose();
const windup = { ...neutralPose(), armA: -0.5 };
const hit = { ...neutralPose(), armA: 1.5 };
// startup 10, active 3, recovery 12
const at = (t: number) => strikeTimeline(base, windup, hit, t, 10, 3, 12).armA;

describe('strikeTimeline', () => {
  it('prepara o golpe antes de soltar (antecipação)', () => {
    expect(at(0)).toBeCloseTo(0);
    expect(at(5)).toBeLessThan(0);
  });

  it('o golpe passa um pouco do ponto antes do impacto (estalo)', () => {
    const peak = Math.max(at(8), at(9));
    expect(peak).toBeGreaterThan(hit.armA);
  });

  it('segura a pose nos quadros ativos e no começo da recuperação', () => {
    expect(at(10)).toBe(hit.armA);
    expect(at(12)).toBe(hit.armA);
    expect(at(14)).toBe(hit.armA);
  });

  it('volta para a guarda no fim da recuperação', () => {
    expect(at(18)).toBeLessThan(hit.armA);
    expect(at(25)).toBeCloseTo(0);
  });
});
