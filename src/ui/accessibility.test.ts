import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACCESSIBILITY_KEY,
  FLASH_OPTIONS,
  SCREEN_SHAKE_OPTIONS,
  cycleOption,
  defaultAccessibility,
  flashScale,
  loadAccessibility,
  saveAccessibility,
  shakeScale,
} from './accessibility';

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

function stubReducedMotion(reduce: boolean) {
  const matchMedia = vi.fn((query: string) => ({
    matches: reduce && query === '(prefers-reduced-motion: reduce)',
  }));
  vi.stubGlobal('matchMedia', matchMedia);
  return matchMedia;
}

describe('acessibilidade', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
    vi.stubGlobal('matchMedia', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('usa tremor e flashes normais por padrão', () => {
    expect(defaultAccessibility()).toEqual({ screenShake: 'normal', flashes: 'normal' });
    expect(loadAccessibility()).toEqual({ screenShake: 'normal', flashes: 'normal' });
  });

  it('salva e lê as preferências na chave do jogo', () => {
    const storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);
    saveAccessibility({ screenShake: 'desligado', flashes: 'reduzidos' });
    expect(JSON.parse(storage.values.get(ACCESSIBILITY_KEY)!)).toEqual({
      screenShake: 'desligado',
      flashes: 'reduzidos',
    });
    expect(loadAccessibility()).toEqual({ screenShake: 'desligado', flashes: 'reduzidos' });
  });

  it('volta ao padrão com JSON inválido ou valores desconhecidos', () => {
    vi.stubGlobal('localStorage', memoryStorage({ [ACCESSIBILITY_KEY]: '{quebrado' }));
    expect(loadAccessibility()).toEqual({ screenShake: 'normal', flashes: 'normal' });

    vi.stubGlobal('localStorage', memoryStorage({ [ACCESSIBILITY_KEY]: 'null' }));
    expect(loadAccessibility()).toEqual({ screenShake: 'normal', flashes: 'normal' });

    const partial = JSON.stringify({ screenShake: 'tremendo', flashes: 'reduzidos' });
    vi.stubGlobal('localStorage', memoryStorage({ [ACCESSIBILITY_KEY]: partial }));
    expect(loadAccessibility()).toEqual({ screenShake: 'normal', flashes: 'reduzidos' });
  });

  it('funciona sem localStorage ou com armazenamento bloqueado', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(loadAccessibility()).toEqual({ screenShake: 'normal', flashes: 'normal' });
    expect(() => saveAccessibility({ screenShake: 'reduzido', flashes: 'normal' })).not.toThrow();

    const fail = () => {
      throw new Error('Sem permissão');
    };
    vi.stubGlobal('localStorage', { getItem: fail, setItem: fail });
    expect(loadAccessibility()).toEqual({ screenShake: 'normal', flashes: 'normal' });
    expect(() => saveAccessibility({ screenShake: 'reduzido', flashes: 'normal' })).not.toThrow();
  });

  it('converte as preferências em multiplicadores', () => {
    expect(shakeScale('normal')).toBe(1);
    expect(shakeScale('reduzido')).toBe(0.35);
    expect(shakeScale('desligado')).toBe(0);
    expect(flashScale('normal')).toBe(1);
    expect(flashScale('reduzidos')).toBe(0.3);
  });

  it('percorre as opções nos dois sentidos, dando a volta', () => {
    expect(cycleOption(SCREEN_SHAKE_OPTIONS, 'normal', 1)).toBe('reduzido');
    expect(cycleOption(SCREEN_SHAKE_OPTIONS, 'desligado', 1)).toBe('normal');
    expect(cycleOption(SCREEN_SHAKE_OPTIONS, 'normal', -1)).toBe('desligado');
    expect(cycleOption(FLASH_OPTIONS, 'reduzidos', 1)).toBe('normal');
  });

  it('com prefers-reduced-motion o tremor padrão é reduzido', () => {
    const matchMedia = stubReducedMotion(true);
    expect(loadAccessibility()).toEqual({ screenShake: 'reduzido', flashes: 'normal' });
    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });

  it('a preferência salva vence o prefers-reduced-motion', () => {
    stubReducedMotion(true);
    const saved = JSON.stringify({ screenShake: 'normal', flashes: 'normal' });
    vi.stubGlobal('localStorage', memoryStorage({ [ACCESSIBILITY_KEY]: saved }));
    expect(loadAccessibility().screenShake).toBe('normal');
  });

  it('não quebra se matchMedia falhar', () => {
    vi.stubGlobal('matchMedia', () => {
      throw new Error('Sem suporte');
    });
    expect(defaultAccessibility().screenShake).toBe('normal');
  });
});
