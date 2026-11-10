import type { Controls, MenuEvent } from '../core/controls';
import type { Button } from '../core/input';
import {
  KEYMAP_BUTTONS,
  type Keymap,
  isKeyCode,
  keysLabel,
  rebind,
  resetKeymap,
  saveKeymap,
} from '../core/keymap';
import type { MenuSounds } from './menu';
import { BUTTON_NAMES } from './notation';

/** Nomes dos botões na tela de remapear. */
export const REMAP_LABELS: Record<Button, string> = {
  up: 'Cima',
  down: 'Baixo',
  left: 'Esquerda',
  right: 'Direita',
  ...BUTTON_NAMES,
  block: 'Defesa',
};

const RESET_ROW = KEYMAP_BUTTONS.length;
const BACK_ROW = RESET_ROW + 1;
const ROWS = BACK_ROW + 1;
const WAITING_TEXT = 'Aperte a nova tecla...';
const HELP_TEXT =
  'Setas/WASD escolhem · ENTER troca a tecla · ESC volta. Cada tecla aciona um botão só.';

/**
 * Tabela com as teclas de luta dos dois jogadores. Escolher uma célula espera a próxima tecla
 * (ESC cancela), aplica na hora e salva no navegador.
 */
export class RemapView {
  readonly el = document.createElement('div');
  private row = 0;
  private col: 0 | 1 = 0;
  /** Cancela a espera da tecla; null quando não está esperando. */
  private cancelCapture: (() => void) | null = null;

  constructor(
    private readonly controls: Controls,
    private readonly sounds: MenuSounds,
    private readonly onBack: () => void,
  ) {
    this.el.className = 'panel controls remap';
    this.render();
  }

  get waiting(): boolean {
    return this.cancelCapture !== null;
  }

  handle(e: MenuEvent): void {
    if (this.waiting) {
      // Teclas do teclado são capturadas antes; aqui só chegam controle e toque.
      if (e.action === 'back' || e.action === 'pause') {
        this.stopWaiting();
        this.sounds.back();
        this.render();
      }
      return;
    }
    switch (e.action) {
      case 'up':
      case 'down':
        this.row = (this.row + (e.action === 'up' ? ROWS - 1 : 1)) % ROWS;
        break;
      case 'left':
      case 'right':
        if (this.row >= RESET_ROW) return;
        this.col = this.col === 0 ? 1 : 0;
        break;
      case 'confirm':
        this.choose();
        return;
      case 'back':
      case 'pause':
        this.leave();
        return;
    }
    this.sounds.move();
    this.render();
  }

  private choose(): void {
    if (this.row === RESET_ROW) {
      this.apply(resetKeymap());
      this.sounds.confirm();
      this.render();
    } else if (this.row === BACK_ROW) {
      this.leave();
    } else {
      this.sounds.confirm();
      this.startWaiting();
    }
  }

  private startWaiting(): void {
    this.stopWaiting();
    const player = this.col;
    const button = KEYMAP_BUTTONS[this.row]!;
    const cancel = this.controls.captureKey((code) => {
      this.cancelCapture = null;
      if (code === 'Escape') {
        this.sounds.back();
      } else if (isKeyCode(code)) {
        this.apply(rebind(this.controls.keymap, player, button, code));
        this.sounds.confirm();
      } else {
        // Tecla sem código conhecido (ex.: alguns teclados virtuais): continua esperando.
        this.startWaiting();
        return;
      }
      this.render();
    });
    this.cancelCapture = cancel;
    this.render();
  }

  private stopWaiting(): void {
    this.cancelCapture?.();
    this.cancelCapture = null;
  }

  private apply(keymap: Keymap): void {
    this.controls.setKeymap(keymap);
    saveKeymap(keymap);
  }

  private leave(): void {
    this.stopWaiting();
    this.sounds.back();
    this.onBack();
  }

  render(): void {
    const keymap = this.controls.keymap;
    this.el.innerHTML = `<h2>Remapear teclas</h2>
      <table>
        <thead><tr><th></th><th>Jogador 1</th><th>Jogador 2</th></tr></thead>
        <tbody></tbody>
      </table>
      <ul class="remap-actions"></ul>
      <p class="help"></p>`;

    const body = this.el.querySelector('tbody')!;
    KEYMAP_BUTTONS.forEach((button, row) => {
      const tr = document.createElement('tr');
      const name = document.createElement('td');
      name.textContent = REMAP_LABELS[button];
      tr.appendChild(name);
      for (const player of [0, 1] as const) {
        const td = document.createElement('td');
        const selected = this.row === row && this.col === player;
        const waiting = selected && this.waiting;
        td.className = 'key';
        td.classList.toggle('selected', selected);
        td.classList.toggle('waiting', waiting);
        td.textContent = waiting ? WAITING_TEXT : keysLabel(keymap, player, button);
        td.addEventListener('click', () => {
          this.row = row;
          this.col = player;
          this.sounds.confirm();
          this.startWaiting();
        });
        tr.appendChild(td);
      }
      body.appendChild(tr);
    });

    const actions = this.el.querySelector('ul')!;
    (['Restaurar padrão', 'Voltar'] as const).forEach((label, i) => {
      const row = RESET_ROW + i;
      const li = document.createElement('li');
      li.textContent = label;
      li.className = this.row === row ? 'selected' : '';
      li.addEventListener('click', () => {
        this.stopWaiting();
        this.row = row;
        this.choose();
      });
      actions.appendChild(li);
    });

    this.el.querySelector('.help')!.textContent = this.waiting
      ? `${WAITING_TEXT} ESC cancela.`
      : HELP_TEXT;
  }
}
