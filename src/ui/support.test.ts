import { describe, expect, it } from 'vitest';
import { DEFAULT_SUPPORT_LABEL, supportLink } from './support';

describe('supportLink', () => {
  it('sem link configurado, não mostra o botão', () => {
    expect(supportLink({})).toBeNull();
    expect(supportLink({ VITE_SUPPORT_URL: '   ' })).toBeNull();
  });

  it('usa o link https e o texto padrão', () => {
    expect(supportLink({ VITE_SUPPORT_URL: ' https://ko-fi.com/exemplo ' })).toEqual({
      url: 'https://ko-fi.com/exemplo',
      label: DEFAULT_SUPPORT_LABEL,
    });
  });

  it('aceita texto próprio', () => {
    expect(
      supportLink({
        VITE_SUPPORT_URL: 'https://livepix.gg/exemplo',
        VITE_SUPPORT_LABEL: 'Mande um Pix',
      })?.label,
    ).toBe('Mande um Pix');
  });

  it('recusa link inválido ou que não é https', () => {
    expect(supportLink({ VITE_SUPPORT_URL: 'ko-fi.com/exemplo' })).toBeNull();
    expect(supportLink({ VITE_SUPPORT_URL: 'http://ko-fi.com/exemplo' })).toBeNull();
    expect(supportLink({ VITE_SUPPORT_URL: 'javascript:alert(1)' })).toBeNull();
  });

  it('some em build de portal com anúncios', () => {
    const url = 'https://ko-fi.com/exemplo';
    expect(supportLink({ VITE_SUPPORT_URL: url, VITE_ADS: 'poki' })).toBeNull();
    expect(supportLink({ VITE_SUPPORT_URL: url, VITE_ADS: 'nenhum' })).not.toBeNull();
  });
});
