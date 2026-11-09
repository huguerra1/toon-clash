import { getCharacter } from '../characters/roster';
import type { GameEvent } from '../game/events';
import type { MatchState } from '../game/match';

interface Popup {
  el: HTMLElement;
  until: number;
}

/** Barras de vida, tempo, rounds, combos e o texto grande do locutor. */
export class Hud {
  readonly el = document.createElement('div');
  private readonly bars: HTMLElement[] = [];
  private readonly trails: HTMLElement[] = [];
  private readonly names: HTMLElement[] = [];
  private readonly forms: HTMLElement[] = [];
  private readonly medals: HTMLElement[] = [];
  private readonly combos: Popup[] = [];
  private readonly specials: Popup[] = [];
  private readonly timer: HTMLElement;
  private readonly announcer: HTMLElement;
  private readonly trailValue = [1, 1];
  private announceUntil = 0;
  private now = 0;
  private training = false;

  constructor() {
    this.el.className = 'hud';
    this.el.innerHTML = `
      <div class="hud-top">
        ${[0, 1]
          .map(
            (i) => `
          <div class="side side-${i}">
            <div class="name"></div>
            <div class="bar"><div class="trail"></div><div class="fill"></div></div>
            <div class="row"><div class="medals"></div><div class="form"></div></div>
            <div class="combo"></div>
            <div class="special"></div>
          </div>`,
          )
          .join('<div class="timer">99</div>')}
      </div>
      <div class="announcer"></div>`;
    for (const i of [0, 1]) {
      const side = this.el.querySelector(`.side-${i}`)!;
      this.names.push(side.querySelector('.name')!);
      this.bars.push(side.querySelector('.fill')!);
      this.trails.push(side.querySelector('.trail')!);
      this.medals.push(side.querySelector('.medals')!);
      this.forms.push(side.querySelector('.form')!);
      this.combos.push({ el: side.querySelector('.combo')!, until: 0 });
      this.specials.push({ el: side.querySelector('.special')!, until: 0 });
    }
    this.timer = this.el.querySelector('.timer')!;
    this.announcer = this.el.querySelector('.announcer')!;
  }

  setup(match: MatchState, labels: [string, string] = ['', '']): void {
    this.training = match.config.training === true;
    match.fighters.forEach((f, i) => {
      const name = getCharacter(f.character).name;
      this.names[i]!.innerHTML = `${name}${labels[i] ? ` <small>${labels[i]}</small>` : ''}`;
      this.trailValue[i] = 1;
    });
    this.announcer.className = 'announcer';
    this.announcer.textContent = '';
    this.announceUntil = 0;
  }

  handleEvents(events: readonly GameEvent[], match: MatchState): void {
    for (const e of events) {
      if (e.type === 'announce')
        this.announce(e.text, e.kind === 'winner' || e.kind === 'toonality' ? 150 : 80);
      if (e.type === 'hit' && e.combo >= 2) {
        const popup = this.combos[e.attacker]!;
        const f = match.fighters[1 - e.attacker]!;
        popup.el.innerHTML = `<b>${e.combo}</b> GOLPES<br><small>${f.comboDamage} de dano</small>`;
        popup.el.classList.remove('pop');
        void popup.el.offsetWidth;
        popup.el.classList.add('pop');
        popup.until = this.now + 90;
      }
      if (e.type === 'special') {
        const popup = this.specials[e.player]!;
        popup.el.textContent = e.name;
        popup.until = this.now + 70;
      }
      if (e.type === 'toonality') this.announce(e.name.toUpperCase(), 140);
    }
  }

  private announce(text: string, ticks: number): void {
    this.announcer.textContent = text;
    this.announcer.className = 'announcer';
    void this.announcer.offsetWidth;
    this.announcer.className = 'announcer show';
    this.announceUntil = this.now + ticks;
  }

  /** Atualiza os elementos a partir do estado (chamado a cada tick). */
  update(match: MatchState): void {
    this.now++;
    match.fighters.forEach((f, i) => {
      const def = getCharacter(f.character);
      const value = Math.max(0, f.health / def.maxHealth);
      this.bars[i]!.style.width = `${value * 100}%`;
      this.bars[i]!.classList.toggle('low', value < 0.25);
      // A barra vermelha desce devagar depois do dano.
      if (this.trailValue[i]! > value)
        this.trailValue[i] = Math.max(value, this.trailValue[i]! - 0.006);
      else this.trailValue[i] = value;
      this.trails[i]!.style.width = `${this.trailValue[i]! * 100}%`;
      const medals = Array.from(
        { length: match.config.roundsToWin },
        (_, k) => `<span class="${k < match.wins[i]! ? 'won' : ''}"></span>`,
      ).join('');
      if (this.medals[i]!.innerHTML !== medals) this.medals[i]!.innerHTML = medals;
      this.forms[i]!.textContent = def.forms ? `Forma: ${def.forms[f.form]!.name}` : '';
    });
    for (const popup of [...this.combos, ...this.specials]) {
      popup.el.classList.toggle('visible', this.now < popup.until);
    }
    this.timer.textContent = this.training ? '∞' : String(Math.ceil(match.timer / 60));
    if (this.now >= this.announceUntil) this.announcer.className = 'announcer';
  }
}
