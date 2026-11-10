/**
 * Ciclo de vida de página con navegación sin recarga (ClientRouter de Astro).
 * Los <script> de módulo se ejecutan una sola vez; este helper corre `fn` en cada página
 * (también la primera) y le pasa una señal que se aborta al salir: úsala en
 * addEventListener({ signal }) y para desmontar observadores, animaciones o WebGL.
 */
type Options = {
  /** Solo en esta ruta (p. ej. '/demos/clinica'). */
  path?: string;
};

export function onPageLoad(fn: (signal: AbortSignal) => void, opts: Options = {}): void {
  let ctrl: AbortController | null = null;
  const stop = () => {
    ctrl?.abort();
    ctrl = null;
  };
  const run = () => {
    stop();
    const here = location.pathname.replace(/\/$/, '') || '/';
    if (opts.path && here !== opts.path) return;
    ctrl = new AbortController();
    fn(ctrl.signal);
  };
  document.addEventListener('astro:page-load', run);
  document.addEventListener('astro:before-swap', stop);
}

/** Ejecuta `cleanup` cuando la señal se aborta (al salir de la página). */
export function onLeave(signal: AbortSignal, cleanup: () => void): void {
  if (signal.aborted) cleanup();
  else signal.addEventListener('abort', cleanup, { once: true });
}
