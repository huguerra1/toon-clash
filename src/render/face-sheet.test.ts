import { describe, expect, it } from 'vitest';
import { getLook } from '../characters/looks';
import { canBlink, faceOptionsOf, faceStyleOf } from './face-sheet';

describe('faceStyleOf', () => {
  it('usa o estilo escolhido no visual', () => {
    expect(faceStyleOf(getLook('nyx'))).toBe('sharp');
    expect(faceStyleOf(getLook('lola'))).toBe('lashes');
  });

  it('deduz o estilo pelos acessórios quando não há escolha', () => {
    expect(faceStyleOf(getLook('ferrum'))).toBe('visor');
    expect(faceStyleOf(getLook('zhaar'))).toBe('glow');
    expect(faceStyleOf(getLook('kai'))).toBe('round');
  });
});

describe('faceOptionsOf', () => {
  it('quem tem focinho fica sem boca e nariz desenhados (a boca vai no focinho)', () => {
    const capi = faceOptionsOf(getLook('capi'));
    expect(capi.mouth).toBe(false);
    expect(capi.nose).toBe(false);
  });

  it('o visor esconde os olhos e o nariz, mas a boca continua', () => {
    const ferrum = faceOptionsOf(getLook('ferrum'));
    expect(ferrum.mouth).toBe(true);
    expect(ferrum.nose).toBe(false);
  });
});

describe('canBlink', () => {
  it('não pisca com o olho já fechado ou desenhado', () => {
    expect(canBlink('neutral')).toBe(true);
    expect(canBlink('angry')).toBe(true);
    expect(canBlink('ko')).toBe(false);
    expect(canBlink('happy')).toBe(false);
  });
});
