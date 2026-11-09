import { type PlayerInput, decodeInput, encodeInput } from '../core/input';
import type { GameEvent } from '../game/events';
import { type MatchState, stepMatch } from '../game/match';
import type { InputPacket } from './protocol';

export interface RollbackOptions {
  /** Atraso aplicado ao input local, em frames: menos rollbacks, um pouco mais de "peso". */
  delay?: number;
  /** Quantos frames podemos prever à frente antes de esperar o outro jogador. */
  maxPrediction?: number;
  /** Quantos inputs antigos vão repetidos em cada pacote. */
  redundancy?: number;
  /** De quantos em quantos frames calcular a soma de verificação. */
  checksumEvery?: number;
}

export interface AdvanceResult {
  match: MatchState;
  /**
   * Eventos do frame novo, mais os que só existem na linha do tempo corrigida pelo rollback
   * (ex.: um golpe que a previsão errada não mostrou). Os que já foram mostrados não se repetem.
   */
  events: GameEvent[];
  rolledBack: number;
}

/**
 * Netcode com rollback (estilo GGPO). Cada lado simula na hora usando a previsão de que o
 * outro jogador continua apertando o mesmo de antes. Quando o input real chega e é diferente,
 * volta ao último estado certo e resimula até o frame atual. Funciona porque stepMatch é
 * determinístico e não altera o estado anterior.
 */
export class RollbackSession {
  /** Próximo frame a simular. */
  frame = 0;
  private readonly delay: number;
  private readonly maxPrediction: number;
  private readonly redundancy: number;
  private readonly checksumEvery: number;
  /** Estado antes de simular cada frame. */
  private readonly states = new Map<number, MatchState>();
  private readonly inputs: [Map<number, number>, Map<number, number>] = [new Map(), new Map()];
  /** Input remoto que usamos (previsto ou real) em cada frame já simulado. */
  private readonly usedRemote = new Map<number, number>();
  /** Maior frame remoto confirmado sem lacunas. */
  private confirmedRemote = -1;
  private rollbackFrom: number | null = null;
  private lastLocalFrame = -1;
  /** Eventos já mostrados em cada frame (por eventKey), para o rollback não repetir efeitos. */
  private readonly shown = new Map<number, string[]>();
  private readonly checksums = new Map<number, number>();
  private readonly remoteChecksums = new Map<number, number>();
  private fresh: { frame: number; value: number }[] = [];
  private lastChecked = -1;
  onDesync: ((frame: number) => void) | null = null;

  constructor(
    initial: MatchState,
    readonly local: 0 | 1,
    options: RollbackOptions = {},
  ) {
    this.delay = options.delay ?? 2;
    this.maxPrediction = options.maxPrediction ?? 10;
    this.redundancy = options.redundancy ?? 12;
    this.checksumEvery = options.checksumEvery ?? 60;
    this.states.set(0, initial);
    // Os primeiros frames (dentro do atraso) não têm input de ninguém.
    for (let f = 0; f < this.delay; f++) {
      this.inputs[0].set(f, 0);
      this.inputs[1].set(f, 0);
    }
    this.confirmedRemote = this.delay - 1;
  }

  get remote(): 0 | 1 {
    return this.local === 0 ? 1 : 0;
  }

  /** Quantos frames estamos à frente do último input confirmado do outro lado. */
  get prediction(): number {
    return this.frame - 1 - this.confirmedRemote;
  }

  /** Registra o input local deste tick e devolve o pacote para enviar. */
  pushLocal(input: PlayerInput): InputPacket {
    const target = this.frame + this.delay;
    if (target > this.lastLocalFrame) {
      this.inputs[this.local].set(target, encodeInput(input));
      this.lastLocalFrame = target;
    }
    const from = Math.max(0, this.lastLocalFrame - this.redundancy + 1);
    const masks: number[] = [];
    for (let f = from; f <= this.lastLocalFrame; f++)
      masks.push(this.inputs[this.local].get(f) ?? 0);
    return { type: 'input', from, masks };
  }

  /** Recebe inputs do outro jogador. */
  receive(packet: InputPacket): void {
    const remote = this.inputs[this.remote];
    packet.masks.forEach((mask, k) => {
      const f = packet.from + k;
      if (remote.has(f)) return;
      remote.set(f, mask);
      const used = this.usedRemote.get(f);
      if (used !== undefined && used !== mask) {
        this.rollbackFrom = this.rollbackFrom === null ? f : Math.min(this.rollbackFrom, f);
      }
    });
    while (remote.has(this.confirmedRemote + 1)) this.confirmedRemote++;
  }

  /** Avança um frame. Devolve null quando precisa esperar o outro jogador. */
  advance(): AdvanceResult | null {
    if (this.prediction >= this.maxPrediction) return null;
    if (!this.inputs[this.local].has(this.frame)) return null;

    let rolledBack = 0;
    const events: GameEvent[] = [];
    // Eventos mostrados nos frames refeitos. Um evento corrigido que "casa" com um deles já foi
    // visto (mesmo que um ou dois frames antes ou depois) e não é mostrado de novo.
    const pool: string[] = [];
    if (this.rollbackFrom !== null && this.rollbackFrom < this.frame) {
      const start = this.rollbackFrom;
      for (let f = start; f < this.frame; f++) pool.push(...(this.shown.get(f) ?? []));
      for (let f = start; f < this.frame; f++) {
        const { match } = this.simulate(f);
        this.states.set(f + 1, match);
        this.shown.set(f, collectNew(match.events, pool, events));
        rolledBack++;
      }
    }
    this.rollbackFrom = null;

    const { match } = this.simulate(this.frame);
    this.shown.set(this.frame, collectNew(match.events, pool, events));
    this.frame++;
    this.states.set(this.frame, match);
    this.recordChecksums();
    this.prune();
    return { match, events, rolledBack };
  }

  /** Estado do último frame simulado. */
  get current(): MatchState {
    return this.states.get(this.frame)!;
  }

  /** Soma de verificação de um frame já confirmado pelos dois lados (ou null). */
  checksumFor(frame: number): number | null {
    return this.checksums.get(frame) ?? null;
  }

  /** Somas calculadas desde a última chamada, para mandar ao outro jogador. */
  takeChecksums(): { frame: number; value: number }[] {
    const out = this.fresh;
    this.fresh = [];
    return out;
  }

  /** Compara com a soma do outro lado; avisa em onDesync se forem diferentes. */
  compareChecksum(frame: number, value: number): void {
    const mine = this.checksums.get(frame);
    if (mine === undefined) this.remoteChecksums.set(frame, value);
    else if (mine !== value) this.onDesync?.(frame);
  }

  /**
   * Frames confirmados pelos dois lados não mudam mais: calcula a soma deles antes que o
   * estado seja descartado. Roda depois do rollback, então usa os estados já corrigidos.
   */
  private recordChecksums(): void {
    const upTo = Math.min(this.confirmedRemote, this.frame - 1);
    for (let f = this.lastChecked + 1; f <= upTo; f++) {
      const state = this.states.get(f + 1);
      if (f % this.checksumEvery !== 0 || !state) continue;
      const value = checksum(state);
      this.checksums.set(f, value);
      this.fresh.push({ frame: f, value });
      const theirs = this.remoteChecksums.get(f);
      if (theirs !== undefined && theirs !== value) this.onDesync?.(f);
    }
    this.lastChecked = Math.max(this.lastChecked, upTo);
  }
  private simulate(f: number): { match: MatchState; events: GameEvent[] } {
    const before = this.states.get(f)!;
    const local = this.inputs[this.local].get(f) ?? 0;
    const remote = this.inputs[this.remote].get(f) ?? this.predictRemote();
    this.usedRemote.set(f, remote);
    const pair: [PlayerInput, PlayerInput] =
      this.local === 0
        ? [decodeInput(local), decodeInput(remote)]
        : [decodeInput(remote), decodeInput(local)];
    const match = stepMatch(before, pair);
    return { match, events: match.events };
  }

  /** Previsão simples: o outro jogador segura o mesmo que segurava no último input conhecido. */
  private predictRemote(): number {
    return this.inputs[this.remote].get(this.confirmedRemote) ?? 0;
  }

  private prune(): void {
    const keepFrom = Math.min(this.frame, this.confirmedRemote + 1) - 2;
    for (const f of this.states.keys()) if (f < keepFrom) this.states.delete(f);
    for (const f of this.usedRemote.keys()) if (f < keepFrom) this.usedRemote.delete(f);
    for (const f of this.shown.keys()) if (f < keepFrom) this.shown.delete(f);
    for (const map of this.inputs)
      for (const f of map.keys()) if (f < keepFrom - this.redundancy) map.delete(f);
    for (const map of [this.checksums, this.remoteChecksums])
      for (const f of map.keys()) if (f < this.frame - 600) map.delete(f);
  }
}

/**
 * Identidade de um evento sem posição nem valores (x, dano, combo), que mudam um pouco entre a
 * linha do tempo prevista e a corrigida.
 */
function eventKey(e: GameEvent): string {
  const who = 'player' in e ? e.player : 'attacker' in e ? e.attacker : '';
  const what = 'kind' in e ? e.kind : 'move' in e ? e.move : 'visual' in e ? e.visual : '';
  return `${e.type}|${who}|${what}`;
}

/**
 * Põe em `out` os eventos do frame que não estão em `pool` (consumindo os que estão) e devolve
 * as chaves de todos os eventos do frame.
 */
function collectNew(frameEvents: readonly GameEvent[], pool: string[], out: GameEvent[]): string[] {
  return frameEvents.map((e) => {
    const key = eventKey(e);
    const at = pool.indexOf(key);
    if (at >= 0) pool.splice(at, 1);
    else out.push(e);
    return key;
  });
}

/**
 * Hash rápido (FNV-1a) do estado inteiro, menos os eventos do tick: qualquer divergência
 * (velocidade, stun, combo, forma, projéteis…) aparece já na próxima soma. JSON.stringify
 * escreve números do mesmo jeito em qualquer navegador.
 */
export function checksum(m: MatchState): number {
  const text = JSON.stringify({ ...m, events: [] });
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
