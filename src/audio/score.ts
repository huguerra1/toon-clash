import type { MusicTrack, SoundVoice } from './types';

export interface MusicScore {
  stepSeconds: number;
  loop: boolean;
  steps: readonly (readonly SoundVoice[])[];
}

export function noteFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

const melodies: Record<MusicTrack, readonly number[]> = {
  menu: [0, 7, 12, 7, 4, 7, 14, 12],
  fight: [0, 12, 7, 10, 0, 7, 15, 14],
  boss: [0, 1, 7, 6, 0, 12, 13, 7],
  victory: [0, 4, 7, 12, 7, 12, 16, 19],
};

/** Sequência independente do relógio e do navegador, em semicolcheias musicais. */
export function createScore(track: MusicTrack): MusicScore {
  const bpm = { menu: 118, fight: 142, boss: 154, victory: 132 }[track];
  const stepSeconds = 60 / bpm / 4;
  const root = track === 'boss' ? 38 : track === 'fight' ? 40 : 48;
  const steps = Array.from({ length: track === 'victory' ? 16 : 32 }, (_, index) => {
    const voices: SoundVoice[] = [];
    const chord =
      track === 'victory' ? 0 : [0, 0, track === 'boss' ? 1 : 5, 7][Math.floor(index / 8)]!;
    if (index % 2 === 0) {
      const note = root + chord + (index % 4 === 2 ? 7 : 0);
      voices.push({
        wave: 'triangle',
        frequency: noteFrequency(note),
        duration: stepSeconds * 1.6,
        gain: 0.42,
      });
      const melody = melodies[track][(index / 2) % 8]!;
      voices.push({
        wave: track === 'boss' ? 'sawtooth' : 'square',
        frequency: noteFrequency(root + 24 + chord + melody),
        duration: stepSeconds * (track === 'victory' && index === 14 ? 5 : 1.3),
        gain: 0.13,
        filter: 'lowpass',
        cutoff: 2400,
      });
    }
    if (index % 8 === 0 || (track !== 'menu' && index % 8 === 3)) {
      voices.push({ wave: 'sine', frequency: 145, endFrequency: 42, duration: 0.18, gain: 0.6 });
    }
    if (index % 8 === 4) {
      voices.push({
        wave: 'noise',
        frequency: 1,
        duration: 0.12,
        gain: 0.32,
        filter: 'bandpass',
        cutoff: 1800,
      });
    }
    if (index % 2 === 1) {
      voices.push({
        wave: 'noise',
        frequency: 1,
        duration: 0.045,
        gain: 0.12,
        filter: 'highpass',
        cutoff: 6500,
      });
    }
    return voices;
  });
  return { stepSeconds, loop: track !== 'victory', steps };
}
