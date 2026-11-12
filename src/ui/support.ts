/**
 * Botão "Apoie o desenvolvedor" da tela inicial (Ko-fi, LivePix, Buy Me a Coffee…).
 *
 * O link vem do build (`VITE_SUPPORT_URL`); sem link, o botão não aparece. Também some quando
 * há anúncios de portal (`VITE_ADS`), porque Poki, CrazyGames e companhia não aceitam links
 * para fora do jogo.
 */

export interface SupportLink {
  url: string;
  label: string;
}

export interface SupportEnv {
  VITE_SUPPORT_URL?: string;
  VITE_SUPPORT_LABEL?: string;
  VITE_ADS?: string;
}

export const DEFAULT_SUPPORT_LABEL = 'Apoie o desenvolvedor';

/** Devolve o link configurado, ou null se não houver link válido ou se for build de portal. */
export function supportLink(env: SupportEnv): SupportLink | null {
  const ads = (env.VITE_ADS ?? '').trim().toLowerCase();
  if (ads !== '' && ads !== 'nenhum') return null;
  const raw = (env.VITE_SUPPORT_URL ?? '').trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  // Só https: nada de javascript:, data: ou http sem criptografia.
  if (url.protocol !== 'https:') return null;
  const label = (env.VITE_SUPPORT_LABEL ?? '').trim() || DEFAULT_SUPPORT_LABEL;
  return { url: url.href, label };
}

/** Monta o botão (um link que abre em outra aba). */
export function supportButton(link: SupportLink): HTMLAnchorElement {
  const a = document.createElement('a');
  a.className = 'support-link';
  a.href = link.url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.textContent = `♥ ${link.label}`;
  // Na tela inicial, clicar em qualquer lugar entra no menu; o link não pode disparar isso.
  a.addEventListener('click', (e) => e.stopPropagation());
  return a;
}
