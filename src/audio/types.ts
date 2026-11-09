export type MusicTrack = 'menu' | 'fight' | 'boss' | 'victory';
export type UiSound = 'move' | 'confirm' | 'back' | 'error';

/** Receita de uma voz sintetizada; tempos em segundos, exclusivos da reprodução sonora. */
export interface SoundVoice {
  wave: OscillatorType | 'noise';
  frequency: number;
  endFrequency?: number;
  duration: number;
  gain: number;
  offset?: number;
  attack?: number;
  filter?: BiquadFilterType;
  cutoff?: number;
  endCutoff?: number;
  resonance?: number;
}
