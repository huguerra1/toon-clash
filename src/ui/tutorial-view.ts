import { DEFAULT_FIGHT_KEYS, type Keymap } from '../core/keymap';
import { LESSONS, type TutorialState } from '../game/tutorial';
import { formatKeyHints } from './key-hints';

/** Painel do tutorial: lição atual, explicação, teclas e barra de progresso. */
export class TutorialView {
  readonly el = document.createElement('div');
  private shown = '';

  constructor() {
    this.el.className = 'tutorial panel';
  }

  update(t: TutorialState, keymap: Keymap = DEFAULT_FIGHT_KEYS): void {
    const lesson = LESSONS[t.lesson];
    if (!lesson) return;
    const done = t.doneFor !== null;
    const keys = formatKeyHints(lesson.keys, keymap);
    const key = `${t.lesson}|${t.progress}|${done}|${keys}`;
    if (key === this.shown) return;
    this.shown = key;
    const percent = Math.round((t.progress / lesson.goal) * 100);
    const counter = lesson.goal > 5 ? `${percent}%` : `${t.progress} / ${lesson.goal}`;
    this.el.classList.toggle('done', done);
    this.el.innerHTML = `
      <p class="step">Lição ${t.lesson + 1} de ${LESSONS.length}</p>
      <h3>${done ? 'Muito bem!' : lesson.title}</h3>
      <p>${formatKeyHints(lesson.text, keymap)}</p>
      <p class="keys">${keys}</p>
      <div class="progress"><div style="width:${percent}%"></div></div>
      <p class="count">${counter}</p>`;
  }
}
