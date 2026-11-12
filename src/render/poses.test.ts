import { describe, expect, it } from 'vitest';
import { capiLook } from '../characters/capi/look';
import { kaiLooks } from '../characters/kai/look';
import { armClearance, neutralPose } from './fighter-model';
import { strikeTimeline, walkPose } from './poses';

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

describe('walkPose', () => {
  const guard = { ...neutralPose(), armA: 0.7, armB: 0.45, twist: 0.12 };

  it('balança os braços ao contrário da perna do mesmo lado', () => {
    const step = walkPose(guard, 1);
    expect(step.legA).toBeGreaterThan(step.legB);
    expect(step.armA).toBeLessThan(guard.armA);
    expect(step.armB).toBeGreaterThan(guard.armB);
    const back = walkPose(guard, -1);
    expect(back.armA).toBeGreaterThan(guard.armA);
    expect(back.armB).toBeLessThan(guard.armB);
  });

  it('gira o tronco a cada passo', () => {
    expect(walkPose(guard, 1).twist).not.toBeCloseTo(walkPose(guard, -1).twist);
  });
});

describe('armClearance', () => {
  it('abre os braços de quem tem barriga mais larga que os ombros', () => {
    expect(armClearance(capiLook)).toBeGreaterThan(0);
    expect(armClearance(kaiLooks[0]!)).toBe(0);
  });
});
