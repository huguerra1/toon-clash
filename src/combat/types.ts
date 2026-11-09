import type { AttackButton } from '../core/input';

/**
 * Caixa de colisão em "espaço do lutador": x é medido para a frente a partir do centro do
 * lutador (espelhado quando ele olha para a esquerda), y a partir dos pés.
 */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Passo de um comando especial, relativo ao lado para onde o lutador olha. */
export type MotionStep = 'F' | 'B' | 'D' | 'U' | 'DF' | 'DB';

/** Onde o golpe precisa ser defendido: baixo só agachado, overhead só em pé. */
export type AttackHeight = 'high' | 'mid' | 'low' | 'overhead';

/** Animação que o renderer usa para o golpe. */
export type AnimKind =
  | 'jab'
  | 'cross'
  | 'frontKick'
  | 'roundhouse'
  | 'crouchJab'
  | 'uppercut'
  | 'lowKick'
  | 'sweep'
  | 'airPunch'
  | 'airKick'
  | 'throw'
  | 'projectile'
  | 'dash'
  | 'slash'
  | 'slam'
  | 'rising'
  | 'teleport'
  | 'burst'
  | 'transform'
  | 'grab'
  | 'stomp';

export interface ProjectileDef {
  speed: number;
  w: number;
  h: number;
  /** Altura do centro do projétil a partir dos pés de quem atira. */
  y: number;
  damage: number;
  hitstun: number;
  knockdown?: boolean;
  /** Duração máxima em ticks. */
  life: number;
  visual: string;
}

/** Golpe. Todas as durações são em ticks (60 por segundo). */
export interface MoveDef {
  name: string;
  anim: AnimKind;
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  hitstun?: number;
  blockstun?: number;
  hitbox?: Box;
  height?: AttackHeight;
  /** Velocidade de empurrão aplicada em quem apanha. */
  knockback?: number;
  /** Velocidade vertical aplicada em quem apanha (lança para o alto). */
  launch?: number;
  knockdown?: boolean;
  /** Agarrão: não pode ser defendido. */
  throw?: boolean;
  /** Golpe especial: pode cancelar normais e causa dano mesmo na defesa. */
  special?: boolean;
  /** Golpes normais que podem emendar este quando ele acerta ou é defendido. */
  chain?: string[];
  projectile?: ProjectileDef;
  /** Avanço durante os ticks [from, to). */
  dash?: { vx: number; from: number; to: number };
  /** Salto no fim do startup (golpes aéreos ascendentes). */
  rise?: { vx: number; vy: number };
  /** Reaparece atrás do oponente no fim do startup. */
  teleport?: boolean;
  /** Absorve um golpe sem sair do ataque. */
  armor?: boolean;
  /** Ticks de invencibilidade a partir do início do golpe. */
  invulnerable?: number;
  /** Troca a forma do lutador (Kai Volt). */
  cycleForm?: boolean;
  /** Dica visual para o renderer (arma, aura, animal…). */
  visual?: string;
}

export interface SpecialDef {
  motion: MotionStep[];
  button: AttackButton;
  move: string;
  air?: boolean;
}

export interface FormDef {
  name: string;
  damageMul: number;
  speedMul: number;
}

export type ToonalityKind =
  | 'shrink'
  | 'blocks'
  | 'portal'
  | 'anvil'
  | 'star'
  | 'stampede'
  | 'trophy'
  | 'pie'
  | 'jelly'
  | 'pixel'
  | 'speaker';

export interface ToonalityDef {
  name: string;
  motion: MotionStep[];
  button: AttackButton;
  kind: ToonalityKind;
}

export type CharacterId =
  | 'kai'
  | 'nyx'
  | 'umbra'
  | 'ferrum'
  | 'solara'
  | 'feral'
  | 'pipoca'
  | 'gelatino'
  | 'capi'
  | 'lola'
  | 'zhaar';

export interface CharacterDef {
  id: CharacterId;
  name: string;
  /** Apelido mostrado na seleção. */
  title: string;
  bio: string;
  pronoun: 'ele' | 'ela';
  boss?: boolean;
  maxHealth: number;
  walkSpeed: number;
  jumpVelocity: number;
  /** Altura da hurtbox em pé. */
  height: number;
  damageMul: number;
  moves: Record<string, MoveDef>;
  specials: SpecialDef[];
  toonality: ToonalityDef;
  forms?: FormDef[];
}
