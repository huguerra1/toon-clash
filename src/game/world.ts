import type { PlayerInput } from '../core/input';

/** Limites da arena no eixo X (unidades do mundo ≈ metros). */
export const ARENA_HALF_WIDTH = 6;
/** Distância mínima entre os dois lutadores, para não atravessarem um ao outro. */
export const MIN_DISTANCE = 1.2;
/** Velocidade de caminhada em unidades por tick. */
export const WALK_SPEED = 0.06;

export interface FighterState {
  x: number;
  /** 1 = olhando para a direita, -1 = para a esquerda. */
  facing: 1 | -1;
}

export interface WorldState {
  tick: number;
  fighters: [FighterState, FighterState];
}

export function createWorld(): WorldState {
  return {
    tick: 0,
    fighters: [
      { x: -2, facing: 1 },
      { x: 2, facing: -1 },
    ],
  };
}

/**
 * Avança a lógica em um tick. Função pura: não depende do Three.js,
 * então pode ser testada e (no futuro) rodar em rollback online.
 */
export function stepWorld(world: WorldState, inputs: [PlayerInput, PlayerInput]): WorldState {
  const [a, b] = world.fighters.map((fighter, i) => {
    const input = inputs[i]!;
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const x = clamp(fighter.x + dir * WALK_SPEED, -ARENA_HALF_WIDTH, ARENA_HALF_WIDTH);
    return { ...fighter, x };
  }) as [FighterState, FighterState];

  separate(a, b);
  // Os lutadores sempre olham um para o outro, como em Mortal Kombat.
  a.facing = a.x <= b.x ? 1 : -1;
  b.facing = a.facing === 1 ? -1 : 1;

  return { tick: world.tick + 1, fighters: [a, b] };
}

function separate(a: FighterState, b: FighterState): void {
  const gap = Math.abs(b.x - a.x);
  if (gap >= MIN_DISTANCE) return;
  const push = (MIN_DISTANCE - gap) / 2;
  const sign = a.x <= b.x ? 1 : -1;
  a.x -= push * sign;
  b.x += push * sign;
  // Encostado na parede: quem está livre é que recua.
  for (const [self, other, side] of [
    [a, b, -sign],
    [b, a, sign],
  ] as const) {
    const limit = side * ARENA_HALF_WIDTH;
    if (Math.abs(self.x) > ARENA_HALF_WIDTH) {
      self.x = limit;
      other.x = limit - side * MIN_DISTANCE;
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
