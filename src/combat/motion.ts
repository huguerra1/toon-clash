import { ATTACK_BUTTONS, type AttackButton, type PlayerInput, encodeInput } from '../core/input';
import type { MotionStep } from './types';

/**
 * Direção em notação de teclado numérico, relativa ao lado para onde o lutador olha:
 * 6 = frente, 4 = trás, 2 = baixo, 8 = cima, 5 = neutro, 3 = baixo-frente…
 */
export type Dir = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface DirEntry {
  dir: Dir;
  tick: number;
}

/** Histórico de inputs guardado no estado do lutador (precisa ser serializável). */
export interface InputHistory {
  /** Só as mudanças de direção, da mais antiga para a mais recente. */
  dirs: DirEntry[];
  /** Bitmask do input do tick anterior, para detectar botões recém-apertados. */
  prev: number;
}

const HISTORY_SIZE = 16;

const STEP_DIRS: Record<MotionStep, readonly Dir[]> = {
  F: [3, 6, 9],
  B: [1, 4, 7],
  D: [1, 2, 3],
  U: [7, 8, 9],
  DF: [3],
  DB: [1],
};

export function createHistory(): InputHistory {
  return { dirs: [{ dir: 5, tick: -1000 }], prev: 0 };
}

export function toDir(input: PlayerInput, facing: 1 | -1): Dir {
  const forward = facing === 1 ? input.right : input.left;
  const back = facing === 1 ? input.left : input.right;
  const h = forward && !back ? 1 : back && !forward ? -1 : 0;
  const v = input.up && !input.down ? 1 : input.down && !input.up ? -1 : 0;
  return (5 + h + v * 3) as Dir;
}

/** Registra o input do tick e devolve os botões de ataque que acabaram de ser apertados. */
export function recordInput(
  history: InputHistory,
  input: PlayerInput,
  facing: 1 | -1,
  tick: number,
): AttackButton[] {
  const dir = toDir(input, facing);
  if (history.dirs[history.dirs.length - 1]?.dir !== dir) {
    history.dirs.push({ dir, tick });
    if (history.dirs.length > HISTORY_SIZE) history.dirs.shift();
  }
  const mask = encodeInput(input);
  const pressed = ATTACK_BUTTONS.filter(
    (button) => input[button] && !wasHeld(history.prev, button),
  );
  history.prev = mask;
  return pressed;
}

function wasHeld(prevMask: number, button: AttackButton): boolean {
  // Mesma ordem de bits de encodeInput: lp=4, hp=5, lk=6, hk=7.
  const bit = 4 + ATTACK_BUTTONS.indexOf(button);
  return (prevMask & (1 << bit)) !== 0;
}

/** Janela em ticks para completar um comando, cresce com o tamanho do comando. */
export function motionWindow(motion: readonly MotionStep[]): number {
  return 10 + motion.length * 7;
}

/**
 * Verifica se a sequência de direções foi feita recentemente (ex.: ↓ → para "D,F").
 * Procura de trás para frente nas mudanças de direção, aceitando direções intermediárias.
 */
export function matchMotion(
  history: InputHistory,
  motion: readonly MotionStep[],
  tick: number,
): boolean {
  const oldest = tick - motionWindow(motion);
  let index = history.dirs.length - 1;
  for (let step = motion.length - 1; step >= 0; step--) {
    const accepted = STEP_DIRS[motion[step]!];
    while (index >= 0 && !accepted.includes(history.dirs[index]!.dir)) index--;
    if (index < 0 || history.dirs[index]!.tick < oldest) return false;
    index--;
  }
  return true;
}
