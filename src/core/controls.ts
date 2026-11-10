import { type Button, type PlayerInput, emptyInput, mergeInputs } from './input';
import { type Keymap, buttonFor, isFightKey, loadKeymap } from './keymap';

export type MenuAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back' | 'pause';

export interface MenuEvent {
  player: 0 | 1;
  action: MenuAction;
}

const MENU_KEYS: [Record<string, MenuAction>, Record<string, MenuAction>] = [
  {
    KeyW: 'up',
    KeyS: 'down',
    KeyA: 'left',
    KeyD: 'right',
    KeyF: 'confirm',
    Enter: 'confirm',
    Space: 'confirm',
    KeyV: 'back',
    Backspace: 'back',
    Escape: 'pause',
    KeyP: 'pause',
  },
  {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    KeyK: 'confirm',
    NumpadEnter: 'confirm',
    KeyL: 'back',
    NumpadDecimal: 'back',
  },
];

// Mapeamento "standard" da Gamepad API (Xbox: A=0 B=1 X=2 Y=3, LB=4 RB=5 LT=6 RT=7, Start=9).
const PAD_BUTTONS: Partial<Record<number, Button>> = {
  2: 'lp',
  3: 'hp',
  0: 'lk',
  1: 'hk',
  4: 'block',
  5: 'block',
  6: 'block',
  7: 'block',
  12: 'up',
  13: 'down',
  14: 'left',
  15: 'right',
};
const PAD_MENU: Partial<Record<number, MenuAction>> = {
  0: 'confirm',
  1: 'back',
  9: 'pause',
  12: 'up',
  13: 'down',
  14: 'left',
  15: 'right',
};
const STICK_DEADZONE = 0.5;
const MENU_ACTIONS: readonly MenuAction[] = [
  'up',
  'down',
  'left',
  'right',
  'confirm',
  'back',
  'pause',
];

/**
 * Junta teclado, controles e toque em inputs por jogador.
 * O jogo lê `read(jogador)` a cada tick; os menus leem `pollMenu()` (só bordas de apertar).
 */
export class Controls {
  private readonly keys = new Set<string>();
  private readonly prevMenu: [Set<MenuAction>, Set<MenuAction>] = [new Set(), new Set()];
  private fightKeys: Keymap;
  /** Quem espera a próxima tecla apertada (tela de remapear). */
  private capture: ((code: string) => void) | null = null;
  /** Input do controle de toque na tela (sempre jogador 1). */
  touch: PlayerInput = emptyInput();
  touchMenu = new Set<MenuAction>();

  constructor(target: Window = window, keymap: Keymap = loadKeymap()) {
    this.fightKeys = keymap;
    target.addEventListener('keydown', (e) => {
      if (isTyping(e)) return;
      if (this.capture) {
        e.preventDefault();
        if (e.repeat) return;
        const onKey = this.capture;
        this.capture = null;
        this.keys.add(e.code);
        // A tecla capturada não deve virar comando de menu no próximo tick.
        this.syncMenu();
        onKey(e.code);
        return;
      }
      if (this.isMapped(e.code)) e.preventDefault();
      this.keys.add(e.code);
    });
    target.addEventListener('keyup', (e) => this.keys.delete(e.code));
    target.addEventListener('blur', () => this.keys.clear());
  }

  /** Teclas de luta em uso. */
  get keymap(): Keymap {
    return this.fightKeys;
  }

  /** Troca as teclas de luta na hora (não salva; veja saveKeymap). */
  setKeymap(keymap: Keymap): void {
    this.fightKeys = keymap;
  }

  /**
   * Entrega o código da próxima tecla apertada a `onKey`, sem repassá-la ao jogo nem aos menus.
   * Devolve uma função que cancela a espera.
   */
  captureKey(onKey: (code: string) => void): () => void {
    this.capture = onKey;
    return () => {
      if (this.capture === onKey) this.capture = null;
    };
  }

  /** Input de luta do jogador neste tick. */
  read(player: 0 | 1): PlayerInput {
    const input = emptyInput();
    for (const code of this.keys) {
      const button = buttonFor(this.fightKeys, player, code);
      if (button) input[button] = true;
    }
    const pad = this.padInput(player);
    const merged = mergeInputs(input, pad);
    return player === 0 ? mergeInputs(merged, this.touch) : merged;
  }

  /** Ações de menu recém-apertadas desde a última chamada. */
  pollMenu(): MenuEvent[] {
    const events: MenuEvent[] = [];
    for (const player of [0, 1] as const) {
      const now = this.menuState(player);
      for (const action of MENU_ACTIONS) {
        if (now.has(action) && !this.prevMenu[player].has(action)) events.push({ player, action });
      }
      this.prevMenu[player] = now;
    }
    return events;
  }

  /** Esquece botões segurados (ex.: ao trocar de tela, para não "vazar" um confirmar). */
  syncMenu(): void {
    for (const player of [0, 1] as const) this.prevMenu[player] = this.menuState(player);
  }

  isKeyDown(code: string): boolean {
    return this.keys.has(code);
  }

  /** Tecla usada pelo jogo: o navegador não deve rolar a página nem fazer outra ação. */
  private isMapped(code: string): boolean {
    return isFightKey(this.fightKeys, code) || MENU_KEYS.some((map) => Object.hasOwn(map, code));
  }

  private menuState(player: 0 | 1): Set<MenuAction> {
    const state = new Set<MenuAction>();
    const map = MENU_KEYS[player];
    for (const code of this.keys) {
      const action = map[code];
      if (action) state.add(action);
    }
    const pad = getPad(player);
    if (pad) {
      pad.buttons.forEach((b, index) => {
        const action = PAD_MENU[index];
        if (action && b.pressed) state.add(action);
      });
      const [x = 0, y = 0] = pad.axes;
      if (x < -STICK_DEADZONE) state.add('left');
      if (x > STICK_DEADZONE) state.add('right');
      if (y < -STICK_DEADZONE) state.add('up');
      if (y > STICK_DEADZONE) state.add('down');
    }
    if (player === 0) for (const action of this.touchMenu) state.add(action);
    return state;
  }

  private padInput(player: 0 | 1): PlayerInput {
    const input = emptyInput();
    const pad = getPad(player);
    if (!pad) return input;
    pad.buttons.forEach((b, index) => {
      const button = PAD_BUTTONS[index];
      if (button && b.pressed) input[button] = true;
    });
    const [x = 0, y = 0] = pad.axes;
    if (x < -STICK_DEADZONE) input.left = true;
    if (x > STICK_DEADZONE) input.right = true;
    if (y < -STICK_DEADZONE) input.up = true;
    if (y > STICK_DEADZONE) input.down = true;
    return input;
  }
}

function getPad(player: 0 | 1): Gamepad | null {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
  const pads = [...navigator.getGamepads()].filter((p): p is Gamepad => p !== null && p.connected);
  return pads[player] ?? null;
}

function isTyping(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}
