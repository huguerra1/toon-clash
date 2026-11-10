import { describe, expect, it } from 'vitest';
import { getCharacter } from '../characters/roster';
import { FINISH_TICKS, INTRO_TICKS, ROUND_OVER_TICKS } from '../combat/constants';
import type { CharacterId } from '../combat/types';
import { type PlayerInput, emptyInput } from '../core/input';
import { type MatchState, createMatch, defaultConfig, stepMatch } from './match';

type Key = keyof PlayerInput;
const idle = emptyInput();

function input(...held: Key[]): PlayerInput {
  const i = emptyInput();
  for (const k of held) i[k] = true;
  return i;
}

function step(m: MatchState, a: PlayerInput = idle, b: PlayerInput = idle, ticks = 1): MatchState {
  for (let t = 0; t < ticks; t++) m = stepMatch(m, [a, b]);
  return m;
}

/** Partida já na fase de luta, com os lutadores a `distance` de distância. */
function fight(chars: [CharacterId, CharacterId] = ['kai', 'nyx'], distance = 1.0): MatchState {
  let m = createMatch(defaultConfig(chars));
  m = step(m, idle, idle, INTRO_TICKS + 1);
  expect(m.phase).toBe('fight');
  m.fighters[0].x = -distance / 2;
  m.fighters[1].x = distance / 2;
  return m;
}

/** Faz um comando especial: direções seguradas 2 ticks cada, depois o botão. */
function motion(m: MatchState, player: 0 | 1, dirs: Key[][], button: Key): MatchState {
  for (const d of dirs) {
    const i = input(...d);
    m = player === 0 ? step(m, i, idle, 2) : step(m, idle, i, 2);
  }
  const last = dirs[dirs.length - 1] ?? [];
  const press = input(...last, button);
  return player === 0 ? step(m, press, idle) : step(m, idle, press);
}

/** Roda até o hitstop e a animação acabarem. */
function settle(m: MatchState, ticks = 60): MatchState {
  return step(m, idle, idle, ticks);
}

describe('rounds', () => {
  it('começa com a introdução e libera a luta depois', () => {
    let m = createMatch(defaultConfig(['kai', 'nyx']));
    expect(m.phase).toBe('intro');
    m = step(m, input('right'), idle, 30);
    expect(m.fighters[0].x).toBe(-2.5);
    m = step(m, idle, idle, INTRO_TICKS);
    expect(m.phase).toBe('fight');
    expect(m.events.some((e) => e.type === 'announce')).toBe(false);
  });

  it('o tempo acaba e vence quem tem mais vida', () => {
    let m = fight();
    m.fighters[1].health = 500;
    m.timer = 2;
    m = step(m, idle, idle, 3);
    expect(m.phase).toBe('roundOver');
    expect(m.roundEnd).toBe('time');
    expect(m.wins).toEqual([1, 0]);
  });

  it('nocaute passa para o próximo round', () => {
    let m = fight();
    m.fighters[1].health = 10;
    m = step(m, input('lp'));
    m = step(m, idle, idle, 10);
    expect(m.phase).toBe('roundOver');
    expect(m.roundEnd).toBe('ko');
    expect(m.wins).toEqual([1, 0]);
    m = step(m, idle, idle, ROUND_OVER_TICKS + 2);
    expect(m.phase).toBe('intro');
    expect(m.round).toBe(2);
    expect(m.fighters[1].health).toBe(getCharacter('nyx').maxHealth);
  });

  it('no último round o perdedor fica tonto e a partida acaba', () => {
    let m = fight();
    m.wins = [1, 0];
    m.fighters[1].health = 10;
    m = step(m, input('lp'));
    m = step(m, idle, idle, 10);
    expect(m.phase).toBe('finishHim');
    expect(m.fighters[1].state).toBe('dizzy');
    m = step(m, idle, idle, FINISH_TICKS + 1);
    expect(m.phase).toBe('roundOver');
    m = step(m, idle, idle, ROUND_OVER_TICKS + 1);
    expect(m.phase).toBe('matchOver');
    expect(m.matchWinner).toBe(0);
  });

  it('a Toonality é feita com o comando certo no "acabe com ele"', () => {
    let m = fight();
    m.wins = [1, 0];
    m.fighters[1].health = 10;
    m = step(m, input('lp'));
    m = step(m, idle, idle, 30);
    // Kai Volt: → → ↓ + chute alto
    m = step(m, input('right'), idle, 2);
    m = step(m, idle, idle, 2);
    m = step(m, input('right'), idle, 2);
    m = motion(m, 0, [['down']], 'hk');
    expect(m.phase).toBe('toonality');
    expect(m.toonality).toEqual({ player: 0, kind: 'shrink' });
    m = step(m, idle, idle, 400);
    expect(m.phase).toBe('matchOver');
    expect(m.wins[0]).toBe(2);
  });
});

describe('combate', () => {
  it.each([
    [8, true],
    [9, false],
  ])('botão antecipado em %i ticks: executa = %s', (early, executes) => {
    let m = fight();
    m.fighters[0].state = 'hitstun';
    m.fighters[0].stun = early;
    m = step(m, input('hp'));
    m = step(m, idle, idle, early);
    expect(m.fighters[0].state === 'attack').toBe(executes);
    expect(m.fighters[0].moveId).toBe(executes ? 'hp' : null);
  });

  it('o jab acerta de perto e causa hitstun', () => {
    let m = fight();
    m = step(m, input('lp'), idle, 8);
    const nyx = m.fighters[1];
    expect(nyx.health).toBe(1000 - 30);
    expect(nyx.state).toBe('hitstun');
  });

  it('defesa anula dano de golpe normal', () => {
    let m = fight();
    m = step(m, input('lp'), input('block'), 10);
    expect(m.fighters[1].health).toBe(1000);
    expect(m.fighters[1].state).toBe('blockstun');
  });

  it('golpe baixo passa pela defesa em pé, mas não pela agachada', () => {
    const m = fight();
    const standing = step(m, input('down', 'lk'), input('block'), 10);
    expect(standing.fighters[1].health).toBeLessThan(1000);
    const crouching = step(m, input('down', 'lk'), input('block', 'down'), 10);
    expect(crouching.fighters[1].health).toBe(1000);
  });

  it('golpe alto passa por cima de quem está agachado', () => {
    let m = fight();
    m = step(m, idle, input('down'), 2);
    m = step(m, input('lp'), input('down'), 10);
    expect(m.fighters[1].health).toBe(1000);
  });

  it('combo encadeado (jab, jab, direto) com dano decrescente', () => {
    let m = fight();
    const hits: number[] = [];
    const press = (k: Key) => {
      m = step(m, input(k));
      for (let t = 0; t < 9; t++) {
        m = step(m);
        for (const e of m.events) if (e.type === 'hit') hits.push(e.damage);
      }
    };
    press('lp');
    press('lp');
    press('hp');
    expect(hits).toHaveLength(3);
    expect(hits[2]).toBeLessThan(55);
    expect(m.fighters[1].comboHits).toBe(3);
  });

  it('o gancho lança o oponente, que cai e levanta', () => {
    let m = fight();
    m = step(m, input('down', 'hp'), idle, 12);
    expect(m.fighters[1].state).toBe('launched');
    m = settle(m, 80);
    expect(['knockdown', 'getup']).toContain(m.fighters[1].state);
    m = settle(m, 80);
    expect(m.fighters[1].state).toBe('idle');
  });

  it('agarrão não pode ser defendido', () => {
    let m = fight();
    m = step(m, idle, input('block'), 2);
    m = step(m, input('right', 'lp'), input('block'), 10);
    expect(m.fighters[1].state).toBe('thrown');
    expect(m.fighters[1].health).toBe(1000 - 110);
    m = settle(m, 60);
    expect(Math.sign(m.fighters[1].x - m.fighters[0].x)).toBe(-1);
  });

  it('especial de projétil cruza a tela e acerta', () => {
    let m = fight(['kai', 'nyx'], 5);
    m = motion(m, 0, [['down'], ['down', 'right'], ['right']], 'lp');
    expect(m.events.some((e) => e.type === 'special')).toBe(true);
    m = settle(m, 20);
    expect(m.projectiles).toHaveLength(1);
    m = settle(m, 40);
    expect(m.projectiles).toHaveLength(0);
    expect(m.fighters[1].health).toBe(1000 - 70);
  });

  it('especial defendido causa dano reduzido (chip)', () => {
    let m = fight(['kai', 'nyx'], 5);
    m = step(m, idle, input('block'), 1);
    for (const d of [['down'], ['down', 'right'], ['right']] as Key[][])
      m = step(m, input(...d), input('block'), 2);
    m = step(m, input('right', 'lp'), input('block'));
    m = step(m, idle, input('block'), 60);
    expect(m.fighters[1].health).toBe(1000 - Math.round(70 * 0.15));
  });

  it('Kai Volt troca de forma e fica mais forte como Rochedo', () => {
    let m = fight();
    m = step(m, input('down'), idle, 2);
    m = step(m, idle, idle, 2);
    m = motion(m, 0, [['down']], 'hp');
    m = settle(m, 45);
    expect(m.fighters[0].form).toBe(1);
    m = step(m, input('lp'), idle, 8);
    expect(m.fighters[1].health).toBe(1000 - Math.round(30 * 1.3));
  });

  it('pulo sobe e volta para o chão', () => {
    let m = fight();
    m = step(m, input('up'));
    expect(m.fighters[0].state).toBe('air');
    let peak = 0;
    for (let t = 0; t < 60; t++) {
      m = step(m);
      peak = Math.max(peak, m.fighters[0].y);
    }
    expect(peak).toBeGreaterThan(2);
    expect(m.fighters[0].y).toBe(0);
  });

  it('lutadores não se atravessam nem saem da arena', () => {
    let m = fight();
    m = step(m, input('right'), input('right'), 600);
    const [a, b] = m.fighters;
    expect(b.x - a.x).toBeGreaterThanOrEqual(0.79);
    expect(Math.abs(b.x)).toBeLessThanOrEqual(7);
  });
});

describe('treino', () => {
  it('não tem nocaute e a vida volta', () => {
    let m = createMatch({ ...defaultConfig(['kai', 'nyx']), training: true });
    m = step(m, idle, idle, INTRO_TICKS + 1);
    m.fighters[0].x = -0.5;
    m.fighters[1].x = 0.5;
    m.fighters[1].health = 5;
    m.fighters[1].lastHitTick = m.tick;
    m = step(m, input('lp'), idle, 10);
    expect(m.fighters[1].health).toBe(1);
    expect(m.phase).toBe('fight');
    m = step(m, idle, idle, 120);
    expect(m.fighters[1].health).toBe(1000);
  });
});

describe('determinismo', () => {
  it('mesmos inputs geram exatamente o mesmo estado e o anterior não muda', () => {
    const script = (t: number): [PlayerInput, PlayerInput] => [
      input(...(['right', 'lp', 'down', 'hk', 'up'] as Key[]).filter((_, k) => (t >> k) & 1)),
      input(...(['left', 'block', 'hp', 'lk'] as Key[]).filter((_, k) => ((t * 7) >> k) & 1)),
    ];
    const run = () => {
      let m = createMatch(defaultConfig(['ferrum', 'solara']));
      for (let t = 0; t < 2000; t++) m = stepMatch(m, script(t));
      return m;
    };
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));

    const before = createMatch(defaultConfig(['kai', 'nyx']));
    const snapshot = JSON.stringify(before);
    stepMatch(before, [input('right'), input('left')]);
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});
