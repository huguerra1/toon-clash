import { describe, expect, it } from 'vitest';
import { createFighter } from '../combat/fighter';
import type { MoveDef } from '../combat/types';
import { poseKey } from './scene';

const jab = { name: 'Soco', anim: 'jab', startup: 4, active: 2, recovery: 6, damage: 5 } as MoveDef;

describe('poseKey', () => {
  it('sem golpe, a chave é o estado', () => {
    const f = { ...createFighter('kai', 0), state: 'walk' as const };
    expect(poseKey(f, null)).toBe('walk');
  });

  it('muda ao passar da preparação para o golpe ativo e para a recuperação', () => {
    const at = (stateTick: number) =>
      poseKey({ ...createFighter('kai', 0), state: 'attack', stateTick }, jab);
    expect(at(0)).toBe(at(3));
    expect(at(4)).not.toBe(at(3));
    expect(at(5)).toBe(at(4));
    expect(at(6)).not.toBe(at(5));
  });
});
