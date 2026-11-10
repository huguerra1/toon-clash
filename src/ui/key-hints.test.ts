import { describe, expect, it } from 'vitest';
import { DEFAULT_FIGHT_KEYS, type Keymap, rebind } from '../core/keymap';
import { LESSONS } from '../game/tutorial';
import { formatKeyHints } from './key-hints';
import { BUTTON_NAMES } from './notation';
import { REMAP_LABELS } from './remap-view';

describe('formatKeyHints', () => {
  it('substitui os marcadores pelas teclas padrão do jogador 1', () => {
    const punches = formatKeyHints('{lp} = Soco Baixo · {hp} = Soco Alto · X / Y');
    expect(punches).toBe('F = Soco Baixo · G = Soco Alto · X / Y');
    const kicks = formatKeyHints('{lk} = Chute Baixo · {hk} = Chute Alto · A / B');
    expect(kicks).toBe('V = Chute Baixo · B = Chute Alto · A / B');
    const walk = formatKeyHints('{left} / {right} · direcional ← →', DEFAULT_FIGHT_KEYS);
    expect(walk).toBe('A / D · direcional ← →');
    expect(formatKeyHints('{up} · direcional ↑', DEFAULT_FIGHT_KEYS)).toBe('W · direcional ↑');
    const lowBlock = formatKeyHints('{down} + {block} · ↓ + LB', DEFAULT_FIGHT_KEYS);
    expect(lowBlock).toBe('S + Espaço · ↓ + LB');
    const special = formatKeyHints('{down}, {down}+{right}, {right} + {lp}', DEFAULT_FIGHT_KEYS);
    expect(special).toBe('S, S+D, D + F');
  });

  it('mostra a tecla nova quando o jogador 1 remapeia um botão', () => {
    let keymap = rebind(DEFAULT_FIGHT_KEYS, 0, 'lp', 'KeyQ');
    keymap = rebind(keymap, 0, 'block', 'ShiftLeft');
    const punches = formatKeyHints('{lp} = Soco Baixo · {hp} = Soco Alto · X / Y', keymap);
    expect(punches).toBe('Q = Soco Baixo · G = Soco Alto · X / Y');
    expect(formatKeyHints('{down} + {block} · ↓ + LB', keymap)).toBe('S + Shift esq. · ↓ + LB');
  });

  it('usa a primeira tecla na ordem do mapa quando um botão tem mais de uma', () => {
    const keymap: Keymap = [{ KeyU: 'lp', Numpad4: 'lp', KeyI: 'hp' }, DEFAULT_FIGHT_KEYS[1]];
    expect(formatKeyHints('{lp}, {lp}, {hp}', keymap)).toBe('U, U, I');
  });

  it('usa "—" quando o botão ficou sem tecla', () => {
    const keymap = rebind(DEFAULT_FIGHT_KEYS, 0, 'lp', 'KeyG');
    const punches = formatKeyHints('{lp} = Soco Baixo · {hp} = Soco Alto · X / Y', keymap);
    expect(punches).toBe('G = Soco Baixo · — = Soco Alto · X / Y');
  });

  it('formata todas as lições do tutorial sem deixar marcadores sobrando', () => {
    for (const lesson of LESSONS) {
      const formatted = formatKeyHints(lesson.keys, DEFAULT_FIGHT_KEYS);
      expect(formatted).not.toMatch(/\{[a-z]+\}/);
    }
  });
});

describe('REMAP_LABELS', () => {
  it('usa os mesmos nomes de botões de ataque de BUTTON_NAMES', () => {
    expect(REMAP_LABELS.lp).toBe(BUTTON_NAMES.lp);
    expect(REMAP_LABELS.hp).toBe(BUTTON_NAMES.hp);
    expect(REMAP_LABELS.lk).toBe(BUTTON_NAMES.lk);
    expect(REMAP_LABELS.hk).toBe(BUTTON_NAMES.hk);
  });
});
