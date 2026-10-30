/** Carga Cloudflare Turnstile solo cuando un formulario lo necesita. */
import { TURNSTILE_SITE_KEY } from 'astro:env/client';

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | null = null;

export const turnstileSiteKey = TURNSTILE_SITE_KEY;

function load(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile'));
    s.onerror = () => reject(new Error('turnstile'));
    document.head.append(s);
  });
  return loading;
}

/** Renderiza el widget y devuelve una función para limpiarlo. Sin site key no hace nada. */
export function mountTurnstile(
  el: HTMLElement,
  onToken: (token: string | undefined) => void,
): () => void {
  if (!TURNSTILE_SITE_KEY) {
    onToken(undefined);
    return () => {};
  }
  let id: string | null = null;
  let cancelled = false;
  load()
    .then((ts) => {
      if (cancelled) return;
      id = ts.render(el, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'dark',
        language: 'es',
        callback: (t: string) => onToken(t),
        'expired-callback': () => onToken(undefined),
        'error-callback': () => onToken(undefined),
      });
    })
    .catch(() => onToken(undefined));
  return () => {
    cancelled = true;
    if (id && window.turnstile) window.turnstile.remove(id);
  };
}

export function resetTurnstile(): void {
  window.turnstile?.reset();
}
