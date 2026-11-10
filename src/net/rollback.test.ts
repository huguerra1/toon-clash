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

interface TrafficOptions {
  burstLength?: number;
  duplicate?: boolean;
  latencyBySide?: [number, number];
}

function play(
  latency: number,
  jitter: number,
  drop: number,
  frames: number,
  traffic: TrafficOptions = {},
) {
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
  let dropped = 0;
  let reordered = 0;
  let duplicates = 0;
  const latestDelivered = [-1, -1];
  const delivered: [Set<number>, Set<number>] = [new Set(), new Set()];
  const burstStart = traffic.burstLength ? 120 + Math.floor(rand() * 20) : -1;
  for (
    let tick = 0;
    tick < frames * 4 && (peers[0]!.frame < frames || peers[1]!.frame < frames);
    tick++
  ) {
    for (const side of [0, 1] as const) {
      const peer = peers[side]!;
      if (peer.frame >= frames) continue;
      const packet = peer.pushLocal(script(side, peer.frame + DELAY));
      const inBurst = tick >= burstStart && tick < burstStart + (traffic.burstLength ?? 0);
      if (rand() < drop || inBurst) {
        dropped++;
        continue;
      }
      const at = tick + (traffic.latencyBySide?.[side] ?? latency) + Math.floor(rand() * jitter);
      wires[side].push({ packet, at });
      if (traffic.duplicate) wires[side].push({ packet, at: at + 1 + Math.floor(rand() * 5) });
    }
    for (const side of [0, 1] as const) {
      const other = peers[1 - side]!;
      const due = wires[side].filter((w) => w.at <= tick);
      wires[side] = wires[side].filter((w) => w.at > tick);
      for (const w of due) {
        const last = w.packet.from + w.packet.masks.length - 1;
        if (delivered[side].has(last)) duplicates++;
        else if (last < latestDelivered[side]!) reordered++;
        delivered[side].add(last);
        latestDelivered[side] = Math.max(latestDelivered[side]!, last);
        other.receive(w.packet);
      }
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
  return { peers, rollbacks, stalls, dropped, reordered, duplicates };
}

/** Após drenar a rede, um avanço aplica a correção dos últimos inputs recebidos. */
function expectConvergence(peers: RollbackSession[], frames: number): void {
  const expected = reference(frames + 1);
  for (const peer of peers) {
    expect(peer.frame).toBe(frames);
    expect(peer.advance()).not.toBeNull();
    expect(peer.frame).toBe(frames + 1);
    expect(peer.current).toEqual(expected);
  }
  expect(peers[0]!.current).toEqual(peers[1]!.current);
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

  it('recupera uma rajada de sete pacotes perdidos por lado usando redundância', () => {
    const frames = 240;
    const { peers, rollbacks, dropped } = play(1, 2, 0, frames, { burstLength: 7 });
    expect(dropped).toBe(14);
    expect(rollbacks).toBeGreaterThan(0);
    // A rajada ocorre durante a luta e cabe na janela padrão de 12 inputs repetidos.
    expectConvergence(peers, frames);
  });

  it('pacotes fora de ordem e duplicados preservam o estado final', () => {
    const frames = 240;
    const { peers, reordered, duplicates } = play(1, 8, 0, frames, { duplicate: true });
    expect(reordered).toBeGreaterThan(0);
    expect(duplicates).toBeGreaterThan(0);
    expectConvergence(peers, frames);
  });

  it('latência assimétrica de 1 contra 20 frames converge mesmo com esperas', () => {
    const frames = 240;
    const { peers, rollbacks, stalls } = play(0, 3, 0, frames, { latencyBySide: [1, 20] });
    expect(stalls).toBeGreaterThan(0);
    expect(rollbacks).toBeGreaterThan(0);
    expectConvergence(peers, frames);
  });

  it.each(['antes', 'depois'] as const)(
    'detecta input divergente no próximo checksum recebido %s do cálculo local',
    (arrival) => {
      const initial = createMatch(defaultConfig(['kai', 'umbra']));
      initial.phase = 'fight';
      const checksumEvery = 4;
      const peers = [
        new RollbackSession(initial, 0, { delay: DELAY, checksumEvery }),
        new RollbackSession(initial, 1, { delay: DELAY, checksumEvery }),
      ];
      const desyncs: number[][] = [[], []];
      peers.forEach((peer, side) => {
        peer.onDesync = (frame) => desyncs[side]!.push(frame);
      });
      const right = encodeInput({ ...emptyInput(), right: true });
      for (let frame = 0; frame <= checksumEvery; frame++) {
        for (const side of [0, 1] as const) {
          const packet = peers[side]!.pushLocal(emptyInput());
          // Só o lado 1 recebe o input adulterado do frame 2; os estados realmente divergem.
          if (side === 0 && packet.from <= DELAY) packet.masks[DELAY - packet.from] = right;
          peers[1 - side]!.receive(packet);
        }
        const sums: { frame: number; value: number }[][] = [];
        for (const side of [0, 1] as const) {
          expect(peers[side]!.advance()).not.toBeNull();
          sums[side] = peers[side]!.takeChecksums();
          if (arrival === 'antes')
            for (const sum of sums[side]!) peers[1 - side]!.compareChecksum(sum.frame, sum.value);
        }
        if (arrival === 'depois')
          for (const side of [0, 1] as const)
            for (const sum of sums[side]!) peers[1 - side]!.compareChecksum(sum.frame, sum.value);
        expect(sums[0]!.map((sum) => sum.frame)).toEqual(
          frame % checksumEvery === 0 ? [frame] : [],
        );
        if (frame < checksumEvery) expect(desyncs).toEqual([[], []]);
      }
      expect(peers[0]!.current).not.toEqual(peers[1]!.current);
      expect(peers[0]!.checksumFor(checksumEvery)).not.toBe(peers[1]!.checksumFor(checksumEvery));
      expect(desyncs).toEqual([[checksumEvery], [checksumEvery]]);
    },
  );

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

  it('mantém o estado parado no limite de predição e retoma quando os inputs chegam', () => {
    const initial = createMatch(defaultConfig(['kai', 'umbra']));
    initial.phase = 'fight';
    const maxPrediction = 4;
    const peer = new RollbackSession(initial, 0, { delay: DELAY, maxPrediction });
    const up = encodeInput({ ...emptyInput(), up: true });
    for (let frame = 0; frame < DELAY + maxPrediction; frame++) {
      peer.pushLocal(emptyInput());
      expect(peer.advance()).not.toBeNull();
    }
    expect(peer.prediction).toBe(maxPrediction);
    const stopped = peer.current;
    const snapshot = structuredClone(stopped);
    for (let tick = 0; tick < 20; tick++) {
      peer.pushLocal(emptyInput());
      expect(peer.advance()).toBeNull();
      expect(peer.frame).toBe(DELAY + maxPrediction);
      expect(peer.prediction).toBe(maxPrediction);
      expect(peer.current).toBe(stopped);
      expect(peer.current).toEqual(snapshot);
    }

    peer.receive({ type: 'input', from: DELAY, masks: Array<number>(maxPrediction).fill(up) });
    expect(peer.prediction).toBe(0);
    let expected = initial;
    for (let frame = 0; frame < DELAY + maxPrediction * 2; frame++) {
      expected = stepMatch(expected, [
        emptyInput(),
        frame < DELAY ? emptyInput() : decodeInput(up),
      ]);
      if (frame < DELAY + maxPrediction) continue;
      peer.pushLocal(emptyInput());
      const result = peer.advance();
      expect(result).not.toBeNull();
      expect(result!.rolledBack).toBe(frame === DELAY + maxPrediction ? maxPrediction : 0);
      expect(peer.current).toEqual(expected);
    }
    expect(peer.prediction).toBe(maxPrediction);
    expect(peer.advance()).toBeNull();
  });
});
