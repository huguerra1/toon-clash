import { describe, expect, it } from 'vitest';
import { createScore, noteFrequency } from './score';
import type { MusicTrack } from './types';

describe('partituras procedurais', () => {
  it('converte notas MIDI para afinação padrão', () => {
    expect(noteFrequency(69)).toBe(440);
    expect(noteFrequency(81)).toBe(880);
    expect(noteFrequency(60)).toBeCloseTo(261.6256);
  });

  it.each<MusicTrack>(['menu', 'fight', 'boss', 'victory'])(
    'gera %s de forma determinística e válida',
    (track) => {
      const score = createScore(track);
      expect(score).toEqual(createScore(track));
      expect(score.stepSeconds).toBeGreaterThan(0);
      expect(score.loop).toBe(track !== 'victory');
      expect(score.steps.length).toBe(track === 'victory' ? 16 : 32);
      const voices = score.steps.flat();
      expect(voices.some((voice) => voice.wave === 'noise')).toBe(true);
      expect(voices.some((voice) => voice.wave === 'triangle' && voice.frequency < 250)).toBe(true);
      expect(voices.some((voice) => voice.frequency > 400)).toBe(true);
      for (const voice of voices) {
        expect(voice.frequency).toBeGreaterThan(0);
        expect(voice.duration).toBeGreaterThan(voice.attack ?? 0.004);
        expect(voice.gain).toBeGreaterThan(0);
        expect(voice.gain).toBeLessThanOrEqual(1);
      }
    },
  );

  it('diferencia as faixas e acelera a tensão do chefe', () => {
    expect(createScore('boss').stepSeconds).toBeLessThan(createScore('fight').stepSeconds);
    expect(createScore('fight').steps).not.toEqual(createScore('menu').steps);
    expect(createScore('boss').steps).not.toEqual(createScore('fight').steps);
    const victory = createScore('victory');
    expect(victory.steps.length * victory.stepSeconds).toBeLessThan(3);
  });
});
