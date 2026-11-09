import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startServer } from '../../server/server.mjs';
import { type PlayerInput, decodeInput } from '../core/input';
import { createMatch, defaultConfig, stepMatch } from '../game/match';
import { NetClient } from './client';
import type { PeerMessage, ServerMessage } from './protocol';
import { RollbackSession, checksum } from './rollback';

const DELAY = 2;
const FRAMES = 600;

function script(side: 0 | 1, frame: number): PlayerInput {
  if (frame < DELAY) return decodeInput(0);
  const slot = Math.floor(frame / 9);
  return decodeInput((Math.imul(slot * 40503 + side * 7919, 2654435761) >>> 5) & 0x1ff);
}

function waitFor(client: NetClient, type: ServerMessage['type']): Promise<ServerMessage> {
  return new Promise((resolve) => {
    const previous = client.onServer;
    client.onServer = (msg) => {
      previous(msg);
      if (msg.type === type) resolve(msg);
    };
  });
}

const tick = () => new Promise((r) => setTimeout(r, 1));

async function until(ok: () => boolean): Promise<void> {
  for (let i = 0; i < 500 && !ok(); i++) await tick();
  expect(ok()).toBe(true);
}

/** Canal WebRTC de mentira (o Node não tem WebRTC): entrega na outra ponta, em memória. */
class FakeChannel {
  readyState: RTCDataChannelState = 'connecting';
  other: FakeChannel | null = null;
  sent = 0;
  onmessage: ((e: { data: string }) => void) | null = null;
  send(data: string): void {
    this.sent++;
    setTimeout(() => this.other?.onmessage?.({ data }));
  }
  close(): void {
    this.readyState = 'closed';
  }
}

const channels: FakeChannel[] = [];
const fakePeers: FakePeer[] = [];

/** Liga as duas pontas quando a resposta SDP chega ao anfitrião, como um P2P que deu certo. */
class FakePeer {
  channel: FakeChannel | null = null;
  gotOffer = false;
  onicecandidate: unknown = null;
  ondatachannel: ((e: { channel: FakeChannel }) => void) | null = null;
  constructor() {
    fakePeers.push(this);
  }
  createDataChannel(): FakeChannel {
    this.channel = new FakeChannel();
    channels.push(this.channel);
    return this.channel;
  }
  createOffer() {
    return Promise.resolve({ type: 'offer' as const, sdp: 'oferta' });
  }
  createAnswer() {
    return Promise.resolve({ type: 'answer' as const, sdp: 'resposta' });
  }
  setLocalDescription() {
    return Promise.resolve();
  }
  setRemoteDescription(d: RTCSessionDescriptionInit) {
    const guest = fakePeers.find((p) => p.gotOffer);
    if (d.type === 'offer') this.gotOffer = true;
    else if (guest && this.channel) {
      const theirs = new FakeChannel();
      this.channel.other = theirs;
      theirs.other = this.channel;
      this.channel.readyState = theirs.readyState = 'open';
      guest.ondatachannel?.({ channel: theirs });
    }
    return Promise.resolve();
  }
  addIceCandidate() {
    return Promise.resolve();
  }
  close(): void {}
}

let server: Awaited<ReturnType<typeof startServer>>;

beforeAll(async () => {
  server = await startServer(0);
});

afterAll(async () => {
  await server.close();
});

describe('online (servidor + rollback)', () => {
  it('dois jogadores entram na mesma sala e terminam a luta no mesmo estado', async () => {
    const url = `ws://localhost:${server.port}`;
    const host = new NetClient();
    const guest = new NetClient();
    await host.connect(url);
    await guest.connect(url);

    const created = waitFor(host, 'created');
    host.send({ type: 'create' });
    const room = ((await created) as { room: string }).room;
    expect(room).toMatch(/^[A-Z]{4}$/);

    const joined = waitFor(guest, 'joined');
    const peerJoined = waitFor(host, 'peer-joined');
    guest.send({ type: 'join', room });
    expect(await joined).toMatchObject({ side: 1 });
    await peerJoined;

    const initial = createMatch(defaultConfig(['nyx', 'feral']));
    const peers = [
      { client: host, session: new RollbackSession(initial, 0, { delay: DELAY }) },
      { client: guest, session: new RollbackSession(initial, 1, { delay: DELAY }) },
    ];
    let desyncs = 0;
    for (const { client, session } of peers) {
      session.onDesync = () => desyncs++;
      client.onPeer = (msg) => {
        if (msg.type === 'input') session.receive(msg);
        if (msg.type === 'checksum') session.compareChecksum(msg.frame, msg.value);
      };
    }

    for (let t = 0; t < FRAMES * 20 && peers.some((p) => p.session.frame < FRAMES); t++) {
      for (const [side, { client, session }] of peers.entries()) {
        if (session.frame >= FRAMES) continue;
        client.sendPeer({
          ...session.pushLocal(script(side as 0 | 1, session.frame + DELAY)),
          game: 1,
        });
        session.advance();
        for (const c of session.takeChecksums())
          client.sendPeer({ type: 'checksum', game: 1, ...c });
      }
      await tick();
    }

    let reference = initial;
    const check = FRAMES - 60;
    for (let f = 0; f <= check; f++) reference = stepMatch(reference, [script(0, f), script(1, f)]);
    const expected = checksum(reference);
    expect(peers[0]!.session.checksumFor(check)).toBe(expected);
    expect(peers[1]!.session.checksumFor(check)).toBe(expected);
    // Cada lado também conferiu as somas do outro durante a luta.
    expect(desyncs).toBe(0);

    const left = waitFor(guest, 'peer-left');
    host.close();
    expect(await left).toEqual({ type: 'peer-left' });
    guest.close();
  }, 30_000);

  it('abre canal direto (WebRTC) para os inputs e mantém o resto pelo servidor', async () => {
    const original = globalThis.RTCPeerConnection;
    globalThis.RTCPeerConnection = FakePeer as unknown as typeof RTCPeerConnection;
    const url = `ws://localhost:${server.port}`;
    const host = new NetClient();
    const guest = new NetClient();
    try {
      await host.connect(url);
      await guest.connect(url);
      const created = waitFor(host, 'created');
      host.send({ type: 'create' });
      const room = ((await created) as { room: string }).room;
      const peerJoined = waitFor(host, 'peer-joined');
      guest.send({ type: 'join', room });
      await peerJoined;

      expect(host.direct).toBe(false);
      host.startDirect();
      await until(() => host.direct && guest.direct);

      const got: PeerMessage[] = [];
      guest.onPeer = (msg) => got.push(msg);
      host.sendPeer({ type: 'input', game: 1, from: 0, masks: [5] });
      host.sendPeer({ type: 'rematch' });
      await until(() => got.length === 2);

      expect(got).toContainEqual({ type: 'input', game: 1, from: 0, masks: [5] });
      expect(got).toContainEqual({ type: 'rematch' });
      // Só o input foi pelo canal direto; a revanche (que não pode se perder) foi pelo servidor.
      expect(channels[0]!.sent).toBe(1);
    } finally {
      host.close();
      guest.close();
      globalThis.RTCPeerConnection = original;
    }
  });

  it('recusa sala inexistente', async () => {
    const client = new NetClient();
    await client.connect(`ws://localhost:${server.port}`);
    const error = waitFor(client, 'error');
    client.send({ type: 'join', room: 'ZZZZ' });
    expect(await error).toMatchObject({ type: 'error' });
    client.close();
  });
});
