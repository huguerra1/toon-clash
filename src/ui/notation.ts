import type { CharacterDef, MotionStep } from '../combat/types';
import type { AttackButton } from '../core/input';

const ARROWS: Record<MotionStep, string> = { F: '→', B: '←', D: '↓', U: '↑', DF: '↘', DB: '↙' };

export const BUTTON_NAMES: Record<AttackButton, string> = {
  lp: 'Soco Baixo',
  hp: 'Soco Alto',
  lk: 'Chute Baixo',
  hk: 'Chute Alto',
};

/** Ex.: "↓ → + Soco Baixo" (com o lutador olhando para a direita). */
export function notation(motion: readonly MotionStep[], button: AttackButton): string {
  return `${motion.map((s) => ARROWS[s]).join(' ')} + ${BUTTON_NAMES[button]}`;
}

export interface MoveLine {
  name: string;
  input: string;
}

export function moveList(def: CharacterDef): MoveLine[] {
  const lines: MoveLine[] = def.specials.map((s) => ({
    name: def.moves[s.move]!.name,
    input: `${s.air ? '(no ar) ' : ''}${notation(s.motion, s.button)}`,
  }));
  lines.push(
    { name: 'Arremesso', input: `→ + ${BUTTON_NAMES.lp} (de perto)` },
    { name: 'Gancho', input: `↓ + ${BUTTON_NAMES.hp}` },
    { name: 'Rasteira', input: `↓ + ${BUTTON_NAMES.hk}` },
    { name: 'Combo', input: `${BUTTON_NAMES.lp}, ${BUTTON_NAMES.lp}, ${BUTTON_NAMES.hp}` },
  );
  return lines;
}
