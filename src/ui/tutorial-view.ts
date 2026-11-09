import { LESSONS, type TutorialState } from '../game/tutorial';

/** Painel do tutorial: lição atual, explicação, teclas e barra de progresso. */
export class TutorialView {
  readonly el = document.createElement('div');
  private shown = '';

  constructor() {
    this.el.className = 'tutorial panel';
  }

  update(t: TutorialState): void {
    const lesson = LESSONS[t.lesson];
    if (!lesson) return;
    const done = t.doneFor !== null;
    const key = `${t.lesson}|${t.progress}|${done}`;
    if (key === this.shown) return;
    this.shown = key;
    const percent = Math.round((t.progress / lesson.goal) * 100);
    const counter = lesson.goal > 5 ? `${percent}%` : `${t.progress} / ${lesson.goal}`;
    this.el.classList.toggle('done', done);
    this.el.innerHTML = `
      <p class="step">Lição ${t.lesson + 1} de ${LESSONS.length}</p>
      <h3>${done ? 'Muito bem!' : lesson.title}</h3>
      <p>${lesson.text}</p>
      <p class="keys">${lesson.keys}</p>
      <div class="progress"><div style="width:${percent}%"></div></div>
      <p class="count">${counter}</p>`;
  }
}
