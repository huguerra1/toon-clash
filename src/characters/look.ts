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
}
