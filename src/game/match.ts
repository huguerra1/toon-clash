import { getCharacter } from '../characters/roster';
import {
  ARENA_HALF_WIDTH,
  BACK_WALK_FACTOR,
  CHIP_FACTOR,
  COMBO_SCALING,
  DEFAULT_BLOCKSTUN,
  DEFAULT_HITSTUN,
  DEFAULT_KNOCKBACK,
  FINISH_TICKS,
  GETUP_TICKS,
  GRAVITY,
  HEAVY_DAMAGE,
  HITSTOP_HEAVY,
  HITSTOP_LIGHT,
  HITSTUN_FRICTION,
  INTRO_TICKS,
  JUGGLE_LIMIT,
  JUMP_VX,
  KNOCKDOWN_TICKS,
  LAND_TICKS,
  LAND_TICKS_AFTER_ATTACK,
  MAX_SEPARATION,
  MIN_COMBO_SCALE,
  MIN_DISTANCE,
  ROUND_OVER_TICKS,
  THROWN_TICKS,
  THROW_RANGE,
  TOONALITY_TICKS,
  TRAINING_REFILL_TICKS,
} from '../combat/constants';
import {
  type Aabb,
  type FighterState,
  createFighter,
  currentMove,
  damageMul,
  hurtbox,
  isActionable,
  isAirborne,
  moveDuration,
  overlaps,
  resetState,
  setState,
  speedMul,
  worldBox,
} from '../combat/fighter';
import { matchMotion, recordInput, toDir } from '../combat/motion';
import type { AttackHeight, CharacterId, MoveDef, ToonalityKind } from '../combat/types';
import { type AttackButton, type PlayerInput, emptyInput } from '../core/input';
import type { AnnounceKind, GameEvent, PlayerIndex } from './events';

export type MatchPhase = 'intro' | 'fight' | 'roundOver' | 'finishHim' | 'toonality' | 'matchOver';

export interface MatchConfig {
  characters: [CharacterId, CharacterId];
  roundsToWin: number;
  roundSeconds: number;
  /** Treino: sem tempo, sem nocaute e vida que se recupera. */
  training?: boolean;
}

export interface Projectile {
  id: number;
  owner: PlayerIndex;
  x: number;
  y: number;
  vx: number;
  w: number;
  h: number;
  damage: number;
  hitstun: number;
  knockdown: boolean;
  life: number;
  visual: string;
}

export interface MatchState {
  config: MatchConfig;
  tick: number;
  round: number;
  wins: [number, number];
  phase: MatchPhase;
  phaseTick: number;
  /** Ticks restantes no round. */
  timer: number;
  fighters: [FighterState, FighterState];
  projectiles: Projectile[];
  nextProjectileId: number;
  /** Congelamento curto no impacto ("hitstop"), deixa os golpes mais pesados. */
  hitstop: number;
  roundWinner: PlayerIndex | null;
  roundEnd: 'ko' | 'time' | 'draw' | null;
  matchWinner: PlayerIndex | null;
  toonality: { player: PlayerIndex; kind: ToonalityKind } | null;
  events: GameEvent[];
}

const BUFFER_TICKS = 5;
const PLAYERS: readonly PlayerIndex[] = [0, 1];

export function defaultConfig(characters: [CharacterId, CharacterId]): MatchConfig {
  return { characters, roundsToWin: 2, roundSeconds: 99 };
}

export function createMatch(config: MatchConfig): MatchState {
  const match: MatchState = {
    config,
    tick: 0,
    round: 0,
    wins: [0, 0],
    phase: 'intro',
    phaseTick: 0,
    timer: 0,
    fighters: [createFighter(config.characters[0], 0), createFighter(config.characters[1], 1)],
    projectiles: [],
    nextProjectileId: 1,
    hitstop: 0,
    roundWinner: null,
    roundEnd: null,
    matchWinner: null,
    toonality: null,
    events: [],
  };
  startRound(match, 1);
  match.events = [];
  return match;
}

/**
 * Avança a partida em um tick. Função pura: devolve um estado novo e não altera `prev`.
 * Mesmo estado + mesmos inputs = mesmo resultado (necessário para o online com rollback).
 */
export function stepMatch(
  prev: MatchState,
  inputs: readonly [PlayerInput, PlayerInput],
): MatchState {
  const m = structuredClone(prev);
  m.events = [];
  m.tick++;

  const controllable = m.phase === 'fight' || m.phase === 'finishHim';
  for (const i of PLAYERS) {
    const f = m.fighters[i];
    const input = controllable ? inputs[i] : emptyInput();
    for (const button of recordInput(f.history, input, f.facing, m.tick)) {
      f.buffer = { button, tick: m.tick };
    }
  }

  if (m.hitstop > 0) {
    m.hitstop--;
    return m;
  }

  m.phaseTick++;
  const live: [PlayerInput, PlayerInput] = controllable
    ? [inputs[0], inputs[1]]
    : [emptyInput(), emptyInput()];
  if (m.phase === 'finishHim' && m.roundWinner !== null)
    live[(1 - m.roundWinner) as PlayerIndex] = emptyInput();

  simulate(m, live);

  switch (m.phase) {
    case 'intro':
      if (m.phaseTick === 80) announce(m, 'fight', 'LUTEM!');
      if (m.phaseTick >= INTRO_TICKS) setPhase(m, 'fight');
      break;
    case 'fight':
      if (!m.config.training && m.timer > 0) m.timer--;
      checkRoundEnd(m);
      break;
    case 'finishHim':
      stepFinishHim(m);
      break;
    case 'toonality':
      if (m.phaseTick === TOONALITY_TICKS - 90) announce(m, 'toonality', 'TOONALITY!');
      if (m.phaseTick >= TOONALITY_TICKS) {
        m.wins[m.toonality!.player]++;
        endMatch(m, m.toonality!.player);
      }
      break;
    case 'roundOver':
      stepRoundOver(m);
      break;
    case 'matchOver':
      break;
  }
  return m;
}

// ---------------------------------------------------------------------------
// Fluxo de rounds
// ---------------------------------------------------------------------------

function setPhase(m: MatchState, phase: MatchPhase): void {
  m.phase = phase;
  m.phaseTick = 0;
}

function announce(m: MatchState, kind: AnnounceKind, text: string): void {
  m.events.push({ type: 'announce', kind, text });
}

function startRound(m: MatchState, round: number): void {
  const old = m.fighters;
  m.fighters = [createFighter(m.config.characters[0], 0), createFighter(m.config.characters[1], 1)];
  // O histórico de input continua para não "engolir" botões entre rounds.
  m.fighters[0].history = old[0].history;
  m.fighters[1].history = old[1].history;
  m.projectiles = [];
  m.round = round;
  m.timer = m.config.roundSeconds * 60;
  m.roundWinner = null;
  m.roundEnd = null;
  m.hitstop = 0;
  setPhase(m, 'intro');
  const last = m.config.roundsToWin - 1;
  const final = m.wins[0] === last && m.wins[1] === last;
  announce(m, 'round', final ? 'ROUND FINAL' : `ROUND ${round}`);
}

function checkRoundEnd(m: MatchState): void {
  if (m.config.training) return;
  const [a, b] = m.fighters;
  const aDown = a.health <= 0;
  const bDown = b.health <= 0;
  if (aDown || bDown) {
    endRound(m, aDown && bDown ? null : aDown ? 1 : 0, 'ko');
  } else if (m.timer <= 0) {
    const ratioA = a.health / getCharacter(a.character).maxHealth;
    const ratioB = b.health / getCharacter(b.character).maxHealth;
    endRound(m, ratioA === ratioB ? null : ratioA > ratioB ? 0 : 1, 'time');
  }
}

function endRound(m: MatchState, winner: PlayerIndex | null, reason: 'ko' | 'time'): void {
  m.projectiles = [];
  m.roundWinner = winner;
  m.roundEnd = winner === null ? 'draw' : reason;

  if (winner === null) {
    const target = m.config.roundsToWin;
    // Empate dá ponto aos dois, a não ser que isso termine a partida para ambos.
    if (!(m.wins[0] + 1 >= target && m.wins[1] + 1 >= target)) {
      m.wins[0]++;
      m.wins[1]++;
    }
    for (const f of m.fighters) if (f.health <= 0) knockOut(f, 0);
    announce(m, 'draw', 'EMPATE!');
    setPhase(m, 'roundOver');
    return;
  }

  const loser = m.fighters[1 - winner]!;
  const winnerChar = getCharacter(m.fighters[winner].character);
  const loserChar = getCharacter(loser.character);

  if (reason === 'ko' && m.wins[winner] + 1 >= m.config.roundsToWin) {
    // Último round: o perdedor fica tonto e o vencedor pode fazer a Toonality.
    loser.health = 0;
    loser.vx = 0;
    loser.moveId = null;
    if (isAirborne(loser)) loser.y = 0;
    loser.vy = 0;
    resetState(loser, 'dizzy');
    setPhase(m, 'finishHim');
    m.events.push({ type: 'ko', player: (1 - winner) as PlayerIndex });
    announce(m, 'finish', `ACABE COM ${loserChar.pronoun.toUpperCase()}!`);
    return;
  }

  m.wins[winner]++;
  if (reason === 'ko') {
    knockOut(loser, m.fighters[winner].facing);
    m.events.push({ type: 'ko', player: (1 - winner) as PlayerIndex });
    announce(m, 'ko', 'K.O.!');
  } else {
    announce(m, 'time', 'TEMPO!');
  }
  if (m.fighters[winner].health >= winnerChar.maxHealth) announce(m, 'perfect', 'PERFEITO!');
  setPhase(m, 'roundOver');
}

function knockOut(f: FighterState, direction: number): void {
  f.moveId = null;
  f.vy = 0.12;
  f.vx = direction * 0.06;
  if (f.y <= 0) f.y = 0.01;
  resetState(f, 'ko');
}

function stepRoundOver(m: MatchState): void {
  if (m.phaseTick === 70 && m.roundWinner !== null) {
    const w = m.fighters[m.roundWinner];
    if (isActionable(w) || w.state === 'air') resetState(w, 'victory');
  }
  if (m.phaseTick < ROUND_OVER_TICKS) return;
  const target = m.config.roundsToWin;
  const champion = m.wins[0] >= target ? 0 : m.wins[1] >= target ? 1 : null;
  if (champion !== null) endMatch(m, champion);
  else startRound(m, m.round + 1);
}

function stepFinishHim(m: MatchState): void {
  const winner = m.roundWinner!;
  const loser = m.fighters[1 - winner]!;
  if (loser.state !== 'dizzy') {
    // Levou um golpe: cai nocauteado.
    if (loser.state !== 'ko') {
      const { vx, vy } = loser;
      resetState(loser, 'ko');
      loser.vx = vx;
      loser.vy = Math.max(vy, 0.1);
      if (loser.y <= 0) loser.y = 0.01;
    }
    m.wins[winner]++;
    setPhase(m, 'roundOver');
    return;
  }
  if (m.phaseTick >= FINISH_TICKS) {
    knockOut(loser, 0);
    m.wins[winner]++;
    setPhase(m, 'roundOver');
  }
}

function startToonality(m: MatchState, i: PlayerIndex): void {
  const def = getCharacter(m.fighters[i].character);
  m.toonality = { player: i, kind: def.toonality.kind };
  const f = m.fighters[i];
  f.moveId = null;
  f.vx = 0;
  resetState(f, 'toonality');
  const victim = m.fighters[1 - i]!;
  resetState(victim, 'toonality');
  victim.vx = 0;
  setPhase(m, 'toonality');
  m.events.push({
    type: 'toonality',
    player: i,
    kind: def.toonality.kind,
    name: def.toonality.name,
  });
}

function endMatch(m: MatchState, winner: PlayerIndex): void {
  m.matchWinner = winner;
  setPhase(m, 'matchOver');
  const w = m.fighters[winner];
  w.moveId = null;
  w.vx = 0;
  if (!isAirborne(w)) resetState(w, 'victory');
  announce(m, 'winner', `${getCharacter(w.character).name.toUpperCase()} VENCE!`);
}

// ---------------------------------------------------------------------------
// Simulação de um tick
// ---------------------------------------------------------------------------

function simulate(m: MatchState, inputs: [PlayerInput, PlayerInput]): void {
  for (const i of PLAYERS) control(m, i, inputs[i]);
  for (const i of PLAYERS) advanceMove(m, i);
  for (const i of PLAYERS) physics(m, i);
  separate(m);
  resolveHits(m);
  updateProjectiles(m);
  for (const i of PLAYERS) updateTimers(m, i);
  faceOpponents(m);
  for (const f of m.fighters) f.stateTick++;
}

function control(m: MatchState, i: PlayerIndex, input: PlayerInput): void {
  const f = m.fighters[i];
  const def = getCharacter(f.character);
  const dir = toDir(input, f.facing);
  const down = dir <= 3;
  const up = dir >= 7;
  const forward = dir === 3 || dir === 6 || dir === 9;
  const back = dir === 1 || dir === 4 || dir === 7;

  if (f.buffer && m.tick - f.buffer.tick > BUFFER_TICKS) f.buffer = null;
  const button = f.buffer?.button ?? null;

  if (isActionable(f)) {
    f.blocking = false;
    if (button && tryAttack(m, i, button, forward, down)) return;
    if (input.block) {
      setState(f, 'block');
      f.crouching = down;
      f.blocking = true;
      f.vx = 0;
      return;
    }
    if (up) {
      const vx = forward ? JUMP_VX : back ? -JUMP_VX : 0;
      f.vx = vx * f.facing * Math.sqrt(speedMul(f, def));
      f.vy = def.jumpVelocity;
      f.y = 0.001;
      f.crouching = false;
      f.airAttackUsed = false;
      resetState(f, 'air');
      m.events.push({ type: 'jump', player: i });
      return;
    }
    if (down) {
      setState(f, 'crouch');
      f.crouching = true;
      f.vx = 0;
      return;
    }
    f.crouching = false;
    if (forward || back) {
      setState(f, 'walk');
      const factor = forward ? 1 : -BACK_WALK_FACTOR;
      f.vx = f.facing * factor * def.walkSpeed * speedMul(f, def);
    } else {
      setState(f, 'idle');
      f.vx = 0;
    }
    return;
  }

  if (f.state === 'air' && !f.airAttackUsed && button) {
    tryAttack(m, i, button, forward, down);
    return;
  }

  if (f.state === 'attack' && button && f.contact !== 'none') {
    const move = currentMove(f, def);
    if (move && f.stateTick >= move.startup) tryCancel(m, i, button, down, move);
  }

  if (f.state === 'blockstun') f.blocking = true;
}

function consumeBuffer(f: FighterState): void {
  f.buffer = null;
}

function tryAttack(
  m: MatchState,
  i: PlayerIndex,
  button: AttackButton,
  forward: boolean,
  down: boolean,
): boolean {
  const f = m.fighters[i];
  const o = m.fighters[1 - i]!;
  const def = getCharacter(f.character);
  const airborne = isAirborne(f);

  if (
    m.phase === 'finishHim' &&
    m.roundWinner === i &&
    !airborne &&
    button === def.toonality.button &&
    matchMotion(f.history, def.toonality.motion, m.tick)
  ) {
    consumeBuffer(f);
    startToonality(m, i);
    return true;
  }

  if (trySpecial(m, i, button)) return true;

  if (airborne) {
    consumeBuffer(f);
    startMove(m, i, `j_${button}`);
    f.airAttackUsed = true;
    return true;
  }

  consumeBuffer(f);
  if (button === 'lp' && forward && !down && Math.abs(o.x - f.x) <= THROW_RANGE && isThrowable(o)) {
    startMove(m, i, 'throw');
    return true;
  }
  startMove(m, i, down ? `d_${button}` : button);
  return true;
}

function trySpecial(m: MatchState, i: PlayerIndex, button: AttackButton): boolean {
  const f = m.fighters[i];
  const def = getCharacter(f.character);
  const airborne = isAirborne(f);
  const specials = [...def.specials].sort((a, b) => b.motion.length - a.motion.length);
  for (const special of specials) {
    if (special.button !== button || !!special.air !== airborne) continue;
    if (!matchMotion(f.history, special.motion, m.tick)) continue;
    const move = def.moves[special.move];
    if (!move) continue;
    if (move.projectile && m.projectiles.some((p) => p.owner === i)) continue;
    consumeBuffer(f);
    startMove(m, i, special.move);
    if (airborne) f.airAttackUsed = true;
    m.events.push({ type: 'special', player: i, move: special.move, name: move.name });
    return true;
  }
  return false;
}

function tryCancel(
  m: MatchState,
  i: PlayerIndex,
  button: AttackButton,
  down: boolean,
  move: MoveDef,
): void {
  const f = m.fighters[i];
  if (!move.special && trySpecial(m, i, button)) return;
  if (isAirborne(f)) return;
  const next = down ? `d_${button}` : button;
  if (move.chain?.includes(next)) {
    consumeBuffer(f);
    startMove(m, i, next);
  }
}

function startMove(m: MatchState, i: PlayerIndex, moveId: string): void {
  const f = m.fighters[i];
  const def = getCharacter(f.character);
  const move = def.moves[moveId];
  if (!move) return;
  resetState(f, 'attack');
  f.moveId = moveId;
  f.contact = 'none';
  f.armorUsed = false;
  f.blocking = false;
  f.crouching = moveId.startsWith('d_');
  f.invuln = Math.max(f.invuln, move.invulnerable ?? 0);
  if (!isAirborne(f)) f.vx = 0;
  const heavy = move.special === true || move.damage >= HEAVY_DAMAGE;
  m.events.push({ type: 'whoosh', player: i, heavy });
}

function isThrowable(f: FighterState): boolean {
  return (
    !isAirborne(f) &&
    f.invuln <= 0 &&
    (isActionable(f) || f.state === 'attack' || f.state === 'dizzy')
  );
}

/** Efeitos que acontecem em ticks específicos do golpe: projétil, avanço, teleporte… */
function advanceMove(m: MatchState, i: PlayerIndex): void {
  const f = m.fighters[i];
  if (f.state !== 'attack') return;
  const def = getCharacter(f.character);
  const move = currentMove(f, def);
  if (!move) {
    setState(f, 'idle');
    return;
  }
  const t = f.stateTick;

  if (move.dash) {
    const dashing = t >= move.dash.from && t < move.dash.to;
    if (dashing) f.vx = f.facing * move.dash.vx * speedMul(f, def);
    else if (t === move.dash.to) f.vx *= 0.3;
  }

  if (t === move.startup) {
    if (move.projectile) {
      const p = move.projectile;
      m.projectiles.push({
        id: m.nextProjectileId++,
        owner: i,
        x: f.x + f.facing * 0.8,
        y: f.y + p.y,
        vx: f.facing * p.speed,
        w: p.w,
        h: p.h,
        damage: Math.round(p.damage * damageMul(f, def)),
        hitstun: p.hitstun,
        knockdown: p.knockdown ?? false,
        life: p.life,
        visual: p.visual,
      });
      m.events.push({ type: 'projectile', player: i, visual: p.visual });
    }
    if (move.rise) {
      f.vy = move.rise.vy;
      f.vx = f.facing * move.rise.vx;
      f.y = Math.max(f.y, 0.001);
    }
    if (move.teleport) teleportBehind(m, i);
    if (move.cycleForm && def.forms) {
      f.form = (f.form + 1) % def.forms.length;
      m.events.push({ type: 'transform', player: i, form: f.form });
    }
  }

  if (t + 1 >= moveDuration(move)) {
    f.moveId = null;
    if (isAirborne(f)) {
      f.airAttackUsed = true;
      setState(f, 'air');
    } else {
      setState(f, f.crouching ? 'crouch' : 'idle');
    }
  }
}

function teleportBehind(m: MatchState, i: PlayerIndex): void {
  const f = m.fighters[i];
  const o = m.fighters[1 - i]!;
  const fromX = f.x;
  const side = o.x >= f.x ? 1 : -1;
  let x = o.x + side * 1.1;
  if (Math.abs(x) > ARENA_HALF_WIDTH - 0.3) x = o.x - side * 1.1;
  f.x = clamp(x, -ARENA_HALF_WIDTH, ARENA_HALF_WIDTH);
  f.facing = o.x >= f.x ? 1 : -1;
  m.events.push({ type: 'teleport', player: i, fromX, toX: f.x });
}

function physics(m: MatchState, i: PlayerIndex): void {
  const f = m.fighters[i];
  if (f.state === 'thrown') {
    const thrower = m.fighters[1 - i]!;
    f.x = thrower.x + thrower.facing * 0.7;
    return;
  }
  if (isAirborne(f)) {
    f.vy -= GRAVITY;
    f.x += f.vx;
    f.y += f.vy;
    if (f.y <= 0) {
      f.y = 0;
      f.vy = 0;
      land(m, i);
    }
    return;
  }
  f.x += f.vx;
  const dashing = f.state === 'attack' && currentMove(f)?.dash !== undefined;
  if (f.state !== 'walk' && !dashing) f.vx *= HITSTUN_FRICTION;
  if (Math.abs(f.vx) < 0.001) f.vx = 0;
}

function land(m: MatchState, i: PlayerIndex): void {
  const f = m.fighters[i];
  switch (f.state) {
    case 'air':
      resetState(f, 'land');
      f.stun = LAND_TICKS;
      f.vx = 0;
      m.events.push({ type: 'land', player: i });
      break;
    case 'attack':
      f.moveId = null;
      resetState(f, 'land');
      f.stun = LAND_TICKS_AFTER_ATTACK;
      f.vx = 0;
      m.events.push({ type: 'land', player: i });
      break;
    case 'launched':
      resetState(f, 'knockdown');
      f.vx = 0;
      m.events.push({ type: 'knockdown', player: i, x: f.x });
      break;
    case 'ko':
      f.vx = 0;
      m.events.push({ type: 'knockdown', player: i, x: f.x });
      break;
    default:
      f.vx = 0;
  }
}

/** Empurra um lutador para fora do outro e mantém os dois dentro da arena e da câmera. */
function separate(m: MatchState): void {
  const [a, b] = m.fighters;
  const solid = (f: FighterState) => f.state !== 'thrown' && f.state !== 'toonality';
  if (solid(a) && solid(b) && Math.abs(a.y - b.y) < 1.2) {
    const gap = Math.abs(b.x - a.x);
    if (gap < MIN_DISTANCE) {
      const sign = a.x < b.x || (a.x === b.x && a.facing === 1) ? 1 : -1;
      const push = (MIN_DISTANCE - gap) / 2;
      a.x -= push * sign;
      b.x += push * sign;
      for (const [self, other, side] of [
        [a, b, -sign],
        [b, a, sign],
      ] as const) {
        if (Math.abs(self.x) > ARENA_HALF_WIDTH) {
          self.x = side * ARENA_HALF_WIDTH;
          other.x = self.x - side * MIN_DISTANCE;
        }
      }
    }
  }
  for (const f of m.fighters) f.x = clamp(f.x, -ARENA_HALF_WIDTH, ARENA_HALF_WIDTH);
  // Limita a distância: quem está se afastando é segurado.
  if (Math.abs(b.x - a.x) > MAX_SEPARATION) {
    const mover = Math.abs(a.vx) >= Math.abs(b.vx) ? a : b;
    const anchor = mover === a ? b : a;
    mover.x = anchor.x + Math.sign(mover.x - anchor.x) * MAX_SEPARATION;
  }
}

interface PendingHit {
  attacker: PlayerIndex;
  move: MoveDef;
  box: Aabb;
  hurt: Aabb;
}

function resolveHits(m: MatchState): void {
  const pending: PendingHit[] = [];
  for (const i of PLAYERS) {
    const f = m.fighters[i];
    const o = m.fighters[1 - i]!;
    if (f.state !== 'attack' || f.contact !== 'none') continue;
    const move = currentMove(f);
    if (!move?.hitbox) continue;
    const t = f.stateTick;
    if (t < move.startup || t >= move.startup + move.active) continue;
    const box = worldBox(f, move.hitbox);
    if (move.throw) {
      if (!isThrowable(o)) continue;
      const def = getCharacter(o.character);
      const hurt = worldBox(o, { x: -0.35, y: 0, w: 0.7, h: def.height });
      if (overlaps(box, hurt)) pending.push({ attacker: i, move, box, hurt });
      continue;
    }
    const hb = hurtbox(o);
    if (!hb) continue;
    const hurt = worldBox(o, hb);
    if (overlaps(box, hurt)) pending.push({ attacker: i, move, box, hurt });
  }
  // Os dois golpes são aplicados juntos (troca de golpes).
  for (const hit of pending) {
    const x = (Math.max(hit.box.x0, hit.hurt.x0) + Math.min(hit.box.x1, hit.hurt.x1)) / 2;
    const y = (Math.max(hit.box.y0, hit.hurt.y0) + Math.min(hit.box.y1, hit.hurt.y1)) / 2;
    applyHit(m, hit.attacker, hit.move, m.fighters[hit.attacker].facing, x, y, false);
  }
}

function isBlocking(d: FighterState, height: AttackHeight | undefined): boolean {
  if (!d.blocking || (d.state !== 'block' && d.state !== 'blockstun')) return false;
  if (height === 'low') return d.crouching;
  if (height === 'overhead') return !d.crouching;
  return true;
}

function applyHit(
  m: MatchState,
  attackerIndex: PlayerIndex,
  move: MoveDef,
  direction: number,
  x: number,
  y: number,
  fromProjectile: boolean,
): void {
  const a = m.fighters[attackerIndex];
  const d = m.fighters[1 - attackerIndex]!;
  const minHealth = m.config.training ? 1 : 0;
  const knock = move.knockback ?? DEFAULT_KNOCKBACK;
  const mul = fromProjectile ? 1 : damageMul(a);

  if (!move.throw && isBlocking(d, move.height)) {
    if (!fromProjectile) a.contact = 'block';
    const chip = move.special ? Math.round(move.damage * mul * CHIP_FACTOR) : 0;
    d.health = Math.max(minHealth, d.health - chip);
    if (chip > 0) d.lastHitTick = m.tick;
    resetState(d, 'blockstun');
    d.stun = move.blockstun ?? DEFAULT_BLOCKSTUN;
    d.vx = direction * knock * 0.8;
    if (!fromProjectile && Math.abs(d.x) >= ARENA_HALF_WIDTH - 0.05)
      a.vx = -direction * knock * 0.6;
    m.hitstop = HITSTOP_LIGHT;
    m.events.push({ type: 'block', attacker: attackerIndex, x, y });
    return;
  }

  // Multiplicação em laço em vez de potência: resultado idêntico em qualquer navegador (online).
  let scale = 1;
  for (let k = 0; k < d.comboHits && scale > MIN_COMBO_SCALE; k++) scale *= COMBO_SCALING;
  scale = Math.max(MIN_COMBO_SCALE, scale);
  const damage = Math.round(move.damage * mul * scale);
  if (!fromProjectile) a.contact = 'hit';

  const dMove = currentMove(d);
  if (
    d.state === 'attack' &&
    dMove?.armor &&
    !d.armorUsed &&
    d.stateTick < dMove.startup + dMove.active
  ) {
    d.armorUsed = true;
    d.health = Math.max(minHealth, d.health - damage);
    d.lastHitTick = m.tick;
    m.hitstop = HITSTOP_LIGHT;
    m.events.push({ type: 'armor', player: (1 - attackerIndex) as PlayerIndex, x, y });
    return;
  }

  d.health = Math.max(minHealth, d.health - damage);
  d.comboHits++;
  d.comboDamage += damage;
  d.lastHitTick = m.tick;
  d.moveId = null;
  d.blocking = false;
  m.hitstop = damage >= HEAVY_DAMAGE ? HITSTOP_HEAVY : HITSTOP_LIGHT;
  m.events.push({
    type: 'hit',
    attacker: attackerIndex,
    x,
    y,
    damage,
    heavy: damage >= HEAVY_DAMAGE,
    combo: d.comboHits,
  });

  if (move.throw) {
    resetState(d, 'thrown');
    d.vx = 0;
    d.vy = 0;
    d.y = 0;
    d.crouching = false;
    m.events.push({ type: 'throw', player: attackerIndex });
    return;
  }

  if (d.state === 'dizzy') {
    resetState(d, 'launched');
    d.vy = move.launch ?? 0.14;
    d.vx = direction * Math.max(knock, 0.06);
    d.y = Math.max(d.y, 0.001);
    return;
  }

  const airborne = isAirborne(d) || d.state === 'launched';
  if (move.launch || move.knockdown || airborne) {
    resetState(d, 'launched');
    d.vy = move.launch ?? (move.knockdown ? 0.12 : 0.14);
    d.vx = direction * knock * (move.knockdown ? 1.5 : 1);
    d.y = Math.max(d.y, 0.001);
    d.juggle++;
    d.crouching = false;
  } else {
    resetState(d, 'hitstun');
    d.stun = move.hitstun ?? DEFAULT_HITSTUN;
    d.vx = direction * knock;
  }
  if (!fromProjectile && Math.abs(d.x) >= ARENA_HALF_WIDTH - 0.05) a.vx = -direction * knock * 0.8;
}

function updateProjectiles(m: MatchState): void {
  for (const p of m.projectiles) {
    p.x += p.vx;
    p.life--;
  }
  // Projéteis de lados opostos se anulam.
  for (const p of m.projectiles) {
    for (const q of m.projectiles) {
      if (p.owner === q.owner || p.life <= 0 || q.life <= 0) continue;
      if (overlaps(projectileBox(p), projectileBox(q))) {
        p.life = 0;
        q.life = 0;
        m.events.push({ type: 'clash', x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
      }
    }
  }
  for (const p of m.projectiles) {
    if (p.life <= 0) continue;
    const target = m.fighters[1 - p.owner]!;
    const hb = hurtbox(target);
    if (!hb) continue;
    if (!overlaps(projectileBox(p), worldBox(target, hb))) continue;
    p.life = 0;
    const move: MoveDef = {
      name: p.visual,
      anim: 'projectile',
      startup: 0,
      active: 0,
      recovery: 0,
      damage: p.damage,
      hitstun: p.hitstun,
      blockstun: 12,
      knockback: 0.08,
      knockdown: p.knockdown,
      height: 'mid',
      special: true,
    };
    applyHit(m, p.owner, move, Math.sign(p.vx), p.x, p.y, true);
  }
  m.projectiles = m.projectiles.filter((p) => p.life > 0 && Math.abs(p.x) < ARENA_HALF_WIDTH + 2);
}

function projectileBox(p: Projectile): Aabb {
  return { x0: p.x - p.w / 2, x1: p.x + p.w / 2, y0: p.y - p.h / 2, y1: p.y + p.h / 2 };
}

function updateTimers(m: MatchState, i: PlayerIndex): void {
  const f = m.fighters[i];
  const o = m.fighters[1 - i]!;
  if (f.invuln > 0) f.invuln--;
  switch (f.state) {
    case 'hitstun':
    case 'blockstun':
      if (--f.stun <= 0) setState(f, f.crouching ? 'crouch' : 'idle');
      break;
    case 'land':
      if (--f.stun <= 0) setState(f, 'idle');
      break;
    case 'knockdown':
      if (f.stateTick >= KNOCKDOWN_TICKS) {
        resetState(f, 'getup');
        f.invuln = GETUP_TICKS + 4;
      }
      break;
    case 'getup':
      if (f.stateTick >= GETUP_TICKS) setState(f, 'idle');
      break;
    case 'thrown':
      if (f.stateTick >= THROWN_TICKS) {
        f.x = clamp(o.x - o.facing * 1.3, -ARENA_HALF_WIDTH, ARENA_HALF_WIDTH);
        f.y = 0.5;
        f.vy = 0.06;
        f.vx = -o.facing * 0.04;
        f.juggle = JUGGLE_LIMIT + 1;
        resetState(f, 'launched');
      }
      break;
  }
  if (isActionable(f) && f.comboHits > 0) {
    f.comboHits = 0;
    f.comboDamage = 0;
    f.juggle = 0;
  }
  if (m.config.training && m.tick - f.lastHitTick > TRAINING_REFILL_TICKS) {
    f.health = getCharacter(f.character).maxHealth;
  }
}

/** No chão e livres, os lutadores sempre olham um para o outro. */
function faceOpponents(m: MatchState): void {
  for (const i of PLAYERS) {
    const f = m.fighters[i];
    const o = m.fighters[1 - i]!;
    const free = isActionable(f) || f.state === 'getup' || f.state === 'land';
    if (free && !isAirborne(f) && o.x !== f.x) f.facing = o.x > f.x ? 1 : -1;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
