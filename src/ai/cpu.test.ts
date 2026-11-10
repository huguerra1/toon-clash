import { describe, expect, it } from 'vitest';
import { STARTING_ROSTER } from '../characters/roster';
import type { CharacterId } from '../combat/types';
import { ATTACK_BUTTONS, emptyInput } from '../core/input';
import { type MatchState, createMatch, defaultConfig, stepMatch } from '../game/match';
import { CPU_LEVELS, type CpuLevel, createCpu, cpuInput, dummyInput } from './cpu';

function cpuMatch(chars: [CharacterId, CharacterId], levels: [CpuLevel, CpuLevel], seed = 1) {
  const brains = [createCpu(levels[0], seed), createCpu(levels[1], seed * 7 + 3)] as const;
  let m = createMatch(defaultConfig(chars));
  let hits = 0;
  let specials = 0;
  for (let t = 0; t < 60 * 60 * 8 && m.phase !== 'matchOver'; t++) {
    m = stepMatch(m, [cpuInput(brains[0], m, 0), cpuInput(brains[1], m, 1)]);
    hits += m.events.filter((e) => e.type === 'hit').length;
    specials += m.events.filter((e) => e.type === 'special').length;
  }
  return { m, hits, specials };
}

/** Iniciante sem leitura de golpes: caminha, aperta um botão e às vezes segura defesa. */
function createBeginner(seed: number) {
  let state = seed >>> 0 || 1;
  let wait = 0;
  let blocking = false;
  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  return (match: MatchState, me: 0 | 1) => {
    const input = emptyInput();
    if (match.phase !== 'fight') return input;
    if (wait-- <= 0) {
      wait = 14 + Math.floor(random() * 21);
      blocking = random() < 0.15;
      if (!blocking) input[ATTACK_BUTTONS[Math.floor(random() * ATTACK_BUTTONS.length)]!] = true;
    } else if (!blocking) {
      const toward = match.fighters[me].x < match.fighters[1 - me]!.x ? 'right' : 'left';
      input[toward] = true;
    }
    input.block = blocking;
    return input;
  };
}

describe('CPU', () => {
  it('a dificuldade cresce de forma justa para um iniciante', () => {
    const samples = 24;
    const wins = CPU_LEVELS.map(({ id }) => {
      let victories = 0;
      for (let seed = 1; seed <= samples; seed++) {
        const me = (seed % 2) as 0 | 1;
        const brain = createCpu(id, seed * 7 + 3);
        const beginner = createBeginner(seed);
        // Espelho elimina vantagem de personagem; Solara exige ↓ em todos os especiais.
        let m = createMatch(defaultConfig(['solara', 'solara']));
        let specials = 0;
        for (let t = 0; t < 60 * 60 * 8 && m.phase !== 'matchOver'; t++) {
          const human = beginner(m, me);
          const cpu = cpuInput(brain, m, me === 0 ? 1 : 0);
          m = stepMatch(m, me === 0 ? [human, cpu] : [cpu, human]);
          specials += m.events.filter((e) => e.type === 'special' && e.player === me).length;
        }
        expect(m.phase, `${id}, semente ${seed}`).toBe('matchOver');
        expect(specials).toBe(0);
        if (m.matchWinner === me) victories++;
      }
      return victories;
    });
    console.info('Vitórias do iniciante (24 sementes por nível):', wins);
    expect(wins[0]! / samples).toBeGreaterThanOrEqual(0.6);
    expect(wins[2]! / samples).toBeLessThan(0.5);
    expect(wins[3]! / samples).toBeLessThanOrEqual(0.1);
    for (let i = 1; i < wins.length; i++) expect(wins[i - 1]!).toBeGreaterThan(wins[i]!);
  }, 60_000);

  it('duas CPUs terminam uma partida com vencedor', () => {
    const { m, hits, specials } = cpuMatch(['kai', 'ferrum'], ['dificil', 'medio']);
    expect(m.phase).toBe('matchOver');
    expect(m.matchWinner).not.toBeNull();
    expect(hits).toBeGreaterThan(10);
    expect(specials).toBeGreaterThan(0);
  });

  it('todos os lutadores e níveis jogam sem travar', () => {
    for (const [i, id] of [...STARTING_ROSTER, 'zhaar' as const].entries()) {
      const level = CPU_LEVELS[i % CPU_LEVELS.length]!.id;
      const { m } = cpuMatch(
        [id, STARTING_ROSTER[(i + 1) % STARTING_ROSTER.length]!],
        [level, 'medio'],
        i + 1,
      );
      expect(m.phase).toBe('matchOver');
    }
  }, 30_000);

  it('nível Pesadelo vence o Fácil na maioria das vezes', () => {
    let wins = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const { m } = cpuMatch(['nyx', 'nyx'], ['pesadelo', 'facil'], seed);
      if (m.matchWinner === 0) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(4);
  });

  it('no nível Pesadelo a CPU faz a Toonality quando vence', () => {
    for (const id of STARTING_ROSTER) {
      const brain = createCpu('pesadelo', 5);
      let m = createMatch(defaultConfig([id, 'kai']));
      m.wins = [1, 0];
      for (let t = 0; t < 130; t++) m = stepMatch(m, [emptyInput(), emptyInput()]);
      m.fighters[0].x = 0;
      m.fighters[1].x = 1;
      m.fighters[1].health = 1;
      m = stepMatch(m, [{ ...emptyInput(), lp: true }, emptyInput()]);
      for (let t = 0; t < 400 && m.phase !== 'toonality'; t++) {
        m = stepMatch(m, [cpuInput(brain, m, 0), emptyInput()]);
      }
      expect(m.phase, id).toBe('toonality');
    }
  });

  it('a mesma semente gera a mesma luta', () => {
    const a = cpuMatch(['solara', 'umbra'], ['medio', 'medio'], 42).m;
    const b = cpuMatch(['solara', 'umbra'], ['medio', 'medio'], 42).m;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('boneco de treino', () => {
  it('o modo "sempre defende" segura defesa', () => {
    const m = createMatch(defaultConfig(['kai', 'nyx']));
    expect(dummyInput('defende', m, 1, 0).block).toBe(true);
    expect(dummyInput('agachado', m, 1, 0).down).toBe(true);
    expect(dummyInput('parado', m, 1, 0).block).toBe(false);
  });
});
