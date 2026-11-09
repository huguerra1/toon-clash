import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../game/events';
import { eventVoices, projectileVoices, uiVoices } from './sfx';
import type { UiSound } from './types';

const hit: Extract<GameEvent, { type: 'hit' }> = {
  type: 'hit',
  attacker: 0,
  x: 0,
  y: 1,
  damage: 10,
  heavy: false,
  combo: 1,
};
const events: GameEvent[] = [
  hit,
  { type: 'block', attacker: 0, x: 0, y: 1 },
  { type: 'armor', player: 0, x: 0, y: 1 },
  { type: 'whoosh', player: 0, heavy: false },
  { type: 'special', player: 0, move: 'burst', name: 'Explosão' },
  { type: 'projectile', player: 0, visual: 'omega' },
  { type: 'clash', x: 0, y: 1 },
  { type: 'jump', player: 0 },
  { type: 'land', player: 0 },
  { type: 'knockdown', player: 0, x: 0 },
  { type: 'throw', player: 0 },
  { type: 'transform', player: 0, form: 1 },
  { type: 'teleport', player: 0, fromX: 0, toX: 1 },
  { type: 'ko', player: 1 },
  { type: 'toonality', player: 0, kind: 'anvil', name: 'Chuva de bigornas!' },
  { type: 'announce', kind: 'fight', text: 'Lutem!' },
];

describe('receitas de efeitos', () => {
  it.each(events)('mapeia $type sem alterar o evento', (event) => {
    const before = structuredClone(event);
    const voices = eventVoices(Object.freeze(event));
    expect(event).toEqual(before);
    expect(voices.length > 0).toBe(event.type !== 'announce');
    for (const voice of voices) {
      expect(voice.frequency).toBeGreaterThan(0);
      expect(voice.endFrequency ?? voice.frequency).toBeGreaterThan(0);
      expect(voice.gain).toBeGreaterThan(0);
      expect(voice.gain).toBeLessThanOrEqual(1);
      expect(voice.duration).toBeGreaterThan(voice.attack ?? 0.004);
      expect(voice.offset ?? 0).toBeGreaterThanOrEqual(0);
    }
  });

  it('dá mais peso aos golpes fortes e aumenta levemente o tom do combo', () => {
    const light = eventVoices(hit)[0]!;
    const heavy = eventVoices({ ...hit, heavy: true })[0]!;
    const combo = eventVoices({ ...hit, combo: 4 })[0]!;
    expect(heavy.frequency).toBeLessThan(light.frequency);
    expect(heavy.gain).toBeGreaterThan(light.gain);
    expect(heavy.duration).toBeGreaterThan(light.duration);
    expect(combo.frequency).toBeGreaterThan(light.frequency);
    expect(combo.frequency).toBeLessThan(light.frequency * 1.2);
    expect(eventVoices({ ...hit, combo: 10000 })[0]!.frequency).toBeLessThan(light.frequency * 2);
  });

  it('alonga o sopro pesado e produz eco decrescente no teleporte', () => {
    const light = eventVoices({ type: 'whoosh', player: 0, heavy: false })[0]!;
    const heavy = eventVoices({ type: 'whoosh', player: 0, heavy: true })[0]!;
    expect(light.wave).toBe('noise');
    expect(heavy.duration).toBeGreaterThan(light.duration);
    const echo = eventVoices({ type: 'teleport', player: 0, fromX: 0, toX: 2 });
    expect(echo[1]!.offset).toBeGreaterThan(echo[0]!.offset!);
    expect(echo[1]!.gain).toBeLessThan(echo[0]!.gain);
    expect(echo[0]!.endFrequency).toBeLessThan(echo[0]!.frequency);
  });

  it('distingue os cinco projéteis e oferece um timbre padrão', () => {
    const voices = ['omega', 'shadow', 'cannon', 'star', 'ray'].map(projectileVoices);
    expect(new Set(voices.map((voice) => JSON.stringify(voice))).size).toBe(5);
    expect(projectileVoices('novo-visual')).toEqual(projectileVoices('outro'));
    expect(projectileVoices('novo-visual').length).toBeGreaterThan(0);
  });

  it.each<UiSound>(['move', 'confirm', 'back', 'error'])(
    'produz o som de interface %s',
    (sound) => {
      expect(uiVoices(sound).length).toBeGreaterThan(0);
    },
  );
});
