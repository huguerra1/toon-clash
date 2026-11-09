import { describe, expect, it } from 'vitest';
import { type PlayerInput, emptyInput } from '../core/input';
import { createHistory, matchMotion, recordInput, toDir } from './motion';

function input(...held: (keyof PlayerInput)[]): PlayerInput {
  const i = emptyInput();
  for (const button of held) i[button] = true;
  return i;
}

/** Aplica uma sequência de inputs, cada um segurado por `hold` ticks. */
function feed(steps: PlayerInput[], hold = 3, facing: 1 | -1 = 1) {
  const history = createHistory();
  let tick = 0;
  let pressed: string[] = [];
  for (const step of steps) {
    for (let i = 0; i < hold; i++) pressed = recordInput(history, step, facing, ++tick);
  }
  return { history, tick, pressed };
}

describe('toDir', () => {
  it('converte para direções relativas ao lado em que o lutador olha', () => {
    expect(toDir(input('right'), 1)).toBe(6);
    expect(toDir(input('right'), -1)).toBe(4);
    expect(toDir(input('down', 'left'), -1)).toBe(3);
    expect(toDir(input('up'), 1)).toBe(8);
    expect(toDir(input('left', 'right'), 1)).toBe(5);
  });
});

describe('recordInput', () => {
  it('só reporta o botão no tick em que foi apertado', () => {
    const history = createHistory();
    expect(recordInput(history, input('lp'), 1, 1)).toEqual(['lp']);
    expect(recordInput(history, input('lp'), 1, 2)).toEqual([]);
    expect(recordInput(history, emptyInput(), 1, 3)).toEqual([]);
    expect(recordInput(history, input('lp', 'hk'), 1, 4)).toEqual(['lp', 'hk']);
  });
});

describe('matchMotion', () => {
  it('reconhece ↓ → (meia-lua simples)', () => {
    const { history, tick } = feed([input('down'), input('down', 'right'), input('right')]);
    expect(matchMotion(history, ['D', 'F'], tick)).toBe(true);
    expect(matchMotion(history, ['B', 'F'], tick)).toBe(false);
  });

  it('reconhece o comando espelhado quando o lutador olha para a esquerda', () => {
    const { history, tick } = feed([input('down'), input('left')], 3, -1);
    expect(matchMotion(history, ['D', 'F'], tick)).toBe(true);
  });

  it('exige soltar a direção entre toques repetidos (→ →)', () => {
    const held = feed([input('right')], 8);
    expect(matchMotion(held.history, ['F', 'F'], held.tick)).toBe(false);
    const tapped = feed([input('right'), emptyInput(), input('right')]);
    expect(matchMotion(tapped.history, ['F', 'F'], tapped.tick)).toBe(true);
  });

  it('não aceita comandos feitos devagar demais', () => {
    const { history, tick } = feed([input('down'), emptyInput(), input('right')], 20);
    expect(matchMotion(history, ['D', 'F'], tick)).toBe(false);
  });
});
