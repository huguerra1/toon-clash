import type { SoundVoice } from './types';

export const MAX_VOICES = 24;

interface PlayingVoice {
  source: OscillatorNode | AudioBufferSourceNode;
  output: AudioNode;
  clean: () => void;
}

/** Motor compartilhado por efeitos e música: o limite inclui vozes futuras agendadas. */
export class Synth {
  readonly effects: GainNode;
  readonly music: GainNode;
  private master: GainNode;
  private noise: AudioBuffer;
  private voices = new Set<PlayingVoice>();

  constructor(readonly context: AudioContext) {
    this.master = context.createGain();
    this.effects = context.createGain();
    this.music = context.createGain();
    this.effects.gain.value = 0.75;
    this.music.gain.value = 0.22;
    this.effects.connect(this.master);
    this.music.connect(this.master);
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 4;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.12;
    this.master.connect(limiter);
    limiter.connect(context.destination);
    this.noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const samples = this.noise.getChannelData(0);
    let seed = 0x71c1a5;
    for (let index = 0; index < samples.length; index++) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      samples[index] = (seed >>> 0) / 0x80000000 - 1;
    }
  }

  setVolume(volume: number): void {
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(volume, now, 0.008);
  }

  play(
    voices: readonly SoundVoice[],
    output = this.effects,
    when = this.context.currentTime,
  ): void {
    if (this.context.state === 'closed') return;
    for (const voice of voices) this.startVoice(voice, output, when);
  }

  stopOutput(output: AudioNode, when = this.context.currentTime): void {
    for (const voice of this.voices) {
      if (voice.output !== output) continue;
      voice.source.stop(when);
      if (when <= this.context.currentTime) voice.clean();
    }
  }

  private startVoice(voice: SoundVoice, output: AudioNode, when: number): void {
    while (this.voices.size >= MAX_VOICES) {
      const oldest = this.voices.values().next().value!;
      oldest.source.stop();
      oldest.clean();
    }
    const context = this.context;
    const start = Math.max(context.currentTime, when) + (voice.offset ?? 0);
    const end = start + voice.duration;
    const envelope = context.createGain();
    const source =
      voice.wave === 'noise' ? context.createBufferSource() : context.createOscillator();
    if ('frequency' in source) {
      source.type = voice.wave as OscillatorType;
      source.frequency.setValueAtTime(voice.frequency, start);
      source.frequency.exponentialRampToValueAtTime(voice.endFrequency ?? voice.frequency, end);
    } else {
      const bufferSource = source as AudioBufferSourceNode;
      bufferSource.buffer = this.noise;
      bufferSource.loop = true;
    }
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(voice.gain, start + (voice.attack ?? 0.004));
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);
    let filter: BiquadFilterNode | undefined;
    if (voice.filter) {
      filter = context.createBiquadFilter();
      filter.type = voice.filter;
      filter.Q.value = voice.resonance ?? 0.7;
      const cutoff = Math.min(voice.cutoff ?? 2000, context.sampleRate * 0.45);
      filter.frequency.setValueAtTime(cutoff, start);
      filter.frequency.exponentialRampToValueAtTime(
        Math.min(voice.endCutoff ?? cutoff, context.sampleRate * 0.45),
        end,
      );
      source.connect(filter);
      filter.connect(envelope);
    } else source.connect(envelope);
    envelope.connect(output);
    const playing: PlayingVoice = {
      source,
      output,
      clean: () => {
        source.disconnect();
        filter?.disconnect();
        envelope.disconnect();
        this.voices.delete(playing);
      },
    };
    source.onended = playing.clean;
    this.voices.add(playing);
    source.start(start);
    source.stop(end + 0.01);
  }
}
