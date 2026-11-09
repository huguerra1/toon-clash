/** Estado dos botões de um jogador em um tick. */
export interface PlayerInput {
  left: boolean;
  right: boolean;
}

const EMPTY: PlayerInput = { left: false, right: false };

/** Mapeamento provisório do teclado (o buffer de comandos especiais vem na etapa M2). */
const KEYMAP: Record<string, [player: 0 | 1, button: keyof PlayerInput]> = {
  KeyA: [0, 'left'],
  KeyD: [0, 'right'],
  ArrowLeft: [1, 'left'],
  ArrowRight: [1, 'right'],
};

export class Keyboard {
  private readonly pressed = new Set<string>();

  constructor(target: Window = window) {
    target.addEventListener('keydown', (e) => {
      if (e.code in KEYMAP) e.preventDefault();
      this.pressed.add(e.code);
    });
    target.addEventListener('keyup', (e) => this.pressed.delete(e.code));
    // Evita tecla "presa" quando a janela perde o foco.
    target.addEventListener('blur', () => this.pressed.clear());
  }

  /** Lê o estado dos dois jogadores neste tick. */
  read(): [PlayerInput, PlayerInput] {
    const inputs: [PlayerInput, PlayerInput] = [{ ...EMPTY }, { ...EMPTY }];
    for (const code of this.pressed) {
      const mapping = KEYMAP[code];
      if (mapping) inputs[mapping[0]][mapping[1]] = true;
    }
    return inputs;
  }
}
