import { getCharacter } from '../characters/roster';
import { JUGGLE_LIMIT } from './constants';
import { type InputHistory, createHistory } from './motion';
import type { Box, CharacterDef, CharacterId, MoveDef } from './types';

export type FighterStateName =
  | 'idle'
  | 'walk'
  | 'crouch'
  | 'block'
  | 'air'
  | 'land'
  | 'attack'
  | 'hitstun'
  | 'blockstun'
  | 'launched'
  | 'knockdown'
  | 'getup'
  | 'thrown'
  | 'dizzy'
  | 'ko'
  | 'victory'
  | 'toonality';

export interface FighterState {
  character: CharacterId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  health: number;
  state: FighterStateName;
  /** Ticks desde que entrou no estado atual. */
  stateTick: number;
  moveId: string | null;
  /** Se o golpe atual já encostou no oponente (libera cancelamentos). */
  contact: 'none' | 'hit' | 'block';
  armorUsed: boolean;
  crouching: boolean;
  blocking: boolean;
  /** Contagem regressiva de hitstun/blockstun/aterrissagem. */
  stun: number;
  juggle: number;
  /** Golpes sofridos no combo atual. */
  comboHits: number;
  comboDamage: number;
  /** Forma atual (só Kai Volt muda). */
  form: number;
  invuln: number;
  airAttackUsed: boolean;
  lastHitTick: number;
  /** Botão apertado recentemente, guardado alguns ticks para facilitar combos. */
  buffer: { button: 'lp' | 'hp' | 'lk' | 'hk'; tick: number } | null;
  history: InputHistory;
}

export const START_X = 2.5;

export function createFighter(character: CharacterId, side: 0 | 1): FighterState {
  return {
    character,
    x: side === 0 ? -START_X : START_X,
    y: 0,
    vx: 0,
    vy: 0,
    facing: side === 0 ? 1 : -1,
    health: getCharacter(character).maxHealth,
    state: 'idle',
    stateTick: 0,
    moveId: null,
    contact: 'none',
    armorUsed: false,
    crouching: false,
    blocking: false,
    stun: 0,
    juggle: 0,
    comboHits: 0,
    comboDamage: 0,
    form: 0,
    invuln: 0,
    airAttackUsed: false,
    lastHitTick: -1000,
    buffer: null,
    history: createHistory(),
  };
}

/** Troca de estado; só zera o contador se o estado realmente mudou. */
export function setState(f: FighterState, state: FighterStateName): void {
  if (f.state !== state) {
    f.state = state;
    f.stateTick = 0;
  }
}

/** Troca de estado sempre reiniciando o contador (ex.: apanhar de novo em hitstun). */
export function resetState(f: FighterState, state: FighterStateName): void {
  f.state = state;
  f.stateTick = 0;
}

export function currentMove(
  f: FighterState,
  def: CharacterDef = getCharacter(f.character),
): MoveDef | null {
  return f.moveId ? (def.moves[f.moveId] ?? null) : null;
}

export function moveDuration(move: MoveDef): number {
  return move.startup + move.active + move.recovery;
}

export function isAirborne(f: FighterState): boolean {
  return f.y > 0 || f.vy > 0;
}

/** Estados em que o lutador aceita comandos novos. */
export function isActionable(f: FighterState): boolean {
  return (
    f.state === 'idle' ||
    f.state === 'walk' ||
    f.state === 'crouch' ||
    f.state === 'block' ||
    (f.state === 'land' && f.stun <= 0)
  );
}

export function damageMul(f: FighterState, def: CharacterDef = getCharacter(f.character)): number {
  return def.damageMul * (def.forms?.[f.form]?.damageMul ?? 1);
}

export function speedMul(f: FighterState, def: CharacterDef = getCharacter(f.character)): number {
  return def.forms?.[f.form]?.speedMul ?? 1;
}

/** Caixa onde o lutador pode ser acertado, ou null se estiver invencível. */
export function hurtbox(
  f: FighterState,
  def: CharacterDef = getCharacter(f.character),
): Box | null {
  if (f.invuln > 0) return null;
  switch (f.state) {
    case 'knockdown':
    case 'getup':
    case 'ko':
    case 'thrown':
    case 'toonality':
      return null;
    case 'launched':
      if (f.juggle > JUGGLE_LIMIT) return null;
      return { x: -0.45, y: 0.1, w: 0.9, h: def.height * 0.6 };
  }
  if (isAirborne(f)) return { x: -0.35, y: 0.2, w: 0.7, h: def.height * 0.75 };
  if (f.crouching) return { x: -0.38, y: 0, w: 0.76, h: def.height * 0.6 };
  return { x: -0.35, y: 0, w: 0.7, h: def.height };
}

export interface Aabb {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Converte uma caixa do espaço do lutador para coordenadas do mundo. */
export function worldBox(f: FighterState, box: Box): Aabb {
  const x0 = f.facing === 1 ? f.x + box.x : f.x - box.x - box.w;
  return { x0, x1: x0 + box.w, y0: f.y + box.y, y1: f.y + box.y + box.h };
}

export function overlaps(a: Aabb, b: Aabb): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}
