import { afterEach, describe, expect, it, vi } from 'vitest';
import { Announcer, announcerText } from './voice';

afterEach(() => vi.unstubAllGlobals());

function mockSpeech() {
  class Utterance {
    lang = '';
    volume = 1;
    voice?: { lang: string };
    onend?: () => void;
    onerror?: () => void;
    constructor(readonly text: string) {}
  }
  const utterances: Utterance[] = [];
  const brazilianVoice = { lang: 'pt-BR' };
  const speech = {
    getVoices: vi.fn(() => [{ lang: 'en-US' }, brazilianVoice]),
    speak: vi.fn((utterance: Utterance) => utterances.push(utterance)),
    cancel: vi.fn(),
  };
  vi.stubGlobal('SpeechSynthesisUtterance', Utterance);
  vi.stubGlobal('speechSynthesis', speech);
  return { utterances, speech, brazilianVoice };
}

describe('locutor', () => {
  it.each([
    ['K.O.!', 'Nocaute!'],
    ['TOONALITY!', 'Tunáliti!'],
    ['  K.O.! TOONALITY!  ', 'Nocaute! Tunáliti!'],
    ['ko!', 'Nocaute!'],
    ['Round 1!', 'Round 1!'],
    ['Niko vence!', 'Niko vence!'],
  ])('ajusta a pronúncia de %s', (input, expected) => {
    expect(announcerText(input)).toBe(expected);
  });

  it('funciona em silêncio sem APIs ou quando o navegador rejeita a fala', () => {
    vi.stubGlobal('speechSynthesis', undefined);
    const announcer = new Announcer();
    expect(() => {
      announcer.say('Olá!', 1);
      announcer.cancel();
    }).not.toThrow();
    const { speech } = mockSpeech();
    speech.speak.mockImplementation(() => {
      throw new Error('Indisponível');
    });
    expect(() => announcer.say('Olá!', 1)).not.toThrow();
  });

  it('seleciona pt-BR e mantém uma fila limitada sem cortar a fala atual', () => {
    const { utterances, speech, brazilianVoice } = mockSpeech();
    const announcer = new Announcer();
    for (const text of ['K.O.!', 'antigo', 'dois', 'três', 'quatro']) announcer.say(text, 0.6);
    expect(utterances).toHaveLength(1);
    expect(utterances[0]).toMatchObject({
      text: 'Nocaute!',
      lang: 'pt-BR',
      volume: 0.6,
      voice: brazilianVoice,
    });
    utterances[0]!.onend!();
    expect(utterances[1]!.text).toBe('dois');
    utterances[1]!.onerror!();
    expect(utterances[2]!.text).toBe('três');
    announcer.setVolume(0);
    expect(speech.cancel).toHaveBeenCalledOnce();
    utterances[2]!.onend!();
    expect(utterances).toHaveLength(3);
  });

  it('usa o idioma mesmo antes das vozes carregarem e ignora texto vazio', () => {
    const { speech, utterances } = mockSpeech();
    speech.getVoices.mockReturnValue([]);
    const announcer = new Announcer();
    announcer.say('   ', 1);
    announcer.say('Olá', 0);
    expect(speech.speak).not.toHaveBeenCalled();
    announcer.say('Lutem!', 1);
    expect(utterances[0]!.lang).toBe('pt-BR');
    expect(utterances[0]!.voice).toBeUndefined();
  });
});
