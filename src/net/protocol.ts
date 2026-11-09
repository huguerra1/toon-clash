import type { CharacterId } from '../combat/types';
import type { StageId } from '../render/stages';

/** Mensagens que o servidor manda para o cliente. */
export type ServerMessage =
  | { type: 'created'; room: string }
  | { type: 'joined'; room: string; side: 0 | 1 }
  | { type: 'peer-joined' }
  | { type: 'peer-left' }
  | { type: 'error'; message: string }
  | { type: 'pong'; t: number }
  | { type: 'relay'; data: PeerMessage };

/** Mensagens que o cliente manda para o servidor. */
export type ClientMessage =
  | { type: 'create' }
  | { type: 'join'; room: string }
  | { type: 'ping'; t: number }
  | { type: 'relay'; data: PeerMessage };

/** Mensagens entre os dois jogadores (o servidor só repassa). */
export type PeerMessage =
  | { type: 'hello'; character: CharacterId }
  | { type: 'start'; characters: [CharacterId, CharacterId]; stage: StageId }
  | InputPacket
  | { type: 'checksum'; game: number; frame: number; value: number }
  | { type: 'rematch' }
  | RtcSignal;

/** Negociação da conexão direta (WebRTC): oferta/resposta SDP ou um candidato ICE. */
export interface RtcSignal {
  type: 'rtc';
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

/**
 * Inputs a partir do frame `from`, um bitmask por frame. Cada pacote repete os últimos
 * inputs (redundância), então perder um pacote não trava a partida.
 */
export interface InputPacket {
  type: 'input';
  /** Número da partida (aumenta a cada revanche) para descartar pacotes atrasados. */
  game?: number;
  from: number;
  masks: number[];
}

/** Código de sala: 4 letras sem caracteres confundíveis (sem I, O, 0, 1). */
export const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const ROOM_CODE_LENGTH = 4;
