/** Descrição visual de um lutador. Dados puros: o renderer monta o modelo 3D a partir disso. */
export type HairStyle = 'spiky' | 'messy' | 'long' | 'hood' | 'crest' | 'bald';

export type LookExtra =
  | 'watch'
  | 'stripe'
  | 'goggles'
  | 'gauntlets'
  | 'cape'
  | 'cannonArm'
  | 'visor'
  | 'shoulderPads'
  | 'ears'
  | 'armor'
  | 'tentacles'
  | 'glowEyes'
  | 'glowHands'
  | 'belt'
  | 'rocks'
  | 'gem'
  | 'potHelmet'
  | 'scarf'
  | 'snout'
  | 'roundEars'
  | 'cap'
  | 'headphones'
  | 'boombox';

export interface CharacterLook {
  skin: number;
  hair: number;
  top: number;
  bottom: number;
  shoes: number;
  /** Cor de detalhe (relógio, óculos, joia…). */
  accent: number;
  /** Cor de brilho dos especiais e projéteis. */
  glow: number;
  hairStyle: HairStyle;
  /** Escala geral do modelo. */
  scale: number;
  /** Largura do corpo (1 = normal). */
  bulk: number;
  extras: LookExtra[];
  /** Corpo semitransparente (gelatina, fantasma…). */
  translucent?: boolean;
  /** Proporções do corpo (1 = padrão) — cada lutador com silhueta própria. */
  proportions?: { head?: number; legs?: number; arms?: number; torso?: number };
  /** Símbolo no peito da roupa. */
  emblem?: EmblemShape;
  /** Jeito de ficar em guarda e de comemorar. */
  personality?: Personality;
  /** Desenho do rosto (padrão: 'visor' com visor, 'glow' com olhos brilhantes, senão 'round'). */
  face?: FaceStyle;
  /** Forma do tronco no modelo do Blender (silhueta reconhecível de longe). Padrão: 'standard'. */
  body?: BodyShape;
  /** Forma da cabeça no modelo do Blender. Padrão: 'round'. */
  headShape?: HeadShape;
}

/**
 * Silhuetas do tronco: 'wedge' triângulo invertido (ombros largos), 'block' quadradão,
 * 'pear' pera (base larga), 'slim' fino e alto, 'blob' gota sem pescoço.
 */
export type BodyShape = 'standard' | 'wedge' | 'block' | 'pear' | 'slim' | 'blob';

/** Formas de cabeça (elipsoides): redonda, larga, alta, feijão, pequena e achatada. */
export type HeadShape = 'round' | 'wide' | 'tall' | 'bean' | 'small' | 'flat';

/** Estilos de rosto desenhado: cada um conta algo da personalidade. */
export type FaceStyle = 'round' | 'sharp' | 'dot' | 'glow' | 'visor' | 'sleepy' | 'lashes';

export type EmblemShape =
  | 'bolt'
  | 'star'
  | 'note'
  | 'leaf'
  | 'gear'
  | 'drop'
  | 'moon'
  | 'crown'
  | 'flame'
  | 'wave'
  | 'cassette'
  | 'shield';

export type Personality =
  | 'hero'
  | 'cool'
  | 'mystic'
  | 'brute'
  | 'royal'
  | 'wild'
  | 'knight'
  | 'goofy'
  | 'lazy'
  | 'dancer'
  | 'villain';
