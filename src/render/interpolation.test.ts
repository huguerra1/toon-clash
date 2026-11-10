import { describe, expect, it } from 'vitest';
import { emptyInput } from '../core/input';
import { createMatch, defaultConfig, stepMatch } from '../game/match';
import { interpolatedPositions } from './scene';

function walking() {
  let m = createMatch(defaultConfig(['kai', 'nyx']));
  const idle = emptyInput();
  for (let t = 0; t < 130; t++) m = stepMatch(m, [idle, idle]);
  const right = { ...emptyInput(), right: true };
  const previous = stepMatch(m, [right, idle]);
  const current = stepMatch(previous, [right, idle]);
  return { previous, current };
}

describe('interpolatedPositions', () => {
  it('desenha o lutador entre o tick anterior e o atual', () => {
    const { previous, current } = walking();
    const before = previous.fighters[0].x;
    const after = current.fighters[0].x;
    expect(after).toBeGreaterThan(before);
    const [half] = interpolatedPositions(current, previous, 0.5);
    expect(half.x).toBeCloseTo((before + after) / 2);
    expect(interpolatedPositions(current, previous, 0)[0].x).toBeCloseTo(before);
    expect(interpolatedPositions(current, previous, 1)[0].x).toBeCloseTo(after);
  });

  it('não interpola com estado de outro tick ou sem estado anterior', () => {
    const { previous, current } = walking();
    const later = stepMatch(current, [emptyInput(), emptyInput()]);
    expect(interpolatedPositions(later, previous, 0.5)[0].x).toBe(later.fighters[0].x);
    expect(interpolatedPositions(current, null, 0.5)[0].x).toBe(current.fighters[0].x);
  });

  it('não arrasta o lutador quando ele é teletransportado', () => {
    const { previous, current } = walking();
    const jumped = structuredClone(current);
    jumped.fighters[0].x = previous.fighters[0].x + 3;
    expect(interpolatedPositions(jumped, previous, 0.5)[0].x).toBe(jumped.fighters[0].x);
  });
});
