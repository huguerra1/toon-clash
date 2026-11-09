import type { Controls } from '../core/controls';
import { type Button, emptyInput } from '../core/input';

const ACTION_BUTTONS: { button: Button; label: string }[] = [
  { button: 'lp', label: 'SB' },
  { button: 'hp', label: 'SA' },
  { button: 'lk', label: 'CB' },
  { button: 'hk', label: 'CA' },
  { button: 'block', label: 'DEF' },
];

/** Direcional e botões na tela para celular/tablet (sempre jogador 1). */
export class TouchControls {
  readonly el = document.createElement('div');
  private readonly held = new Map<number, Button[]>();

  constructor(private readonly controls: Controls) {
    this.el.className = 'touch';
    this.el.innerHTML = `
      <div class="dpad"><div class="knob"></div></div>
      <div class="actions">${ACTION_BUTTONS.map(
        (b) => `<button data-button="${b.button}" class="act act-${b.button}">${b.label}</button>`,
      ).join('')}</div>
      <button class="pause-btn" aria-label="Pausa">II</button>`;

    const dpad = this.el.querySelector<HTMLElement>('.dpad')!;
    const knob = this.el.querySelector<HTMLElement>('.knob')!;
    const updatePad = (e: PointerEvent) => {
      const rect = dpad.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      const dead = rect.width * 0.15;
      const dirs: Button[] = [];
      if (dx < -dead) dirs.push('left');
      if (dx > dead) dirs.push('right');
      if (dy < -dead) dirs.push('up');
      if (dy > dead) dirs.push('down');
      this.held.set(e.pointerId, dirs);
      const max = rect.width / 3;
      const len = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, max / len);
      knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
      this.sync();
    };
    dpad.addEventListener('pointerdown', (e) => {
      capture(dpad, e);
      updatePad(e);
    });
    dpad.addEventListener('pointermove', (e) => {
      if (this.held.has(e.pointerId)) updatePad(e);
    });
    const releasePad = (e: PointerEvent) => {
      this.held.delete(e.pointerId);
      knob.style.transform = '';
      this.sync();
    };
    dpad.addEventListener('pointerup', releasePad);
    dpad.addEventListener('pointercancel', releasePad);

    for (const btn of this.el.querySelectorAll<HTMLElement>('.act')) {
      const button = btn.dataset.button as Button;
      btn.addEventListener('pointerdown', (e) => {
        capture(btn, e);
        btn.classList.add('down');
        this.held.set(e.pointerId, [button]);
        this.sync();
      });
      const release = (e: PointerEvent) => {
        btn.classList.remove('down');
        this.held.delete(e.pointerId);
        this.sync();
      };
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
    }

    this.el.querySelector('.pause-btn')!.addEventListener('pointerdown', () => {
      controls.touchMenu.add('pause');
      setTimeout(() => controls.touchMenu.delete('pause'), 120);
    });
  }

  private sync(): void {
    const input = emptyInput();
    for (const buttons of this.held.values()) for (const b of buttons) input[b] = true;
    this.controls.touch = input;
  }
}

/** Mantém o toque no botão mesmo se o dedo escorregar; ignora navegadores que recusam. */
function capture(el: HTMLElement, e: PointerEvent): void {
  try {
    el.setPointerCapture(e.pointerId);
  } catch {
    // Sem captura o botão ainda funciona, só solta se o dedo sair dele.
  }
}
