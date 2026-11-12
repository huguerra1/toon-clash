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
  /** Detalhes da roupa no modelo do Blender (mangas, barras, bolsos, zíper…). */
  outfit?: Outfit;
}

/**
 * Roupa de desenho: cor chapada com poucos detalhes bem escolhidos, cada um com traço de nanquim
 * (barra, gola, punho, bolso, zíper, listra). Cores são 0xRRGGBB.
 */
export interface Outfit {
  /** Mangas: curta (camiseta), comprida (jaqueta, moletom) ou sem manga. Padrão: 'short'. */
  sleeves?: 'short' | 'long' | 'none';
  /** Cor da gola, da barra e dos punhos (padrão: a cor da blusa, um pouco mais escura). */
  trim?: number;
  /** Jaqueta aberta: cor da camiseta que aparece na frente. */
  openFront?: number;
  /** Zíper na frente. */
  zipper?: boolean;
  /** Botões na frente (quantidade) e a cor deles. */
  buttons?: { count: number; color: number };
  /** Bolso no peito. */
  chestPocket?: boolean;
  /** Bolsos da calça (traço curvo na frente). */
  pantsPockets?: boolean;
  /** Barra da calça dobrada, com esta cor. */
  rolledCuffs?: number;
  /** Remendo/joelheira no joelho, com esta cor. */
  kneePatch?: number;
  /** Listra lateral nas mangas e na calça (agasalho esportivo), com esta cor. */
  stripes?: number;
  /** Barra da blusa e das mangas rasgada em zigue-zague. */
  ragged?: boolean;
  /** Bico e listra do tênis, com esta cor. */
  shoeTrim?: number;
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
