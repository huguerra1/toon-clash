import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadQuality, saveQuality } from './quality';

afterEach(() => vi.unstubAllGlobals());

describe('preferência de qualidade gráfica', () => {
  it('usa qualidade alta e permite salvar sem window', () => {
    vi.stubGlobal('window', undefined);
    expect(loadQuality()).toBe('alto');
    expect(() => saveQuality('baixo')).not.toThrow();
  });

  it.each([true, false])('detecta ponteiro impreciso: %s', (coarse) => {
    const matchMedia = vi.fn(() => ({ matches: coarse }));
    vi.stubGlobal('window', {
      localStorage: { getItem: () => null },
      matchMedia,
    });
    expect(loadQuality()).toBe(coarse ? 'baixo' : 'alto');
    expect(matchMedia).toHaveBeenCalledWith('(pointer: coarse)');
  });

  it.each(['alto', 'baixo'] as const)('respeita a preferência salva: %s', (quality) => {
    const getItem = vi.fn(() => quality);
    const matchMedia = vi.fn(() => ({ matches: quality === 'alto' }));
    vi.stubGlobal('window', { localStorage: { getItem }, matchMedia });
    expect(loadQuality()).toBe(quality);
    expect(getItem).toHaveBeenCalledWith('toon-clash:qualidade');
    expect(matchMedia).not.toHaveBeenCalled();
  });

  it('ignora valores salvos inválidos', () => {
    vi.stubGlobal('window', {
      localStorage: { getItem: () => 'médio' },
      matchMedia: () => ({ matches: true }),
    });
    expect(loadQuality()).toBe('baixo');
  });

  it('detecta toque mesmo quando o acesso ao armazenamento é bloqueado', () => {
    vi.stubGlobal('window', {
      get localStorage() {
        throw new Error('Acesso bloqueado');
      },
      matchMedia: () => ({ matches: true }),
    });
    expect(loadQuality()).toBe('baixo');
    expect(() => saveQuality('baixo')).not.toThrow();
  });

  it('usa qualidade alta sem armazenamento nem matchMedia', () => {
    vi.stubGlobal('window', {});
    expect(loadQuality()).toBe('alto');
  });

  it('usa qualidade alta quando matchMedia lança uma exceção', () => {
    vi.stubGlobal('window', {
      matchMedia: () => {
        throw new Error('Consulta indisponível');
      },
    });
    expect(loadQuality()).toBe('alto');
  });

  it.each(['alto', 'baixo'] as const)('salva a preferência: %s', (quality) => {
    const setItem = vi.fn();
    vi.stubGlobal('window', { localStorage: { setItem } });
    saveQuality(quality);
    expect(setItem).toHaveBeenCalledWith('toon-clash:qualidade', quality);
  });

  it('tolera falhas de leitura e escrita no armazenamento', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem() {
          throw new Error('Leitura bloqueada');
        },
        setItem() {
          throw new Error('Escrita bloqueada');
        },
      },
    });
    expect(loadQuality()).toBe('alto');
    expect(() => saveQuality('alto')).not.toThrow();
  });
});
