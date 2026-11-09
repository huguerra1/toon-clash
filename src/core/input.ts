/** Estado dos botões de um jogador em um tick (estilo Mortal Kombat: 4 ataques + defesa). */
export interface PlayerInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  /** Soco baixo */
  lp: boolean;
  /** Soco alto */
  hp: boolean;
  /** Chute baixo */
  lk: boolean;
  /** Chute alto */
  hk: boolean;
  block: boolean;
}

export type Button = keyof PlayerInput;
export const ATTACK_BUTTONS = ['lp', 'hp', 'lk', 'hk'] as const;
export type AttackButton = (typeof ATTACK_BUTTONS)[number];

/** Ordem fixa dos bits — usada para comparar inputs e mandar pela rede. */
const BITS: readonly Button[] = ['up', 'down', 'left', 'right', 'lp', 'hp', 'lk', 'hk', 'block'];

export function emptyInput(): PlayerInput {
  return decodeInput(0);
}

export function encodeInput(input: PlayerInput): number {
  let mask = 0;
  BITS.forEach((button, bit) => {
    if (input[button]) mask |= 1 << bit;
  });
  return mask;
}

export function decodeInput(mask: number): PlayerInput {
  const input = {} as PlayerInput;
  BITS.forEach((button, bit) => {
    input[button] = (mask & (1 << bit)) !== 0;
  });
  return input;
}

/** Junta dois inputs (ex.: teclado + controle do mesmo jogador). */
export function mergeInputs(a: PlayerInput, b: PlayerInput): PlayerInput {
  return decodeInput(encodeInput(a) | encodeInput(b));
}
