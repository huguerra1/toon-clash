import { getCharacter } from '../characters/roster';
import { type FighterState, currentMove, isAirborne } from '../combat/fighter';
import type { MotionStep } from '../combat/types';
import { type PlayerInput, decodeInput, emptyInput, encodeInput } from '../core/input';
import type { MatchState } from '../game/match';

export type CpuLevel = 'facil' | 'medio' | 'dificil' | 'pesadelo';

export const CPU_LEVELS: { id: CpuLevel; name: string }[] = [
  { id: 'facil', name: 'Fácil' },
  { id: 'medio', name: 'Médio' },
  { id: 'dificil', name: 'Difícil' },
  { id: 'pesadelo', name: 'Pesadelo' },
];

interface LevelParams {
  /** Ticks até "perceber" um ataque do oponente. */
  reaction: number;
  blockChance: number;
  antiAirChance: number;
  /** Vontade de se aproximar e atacar em vez de esperar. */
  aggression: number;
  comboChance: number;
  specialChance: number;
  toonalityChance: number;
  /** Ticks parados entre decisões. */
  idle: [number, number];
}

const PARAMS: Record<CpuLevel, LevelParams> = {
  facil: {
    reaction: 32,
    blockChance: 0.08,
    antiAirChance: 0.01,
    aggression: 0.22,
    comboChance: 0.02,
    specialChance: 0.04,
    toonalityChance: 0.1,
    idle: [40, 80],
  },
  medio: {
    reaction: 24,
    blockChance: 0.25,
    antiAirChance: 0.12,
    aggression: 0.43,
    comboChance: 0.22,
    specialChance: 0.18,
    toonalityChance: 0.3,
    idle: [16, 40],
  },
  dificil: {
    reaction: 15,
    blockChance: 0.48,
    antiAirChance: 0.32,
    aggression: 0.57,
    comboChance: 0.42,
    specialChance: 0.29,
    toonalityChance: 0.6,
    idle: [10, 28],
  },
  pesadelo: {
    reaction: 4,
    blockChance: 0.92,
    antiAirChance: 0.88,
    aggression: 0.8,
    comboChance: 0.9,
    specialChance: 0.5,
    toonalityChance: 1,
    idle: [2, 8],
  },
};

/** Memória da CPU. Fica fora do MatchState; usa um gerador com semente próprio. */
export interface CpuBrain {
  level: CpuLevel;
  seed: number;
  /** Inputs (bitmask) já planejados, um por tick. */
  queue: number[];
  /** Movimento segurado enquanto espera a próxima decisão. */
  hold: number;
  wait: number;
  /** Para não sortear de novo a reação ao mesmo golpe/pulo/projétil. */
  reacted: string;
}

export function createCpu(level: CpuLevel, seed = 12345): CpuBrain {
  return { level, seed: seed >>> 0 || 1, queue: [], hold: 0, wait: 30, reacted: '' };
}

/** mulberry32: aleatório determinístico a partir da semente. */
function random(brain: CpuBrain): number {
  brain.seed = (brain.seed + 0x6d2b79f5) >>> 0;
  let t = brain.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function between(brain: CpuBrain, [min, max]: [number, number]): number {
  return Math.floor(min + random(brain) * (max - min + 1));
}

type Held = Partial<Record<keyof PlayerInput, boolean>>;

function mask(held: Held): number {
  return encodeInput({ ...emptyInput(), ...held });
}

/** Converte um passo de comando (relativo) em teclas para o lado em que a CPU olha. */
function stepKeys(step: MotionStep | 'N', facing: 1 | -1): Held {
  const forward = facing === 1 ? 'right' : 'left';
  const back = facing === 1 ? 'left' : 'right';
  switch (step) {
    case 'F':
      return { [forward]: true };
    case 'B':
      return { [back]: true };
    case 'D':
      return { down: true };
    case 'U':
      return { up: true };
    case 'DF':
      return { down: true, [forward]: true };
    case 'DB':
      return { down: true, [back]: true };
    case 'N':
      return {};
  }
}

function queue(brain: CpuBrain, held: Held, ticks: number): void {
  const m = mask(held);
  for (let i = 0; i < ticks; i++) brain.queue.push(m);
}

/** Planeja um comando especial: direções com folga, depois o botão junto da última direção. */
function queueMotion(
  brain: CpuBrain,
  motion: readonly MotionStep[],
  button: keyof PlayerInput,
  facing: 1 | -1,
): void {
  motion.forEach((step, i) => {
    const prev = motion[i - 1];
    if (prev === step) queue(brain, {}, 2);
    queue(brain, stepKeys(step, facing), 3);
  });
  const last = motion[motion.length - 1]!;
  queue(brain, { ...stepKeys(last, facing), [button]: true }, 2);
  queue(brain, {}, 6);
}

/** Input da CPU neste tick. Altera só o `brain`. */
export function cpuInput(brain: CpuBrain, match: MatchState, me: 0 | 1): PlayerInput {
  const params = PARAMS[brain.level];
  const self = match.fighters[me];
  const opp = match.fighters[1 - me]!;

  if (match.phase === 'finishHim' && match.roundWinner === me && self.state !== 'attack') {
    if (brain.queue.length === 0) planFinish(brain, match, me, params);
  } else if (match.phase !== 'fight' && match.phase !== 'finishHim') {
    brain.queue.length = 0;
    return emptyInput();
  } else {
    react(brain, match, self, opp, params);
  }

  const next = brain.queue.shift();
  if (next !== undefined) return decodeInput(next);
  if (brain.wait > 0) {
    brain.wait--;
    return decodeInput(brain.hold);
  }
  decide(brain, match, self, opp, params);
  const planned = brain.queue.shift();
  return decodeInput(planned ?? brain.hold);
}

/** Reações que interrompem o plano: defender, anti-aéreo, pular projétil. */
function react(
  brain: CpuBrain,
  match: MatchState,
  self: FighterState,
  opp: FighterState,
  p: LevelParams,
): void {
  if (self.state === 'attack' || isAirborne(self)) return;
  const dist = Math.abs(opp.x - self.x);

  // Ataque do oponente vindo
  const move = currentMove(opp);
  if (
    opp.state === 'attack' &&
    move &&
    opp.stateTick >= p.reaction &&
    opp.stateTick < move.startup + move.active
  ) {
    const key = `atk:${match.tick - opp.stateTick}`;
    const reach = (move.hitbox ? move.hitbox.x + move.hitbox.w : 1.2) + 0.6 + (move.dash ? 2.5 : 0);
    if (brain.reacted !== key && dist < reach) {
      brain.reacted = key;
      if (random(brain) < p.blockChance) {
        brain.queue.length = 0;
        const low = move.height === 'low';
        const remaining = move.startup + move.active - opp.stateTick + 4;
        queue(brain, { block: true, down: low }, Math.max(4, remaining));
        return;
      }
    }
  }

  // Pulo do oponente vindo para cima
  if (
    opp.state === 'air' &&
    opp.vy < 0.12 &&
    dist < 2.6 &&
    Math.sign(opp.vx) === Math.sign(self.x - opp.x)
  ) {
    const key = `air:${match.tick - opp.stateTick}`;
    if (brain.reacted !== key) {
      brain.reacted = key;
      if (random(brain) < p.antiAirChance) {
        brain.queue.length = 0;
        queue(brain, { down: true }, 2);
        queue(brain, { down: true, hp: true }, 2);
        queue(brain, {}, 10);
        return;
      }
    }
  }

  // Projétil chegando
  for (const proj of match.projectiles) {
    if (proj.owner === (match.fighters.indexOf(self) as 0 | 1)) continue;
    const coming = Math.sign(proj.vx) === Math.sign(self.x - proj.x);
    const gap = Math.abs(self.x - proj.x);
    const key = `proj:${proj.id}`;
    if (!coming || gap > 3.5 || brain.reacted === key) continue;
    brain.reacted = key;
    if (random(brain) < p.blockChance) {
      brain.queue.length = 0;
      if (random(brain) < 0.5)
        queue(brain, { block: true }, Math.ceil(gap / Math.abs(proj.vx)) + 6);
      else queue(brain, { up: true, ...stepKeys('F', self.facing) }, 3);
    }
  }
}

function decide(
  brain: CpuBrain,
  match: MatchState,
  self: FighterState,
  opp: FighterState,
  p: LevelParams,
): void {
  const def = getCharacter(self.character);
  const dist = Math.abs(opp.x - self.x);
  const facing = self.facing;
  const toward = stepKeys('F', facing);
  const away = stepKeys('B', facing);
  const r = random(brain);
  brain.hold = 0;
  brain.wait = between(brain, p.idle);

  if (
    self.state === 'attack' ||
    !['idle', 'walk', 'crouch', 'block', 'land'].includes(self.state)
  ) {
    brain.wait = 2;
    return;
  }

  const projectile = def.specials.find((s) => !s.air && def.moves[s.move]?.projectile);
  const closer = def.specials.filter(
    (s) => !s.air && !def.moves[s.move]?.projectile && !def.moves[s.move]?.cycleForm,
  );
  const canShoot =
    projectile && !match.projectiles.some((pr) => pr.owner === match.fighters.indexOf(self));

  if (dist > 3.2) {
    if (canShoot && r < p.specialChance * 1.6) {
      queueMotion(brain, projectile.motion, projectile.button, facing);
    } else if (r < p.aggression) {
      brain.hold = mask(toward);
      brain.wait = between(brain, [15, 40]);
    } else if (r < p.aggression + 0.12) {
      queue(brain, { up: true, ...toward }, 3);
      queue(brain, {}, 18);
      queue(brain, { hk: true }, 2);
      queue(brain, {}, 20);
    } else if (def.forms && r < p.aggression + 0.2) {
      const shift = def.specials.find((s) => def.moves[s.move]?.cycleForm);
      if (shift) queueMotion(brain, shift.motion, shift.button, facing);
    }
    return;
  }

  if (dist > 1.5) {
    if (closer.length && r < p.specialChance) {
      const pick = closer[Math.floor(random(brain) * closer.length)]!;
      queueMotion(brain, pick.motion, pick.button, facing);
    } else if (r < p.aggression) {
      brain.hold = mask(toward);
      brain.wait = between(brain, [8, 20]);
    } else if (r < p.aggression + 0.15) {
      queue(brain, { up: true, ...toward }, 3);
      queue(brain, {}, 16);
      queue(brain, { lk: true }, 2);
      queue(brain, {}, 20);
    } else {
      brain.hold = mask(random(brain) < 0.5 ? { block: true } : away);
    }
    return;
  }

  // Perto
  if (r < p.comboChance) {
    planCombo(brain, def.specials, facing);
  } else if (r < p.comboChance + 0.15) {
    queue(brain, { ...toward, lp: true }, 2);
    queue(brain, {}, 20);
  } else if (r < p.comboChance + 0.3) {
    queue(brain, { down: true }, 2);
    queue(brain, { down: true, hk: true }, 2);
    queue(brain, {}, 18);
  } else if (r < 0.85) {
    queue(brain, { lp: true }, 2);
    queue(brain, {}, 10);
  } else {
    brain.hold = mask(random(brain) < 0.5 ? { block: true } : away);
  }
}

function planCombo(
  brain: CpuBrain,
  specials: ReturnType<typeof getCharacter>['specials'],
  facing: 1 | -1,
): void {
  const r = random(brain);
  if (r < 0.35) {
    queue(brain, { lp: true }, 2);
    queue(brain, {}, 4);
    queue(brain, { lp: true }, 2);
    queue(brain, {}, 4);
    queue(brain, { hp: true }, 2);
    queue(brain, {}, 16);
  } else if (r < 0.6) {
    queue(brain, { lk: true }, 2);
    queue(brain, {}, 6);
    queue(brain, { hk: true }, 2);
    queue(brain, {}, 22);
  } else if (r < 0.8) {
    queue(brain, { down: true, lp: true }, 2);
    queue(brain, { down: true }, 4);
    queue(brain, { down: true, hp: true }, 2);
    queue(brain, {}, 24);
  } else {
    // Normal cancelado em especial
    const special =
      specials.filter((s) => !s.air)[Math.floor(random(brain) * specials.length)] ?? specials[0];
    queue(brain, { lp: true }, 2);
    queue(brain, {}, 2);
    if (special) queueMotion(brain, special.motion, special.button, facing);
  }
}

function planFinish(brain: CpuBrain, match: MatchState, me: 0 | 1, p: LevelParams): void {
  const self = match.fighters[me];
  const def = getCharacter(self.character);
  if (match.phaseTick < 40) {
    queue(brain, {}, 40 - match.phaseTick);
    return;
  }
  if (random(brain) < p.toonalityChance) {
    queueMotion(brain, def.toonality.motion, def.toonality.button, self.facing);
    queue(brain, {}, 60);
  } else {
    const opp = match.fighters[1 - me]!;
    const toward = stepKeys('F', self.facing);
    if (Math.abs(opp.x - self.x) > 1.2) queue(brain, toward, 10);
    else queue(brain, { hk: true }, 2);
    queue(brain, {}, 10);
  }
}

/** Comportamentos simples do boneco de treino. */
export type DummyMode = 'parado' | 'defende' | 'agachado' | 'pula' | 'cpu';

export const DUMMY_MODES: { id: DummyMode; name: string }[] = [
  { id: 'parado', name: 'Parado' },
  { id: 'defende', name: 'Sempre defende' },
  { id: 'agachado', name: 'Agachado' },
  { id: 'pula', name: 'Pulando' },
  { id: 'cpu', name: 'Luta (CPU)' },
];

export function dummyInput(
  mode: DummyMode,
  match: MatchState,
  me: 0 | 1,
  tick: number,
): PlayerInput {
  const input = emptyInput();
  const opp = match.fighters[1 - me]!;
  switch (mode) {
    case 'defende': {
      input.block = true;
      input.down = currentMove(opp)?.height === 'low';
      break;
    }
    case 'agachado':
      input.down = true;
      break;
    case 'pula':
      input.up = tick % 70 < 3;
      break;
    default:
      break;
  }
  return input;
}
