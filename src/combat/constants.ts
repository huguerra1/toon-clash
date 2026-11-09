/** Metade da largura da arena (unidades do mundo ≈ metros). */
export const ARENA_HALF_WIDTH = 7;
/** Distância máxima entre os lutadores — a câmera precisa enquadrar os dois. */
export const MAX_SEPARATION = 9;
/** Distância mínima entre os centros (caixas de empurrão). */
export const MIN_DISTANCE = 0.8;
/** Alcance do agarrão comum (→ + soco baixo, de perto). */
export const THROW_RANGE = 1.15;

export const GRAVITY = 0.011;
export const JUMP_VX = 0.075;
export const BACK_WALK_FACTOR = 0.8;
export const HITSTUN_FRICTION = 0.82;

export const LAND_TICKS = 4;
export const LAND_TICKS_AFTER_ATTACK = 8;
export const KNOCKDOWN_TICKS = 40;
export const GETUP_TICKS = 24;
export const THROWN_TICKS = 26;

export const HITSTOP_LIGHT = 5;
export const HITSTOP_HEAVY = 9;
export const HEAVY_DAMAGE = 70;
/** Cada golpe seguido no mesmo combo causa menos dano. */
export const COMBO_SCALING = 0.88;
export const MIN_COMBO_SCALE = 0.4;
/** Depois de tantos golpes no ar, o lutador cai sem poder ser acertado. */
export const JUGGLE_LIMIT = 4;
/** Fração do dano de golpes especiais que passa pela defesa. */
export const CHIP_FACTOR = 0.15;

export const DEFAULT_HITSTUN = 16;
export const DEFAULT_BLOCKSTUN = 10;
export const DEFAULT_KNOCKBACK = 0.06;

export const INTRO_TICKS = 120;
export const ROUND_OVER_TICKS = 210;
export const FINISH_TICKS = 6 * 60;
export const TOONALITY_TICKS = 5 * 60;
/** No treino a vida volta ao máximo depois de tanto tempo sem apanhar. */
export const TRAINING_REFILL_TICKS = 90;
