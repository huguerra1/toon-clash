export type Quality = 'alto' | 'baixo';

const STORAGE_KEY = 'toon-clash:qualidade';

/** A preferência salva prevalece sobre a detecção de aparelho de toque. */
export function loadQuality(): Quality {
  if (typeof window === 'undefined') return 'alto';

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'alto' || saved === 'baixo') return saved;
  } catch {
    // Armazenamento bloqueado: usa a preferência padrão do aparelho.
  }

  try {
    if (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches) {
      return 'baixo';
    }
  } catch {
    // Ambientes sem suporte à consulta de mídia usam a qualidade alta.
  }
  return 'alto';
}

export function saveQuality(q: Quality): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, q);
  } catch {
    // A indisponibilidade do armazenamento não deve interromper a partida.
  }
}
