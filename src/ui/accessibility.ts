/** Preferências de acessibilidade visual. Só afetam o desenho, nunca as regras do jogo. */

export type ScreenShake = 'normal' | 'reduzido' | 'desligado';
export type Flashes = 'normal' | 'reduzidos';
/** 'desenho' segura cada pose por alguns quadros, como animação de TV feita à mão ("em dois"). */
export type AnimationStyle = 'suave' | 'desenho';

export interface AccessibilityPrefs {
  screenShake: ScreenShake;
  flashes: Flashes;
  animation: AnimationStyle;
}

export const ACCESSIBILITY_KEY = 'toon-clash:acessibilidade';
export const SCREEN_SHAKE_OPTIONS: readonly ScreenShake[] = ['normal', 'reduzido', 'desligado'];
export const FLASH_OPTIONS: readonly Flashes[] = ['normal', 'reduzidos'];
export const ANIMATION_OPTIONS: readonly AnimationStyle[] = ['suave', 'desenho'];

/**
 * Quanto tempo cada pose fica parada no estilo 'desenho': 1/15 s (4 quadros da lógica).
 * Mais que isso esconderia golpes rápidos; o início de cada golpe sempre aparece na hora.
 */
const POSE_HOLD: Record<AnimationStyle, number> = { suave: 0, desenho: 1 / 15 };

export function poseHold(animation: AnimationStyle): number {
  return POSE_HOLD[animation];
}

const SHAKE_SCALE: Record<ScreenShake, number> = { normal: 1, reduzido: 0.35, desligado: 0 };
const FLASH_SCALE: Record<Flashes, number> = { normal: 1, reduzidos: 0.3 };

/** Multiplicador da intensidade do tremor de câmera. */
export function shakeScale(screenShake: ScreenShake): number {
  return SHAKE_SCALE[screenShake];
}

/** Multiplicador da intensidade do clarão branco ao apanhar. */
export function flashScale(flashes: Flashes): number {
  return FLASH_SCALE[flashes];
}

/** Próximo valor da lista (step 1) ou anterior (step -1), dando a volta nas pontas. */
export function cycleOption<T>(options: readonly T[], current: T, step: 1 | -1): T {
  const index = Math.max(0, options.indexOf(current));
  return options[(index + step + options.length) % options.length]!;
}

/** Sistema operacional pediu menos movimento na tela. */
export function prefersReducedMotion(): boolean {
  try {
    const matchMedia = globalThis.matchMedia;
    if (typeof matchMedia !== 'function') return false;
    return matchMedia('(prefers-reduced-motion: reduce)').matches === true;
  } catch {
    return false;
  }
}

export function defaultAccessibility(): AccessibilityPrefs {
  return {
    screenShake: prefersReducedMotion() ? 'reduzido' : 'normal',
    flashes: 'normal',
    animation: 'suave',
  };
}

/** Lê as preferências salvas; campos ausentes ou inválidos voltam ao padrão. */
export function loadAccessibility(): AccessibilityPrefs {
  const prefs = defaultAccessibility();
  let saved: unknown = null;
  try {
    const raw = globalThis.localStorage?.getItem(ACCESSIBILITY_KEY) ?? null;
    if (raw !== null) saved = JSON.parse(raw);
  } catch {
    return prefs;
  }
  if (typeof saved !== 'object' || saved === null) return prefs;
  const { screenShake, flashes, animation } = saved as Record<string, unknown>;
  if (SCREEN_SHAKE_OPTIONS.includes(screenShake as ScreenShake)) {
    prefs.screenShake = screenShake as ScreenShake;
  }
  if (FLASH_OPTIONS.includes(flashes as Flashes)) prefs.flashes = flashes as Flashes;
  if (ANIMATION_OPTIONS.includes(animation as AnimationStyle)) {
    prefs.animation = animation as AnimationStyle;
  }
  return prefs;
}

export function saveAccessibility(prefs: AccessibilityPrefs): void {
  try {
    globalThis.localStorage?.setItem(
      ACCESSIBILITY_KEY,
      JSON.stringify({
        screenShake: prefs.screenShake,
        flashes: prefs.flashes,
        animation: prefs.animation,
      }),
    );
  } catch {
    /* Armazenamento bloqueado não deve interromper o jogo. */
  }
}
