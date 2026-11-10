import type { Button } from '../core/input';
import { DEFAULT_FIGHT_KEYS, type Keymap, keyLabel, keysFor } from '../core/keymap';

const BUTTON_MARKER = /\{(up|down|left|right|lp|hp|lk|hk|block)\}/g;

/** Nome legível da primeira tecla do botão para o jogador 1, ou "—" se estiver sem tecla. */
export function firstKeyLabel(keymap: Keymap, button: Button): string {
  const first = keysFor(keymap, 0, button)[0];
  return first !== undefined ? keyLabel(first) : '—';
}

/**
 * Troca marcadores `{lp}`, `{hp}`, `{up}` etc. pelo nome legível da tecla do jogador 1.
 * Se um botão tiver mais de uma tecla, usa a primeira na ordem do mapa; sem tecla, usa "—".
 */
export function formatKeyHints(text: string, keymap: Keymap = DEFAULT_FIGHT_KEYS): string {
  return text.replace(BUTTON_MARKER, (_, button: Button) => firstKeyLabel(keymap, button));
}
