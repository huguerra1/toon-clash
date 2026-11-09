import type { GameEvent } from '../game/events';
import type { SoundVoice, UiSound } from './types';

function tone(
  frequency: number,
  endFrequency: number,
  duration: number,
  gain: number,
  wave: OscillatorType = 'sine',
  offset = 0,
): SoundVoice {
  return { wave, frequency, endFrequency, duration, gain, offset };
}

function noise(duration: number, gain: number, cutoff: number, offset = 0): SoundVoice {
  return {
    wave: 'noise',
    frequency: 1,
    duration,
    gain,
    offset,
    filter: 'bandpass',
    cutoff,
    endCutoff: Math.max(80, cutoff / 5),
    resonance: 0.7,
  };
}

function thud(heavy = false, offset = 0): SoundVoice[] {
  return [
    tone(heavy ? 110 : 190, 38, heavy ? 0.45 : 0.17, heavy ? 0.65 : 0.4, 'sine', offset),
    noise(heavy ? 0.25 : 0.09, 0.3, 750, offset),
  ];
}

/** Timbres originais de projéteis; visuais novos recebem o brilho padrão. */
export function projectileVoices(visual: string): SoundVoice[] {
  switch (visual) {
    case 'omega':
      return [tone(170, 950, 0.26, 0.24, 'sawtooth'), tone(340, 1900, 0.22, 0.13)];
    case 'shadow':
      return [noise(0.4, 0.4, 700), tone(150, 45, 0.38, 0.27, 'triangle')];
    case 'cannon':
      return [...thud(true), noise(0.2, 0.4, 2000)];
    case 'star':
      return [tone(1200, 2400, 0.18, 0.2, 'triangle'), tone(1800, 3200, 0.22, 0.15, 'sine', 0.04)];
    case 'ray':
      return [tone(1600, 180, 0.35, 0.22, 'sawtooth'), noise(0.15, 0.14, 4000)];
    default:
      return [tone(500, 1500, 0.25, 0.25, 'triangle')];
  }
}

export function eventVoices(event: GameEvent): SoundVoice[] {
  switch (event.type) {
    case 'hit': {
      const pitch = 1 + Math.min(20, Math.max(0, event.combo - 1)) * 0.035;
      return [
        tone(
          (event.heavy ? 145 : 270) * pitch,
          55 * pitch,
          event.heavy ? 0.28 : 0.14,
          event.heavy ? 0.65 : 0.4,
          'triangle',
        ),
        noise(event.heavy ? 0.18 : 0.08, event.heavy ? 0.45 : 0.28, 1900 * pitch),
      ];
    }
    case 'block':
      return [tone(950, 640, 0.12, 0.22, 'square'), tone(1473, 1150, 0.09, 0.13)];
    case 'armor':
      return [tone(260, 170, 0.19, 0.3, 'square'), tone(413, 290, 0.15, 0.18)];
    case 'whoosh':
      return [noise(event.heavy ? 0.32 : 0.14, 0.32, 3300)];
    case 'special':
      return [tone(330, 1320, 0.35, 0.24, 'triangle'), tone(660, 2640, 0.28, 0.13, 'sine', 0.05)];
    case 'projectile':
      return projectileVoices(event.visual);
    case 'clash':
      return [noise(0.32, 0.6, 2600), tone(180, 40, 0.35, 0.5)];
    case 'jump':
      return [tone(180, 620, 0.17, 0.25, 'sine')];
    case 'land':
      return thud();
    case 'knockdown':
      return [...thud(true), ...thud(false, 0.1)];
    case 'throw':
      return [noise(0.25, 0.3, 2500), ...thud(true, 0.16)];
    case 'transform':
      return [0, 4, 7, 12, 16, 19].map((note, index) =>
        tone(220 * 2 ** (note / 12), 440 * 2 ** (note / 12), 0.25, 0.22, 'triangle', index * 0.065),
      );
    case 'teleport':
      return [0, 1, 2].map((index) =>
        tone(1400, 90, 0.28, 0.3 * 0.45 ** index, 'sawtooth', index * 0.11),
      );
    case 'ko':
      return [tone(100, 25, 1.3, 0.75), noise(0.75, 0.5, 900)];
    case 'toonality':
      return [
        tone(330, 280, 0.17, 0.24, 'sawtooth'),
        tone(370, 300, 0.17, 0.24, 'sawtooth', 0.18),
        tone(440, 110, 0.65, 0.3, 'sawtooth', 0.36),
        tone(220, 55, 0.65, 0.15, 'triangle', 0.36),
      ];
    case 'announce':
      return [];
    default:
      return exhaustive(event);
  }
}

function exhaustive(event: never): never {
  throw new Error(`Evento de áudio desconhecido: ${String(event)}`);
}

export function uiVoices(sound: UiSound): SoundVoice[] {
  switch (sound) {
    case 'move':
      return [tone(600, 850, 0.055, 0.14, 'triangle')];
    case 'confirm':
      return [tone(660, 660, 0.12, 0.2, 'triangle'), tone(990, 990, 0.19, 0.2, 'triangle', 0.08)];
    case 'back':
      return [tone(700, 300, 0.15, 0.18, 'triangle')];
    case 'error':
      return [tone(140, 110, 0.22, 0.2, 'square')];
  }
}
