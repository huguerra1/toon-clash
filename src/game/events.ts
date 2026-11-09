import type { ToonalityKind } from '../combat/types';

export type PlayerIndex = 0 | 1;

export type AnnounceKind =
  'round' | 'fight' | 'ko' | 'time' | 'draw' | 'perfect' | 'finish' | 'toonality' | 'winner';

/**
 * Acontecimentos de um tick da partida. A lógica só os produz; som, efeitos visuais e HUD
 * reagem a eles. Ficam em MatchState.events e são substituídos a cada tick.
 */
export type GameEvent =
  | {
      type: 'hit';
      attacker: PlayerIndex;
      x: number;
      y: number;
      damage: number;
      heavy: boolean;
      combo: number;
    }
  | { type: 'block'; attacker: PlayerIndex; x: number; y: number }
  | { type: 'armor'; player: PlayerIndex; x: number; y: number }
  | { type: 'whoosh'; player: PlayerIndex; heavy: boolean }
  | { type: 'special'; player: PlayerIndex; move: string; name: string }
  | { type: 'projectile'; player: PlayerIndex; visual: string }
  | { type: 'clash'; x: number; y: number }
  | { type: 'jump'; player: PlayerIndex }
  | { type: 'land'; player: PlayerIndex }
  | { type: 'knockdown'; player: PlayerIndex; x: number }
  | { type: 'throw'; player: PlayerIndex }
  | { type: 'transform'; player: PlayerIndex; form: number }
  | { type: 'teleport'; player: PlayerIndex; fromX: number; toX: number }
  | { type: 'announce'; kind: AnnounceKind; text: string }
  | { type: 'ko'; player: PlayerIndex }
  | { type: 'toonality'; player: PlayerIndex; kind: ToonalityKind; name: string };
