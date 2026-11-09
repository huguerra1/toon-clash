import { type PlayerInput, emptyInput } from '../core/input';
import type { GameEvent } from './events';
import type { MatchState } from './match';

/** O que o boneco faz durante a lição. */
export type TutorialDummy = 'parado' | 'jab' | 'low' | 'jump';

export interface Lesson {
  title: string;
  /** Explicação curta mostrada na tela. */
  text: string;
  /** Teclas do jogador 1 e botões do controle. */
  keys: string;
  goal: number;
  dummy: TutorialDummy;
  /** Quanto o progresso avança neste tick. */
  progress(now: MatchState, events: readonly GameEvent[]): number;
}

const PUNCHES = ['lp', 'hp', 'd_lp', 'd_hp', 'j_lp', 'j_hp'];
const KICKS = ['lk', 'hk', 'd_lk', 'd_hk', 'j_lk', 'j_hk'];

const count = (events: readonly GameEvent[], test: (e: GameEvent) => boolean) =>
  events.filter(test).length;

/** Lições do tutorial, jogadas com Kai Volt (jogador 1) contra um boneco. */
export const LESSONS: Lesson[] = [
  {
    title: 'Andar',
    text: 'Ande para a frente e para trás.',
    keys: 'A / D · direcional ← →',
    goal: 60,
    dummy: 'parado',
    progress: (m) => (m.fighters[0].state === 'walk' ? 1 : 0),
  },
  {
    title: 'Pular',
    text: 'Pule 3 vezes. Segurando para a frente ou para trás você pula na diagonal.',
    keys: 'W · direcional ↑',
    goal: 3,
    dummy: 'parado',
    progress: (_, events) => count(events, (e) => e.type === 'jump' && e.player === 0),
  },
  {
    title: 'Agachar',
    text: 'Agache 3 vezes. Agachado você escapa de golpes altos.',
    keys: 'S · direcional ↓',
    goal: 3,
    dummy: 'parado',
    progress: (m) => (m.fighters[0].state === 'crouch' && m.fighters[0].stateTick === 1 ? 1 : 0),
  },
  {
    title: 'Socos',
    text: 'Chegue perto e acerte 3 socos no boneco.',
    keys: 'F = Soco Baixo · G = Soco Alto · X / Y',
    goal: 3,
    dummy: 'parado',
    progress: (m, events) =>
      count(
        events,
        (e) => e.type === 'hit' && e.attacker === 0 && PUNCHES.includes(m.fighters[0].moveId ?? ''),
      ),
  },
  {
    title: 'Chutes',
    text: 'Agora acerte 3 chutes. O Chute Alto derruba!',
    keys: 'V = Chute Baixo · B = Chute Alto · A / B',
    goal: 3,
    dummy: 'parado',
    progress: (m, events) =>
      count(
        events,
        (e) => e.type === 'hit' && e.attacker === 0 && KICKS.includes(m.fighters[0].moveId ?? ''),
      ),
  },
  {
    title: 'Defender',
    text: 'O boneco vai atacar. Segure DEFENDER para bloquear 3 golpes.',
    keys: 'Espaço · LB / RB',
    goal: 3,
    dummy: 'jab',
    progress: (_, events) => count(events, (e) => e.type === 'block' && e.attacker === 1),
  },
  {
    title: 'Defesa baixa',
    text: 'Rasteiras passam pela defesa em pé. Agache + DEFENDER para bloquear 2.',
    keys: 'S + Espaço · ↓ + LB',
    goal: 2,
    dummy: 'low',
    progress: (m, events) =>
      count(
        events,
        (e) => e.type === 'block' && e.attacker === 1 && m.fighters[1].moveId === 'd_lk',
      ),
  },
  {
    title: 'Combo',
    text: 'Emende golpes: Soco Baixo, Soco Baixo, Soco Alto bem rápido, de perto.',
    keys: 'F, F, G',
    goal: 1,
    dummy: 'parado',
    progress: (_, events) =>
      count(events, (e) => e.type === 'hit' && e.attacker === 0 && e.combo >= 3),
  },
  {
    title: 'Golpe especial',
    text: 'Faça a Rajada Ômega 2 vezes: ↓, ↘, → e Soco Baixo, num movimento só.',
    keys: 'S, S+D, D + F',
    goal: 2,
    dummy: 'parado',
    progress: (_, events) => count(events, (e) => e.type === 'special' && e.player === 0),
  },
  {
    title: 'Arremesso',
    text: 'Bem de perto, aperte → + Soco Baixo para agarrar. Não dá para defender!',
    keys: 'D + F (de perto)',
    goal: 1,
    dummy: 'parado',
    progress: (_, events) => count(events, (e) => e.type === 'throw' && e.player === 0),
  },
  {
    title: 'Anti-aéreo',
    text: 'O boneco vai pular em você. Derrube-o no ar com o Gancho: ↓ + Soco Alto.',
    keys: 'S + G',
    goal: 1,
    dummy: 'jump',
    progress: (m, events) =>
      count(events, (e) => e.type === 'hit' && e.attacker === 0 && m.fighters[0].moveId === 'd_hp'),
  },
];

export interface TutorialState {
  lesson: number;
  progress: number;
  /** Ticks desde que a lição atual foi concluída (null enquanto não concluiu). */
  doneFor: number | null;
}

export const LESSON_PAUSE_TICKS = 90;

export function createTutorial(): TutorialState {
  return { lesson: 0, progress: 0, doneFor: null };
}

/** Atualiza o progresso com o estado e os eventos do tick. Devolve true se terminou tudo. */
export function updateTutorial(
  t: TutorialState,
  match: MatchState,
  events: readonly GameEvent[],
): boolean {
  const lesson = LESSONS[t.lesson];
  if (!lesson) return true;
  if (t.doneFor !== null) {
    if (++t.doneFor >= LESSON_PAUSE_TICKS) skipLesson(t);
    return t.lesson >= LESSONS.length;
  }
  t.progress = Math.min(lesson.goal, t.progress + lesson.progress(match, events));
  if (t.progress >= lesson.goal) t.doneFor = 0;
  return false;
}

export function skipLesson(t: TutorialState): void {
  t.lesson++;
  t.progress = 0;
  t.doneFor = null;
}

/** Input do boneco conforme a lição (ele sempre é o jogador 2). */
export function tutorialDummyInput(
  kind: TutorialDummy,
  match: MatchState,
  tick: number,
): PlayerInput {
  const input = emptyInput();
  const self = match.fighters[1];
  const player = match.fighters[0];
  const toward: 'left' | 'right' = player.x < self.x ? 'left' : 'right';
  const away: 'left' | 'right' = toward === 'left' ? 'right' : 'left';
  const dist = Math.abs(player.x - self.x);
  switch (kind) {
    case 'parado':
      break;
    case 'jab':
    case 'low':
      if (dist > 1.25) input[toward] = true;
      else if (tick % 50 < 2) {
        if (kind === 'low') {
          input.down = true;
          input.lk = true;
        } else {
          input.lp = true;
        }
      } else if (kind === 'low') input.down = true;
      break;
    case 'jump':
      if (dist < 2.2) input[away] = true;
      else if (tick % 80 < 3) {
        input.up = true;
        input[toward] = true;
      }
      break;
  }
  return input;
}
