import { describe, expect, it } from 'vitest';
import { type PlayerInput, decodeInput, emptyInput, encodeInput } from '../core/input';
import type { GameEvent } from '../game/events';
import { type MatchState, createMatch, defaultConfig, stepMatch } from '../game/match';
import type { InputPacket } from './protocol';
import { RollbackSession, checksum } from './rollback';

const DELAY = 2;

/** Inputs "aleatórios" mas determinísticos por lado e frame. */
function script(side: 0 | 1, frame: number): PlayerInput {
  if (frame < DELAY) return decodeInput(0);
  const x = Math.imul(frame * 2654435761 + side * 97, 2246822519) >>> 0;
  // Muda de ideia a cada ~8 frames, como uma pessoa.
  const slot = Math.floor(frame / 8);
  const y = Math.imul(slot * 40503 + side * 7919, 2654435761) >>> 0;
  return decodeInput((y >>> 3) & 0x1ff & (x & 1 ? 0x1ff : 0x10f));
}

function reference(frames: number): MatchState {
  let m = createMatch(defaultConfig(['kai', 'umbra']));
  for (let f = 0; f < frames; f++) m = stepMatch(m, [script(0, f), script(1, f)]);
  return m;
}

interface Wire {
  packet: InputPacket;
  at: number;
}

function play(latency: number, jitter: number, drop: number, frames: number) {
  const initial = createMatch(defaultConfig(['kai', 'umbra']));
  const peers = [
    new RollbackSession(initial, 0, { delay: DELAY }),
    new RollbackSession(initial, 1, { delay: DELAY }),
  ];
  const wires: [Wire[], Wire[]] = [[], []];
  let seed = 7;
  const rand = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return seed / 4294967296;
  };
  let rollbacks = 0;
  let stalls = 0;
  for (
    let tick = 0;
    tick < frames * 4 && (peers[0]!.frame < frames || peers[1]!.frame < frames);
    tick++
  ) {
    for (const side of [0, 1] as const) {
      const peer = peers[side]!;
      if (peer.frame >= frames) continue;
      const packet = peer.pushLocal(script(side, peer.frame + DELAY));
      if (rand() >= drop)
        wires[side].push({ packet, at: tick + latency + Math.floor(rand() * jitter) });
    }
    for (const side of [0, 1] as const) {
      const other = peers[1 - side]!;
      const due = wires[side].filter((w) => w.at <= tick);
      wires[side] = wires[side].filter((w) => w.at > tick);
      for (const w of due) other.receive(w.packet);
    }
    for (const peer of peers) {
      if (peer.frame >= frames) continue;
      const result = peer.advance();
      if (!result) stalls++;
      else rollbacks += result.rolledBack;
    }
  }
  // Entrega o que sobrou para confirmar os últimos frames.
  for (const side of [0, 1] as const)
    for (const w of wires[side]) peers[1 - side]!.receive(w.packet);
  return { peers, rollbacks, stalls };
}

describe('RollbackSession', () => {
  it('sem atraso de rede os dois lados ficam iguais à simulação local', () => {
    const { peers } = play(0, 1, 0, 400);
    const ref = JSON.stringify(reference(400));
    expect(JSON.stringify(peers[0]!.current)).toBe(ref);
    expect(JSON.stringify(peers[1]!.current)).toBe(ref);
  });

  it('com atraso, variação e pacotes perdidos, corrige com rollback e termina igual', () => {
    const frames = 900;
    const { peers, rollbacks } = play(5, 4, 0.2, frames);
    expect(rollbacks).toBeGreaterThan(0);
    for (const peer of peers) {
      expect(peer.frame).toBe(frames);
    }
    // Só frames confirmados pelos dois lados se comparam: os últimos ainda usam input previsto.
    const confirmed = frames - 60;
    expect(peers[0]!.checksumFor(confirmed)).not.toBeNull();
    expect(peers[0]!.checksumFor(confirmed)).toBe(peers[1]!.checksumFor(confirmed));
    expect(peers[0]!.checksumFor(confirmed)).toBe(checksum(reference(confirmed + 1)));
  });

  it('mostra eventos que só aparecem depois do rollback, sem repetir os já mostrados', () => {
    const initial = createMatch(defaultConfig(['kai', 'umbra']));
    initial.phase = 'fight';
    const up = encodeInput({ ...emptyInput(), up: true });
    const peer = new RollbackSession(initial, 0, { delay: 2 });
    const seen: GameEvent[] = [];
    // O jogador local pula; o remoto também, mas o input dele só chega depois.
    for (let t = 0; t < 8; t++) {
      peer.pushLocal(decodeInput(up));
      seen.push(...peer.advance()!.events);
    }
    peer.receive({ type: 'input', from: 2, masks: Array<number>(6).fill(up) });
    peer.pushLocal(decodeInput(up));
    const result = peer.advance()!;
    seen.push(...result.events);

    expect(result.rolledBack).toBeGreaterThan(0);
    const jumps = (player: number) =>
      seen.filter((e) => e.type === 'jump' && e.player === player).length;
    expect(jumps(0)).toBe(1);
    expect(jumps(1)).toBe(1);
  });

  it('a soma de verificação muda com qualquer campo do estado', () => {
    const a = createMatch(defaultConfig(['kai', 'umbra']));
    const b = structuredClone(a);
    b.fighters[0].vx = 0.01;
    expect(checksum(b)).not.toBe(checksum(a));
    expect(checksum(structuredClone(a))).toBe(checksum(a));
  });

  it('espera o outro jogador quando ele some', () => {
    const initial = createMatch(defaultConfig(['kai', 'umbra']));
    const peer = new RollbackSession(initial, 0, { delay: 2, maxPrediction: 8 });
    let advanced = 0;
    for (let t = 0; t < 50; t++) {
      peer.pushLocal(decodeInput(0));
      if (peer.advance()) advanced++;
    }
    expect(advanced).toBeLessThanOrEqual(2 + 8);
    expect(peer.prediction).toBe(8);
  });
});
