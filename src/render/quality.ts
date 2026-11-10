export type QualityLevel = 'alto' | 'baixo';
export type Quality = QualityLevel | 'auto';

export const QUALITY_OPTIONS: readonly Quality[] = ['alto', 'baixo', 'auto'];

export const QUALITY_LABELS: Record<Quality, string> = {
  alto: 'alto (com brilho)',
  baixo: 'baixo (mais leve)',
  auto: 'automático',
};

const STORAGE_KEY = 'toon-clash:qualidade';

/** Nível efetivo inicial: 'baixo' em aparelhos de toque, 'alto' nos demais. */
export function defaultQualityLevel(): QualityLevel {
  if (typeof window === 'undefined') return 'alto';

  try {
    if (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches) {
      return 'baixo';
    }
  } catch {
    // Ambientes sem suporte à consulta de mídia usam a qualidade alta.
  }
  return 'alto';
}

/** Lê a preferência salva ('alto', 'baixo' ou 'auto'); quem não salvou nada fica em 'auto'. */
export function loadQuality(): Quality {
  if (typeof window === 'undefined') return 'auto';

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'alto' || saved === 'baixo' || saved === 'auto') return saved;
  } catch {
    // Armazenamento bloqueado: usa a qualidade automática.
  }

  return 'auto';
}

export function saveQuality(q: Quality): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, q);
  } catch {
    // A indisponibilidade do armazenamento não deve interromper a partida.
  }
}
