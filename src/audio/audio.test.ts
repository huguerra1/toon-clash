import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioSystem } from './audio';
import { CROSSFADE_SECONDS } from './music';
import { MAX_VOICES } from './synth';

class FakeParam {
  value = 0;
  setValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  setTargetAtTime = vi.fn();
  cancelScheduledValues = vi.fn();
  cancelAndHoldAtTime = vi.fn();
}

class FakeNode {
  connect = vi.fn();
  disconnect = vi.fn();
}

class FakeGain extends FakeNode {
  gain = new FakeParam();
}

class FakeSource extends FakeNode {
  onended?: () => void;
  start = vi.fn();
  private timer?: ReturnType<typeof setTimeout>;
  stop = vi.fn((when = context().currentTime) => {
    clearTimeout(this.timer);
    this.timer = setTimeout(
      () => this.onended?.(),
      Math.max(0, when - context().currentTime) * 1000,
    );
  });
}

class FakeOscillator extends FakeSource {
  frequency = new FakeParam();
  type = 'sine';
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  private started = Date.now();
  get currentTime() {
    return (Date.now() - this.started) / 1000;
  }
  state = 'running';
  sampleRate = 8000;
  destination = new FakeNode();
  gains: FakeGain[] = [];
  sources: FakeSource[] = [];
  resume = vi.fn(async () => {
    this.state = 'running';
  });
  suspend = vi.fn(async () => {
    this.state = 'suspended';
  });
  close = vi.fn(async () => {
    this.state = 'closed';
  });
  constructor() {
    FakeAudioContext.instances.push(this);
  }
  createGain() {
    const node = new FakeGain();
    this.gains.push(node);
    return node;
  }
  createDynamicsCompressor() {
    return Object.assign(new FakeNode(), {
      threshold: new FakeParam(),
      knee: new FakeParam(),
      ratio: new FakeParam(),
      attack: new FakeParam(),
      release: new FakeParam(),
    });
  }
  createBiquadFilter() {
    return Object.assign(new FakeNode(), { Q: new FakeParam(), frequency: new FakeParam() });
  }
  createBuffer(_channels: number, length: number) {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
  createOscillator() {
    const source = new FakeOscillator();
    this.sources.push(source);
    return source;
  }
  createBufferSource() {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }
}

function context(): FakeAudioContext {
  return FakeAudioContext.instances.at(-1)!;
}
function trackOutputs(): FakeGain[] {
  return context().gains.filter((gain) =>
    gain.connect.mock.calls.some(([output]) => output === context().gains[2]),
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeAudioContext.instances = [];
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.stubGlobal('speechSynthesis', undefined);
  vi.stubGlobal('SpeechSynthesisUtterance', undefined);
  vi.stubGlobal('localStorage', undefined);
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('AudioSystem', () => {
  it('mantém a criação preguiçosa e reaproveita um único contexto', () => {
    const audio = new AudioSystem();
    audio.stopMusic();
    audio.handleEvents([]);
    expect(FakeAudioContext.instances).toHaveLength(0);
    audio.unlock();
    audio.ui('confirm');
    audio.unlock();
    expect(FakeAudioContext.instances).toHaveLength(1);
    expect(context().sources).toHaveLength(2);
    expect(context().gains[2]!.gain.value).toBeLessThan(context().gains[1]!.gain.value);
    vi.advanceTimersByTime(1000);
    expect(context().sources.every((source) => source.disconnect.mock.calls.length > 0)).toBe(true);
  });

  it('opera em Node sem áudio, fala ou armazenamento e tolera construtor indisponível', () => {
    vi.stubGlobal('AudioContext', undefined);
    const audio = new AudioSystem();
    expect(() => {
      audio.unlock();
      audio.ui('move');
      audio.say('K.O.!');
      audio.handleEvents([
        { type: 'jump', player: 0 },
        { type: 'announce', kind: 'ko', text: 'K.O.!' },
      ]);
      audio.playMusic('boss');
      audio.stopMusic();
      audio.muted = true;
      audio.volume = 0.5;
    }).not.toThrow();
    expect(FakeAudioContext.instances).toHaveLength(0);
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          throw new Error('Áudio bloqueado');
        }
      },
    );
    expect(() => audio.unlock()).not.toThrow();
  });

  it('retoma contexto suspenso no gesto e tolera rejeição da retomada', async () => {
    const audio = new AudioSystem();
    audio.ui('move');
    context().state = 'suspended';
    context().resume.mockRejectedValueOnce(new Error('Gesto necessário'));
    audio.unlock();
    await Promise.resolve();
    expect(context().resume).toHaveBeenCalledOnce();
    audio.unlock();
    expect(context().state).toBe('running');
  });

  it('pausa para anúncio: suspende o contexto, ignora sons e só retoma no resume', async () => {
    const audio = new AudioSystem();
    audio.ui('move');
    const before = context().sources.length;
    audio.pause();
    await Promise.resolve();
    expect(audio.paused).toBe(true);
    expect(context().suspend).toHaveBeenCalledOnce();
    audio.ui('confirm');
    audio.handleEvents([{ type: 'jump', player: 0 }]);
    audio.unlock();
    expect(context().sources).toHaveLength(before);
    expect(context().resume).not.toHaveBeenCalled();
    audio.resume();
    await Promise.resolve();
    expect(context().resume).toHaveBeenCalledOnce();
    expect(context().state).toBe('running');
    audio.ui('confirm');
    expect(context().sources.length).toBeGreaterThan(before);
  });

  it('pausa e retomada sem contexto criado não quebram', () => {
    const audio = new AudioSystem();
    expect(() => {
      audio.pause();
      audio.resume();
    }).not.toThrow();
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  it('limita vozes em rajadas e desconecta as vozes roubadas', () => {
    const audio = new AudioSystem();
    for (let index = 0; index < 60; index++) audio.ui('confirm');
    expect(context().sources.filter((source) => !source.disconnect.mock.calls.length)).toHaveLength(
      MAX_VOICES,
    );
    expect(context().sources[0]!.stop).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1000);
    expect(context().sources.every((source) => source.disconnect.mock.calls.length > 0)).toBe(true);
  });

  it('preserva a faixa repetida, faz crossfade e para o agendamento', () => {
    const audio = new AudioSystem();
    audio.playMusic('menu');
    const count = context().sources.length;
    audio.playMusic('menu');
    audio.unlock();
    expect(context().sources).toHaveLength(count);
    const oldOutput = trackOutputs()[0]!;
    audio.playMusic('fight');
    expect(oldOutput.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, CROSSFADE_SECONDS);
    expect(trackOutputs()).toHaveLength(2);
    expect(trackOutputs()[1]!.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(
      1,
      CROSSFADE_SECONDS,
    );
    vi.advanceTimersByTime(200);
    expect(oldOutput.disconnect).toHaveBeenCalledOnce();
    audio.stopMusic();
    const stoppedCount = context().sources.length;
    vi.advanceTimersByTime(5000);
    expect(context().sources).toHaveLength(stoppedCount);
    expect(vi.getTimerCount()).toBe(0);
    audio.playMusic('fight');
    expect(context().sources.length).toBeGreaterThan(stoppedCount);
    audio.stopMusic();
  });

  it('repete combate e encerra vitória sem loop nem reinício ao repetir o pedido', () => {
    const audio = new AudioSystem();
    audio.playMusic('boss');
    vi.advanceTimersByTime(6000);
    const count = context().sources.length;
    vi.advanceTimersByTime(1000);
    expect(context().sources.length).toBeGreaterThan(count);
    audio.playMusic('victory');
    vi.advanceTimersByTime(5000);
    const finalCount = context().sources.length;
    audio.playMusic('victory');
    vi.advanceTimersByTime(5000);
    expect(context().sources).toHaveLength(finalCount);
    expect(vi.getTimerCount()).toBe(0);
    audio.stopMusic();
  });

  it('persiste preferências e aplica limites sem perder a escolha de volume ao silenciar', () => {
    const values = new Map([
      ['toon-clash:audio:volume', '0.4'],
      ['toon-clash:audio:muted', 'true'],
    ]);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    const audio = new AudioSystem();
    expect(audio.muted).toBe(true);
    expect(audio.volume).toBe(0.4);
    audio.ui('move');
    expect(FakeAudioContext.instances).toHaveLength(0);
    audio.unlock();
    expect(context().gains[0]!.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 0, 0.008);
    audio.muted = false;
    expect(context().gains[0]!.gain.setTargetAtTime).toHaveBeenLastCalledWith(0.4, 0, 0.008);
    audio.volume = 5;
    expect(audio.volume).toBe(1);
    audio.volume = -5;
    expect(audio.volume).toBe(0);
    audio.volume = Number.NaN;
    expect(audio.volume).toBe(0);
    audio.volume = 0.7;
    expect(new AudioSystem().volume).toBe(0.7);
    expect(new AudioSystem().muted).toBe(false);
  });

  it('ignora preferências inválidas e falhas de armazenamento', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => 'corrompido',
      setItem: () => {
        throw new Error('Sem permissão');
      },
    });
    const audio = new AudioSystem();
    expect(audio.volume).toBe(0.8);
    expect(() => {
      audio.volume = 0.5;
      audio.muted = true;
    }).not.toThrow();
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('Sem permissão');
      },
    });
    expect(() => new AudioSystem()).not.toThrow();
  });

  it('encaminha anúncios e nomes de toonality ao locutor e respeita mudo', () => {
    class Utterance {
      constructor(readonly text: string) {}
    }
    const spoken: { text: string; onend?: () => void }[] = [];
    const speech = {
      getVoices: () => [],
      speak: vi.fn((utterance: Utterance) => spoken.push(utterance)),
      cancel: vi.fn(),
    };
    vi.stubGlobal('speechSynthesis', speech);
    vi.stubGlobal('SpeechSynthesisUtterance', Utterance);
    const audio = new AudioSystem();
    audio.handleEvents([
      { type: 'announce', kind: 'ko', text: 'K.O.!' },
      { type: 'toonality', player: 0, kind: 'anvil', name: 'Chuva de bigornas!' },
    ]);
    expect(spoken[0]!.text).toBe('Nocaute!');
    spoken[0]!.onend!();
    expect(spoken[1]!.text).toBe('Chuva de bigornas!');
    expect(context().sources).toHaveLength(4);
    audio.muted = true;
    expect(speech.cancel).toHaveBeenCalledOnce();
    audio.handleEvents([{ type: 'jump', player: 0 }]);
    audio.say('Silêncio');
    audio.ui('error');
    expect(context().sources).toHaveLength(4);
    expect(spoken).toHaveLength(2);
  });
});
