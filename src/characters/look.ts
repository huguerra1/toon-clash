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
}

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
