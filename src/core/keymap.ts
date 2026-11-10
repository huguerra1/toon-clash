import type { Button } from './input';

/** Teclas de luta de um jogador: KeyboardEvent.code (posição física) → botão. */
export type PlayerKeys = Readonly<Record<string, Button>>;
/** Teclas de luta dos jogadores 1 e 2. */
export type Keymap = readonly [PlayerKeys, PlayerKeys];

export const KEYMAP_KEY = 'toon-clash:teclas';

/** Botões na ordem em que aparecem na tela de remapear. */
export const KEYMAP_BUTTONS: readonly Button[] = [
  'up',
  'down',
  'left',
  'right',
  'lp',
  'hp',
  'lk',
  'hk',
  'block',
];

/** Teclas padrão (KeyboardEvent.code = posição física, funciona em ABNT2). */
export const DEFAULT_FIGHT_KEYS: Keymap = [
  {
    KeyW: 'up',
    KeyS: 'down',
    KeyA: 'left',
    KeyD: 'right',
    KeyF: 'lp',
    KeyG: 'hp',
    KeyV: 'lk',
    KeyB: 'hk',
    Space: 'block',
  },
  {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    KeyK: 'lp',
    KeyL: 'hp',
    Comma: 'lk',
    Period: 'hk',
    KeyJ: 'block',
    Numpad4: 'lp',
    Numpad5: 'hp',
    Numpad1: 'lk',
    Numpad2: 'hk',
    Numpad0: 'block',
  },
];

/** Códigos de KeyboardEvent.code são só letras e dígitos (KeyF, Digit1, ArrowLeft…). */
export function isKeyCode(code: unknown): code is string {
  return typeof code === 'string' && /^[A-Za-z0-9]{1,32}$/.test(code);
}

function isButton(value: unknown): value is Button {
  return KEYMAP_BUTTONS.includes(value as Button);
}

/** Cópia nova das teclas padrão. */
export function resetKeymap(): Keymap {
  return [{ ...DEFAULT_FIGHT_KEYS[0] }, { ...DEFAULT_FIGHT_KEYS[1] }];
}

/** Botão acionado pela tecla para o jogador (ignora propriedades herdadas como "toString"). */
export function buttonFor(keymap: Keymap, player: 0 | 1, code: string): Button | undefined {
  const keys = keymap[player];
  return Object.hasOwn(keys, code) ? keys[code] : undefined;
}

/** Teclas que acionam o botão para o jogador, na ordem em que foram definidas. */
export function keysFor(keymap: Keymap, player: 0 | 1, button: Button): string[] {
  return Object.entries(keymap[player])
    .filter(([, b]) => b === button)
    .map(([code]) => code);
}

/** A tecla aciona algum botão de luta de algum jogador. */
export function isFightKey(keymap: Keymap, code: string): boolean {
  return Object.hasOwn(keymap[0], code) || Object.hasOwn(keymap[1], code);
}

/**
 * Novo keymap em que `code` passa a acionar `button` para `player`.
 * As teclas antigas desse botão (incluindo o atalho de Numpad) saem, e `code` deixa de acionar
 * qualquer outro botão dos dois jogadores. O keymap recebido não é alterado.
 */
export function rebind(keymap: Keymap, player: 0 | 1, button: Button, code: string): Keymap {
  if (!isKeyCode(code) || !isButton(button)) return [{ ...keymap[0] }, { ...keymap[1] }];
  const next: [Record<string, Button>, Record<string, Button>] = [{}, {}];
  for (const side of [0, 1] as const) {
    for (const [key, b] of Object.entries(keymap[side])) {
      if (key === code) continue;
      if (side === player && b === button) continue;
      next[side][key] = b;
    }
  }
  next[player][code] = button;
  return next;
}

/** Lê e valida um keymap salvo; qualquer problema devolve null. */
function parseKeymap(saved: unknown): Keymap | null {
  if (!Array.isArray(saved) || saved.length !== 2) return null;
  const next: [Record<string, Button>, Record<string, Button>] = [{}, {}];
  const seen = new Set<string>();
  for (const side of [0, 1] as const) {
    const keys: unknown = saved[side];
    if (typeof keys !== 'object' || keys === null || Array.isArray(keys)) return null;
    for (const [code, button] of Object.entries(keys)) {
      if (!isKeyCode(code) || !isButton(button) || seen.has(code)) return null;
      seen.add(code);
      next[side][code] = button;
    }
  }
  return next;
}

/** Lê as teclas salvas; JSON inválido ou formato errado volta ao padrão. */
export function loadKeymap(): Keymap {
  try {
    const raw = globalThis.localStorage?.getItem(KEYMAP_KEY) ?? null;
    if (raw === null) return resetKeymap();
    return parseKeymap(JSON.parse(raw)) ?? resetKeymap();
  } catch {
    return resetKeymap();
  }
}

export function saveKeymap(keymap: Keymap): void {
  try {
    globalThis.localStorage?.setItem(KEYMAP_KEY, JSON.stringify(keymap));
  } catch {
    /* Armazenamento bloqueado não deve interromper o jogo. */
  }
}

const KEY_NAMES: Readonly<Record<string, string>> = {
  ArrowUp: 'Seta cima',
  ArrowDown: 'Seta baixo',
  ArrowLeft: 'Seta esquerda',
  ArrowRight: 'Seta direita',
  Space: 'Espaço',
  Enter: 'Enter',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Escape: 'Esc',
  CapsLock: 'Caps Lock',
  ShiftLeft: 'Shift esq.',
  ShiftRight: 'Shift dir.',
  ControlLeft: 'Ctrl esq.',
  ControlRight: 'Ctrl dir.',
  AltLeft: 'Alt',
  AltRight: 'AltGr',
  MetaLeft: 'Win esq.',
  MetaRight: 'Win dir.',
  ContextMenu: 'Menu',
  Insert: 'Insert',
  Delete: 'Delete',
  Home: 'Home',
  End: 'End',
  PageUp: 'Page Up',
  PageDown: 'Page Down',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Semicolon: ';',
  Quote: "'",
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  IntlBackslash: '\\',
  IntlRo: '/',
  Minus: '-',
  Equal: '=',
  Backquote: '`',
  NumpadAdd: 'Num +',
  NumpadSubtract: 'Num -',
  NumpadMultiply: 'Num *',
  NumpadDivide: 'Num /',
  NumpadDecimal: 'Num ,',
  NumpadComma: 'Num ,',
  NumpadEnter: 'Num Enter',
};

/** Nome legível da tecla (KeyF → "F", ArrowLeft → "Seta esquerda", Numpad4 → "Num 4"). */
export function keyLabel(code: string): string {
  if (Object.hasOwn(KEY_NAMES, code)) return KEY_NAMES[code]!;
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter) return letter[1]!;
  const digit = /^Digit([0-9])$/.exec(code);
  if (digit) return digit[1]!;
  const numpad = /^Numpad([0-9])$/.exec(code);
  if (numpad) return `Num ${numpad[1]}`;
  return code;
}

/** Teclas do botão para o jogador, ex.: "K ou Num 4"; "—" se o botão ficou sem tecla. */
export function keysLabel(keymap: Keymap, player: 0 | 1, button: Button): string {
  const codes = keysFor(keymap, player, button);
  return codes.length > 0 ? codes.map(keyLabel).join(' ou ') : '—';
}
