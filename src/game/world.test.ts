import { describe, expect, it } from 'vitest';
import type { PlayerInput } from '../core/input';
import { ARENA_HALF_WIDTH, MIN_DISTANCE, WALK_SPEED, createWorld, stepWorld } from './world';

const idle: PlayerInput = { left: false, right: false };
const right: PlayerInput = { left: false, right: true };
const left: PlayerInput = { left: true, right: false };

function run(ticks: number, inputs: [PlayerInput, PlayerInput]) {
  let world = createWorld();
  for (let i = 0; i < ticks; i++) world = stepWorld(world, inputs);
  return world;
}

describe('stepWorld', () => {
  it('anda na direção apertada', () => {
    const world = run(10, [right, idle]);
    expect(world.fighters[0].x).toBeCloseTo(-2 + 10 * WALK_SPEED);
    expect(world.tick).toBe(10);
  });

  it('não deixa sair da arena', () => {
    const world = run(1000, [left, right]);
    expect(world.fighters[0].x).toBe(-ARENA_HALF_WIDTH);
    expect(world.fighters[1].x).toBe(ARENA_HALF_WIDTH);
  });

  it('não deixa um lutador atravessar o outro', () => {
    const world = run(1000, [right, idle]);
    const [a, b] = world.fighters;
    expect(b.x - a.x).toBeGreaterThanOrEqual(MIN_DISTANCE - 1e-9);
    expect(b.x).toBeLessThanOrEqual(ARENA_HALF_WIDTH);
  });

  it('mantém os lutadores virados um para o outro', () => {
    const world = run(1, [idle, idle]);
    expect(world.fighters[0].facing).toBe(1);
    expect(world.fighters[1].facing).toBe(-1);
  });

  it('não altera o estado anterior', () => {
    const before = createWorld();
    stepWorld(before, [right, left]);
    expect(before.fighters[0].x).toBe(-2);
    expect(before.tick).toBe(0);
  });
});
