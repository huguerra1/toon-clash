import { describe, expect, it } from 'vitest';
import { Ads, NoAdsProvider, createAdProvider, type AdProvider, type PauseTarget } from './ads';

function setup(provider: Partial<AdProvider> = {}, interval = 1000) {
  const log: string[] = [];
  let time = 10_000;
  const target: PauseTarget = {
    pause: () => log.push('pause'),
    resume: () => log.push('resume'),
  };
  const base = new NoAdsProvider();
  const full: AdProvider = {
    name: 'teste',
    init: () => base.init(),
    gameplayStart: () => log.push('start'),
    gameplayStop: () => log.push('stop'),
    commercialBreak: async () => {
      log.push('break');
    },
    rewardedBreak: async () => {
      log.push('reward');
      return true;
    },
    ...provider,
  };
  const ads = new Ads(full, target, { minBreakIntervalMs: interval, now: () => time });
  return { ads, log, advance: (ms: number) => (time += ms) };
}

describe('NoAdsProvider', () => {
  it('resolve tudo na hora e sempre dá a recompensa', async () => {
    const p = new NoAdsProvider();
    await expect(p.init()).resolves.toBeUndefined();
    await expect(p.commercialBreak()).resolves.toBeUndefined();
    await expect(p.rewardedBreak()).resolves.toBe(true);
  });

  it('é o padrão para nome vazio ou desconhecido', () => {
    expect(createAdProvider(undefined).name).toBe('nenhum');
    expect(createAdProvider('portal-que-nao-existe').name).toBe('nenhum');
  });
});

describe('Ads', () => {
  it('não repete gameplayStart/Stop seguidos', () => {
    const { ads, log } = setup();
    ads.gameplayStart();
    ads.gameplayStart();
    ads.gameplayStop();
    ads.gameplayStop();
    expect(log).toEqual(['start', 'stop']);
  });

  it('pausa o jogo durante o anúncio e encerra o trecho jogável antes', async () => {
    const { ads, log } = setup();
    ads.gameplayStart();
    await expect(ads.commercialBreak()).resolves.toBe(true);
    expect(log).toEqual(['start', 'stop', 'pause', 'break', 'resume']);
    expect(ads.showing).toBe(false);
  });

  it('respeita o intervalo mínimo entre intervalos comerciais', async () => {
    const { ads, log, advance } = setup({}, 1000);
    await ads.commercialBreak();
    advance(500);
    await expect(ads.commercialBreak()).resolves.toBe(false);
    advance(600);
    await expect(ads.commercialBreak()).resolves.toBe(true);
    expect(log.filter((l) => l === 'break')).toHaveLength(2);
  });

  it('não abre dois anúncios ao mesmo tempo', async () => {
    let finish = () => {};
    const { ads } = setup({
      commercialBreak: () => new Promise<void>((resolve) => (finish = resolve)),
    });
    const first = ads.commercialBreak();
    expect(ads.showing).toBe(true);
    await expect(ads.rewardedBreak()).resolves.toBe(false);
    finish();
    await expect(first).resolves.toBe(true);
  });

  it('volta o jogo mesmo quando a SDK falha', async () => {
    const { ads, log } = setup({
      commercialBreak: () => Promise.reject(new Error('bloqueado')),
      rewardedBreak: () => Promise.reject(new Error('bloqueado')),
    });
    await ads.commercialBreak();
    await expect(ads.rewardedBreak()).resolves.toBe(false);
    expect(log).toEqual(['pause', 'resume', 'pause', 'resume']);
    expect(ads.showing).toBe(false);
  });

  it('anúncio premiado devolve a resposta do provedor e não conta como intervalo', async () => {
    const { ads } = setup({ rewardedBreak: () => Promise.resolve(false) });
    await expect(ads.rewardedBreak()).resolves.toBe(false);
    await expect(ads.commercialBreak()).resolves.toBe(true);
  });

  it('init engole erro da SDK', async () => {
    const { ads } = setup({ init: () => Promise.reject(new Error('sem rede')) });
    await expect(ads.init()).resolves.toBeUndefined();
  });

  it('erro em gameplayStart não derruba o jogo', () => {
    const { ads } = setup({
      gameplayStart: () => {
        throw new Error('sdk');
      },
    });
    expect(() => ads.gameplayStart()).not.toThrow();
  });
});
