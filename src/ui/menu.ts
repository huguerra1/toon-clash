import type { MenuEvent } from '../core/controls';

export interface MenuItem {
  label: string | (() => string);
  hint?: string;
  action?: () => void;
  /** Para opções com valor (volume, nível…): setas esquerda/direita. */
  left?: () => void;
  right?: () => void;
  disabled?: boolean;
}

export interface MenuSounds {
  move(): void;
  confirm(): void;
  back(): void;
}

/** Lista navegável por teclado, controle, mouse e toque. */
export class Menu {
  index = 0;
  readonly el = document.createElement('div');

  constructor(
    title: string,
    private readonly items: MenuItem[],
    private readonly sounds: MenuSounds,
    private readonly onBack?: () => void,
    subtitle = '',
  ) {
    this.el.className = 'menu panel';
    this.el.innerHTML = `<h2>${title}</h2>${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}<ul></ul>`;
    this.index = Math.max(
      0,
      items.findIndex((i) => !i.disabled),
    );
    this.render();
  }

  /** Processa um evento de menu; devolve true se tratou. */
  handle(e: MenuEvent): boolean {
    const item = this.items[this.index];
    switch (e.action) {
      case 'up':
        this.move(-1);
        return true;
      case 'down':
        this.move(1);
        return true;
      case 'left':
        if (item?.left) {
          item.left();
          this.sounds.move();
          this.render();
        }
        return true;
      case 'right':
        if (item?.right) {
          item.right();
          this.sounds.move();
          this.render();
        }
        return true;
      case 'confirm':
        if (item && !item.disabled) {
          if (item.action) {
            this.sounds.confirm();
            item.action();
          } else if (item.right) {
            item.right();
            this.sounds.move();
          }
          this.render();
        }
        return true;
      case 'back':
      case 'pause':
        if (this.onBack) {
          this.sounds.back();
          this.onBack();
        }
        return true;
    }
  }

  private move(delta: number): void {
    const n = this.items.length;
    for (let step = 1; step <= n; step++) {
      const next = (this.index + delta * step + n * n) % n;
      if (!this.items[next]!.disabled) {
        this.index = next;
        break;
      }
    }
    this.sounds.move();
    this.render();
  }

  render(): void {
    const list = this.el.querySelector('ul')!;
    list.innerHTML = '';
    this.items.forEach((item, i) => {
      const li = document.createElement('li');
      const label = typeof item.label === 'function' ? item.label() : item.label;
      const arrows = item.left || item.right;
      li.innerHTML = arrows
        ? `<span class="arrow">‹</span>${label}<span class="arrow">›</span>`
        : label;
      if (item.hint && i === this.index) li.innerHTML += `<small>${item.hint}</small>`;
      li.className = [i === this.index ? 'selected' : '', item.disabled ? 'disabled' : ''].join(
        ' ',
      );
      li.addEventListener('click', (ev) => {
        if (item.disabled) return;
        const target = ev.target as HTMLElement;
        this.index = i;
        if (target.classList.contains('arrow')) {
          const leftArrow = target === li.firstElementChild;
          (leftArrow ? item.left : item.right)?.();
          this.sounds.move();
          this.render();
          return;
        }
        this.handle({ player: 0, action: 'confirm' });
      });
      list.appendChild(li);
    });
  }
}
