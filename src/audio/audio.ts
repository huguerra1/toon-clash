import type { GameEvent } from '../game/events';
import { MusicPlayer } from './music';
import { eventVoices, uiVoices } from './sfx';
import { Synth } from './synth';
import type { MusicTrack, UiSound } from './types';
import { Announcer } from './voice';

export type { MusicTrack, UiSound } from './types';

const MUTED_KEY = 'toon-clash:audio:muted';
const VOLUME_KEY = 'toon-clash:audio:volume';

function readPreference(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function savePreference(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    /* Armazenamento bloqueado não deve interromper o jogo. */
  }
}

export class AudioSystem {
  private synth?: Synth;
  private music?: MusicPlayer;
  private announcer = new Announcer();
  private requestedTrack?: MusicTrack;
  private isMuted = readPreference(MUTED_KEY) === 'true';
  private level = 0.8;

  constructor() {
    const stored = readPreference(VOLUME_KEY);
    if (stored !== null && stored.trim() !== '' && Number.isFinite(Number(stored))) {
      this.level = Math.min(1, Math.max(0, Number(stored)));
    }
  }

  /** Chamar no primeiro clique/tecla do usuário para liberar o áudio do navegador. */
  unlock(): void {
    this.ensureSynth();
    if (this.requestedTrack) this.music?.play(this.requestedTrack);
  }

  handleEvents(events: readonly GameEvent[]): void {
    if (this.isMuted || this.level === 0) return;
    for (const event of events) {
      if (event.type === 'announce') this.say(event.text);
      else {
        this.ensureSynth()?.play(eventVoices(event));
        if (event.type === 'toonality') this.say(event.name);
      }
    }
  }

  playMusic(track: MusicTrack): void {
    this.requestedTrack = track;
    this.ensureSynth();
    this.music?.play(track);
  }

  stopMusic(): void {
    this.requestedTrack = undefined;
    this.music?.stop();
  }

  ui(sound: UiSound): void {
    if (this.isMuted || this.level === 0) return;
    this.ensureSynth()?.play(uiVoices(sound));
  }

  say(text: string): void {
    if (!this.isMuted) this.announcer.say(text, this.level);
  }

  get muted(): boolean {
    return this.isMuted;
  }
  set muted(value: boolean) {
    this.isMuted = value;
    savePreference(MUTED_KEY, String(value));
    this.applyVolume();
  }

  get volume(): number {
    return this.level;
  }
  set volume(value: number) {
    this.level = Number.isNaN(value) ? 0 : Math.min(1, Math.max(0, value));
    savePreference(VOLUME_KEY, String(this.level));
    this.applyVolume();
  }

  private applyVolume(): void {
    const volume = this.isMuted ? 0 : this.level;
    this.synth?.setVolume(volume);
    this.announcer.setVolume(volume);
  }

  private ensureSynth(): Synth | undefined {
    try {
      if (!this.synth) {
        const Context =
          globalThis.AudioContext ??
          (
            globalThis as typeof globalThis & {
              webkitAudioContext?: typeof AudioContext;
            }
          ).webkitAudioContext;
        if (!Context) return undefined;
        const context = new Context();
        try {
          this.synth = new Synth(context);
        } catch {
          void context.close().catch(() => {});
          return undefined;
        }
        this.music = new MusicPlayer(this.synth);
        this.applyVolume();
      }
      if (this.synth.context.state === 'suspended') {
        void this.synth.context.resume().catch(() => {});
      }
      return this.synth;
    } catch {
      return undefined;
    }
  }
}
