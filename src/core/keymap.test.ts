import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_FIGHT_KEYS,
  KEYMAP_KEY,
  type Keymap,
  buttonFor,
  isFightKey,
  keyLabel,
  keysFor,
  keysLabel,
  loadKeymap,
  rebind,
  resetKeymap,
  saveKeymap,
} from './keymap';

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

/** Todas as teclas dos dois jogadores, para checar que nenhuma se repete. */
function allCodes(keymap: Keymap): string[] {
  return [...Object.keys(keymap[0]), ...Object.keys(keymap[1])];
}

describe('keymap', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('padrão', () => {
    it('usa WASD + F G V B + Espaço para o jogador 1', () => {
      const keys = DEFAULT_FIGHT_KEYS;
      expect(keysFor(keys, 0, 'up')).toEqual(['KeyW']);
      expect(keysFor(keys, 0, 'lp')).toEqual(['KeyF']);
      expect(keysFor(keys, 0, 'block')).toEqual(['Space']);
    });

    it('usa setas + K L , . J e atalhos de Numpad para o jogador 2', () => {
      const keys = DEFAULT_FIGHT_KEYS;
      expect(keysFor(keys, 1, 'left')).toEqual(['ArrowLeft']);
      expect(keysFor(keys, 1, 'lp')).toEqual(['KeyK', 'Numpad4']);
      expect(keysFor(keys, 1, 'block')).toEqual(['KeyJ', 'Numpad0']);
    });

    it('não repete teclas entre os jogadores', () => {
      const codes = allCodes(DEFAULT_FIGHT_KEYS);
      expect(new Set(codes).size).toBe(codes.length);
    });

    it('sem nada salvo, carrega o padrão', () => {
      expect(loadKeymap()).toEqual(DEFAULT_FIGHT_KEYS);
    });

    it('consulta só teclas próprias do mapa', () => {
      expect(buttonFor(DEFAULT_FIGHT_KEYS, 0, 'KeyF')).toBe('lp');
      expect(buttonFor(DEFAULT_FIGHT_KEYS, 0, 'KeyK')).toBeUndefined();
      expect(buttonFor(DEFAULT_FIGHT_KEYS, 0, 'toString')).toBeUndefined();
      expect(isFightKey(DEFAULT_FIGHT_KEYS, 'Numpad4')).toBe(true);
      expect(isFightKey(DEFAULT_FIGHT_KEYS, 'KeyQ')).toBe(false);
      expect(isFightKey(DEFAULT_FIGHT_KEYS, 'constructor')).toBe(false);
    });
  });

  describe('leitura e escrita', () => {
    it('salva e lê na chave do jogo', () => {
      const storage = memoryStorage();
      vi.stubGlobal('localStorage', storage);
      const keymap = rebind(DEFAULT_FIGHT_KEYS, 0, 'lp', 'KeyQ');
      saveKeymap(keymap);
      expect(JSON.parse(storage.values.get(KEYMAP_KEY)!)).toEqual(keymap);
      expect(loadKeymap()).toEqual(keymap);
    });

    it('volta ao padrão com JSON inválido', () => {
      vi.stubGlobal('localStorage', memoryStorage({ [KEYMAP_KEY]: '{quebrado' }));
      expect(loadKeymap()).toEqual(DEFAULT_FIGHT_KEYS);
    });

    it('volta ao padrão com formato errado', () => {
      const invalid = [
        'null',
        '{}',
        '[{}]',
        '[{}, {}, {}]',
        '[[], {}]',
        '[{"KeyF": "soco"}, {}]',
        '[{"KeyF": 3}, {}]',
        '[{"Key F": "lp"}, {}]',
        '[{"<img>": "lp"}, {}]',
        '[{"KeyF": "lp"}, {"KeyF": "hp"}]',
      ];
      for (const raw of invalid) {
        vi.stubGlobal('localStorage', memoryStorage({ [KEYMAP_KEY]: raw }));
        expect(loadKeymap(), raw).toEqual(DEFAULT_FIGHT_KEYS);
      }
    });

    it('funciona sem localStorage ou com armazenamento bloqueado', () => {
      vi.stubGlobal('localStorage', undefined);
      expect(loadKeymap()).toEqual(DEFAULT_FIGHT_KEYS);
      expect(() => saveKeymap(DEFAULT_FIGHT_KEYS)).not.toThrow();

      const fail = () => {
        throw new Error('Sem permissão');
      };
      vi.stubGlobal('localStorage', { getItem: fail, setItem: fail });
      expect(loadKeymap()).toEqual(DEFAULT_FIGHT_KEYS);
      expect(() => saveKeymap(DEFAULT_FIGHT_KEYS)).not.toThrow();
    });
  });

  describe('rebind', () => {
    it('troca a tecla de um botão por uma tecla livre', () => {
      const keymap = rebind(DEFAULT_FIGHT_KEYS, 0, 'lp', 'KeyQ');
      expect(keysFor(keymap, 0, 'lp')).toEqual(['KeyQ']);
      expect(buttonFor(keymap, 0, 'KeyF')).toBeUndefined();
      expect(keysFor(keymap, 0, 'hp')).toEqual(['KeyG']);
    });

    it('no jogador 2 remove também o Numpad do botão, mas mantém os dos outros botões', () => {
      const keymap = rebind(DEFAULT_FIGHT_KEYS, 1, 'lp', 'KeyU');
      expect(keysFor(keymap, 1, 'lp')).toEqual(['KeyU']);
      expect(buttonFor(keymap, 1, 'Numpad4')).toBeUndefined();
      expect(keysFor(keymap, 1, 'hp')).toEqual(['KeyL', 'Numpad5']);
      expect(keysFor(keymap, 1, 'block')).toEqual(['KeyJ', 'Numpad0']);
    });

    it('tira a tecla do outro botão do mesmo jogador', () => {
      const keymap = rebind(DEFAULT_FIGHT_KEYS, 0, 'lp', 'KeyG');
      expect(keysFor(keymap, 0, 'lp')).toEqual(['KeyG']);
      expect(keysFor(keymap, 0, 'hp')).toEqual([]);
    });

    it('tira a tecla do outro jogador', () => {
      const keymap = rebind(DEFAULT_FIGHT_KEYS, 0, 'hk', 'KeyK');
      expect(keysFor(keymap, 0, 'hk')).toEqual(['KeyK']);
      expect(buttonFor(keymap, 1, 'KeyK')).toBeUndefined();
      expect(keysFor(keymap, 1, 'lp')).toEqual(['Numpad4']);
      const codes = allCodes(keymap);
      expect(new Set(codes).size).toBe(codes.length);
    });

    it('pode pegar um atalho de Numpad do jogador 2 para o jogador 1', () => {
      const keymap = rebind(DEFAULT_FIGHT_KEYS, 0, 'block', 'Numpad0');
      expect(keysFor(keymap, 0, 'block')).toEqual(['Numpad0']);
      expect(keysFor(keymap, 1, 'block')).toEqual(['KeyJ']);
    });

    it('reaplicar a mesma tecla deixa o mapa igual', () => {
      const keymap = rebind(DEFAULT_FIGHT_KEYS, 0, 'lp', 'KeyF');
      expect(keymap).toEqual(DEFAULT_FIGHT_KEYS);
    });

    it('não muta o keymap original', () => {
      const original = resetKeymap();
      const copy = structuredClone(original);
      const next = rebind(original, 1, 'hp', 'KeyF');
      expect(original).toEqual(copy);
      expect(next).not.toBe(original);
      expect(next[0]).not.toBe(original[0]);
      expect(next[1]).not.toBe(original[1]);
    });

    it('ignora códigos de tecla inválidos', () => {
      const keymap = rebind(DEFAULT_FIGHT_KEYS, 1, 'lp', '');
      expect(keymap).toEqual(DEFAULT_FIGHT_KEYS);
      expect(keymap[1]).not.toBe(DEFAULT_FIGHT_KEYS[1]);
    });
  });

  it('resetKeymap devolve uma cópia nova do padrão', () => {
    const a = resetKeymap();
    const b = resetKeymap();
    expect(a).toEqual(DEFAULT_FIGHT_KEYS);
    expect(a[0]).not.toBe(DEFAULT_FIGHT_KEYS[0]);
    expect(a[0]).not.toBe(b[0]);
  });

  it('keyLabel dá nomes legíveis às teclas', () => {
    expect(keyLabel('KeyF')).toBe('F');
    expect(keyLabel('Digit7')).toBe('7');
    expect(keyLabel('ArrowLeft')).toBe('Seta esquerda');
    expect(keyLabel('ArrowUp')).toBe('Seta cima');
    expect(keyLabel('Space')).toBe('Espaço');
    expect(keyLabel('Comma')).toBe(',');
    expect(keyLabel('Period')).toBe('.');
    expect(keyLabel('Numpad4')).toBe('Num 4');
    expect(keyLabel('NumpadAdd')).toBe('Num +');
    expect(keyLabel('ShiftLeft')).toBe('Shift esq.');
    expect(keyLabel('F5')).toBe('F5');
    expect(keyLabel('toString')).toBe('toString');
  });

  it('keysLabel junta as teclas de um botão', () => {
    expect(keysLabel(DEFAULT_FIGHT_KEYS, 0, 'block')).toBe('Espaço');
    expect(keysLabel(DEFAULT_FIGHT_KEYS, 1, 'lk')).toBe(', ou Num 1');
    const keymap = rebind(DEFAULT_FIGHT_KEYS, 0, 'lp', 'KeyG');
    expect(keysLabel(keymap, 0, 'hp')).toBe('—');
  });
});
