import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultQualityLevel, loadQuality, saveQuality } from './quality';

afterEach(() => vi.unstubAllGlobals());

describe('preferência de qualidade gráfica', () => {
  it('usa modo automático por padrão e permite salvar sem window', () => {
    vi.stubGlobal('window', undefined);
    expect(loadQuality()).toBe('auto');
    expect(defaultQualityLevel()).toBe('alto');
    expect(() => saveQuality('baixo')).not.toThrow();
  });

  it('retorna automático quando nada foi salvo', () => {
    vi.stubGlobal('window', {
      localStorage: { getItem: () => null },
    });
    expect(loadQuality()).toBe('auto');
  });

  it.each(['alto', 'baixo', 'auto'] as const)('respeita a preferência salva: %s', (quality) => {
    const getItem = vi.fn(() => quality);
    const matchMedia = vi.fn(() => ({ matches: true }));
    vi.stubGlobal('window', { localStorage: { getItem }, matchMedia });
    expect(loadQuality()).toBe(quality);
    expect(getItem).toHaveBeenCalledWith('toon-clash:qualidade');
    expect(matchMedia).not.toHaveBeenCalled();
  });

  it('ignora valores salvos inválidos e volta ao automático', () => {
    vi.stubGlobal('window', {
      localStorage: { getItem: () => 'médio' },
      matchMedia: () => ({ matches: true }),
    });
    expect(loadQuality()).toBe('auto');
  });

  it.each([true, false])('detecta ponteiro impreciso no nível inicial: %s', (coarse) => {
    const matchMedia = vi.fn(() => ({ matches: coarse }));
    vi.stubGlobal('window', { matchMedia });
    expect(defaultQualityLevel()).toBe(coarse ? 'baixo' : 'alto');
    expect(matchMedia).toHaveBeenCalledWith('(pointer: coarse)');
  });

  it('usa qualidade alta sem matchMedia ou quando matchMedia lança exceção', () => {
    vi.stubGlobal('window', {});
    expect(defaultQualityLevel()).toBe('alto');

    vi.stubGlobal('window', {
      matchMedia: () => {
        throw new Error('Consulta indisponível');
      },
    });
    expect(defaultQualityLevel()).toBe('alto');
  });

  it.each(['alto', 'baixo', 'auto'] as const)('salva a preferência: %s', (quality) => {
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
    expect(loadQuality()).toBe('auto');
    expect(() => saveQuality('alto')).not.toThrow();
  });
});
