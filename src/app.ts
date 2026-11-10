import {
  CPU_LEVELS,
  type CpuBrain,
  type CpuLevel,
  DUMMY_MODES,
  type DummyMode,
  createCpu,
  cpuInput,
  dummyInput,
} from './ai/cpu';
import type { AudioSystem } from './audio/audio';
import { getLook } from './characters/looks';
import { STARTING_ROSTER, getCharacter } from './characters/roster';
import type { CharacterId } from './combat/types';
import type { Controls, MenuEvent } from './core/controls';
import { type Button, type PlayerInput, emptyInput, mergeInputs } from './core/input';
import { keysLabel } from './core/keymap';
import type { GameEvent } from './game/events';
import { type MatchState, createMatch, defaultConfig, stepMatch } from './game/match';
import {
  LESSONS,
  createTutorial,
  skipLesson,
  tutorialDummyInput,
  updateTutorial,
} from './game/tutorial';
import type { GameRenderer } from './render/scene';
import { STAGES, type StageId } from './render/stages';
import { Hud } from './ui/hud';
import { FLASH_OPTIONS, SCREEN_SHAKE_OPTIONS, cycleOption } from './ui/accessibility';
import { Menu, type MenuItem } from './ui/menu';
import { fighterPortrait } from './render/portraits';
import { BUTTON_NAMES, moveList } from './ui/notation';
import { RemapView } from './ui/remap-view';
import { TutorialView } from './ui/tutorial-view';

export type Mode = 'arcade' | 'versus' | 'cpu' | 'training' | 'tutorial' | 'online';

/** Quem controla cada lado da luta. */
export type InputSource =
  | { kind: 'local'; player: 0 | 1 | 'both' }
  | { kind: 'cpu'; brain: CpuBrain }
  | { kind: 'dummy' }
  | { kind: 'script'; input: (match: MatchState) => PlayerInput }
  | { kind: 'remote' };

/** O que o módulo online fornece para a partida. */
export interface OnlineHooks {
  labels: [string, string];
  /** Chamado quando a luta (re)começa, com o estado inicial idêntico nos dois lados. */
  start(initial: MatchState): void;
  /** Avança a luta online um tick (inputs, rede e rollback). */
  tick(): void;
  /** Opções da tela de resultado (revanche, sair). */
  resultItems(): MenuItem[];
}

export interface Screen {
  el: HTMLElement;
  handle?(e: MenuEvent): void;
  tick?(): void;
  /** Esconde a interface e mostra o HUD (tela de luta). */
  fight?: boolean;
}

interface Session {
  mode: Mode;
  characters: [CharacterId, CharacterId];
  stage: StageId;
  sources: [InputSource, InputSource];
  level: CpuLevel;
  ladder?: { opponents: CharacterId[]; index: number };
}

/** Autor do jogo, mostrado no rodapé das telas e nos créditos. */
export const AUTHOR = 'Hugo Mourao';

const UNLOCK_KEY = 'toon-clash:zhaar-liberado';
const RESULTS_DELAY = 200;

function readUnlock(): boolean {
  try {
    return localStorage.getItem(UNLOCK_KEY) === 'sim';
  } catch {
    return false;
  }
}

function saveUnlock(): void {
  try {
    localStorage.setItem(UNLOCK_KEY, 'sim');
  } catch {
    // Sem armazenamento: o chefe só fica liberado nesta sessão.
  }
}

function html(tag: string, className: string, inner = ''): HTMLElement {
  const el = document.createElement(tag);
  el.className = className;
  el.innerHTML = inner;
  return el;
}

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/** Fluxo do jogo: telas, partida, arcade e treino. */
export class App {
  match: MatchState;
  session: Session | null = null;
  readonly hud = new Hud();
  private screen: Screen | null = null;
  /** Algo aberto por cima da luta (pausa, lista de golpes) que recebe os comandos de menu. */
  private paused: { handle(e: MenuEvent): unknown } | null = null;
  private dummy: DummyMode = 'parado';
  private zhaarUnlocked = readUnlock();
  private tickCount = 0;
  /** Tela de entrada do modo online (lobby), registrada pelo módulo de rede. */
  onlineScreen: ((app: App) => Screen) | null = null;
  /** Partida online em andamento. */
  online: OnlineHooks | null = null;

  constructor(
    private readonly root: HTMLElement,
    readonly renderer: GameRenderer,
    readonly controls: Controls,
    readonly audio: AudioSystem,
  ) {
    root.appendChild(this.hud.el);
    root.appendChild(html('div', 'signature', `Criado por <b>${AUTHOR}</b>`));
    this.match = this.showcase(['kai', 'solara'], 'rooftop');
    this.show(this.titleScreen());
  }

  readonly sounds = {
    move: () => this.audio.ui('move'),
    confirm: () => this.audio.ui('confirm'),
    back: () => this.audio.ui('back'),
  };

  get roster(): CharacterId[] {
    return this.zhaarUnlocked ? [...STARTING_ROSTER, 'zhaar'] : STARTING_ROSTER;
  }

  show(screen: Screen): void {
    this.screen?.el.remove();
    this.screen = screen;
    this.root.appendChild(screen.el);
    this.root.classList.toggle('fighting', screen.fight === true);
    this.controls.syncMenu();
  }

  /** Partida parada só para mostrar os lutadores ao fundo dos menus. */
  showcase(characters: [CharacterId, CharacterId], stage: StageId): MatchState {
    this.renderer.load(characters, stage);
    const m = createMatch(defaultConfig(characters));
    m.events = [];
    return m;
  }

  update(): void {
    this.tickCount++;
    const events = this.controls.pollMenu();
    if (this.paused) {
      // A pausa pode fechar no meio da lista (ex.: os dois jogadores confirmam juntos).
      for (const e of events) {
        if (!this.paused) break;
        this.paused.handle(e);
      }
      return;
    }
    const screen = this.screen;
    for (const e of events) {
      // Se um evento trocou de tela, os seguintes não vão para a tela nova.
      if (this.screen !== screen || this.paused) break;
      screen?.handle?.(e);
    }
    this.screen?.tick?.();
  }

  render(dt: number): void {
    this.renderer.render(this.match, dt);
  }

  // -------------------------------------------------------------------------
  // Telas
  // -------------------------------------------------------------------------

  titleScreen(): Screen {
    this.audio.playMusic('menu');
    const el = html(
      'div',
      'screen title-screen',
      `<h1 class="logo"><span class="w1">TOON</span><br><span class="w2">CLASH</span></h1>
       <p class="tagline">Lutadores originais inspirados nos desenhos dos anos 2000</p>
       <p class="blink">Aperte ENTER ou toque para começar</p>`,
    );
    el.addEventListener('click', () => this.show(this.mainMenu()));
    return {
      el,
      handle: (e) => {
        if (e.action === 'confirm' || e.action === 'pause') {
          this.sounds.confirm();
          this.show(this.mainMenu());
        }
      },
    };
  }

  mainMenu(): Screen {
    this.audio.playMusic('menu');
    this.match = this.showcase(['kai', 'solara'], 'rooftop');
    const items: MenuItem[] = [
      {
        label: 'Tutorial',
        hint: 'Aprenda a jogar em poucos minutos',
        action: () => this.startTutorial(),
      },
      {
        label: 'Arcade',
        hint: '1 jogador contra todos, até o chefe',
        action: () => this.show(this.levelMenu('arcade')),
      },
      {
        label: 'Versus',
        hint: '2 jogadores no mesmo computador',
        action: () => this.show(this.selectScreen('versus')),
      },
      {
        label: 'Contra a CPU',
        hint: 'Escolha o oponente e a dificuldade',
        action: () => this.show(this.levelMenu('cpu')),
      },
      {
        label: 'Treino',
        hint: 'Sem tempo, sem nocaute, boneco configurável',
        action: () => this.show(this.selectScreen('training')),
      },
      {
        label: 'Online',
        hint: this.onlineScreen ? 'Jogue com um amigo pela internet' : 'Em breve',
        disabled: !this.onlineScreen,
        action: () => this.onlineScreen && this.show(this.onlineScreen(this)),
      },
      { label: 'Controles', action: () => this.show(this.controlsScreen()) },
      { label: 'Opções', action: () => this.show(this.optionsScreen()) },
    ];
    const menu = new Menu('Menu principal', items, this.sounds, () =>
      this.show(this.titleScreen()),
    );
    const el = html('div', 'screen');
    el.appendChild(menu.el);
    return { el, handle: (e) => menu.handle(e) };
  }

  levelMenu(mode: 'arcade' | 'cpu'): Screen {
    const items: MenuItem[] = CPU_LEVELS.map((l) => ({
      label: l.name,
      action: () => this.show(this.selectScreen(mode, l.id)),
    }));
    const menu = new Menu('Dificuldade', items, this.sounds, () => this.show(this.mainMenu()));
    menu.index = 1;
    menu.render();
    const el = html('div', 'screen');
    el.appendChild(menu.el);
    return { el, handle: (e) => menu.handle(e) };
  }

  selectScreen(
    mode: Mode,
    level: CpuLevel = 'medio',
    onDone?: (chars: [CharacterId, CharacterId]) => void,
    /** Chamado ao sair da seleção sem escolher (padrão: volta ao menu). */
    onCancel: () => void = () => this.show(this.mainMenu()),
  ): Screen {
    this.audio.playMusic('menu');
    const roster = this.roster;
    const cursor: [number, number] = [0, Math.min(1, roster.length - 1)];
    const locked: [boolean, boolean] = [false, false];
    const twoPlayers = mode === 'versus';
    const pickOpponent = mode === 'cpu' || mode === 'training';
    const single = mode === 'arcade' || mode === 'online';
    const title =
      mode === 'arcade'
        ? 'Arcade — escolha seu lutador'
        : mode === 'online'
          ? 'Online — escolha seu lutador'
          : 'Escolha os lutadores';

    const el = html(
      'div',
      'screen select-screen',
      `<h2>${title}</h2>
       <div class="select-body">
         <div class="info info-0"></div>
         <div class="grid"></div>
         <div class="info info-1"></div>
       </div>
       <p class="help">${twoPlayers ? 'Jogador 1: WASD + F · Jogador 2: setas + K' : 'Setas/WASD para escolher · ENTER para confirmar · ESC volta'}</p>`,
    );
    const grid = el.querySelector('.grid')!;
    const infos = [el.querySelector('.info-0')!, el.querySelector('.info-1')!];

    const cards = roster.map((id, i) => {
      const def = getCharacter(id);
      const look = getLook(id);
      const card = html(
        'button',
        'card',
        `<div class="portrait" style="--glow:${hex(look.glow)};--top:${hex(look.top)}"><img src="${fighterPortrait(id)}" alt="" draggable="false" /></div>
         <span>${def.name}</span><i class="tag tag-0">1P</i><i class="tag tag-1">${twoPlayers ? '2P' : 'CPU'}</i>`,
      );
      card.addEventListener('click', () => {
        const side = !single && locked[0] && !twoPlayers ? 1 : 0;
        cursor[side] = i;
        confirm(side);
      });
      grid.appendChild(card);
      return card;
    });

    const activeSide = (player: 0 | 1): 0 | 1 => {
      if (twoPlayers) return player;
      return locked[0] && pickOpponent ? 1 : 0;
    };

    const refresh = () => {
      cards.forEach((card, i) => {
        card.classList.toggle('on-0', cursor[0] === i);
        card.classList.toggle('on-1', !single && cursor[1] === i && (twoPlayers || locked[0]));
        card.classList.toggle('locked-0', locked[0] && cursor[0] === i);
        card.classList.toggle('locked-1', locked[1] && cursor[1] === i);
      });
      for (const side of [0, 1] as const) {
        const show = side === 0 || twoPlayers || (pickOpponent && locked[0]);
        if (!show) {
          infos[side]!.innerHTML = single ? '' : '<p class="waiting">Depois escolha o oponente</p>';
          continue;
        }
        const def = getCharacter(roster[cursor[side]]!);
        infos[side]!.innerHTML = `
          <h3>${def.name}</h3><p class="title">${def.title}</p><p>${def.bio}</p>
          <ul>${moveList(def)
            .slice(0, def.specials.length)
            .map((m) => `<li><b>${m.name}</b><br>${m.input}</li>`)
            .join('')}</ul>
          ${locked[side] ? '<p class="ready">PRONTO!</p>' : ''}`;
      }
      const opponent: CharacterId = single
        ? roster[(cursor[0] + 1) % roster.length]!
        : roster[cursor[1]]!;
      const pair: [CharacterId, CharacterId] = [roster[cursor[0]]!, opponent];
      this.match = this.showcase(pair, 'rooftop');
      locked.forEach((l, i) => {
        if (l) this.match.fighters[i]!.state = 'victory';
      });
    };

    const confirm = (side: 0 | 1) => {
      if (locked[side]) return;
      locked[side] = true;
      this.sounds.confirm();
      const done = single ? locked[0] : locked[0] && locked[1];
      refresh();
      if (!done) return;
      const chars: [CharacterId, CharacterId] = [roster[cursor[0]]!, roster[cursor[1]]!];
      if (onDone) onDone(chars);
      else if (mode === 'arcade') this.startArcade(chars[0], level);
      else this.show(this.stageMenu(mode, chars, level));
    };

    const back = (side: 0 | 1) => {
      if (locked[side]) {
        locked[side] = false;
      } else if (side === 1 && !twoPlayers && locked[0]) {
        locked[0] = false;
      } else {
        this.sounds.back();
        onCancel();
        return;
      }
      this.sounds.back();
      refresh();
    };

    refresh();
    const cols = 4;
    return {
      el,
      handle: (e) => {
        // Em modo de 1 jogador, as teclas dos dois lados controlam o mesmo cursor.
        const side = activeSide(e.player);
        if (e.action === 'back' || e.action === 'pause') return back(side);
        if (locked[side]) return;
        const n = roster.length;
        if (e.action === 'left') cursor[side] = (cursor[side] + n - 1) % n;
        if (e.action === 'right') cursor[side] = (cursor[side] + 1) % n;
        if (e.action === 'up') cursor[side] = (cursor[side] + n - cols) % n;
        if (e.action === 'down') cursor[side] = (cursor[side] + cols) % n;
        if (e.action === 'confirm') return confirm(side);
        this.sounds.move();
        refresh();
      },
    };
  }

  stageMenu(mode: Mode, chars: [CharacterId, CharacterId], level: CpuLevel): Screen {
    const items: MenuItem[] = [
      ...STAGES.map((s) => ({
        label: s.name,
        action: () => this.startSession(mode, chars, s.id, level),
      })),
      {
        label: 'Aleatório',
        action: () =>
          this.startSession(
            mode,
            chars,
            STAGES[Math.floor(Math.random() * STAGES.length)]!.id,
            level,
          ),
      },
    ];
    const menu = new Menu('Cenário', items, this.sounds, () =>
      this.show(this.selectScreen(mode, level)),
    );
    const el = html('div', 'screen');
    el.appendChild(menu.el);
    const preview = () => {
      const stage = STAGES[menu.index]?.id;
      if (stage) this.match = this.showcase(chars, stage);
    };
    preview();
    return {
      el,
      handle: (e) => {
        menu.handle(e);
        if (this.screen?.el === el) preview();
      },
    };
  }

  // -------------------------------------------------------------------------
  // Partida
  // -------------------------------------------------------------------------

  private sourcesFor(mode: Mode, level: CpuLevel): [InputSource, InputSource] {
    const seed = Math.floor(Math.random() * 1e9);
    switch (mode) {
      case 'versus':
        return [
          { kind: 'local', player: 0 },
          { kind: 'local', player: 1 },
        ];
      case 'training':
        return [{ kind: 'local', player: 'both' }, { kind: 'dummy' }];
      case 'online':
        return [{ kind: 'remote' }, { kind: 'remote' }];
      default:
        return [
          { kind: 'local', player: 'both' },
          { kind: 'cpu', brain: createCpu(level, seed) },
        ];
    }
  }

  startSession(
    mode: Mode,
    characters: [CharacterId, CharacterId],
    stage: StageId,
    level: CpuLevel,
  ): void {
    this.session = { mode, characters, stage, sources: this.sourcesFor(mode, level), level };
    this.dummyBrain = createCpu(level, 7);
    this.show(this.versusScreen());
  }

  private startArcade(player: CharacterId, level: CpuLevel): void {
    const others = STARTING_ROSTER.filter((id) => id !== player);
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [others[i], others[j]] = [others[j]!, others[i]!];
    }
    // 6 lutas sorteadas + o chefe, para o arcade não ficar longo demais com o elenco grande.
    const opponents: CharacterId[] = [...others.slice(0, 6), 'zhaar'];
    this.session = {
      mode: 'arcade',
      characters: [player, opponents[0]!],
      stage: 'rooftop',
      sources: this.sourcesFor('arcade', level),
      level,
      ladder: { opponents, index: 0 },
    };
    this.arcadeStage();
    this.show(this.versusScreen());
  }

  private arcadeStage(): void {
    const s = this.session!;
    const ladder = s.ladder!;
    const opponent = ladder.opponents[ladder.index]!;
    const cycle: StageId[] = ['rooftop', 'park', 'forest', 'sweets', 'base'];
    s.characters = [s.characters[0], opponent];
    s.stage = opponent === 'zhaar' ? 'ship' : cycle[ladder.index % cycle.length]!;
    // A CPU fica mais esperta a cada luta do arcade.
    const order = CPU_LEVELS.map((l) => l.id);
    const base = order.indexOf(s.level);
    const level = order[Math.min(order.length - 1, base + Math.floor(ladder.index / 2))]!;
    s.sources = [
      { kind: 'local', player: 'both' },
      { kind: 'cpu', brain: createCpu(level, Math.floor(Math.random() * 1e9)) },
    ];
  }

  versusScreen(): Screen {
    const s = this.session!;
    const [a, b] = s.characters.map((id) => getCharacter(id));
    const step =
      s.ladder !== undefined
        ? `<p class="ladder">Luta ${s.ladder.index + 1} de ${s.ladder.opponents.length}${b!.boss ? ' — CHEFE FINAL' : ''}</p>`
        : '';
    const el = html(
      'div',
      'screen versus-screen',
      `<div class="vs-name left">${a!.name}<small>${a!.title}</small></div>
       <div class="vs">VS</div>
       <div class="vs-name right">${b!.name}<small>${b!.title}</small></div>${step}`,
    );
    this.match = this.showcase(s.characters, s.stage);
    this.audio.say(`${a!.name} contra ${b!.name}`);
    let ticks = 0;
    return {
      el,
      handle: (e) => {
        if (e.action === 'confirm') ticks = Math.max(ticks, 100);
      },
      tick: () => {
        if (++ticks >= 130) this.beginFight();
      },
    };
  }

  /** Começa (ou recomeça) a luta da sessão atual. */
  beginFight(): void {
    const s = this.session!;
    const training = s.mode === 'training' || s.mode === 'tutorial';
    const config = { ...defaultConfig(s.characters), training };
    this.renderer.load(s.characters, s.stage);
    this.renderer.reset();
    this.match = createMatch(config);
    const labels: [string, string] =
      s.mode === 'versus'
        ? ['1P', '2P']
        : training
          ? ['VOCÊ', 'BONECO']
          : s.mode === 'online'
            ? (this.online?.labels ?? ['', ''])
            : ['VOCÊ', 'CPU'];
    this.hud.setup(this.match, labels);
    this.audio.playMusic(s.characters.includes('zhaar') ? 'boss' : 'fight');
    if (s.mode === 'online') this.online?.start(this.match);
    this.show(this.fightScreen());
  }

  /** Começa uma partida online já combinada com o outro jogador. */
  startOnline(characters: [CharacterId, CharacterId], stage: StageId, hooks: OnlineHooks): void {
    this.online = hooks;
    this.session = {
      mode: 'online',
      characters,
      stage,
      sources: this.sourcesFor('online', 'medio'),
      level: 'medio',
    };
    this.show(this.versusScreen());
  }

  private dummyBrain: CpuBrain = createCpu('medio', 7);
  private tutorial = createTutorial();
  private tutorialView = new TutorialView();

  /** Tutorial: Kai Volt contra um boneco que muda de comportamento a cada lição. */
  startTutorial(): void {
    this.tutorial = createTutorial();
    this.tutorialView = new TutorialView();
    this.session = {
      mode: 'tutorial',
      characters: ['kai', 'nyx'],
      stage: 'rooftop',
      sources: [
        { kind: 'local', player: 'both' },
        {
          kind: 'script',
          input: (match) => {
            const lesson = LESSONS[this.tutorial.lesson];
            return lesson ? tutorialDummyInput(lesson.dummy, match, this.tickCount) : emptyInput();
          },
        },
      ],
      level: 'medio',
    };
    this.beginFight();
    this.tutorialView.update(this.tutorial);
  }

  private tutorialDoneScreen(): Screen {
    const el = html(
      'div',
      'screen',
      `<div class="panel tutorial-done">
         <h2>Tutorial completo!</h2>
         <p>Você já sabe andar, pular, defender, fazer combos, especiais, arremessos e anti-aéreos.</p>
         <p>Dica: no menu de pausa fica a lista de golpes de cada lutador. Cada um tem 3 especiais e uma
         Toonality para fazer quando aparecer "ACABE COM ELE/ELA!".</p>
         <p class="blink">ENTER para voltar ao menu</p>
       </div>`,
    );
    const back = () => this.show(this.mainMenu());
    el.addEventListener('click', back);
    return { el, handle: (e) => (e.action === 'confirm' || e.action === 'pause') && back() };
  }

  private inputFor(side: 0 | 1, source: InputSource): PlayerInput {
    switch (source.kind) {
      case 'local':
        return source.player === 'both'
          ? mergeInputs(this.controls.read(0), this.controls.read(1))
          : this.controls.read(source.player);
      case 'cpu':
        return cpuInput(source.brain, this.match, side);
      case 'dummy':
        return this.dummy === 'cpu'
          ? cpuInput(this.dummyBrain, this.match, side)
          : dummyInput(this.dummy, this.match, side, this.tickCount);
      case 'script':
        return source.input(this.match);
      case 'remote':
        return emptyInput();
    }
  }

  fightScreen(): Screen {
    const el = html('div', 'screen fight-screen');
    if (this.session?.mode === 'tutorial') el.appendChild(this.tutorialView.el);
    let resultsShown = false;
    return {
      el,
      fight: true,
      handle: (e) => {
        if (e.action === 'pause' && this.session?.mode !== 'online') this.openPause();
      },
      tick: () => {
        const s = this.session!;
        if (s.mode === 'online') this.online?.tick();
        else this.advance([this.inputFor(0, s.sources[0]), this.inputFor(1, s.sources[1])]);
        if (s.mode === 'tutorial') {
          const finished = updateTutorial(this.tutorial, this.match, this.match.events);
          this.tutorialView.update(this.tutorial);
          if (finished) this.show(this.tutorialDoneScreen());
          return;
        }
        if (
          this.match.phase === 'matchOver' &&
          this.match.phaseTick >= RESULTS_DELAY &&
          !resultsShown
        ) {
          resultsShown = true;
          this.show(this.resultsScreen());
        }
      },
    };
  }

  /** Avança a partida um tick e espalha os eventos para vídeo, som e HUD. */
  advance(inputs: [PlayerInput, PlayerInput]): void {
    this.present(stepMatch(this.match, inputs));
  }

  /** Mostra um novo estado da partida (local ou vindo do rollback online). */
  present(match: MatchState, events: readonly GameEvent[] = match.events): void {
    const before = this.match.phase;
    this.match = match;
    this.renderer.handleEvents(events, this.match);
    this.hud.handleEvents(events, this.match);
    this.audio.handleEvents(events);
    this.hud.update(this.match);
    if (before !== 'matchOver' && this.match.phase === 'matchOver') this.audio.playMusic('victory');
  }

  private openPause(): void {
    const s = this.session!;
    const training = s.mode === 'training';
    const tutorial = s.mode === 'tutorial';
    const close = () => {
      menu.el.remove();
      this.paused = null;
      this.controls.syncMenu();
    };
    const dummyIndex = () => DUMMY_MODES.findIndex((d) => d.id === this.dummy);
    const cycleDummy = (delta: number) => {
      const n = DUMMY_MODES.length;
      this.dummy = DUMMY_MODES[(dummyIndex() + delta + n) % n]!.id;
    };
    const levelIndex = () => CPU_LEVELS.findIndex((l) => l.id === this.dummyBrain.level);
    const cycleLevel = (delta: number) => {
      const n = CPU_LEVELS.length;
      this.dummyBrain = createCpu(CPU_LEVELS[(levelIndex() + delta + n) % n]!.id, 7);
    };
    const items: MenuItem[] = [
      { label: 'Continuar', action: close },
      { label: 'Lista de golpes', action: () => this.showMoves(menu) },
      ...(tutorial
        ? [
            {
              label: 'Pular lição',
              action: () => {
                skipLesson(this.tutorial);
                close();
              },
            },
          ]
        : []),
      ...(training
        ? [
            {
              label: () => `Boneco: ${DUMMY_MODES[dummyIndex()]!.name}`,
              left: () => cycleDummy(-1),
              right: () => cycleDummy(1),
            },
            {
              label: () => `Nível da CPU: ${CPU_LEVELS[levelIndex()]!.name}`,
              left: () => cycleLevel(-1),
              right: () => cycleLevel(1),
            },
          ]
        : []),
      {
        label: 'Reiniciar luta',
        action: () => {
          close();
          this.beginFight();
        },
      },
      {
        label: 'Sair para o menu',
        action: () => {
          close();
          this.session = null;
          this.show(this.mainMenu());
        },
      },
    ];
    const menu = new Menu('Pausa', items, this.sounds, close);
    menu.el.classList.add('pause');
    this.root.appendChild(menu.el);
    this.paused = menu;
    this.controls.syncMenu();
  }

  private showMoves(pauseMenu: Menu): void {
    const s = this.session!;
    const sides = s.mode === 'versus' ? [0, 1] : [0];
    const panel = html(
      'div',
      'panel moves',
      `<h2>Lista de golpes</h2><div class="moves-cols">${sides
        .map((i) => {
          const def = getCharacter(s.characters[i]!);
          const t = def.toonality;
          return `<div><h3>${def.name}</h3><ul>${moveList(def)
            .map((m) => `<li><b>${m.name}</b><span>${m.input}</span></li>`)
            .join('')}<li class="toon"><b>Toonality: ${t.name}</b><span>${t.motion
            .map((x) => ({ F: '→', B: '←', D: '↓', U: '↑', DF: '↘', DB: '↙' })[x])
            .join(
              ' ',
            )} + ${BUTTON_NAMES[t.button]} (no "acabe com ${def.pronoun === 'ele' ? 'ele' : 'ela'}")</span></li></ul></div>`;
        })
        .join(
          '',
        )}</div><p class="help">Comandos com o lutador olhando para a direita · ESC volta</p>`,
    );
    pauseMenu.el.style.display = 'none';
    this.root.appendChild(panel);
    const previous = this.paused;
    const closeMoves = () => {
      panel.remove();
      pauseMenu.el.style.display = '';
      this.paused = previous;
      this.controls.syncMenu();
    };
    panel.addEventListener('click', closeMoves);
    this.paused = {
      handle: (e: MenuEvent) =>
        (e.action === 'back' || e.action === 'pause' || e.action === 'confirm') && closeMoves(),
    };
  }

  private resultsScreen(): Screen {
    const s = this.session!;
    const winner = this.match.matchWinner;
    const winnerName = winner !== null ? getCharacter(s.characters[winner]).name : '';
    let items: MenuItem[];
    let title = `${winnerName} venceu!`;

    if (s.mode === 'arcade') {
      const ladder = s.ladder!;
      if (winner === 0) {
        if (ladder.index >= ladder.opponents.length - 1) return this.endingScreen();
        title = 'Vitória!';
        items = [
          {
            label: 'Próxima luta',
            action: () => {
              ladder.index++;
              this.arcadeStage();
              this.show(this.versusScreen());
            },
          },
          { label: 'Desistir', action: () => this.show(this.mainMenu()) },
        ];
      } else {
        return this.continueScreen();
      }
    } else if (s.mode === 'online' && this.online) {
      items = this.online.resultItems();
    } else {
      items = [
        { label: 'Revanche', action: () => this.beginFight() },
        { label: 'Trocar lutadores', action: () => this.show(this.selectScreen(s.mode, s.level)) },
        { label: 'Menu principal', action: () => this.show(this.mainMenu()) },
      ];
    }
    const menu = new Menu(title, items, this.sounds);
    menu.el.classList.add('results');
    const el = html('div', 'screen');
    el.appendChild(menu.el);
    return { el, fight: true, handle: (e) => menu.handle(e) };
  }

  private continueScreen(): Screen {
    let count = 10;
    let ticks = 0;
    const el = html(
      'div',
      'screen continue-screen',
      `<h2>CONTINUAR?</h2><div class="count">${count}</div><p>ENTER para continuar</p>`,
    );
    const retry = () => this.show(this.versusScreen());
    el.addEventListener('click', retry);
    return {
      el,
      fight: true,
      handle: (e) => {
        if (e.action === 'confirm') retry();
        if (e.action === 'back' || e.action === 'pause') this.show(this.mainMenu());
      },
      tick: () => {
        if (++ticks % 60 !== 0) return;
        count--;
        el.querySelector('.count')!.textContent = String(count);
        this.audio.ui('move');
        if (count <= 0) this.show(this.mainMenu());
      },
    };
  }

  private endingScreen(): Screen {
    const first = !this.zhaarUnlocked;
    this.zhaarUnlocked = true;
    saveUnlock();
    const name = getCharacter(this.session!.characters[0]).name;
    const el = html(
      'div',
      'screen ending-screen panel',
      `<h2>PARABÉNS!</h2>
       <p>${name} derrotou Warlord Zhaar e o relógio cósmico está a salvo.</p>
       ${first ? '<p class="unlock">Novo lutador liberado: <b>Warlord Zhaar</b>!</p>' : ''}
       <p class="credits">Toon Clash — criado por ${AUTHOR}. Personagens originais.</p>
       <p class="blink">ENTER para voltar ao menu</p>`,
    );
    el.addEventListener('click', () => this.show(this.mainMenu()));
    return {
      el,
      fight: true,
      handle: (e) => {
        if (e.action === 'confirm' || e.action === 'pause') this.show(this.mainMenu());
      },
    };
  }

  controlsScreen(): Screen {
    const keymap = this.controls.keymap;
    const row = (name: string, p1: string, p2: string, pad = '') =>
      `<tr><td>${name}</td><td>${p1}</td><td>${p2}</td>${pad}</tr>`;
    const padCell = (text: string, rows = 1) => `<td rowspan="${rows}">${text}</td>`;
    const keys = (name: string, button: Button, pad = '') =>
      row(name, keysLabel(keymap, 0, button), keysLabel(keymap, 1, button), pad);
    const table = html(
      'div',
      'controls-table',
      `<table>
        <tr><th></th><th>Jogador 1</th><th>Jogador 2</th><th>Controle</th></tr>
        ${keys('Pular (cima)', 'up', padCell('Direcional ou analógico', 4))}
        ${keys('Agachar (baixo)', 'down')}
        ${keys('Esquerda', 'left')}
        ${keys('Direita', 'right')}
        ${keys(BUTTON_NAMES.lp, 'lp', padCell('X / □'))}
        ${keys(BUTTON_NAMES.hp, 'hp', padCell('Y / △'))}
        ${keys(BUTTON_NAMES.lk, 'lk', padCell('A / ✕'))}
        ${keys(BUTTON_NAMES.hk, 'hk', padCell('B / ○'))}
        ${keys('Defender', 'block', padCell('LB / RB / gatilhos'))}
        ${row('Pausa', 'ESC', 'ESC', padCell('Start'))}
      </table>
      <p>Golpes especiais são sequências de direções + botão (ex.: ↓ → + Soco Baixo). Veja a lista de golpes no menu de pausa.</p>
      <p class="help">No celular, use os botões na tela. Os menus sempre usam WASD/setas, ENTER e ESC.</p>`,
    );
    const back = () => this.show(this.mainMenu());
    const items: MenuItem[] = [
      {
        label: 'Remapear teclas',
        hint: 'Escolha as teclas de luta de cada jogador',
        action: () => this.show(this.remapScreen()),
      },
      { label: 'Voltar', action: back },
    ];
    const menu = new Menu('Controles', items, this.sounds, back);
    menu.el.classList.add('controls');
    menu.el.querySelector('ul')!.before(table);
    const el = html('div', 'screen');
    el.appendChild(menu.el);
    return { el, handle: (e) => menu.handle(e) };
  }

  /** Troca as teclas de luta do teclado; as escolhas ficam salvas no navegador. */
  remapScreen(): Screen {
    const view = new RemapView(this.controls, this.sounds, () => this.show(this.controlsScreen()));
    const el = html('div', 'screen');
    el.appendChild(view.el);
    return { el, handle: (e) => view.handle(e) };
  }

  optionsScreen(): Screen {
    const a11y = () => this.renderer.accessibility;
    const setShake = (step: 1 | -1) =>
      this.renderer.setAccessibility({
        ...a11y(),
        screenShake: cycleOption(SCREEN_SHAKE_OPTIONS, a11y().screenShake, step),
      });
    const setFlashes = (step: 1 | -1) =>
      this.renderer.setAccessibility({
        ...a11y(),
        flashes: cycleOption(FLASH_OPTIONS, a11y().flashes, step),
      });
    const items: MenuItem[] = [
      {
        label: () => `Volume: ${Math.round(this.audio.volume * 100)}%`,
        left: () => (this.audio.volume = Math.max(0, this.audio.volume - 0.1)),
        right: () => (this.audio.volume = Math.min(1, this.audio.volume + 0.1)),
      },
      {
        label: () => `Som: ${this.audio.muted ? 'desligado' : 'ligado'}`,
        action: () => (this.audio.muted = !this.audio.muted),
      },
      {
        label: () =>
          `Gráficos: ${this.renderer.quality === 'alto' ? 'alto (com brilho)' : 'baixo (mais leve)'}`,
        action: () => this.renderer.setQuality(this.renderer.quality === 'alto' ? 'baixo' : 'alto'),
      },
      {
        label: () => `Tremor de tela: ${a11y().screenShake}`,
        action: () => setShake(1),
        left: () => setShake(-1),
        right: () => setShake(1),
      },
      {
        label: () => `Flashes: ${a11y().flashes}`,
        action: () => setFlashes(1),
        left: () => setFlashes(-1),
        right: () => setFlashes(1),
      },
      {
        label: 'Tela cheia',
        action: () => {
          if (document.fullscreenElement) void document.exitFullscreen();
          else void document.documentElement.requestFullscreen?.().catch(() => {});
        },
      },
      { label: 'Voltar', action: () => this.show(this.mainMenu()) },
    ];
    const menu = new Menu('Opções', items, this.sounds, () => this.show(this.mainMenu()));
    const el = html('div', 'screen');
    el.appendChild(menu.el);
    return { el, handle: (e) => menu.handle(e) };
  }
}
