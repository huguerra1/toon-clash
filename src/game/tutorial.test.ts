import { describe, expect, it } from 'vitest';
import { INTRO_TICKS } from '../combat/constants';
import { type PlayerInput, emptyInput } from '../core/input';
import { type MatchState, createMatch, defaultConfig, stepMatch } from './match';
import {
  LESSONS,
  LESSON_PAUSE_TICKS,
  createTutorial,
  tutorialDummyInput,
  updateTutorial,
} from './tutorial';

function input(...held: (keyof PlayerInput)[]): PlayerInput {
  const i = emptyInput();
  for (const k of held) i[k] = true;
  return i;
}

function setup(): { m: MatchState; t: ReturnType<typeof createTutorial>; tick: number } {
  let m = createMatch({ ...defaultConfig(['kai', 'nyx']), training: true });
  for (let i = 0; i <= INTRO_TICKS; i++) m = stepMatch(m, [emptyInput(), emptyInput()]);
  return { m, t: createTutorial(), tick: 0 };
}

describe('tutorial', () => {
  it('conclui as primeiras lições com os comandos certos', () => {
    const s = setup();
    const run = (p1: PlayerInput, ticks: number) => {
      for (let i = 0; i < ticks; i++) {
        const lesson = LESSONS[s.t.lesson]!;
        const dummy = tutorialDummyInput(lesson.dummy, s.m, s.tick++);
        s.m = stepMatch(s.m, [p1, dummy]);
        updateTutorial(s.t, s.m, s.m.events);
      }
    };
    run(input('right'), 70);
    expect(s.t.doneFor).not.toBeNull();
    run(emptyInput(), LESSON_PAUSE_TICKS);
    expect(s.t.lesson).toBe(1);

    for (let k = 0; k < 3; k++) {
      run(input('up'), 2);
      run(emptyInput(), 60);
    }
    run(emptyInput(), LESSON_PAUSE_TICKS);
    expect(s.t.lesson).toBe(2);

    for (let k = 0; k < 3; k++) {
      run(input('down'), 6);
      run(emptyInput(), 6);
    }
    run(emptyInput(), LESSON_PAUSE_TICKS);
    expect(s.t.lesson).toBe(3);
  });

  it('o boneco ataca nas lições de defesa e o bloqueio conta', () => {
    const s = setup();
    s.t.lesson = LESSONS.findIndex((l) => l.title === 'Defender');
    for (let i = 0; i < 600 && s.t.doneFor === null; i++) {
      const dummy = tutorialDummyInput('jab', s.m, s.tick++);
      s.m = stepMatch(s.m, [input('block'), dummy]);
      updateTutorial(s.t, s.m, s.m.events);
    }
    expect(s.t.progress).toBe(3);
  });

  it('todas as lições têm objetivo positivo, texto e marcadores de botão nas teclas', () => {
    for (const l of LESSONS) {
      expect(l.goal).toBeGreaterThan(0);
      expect(l.text.length).toBeGreaterThan(10);
      expect(l.keys).toMatch(/\{(up|down|left|right|lp|hp|lk|hk|block)\}/);
    }
  });
});
