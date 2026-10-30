/**
 * Cargador de la escena 3D (va en el bundle inicial, debe ser mínimo).
 * Solo importa `Scene3D` (Three.js) si el dispositivo es apto y DESPUÉS del contenido:
 * escritorio → load + requestIdleCallback; móvil → primera interacción (scroll/toque).
 */
export type SceneQuality = 'high' | 'medium';

interface NavigatorExtras {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

export function pickQuality(): SceneQuality | null {
  const nav = navigator as Navigator & NavigatorExtras;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  if (nav.connection?.saveData) return null;
  const cores = nav.hardwareConcurrency ?? 2;
  if (cores < 4) return null;
  const memory = nav.deviceMemory ?? 4;
  if (cores >= 8 && memory >= 8 && innerWidth >= 1024) return 'high';
  if (memory < 2) return null;
  return 'medium';
}

export function bootScene(): void {
  const canvas = document.getElementById('bg');
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const quality = pickQuality();
  if (!quality) return;

  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    void import('./Scene3D')
      .then(({ mountScene }) => {
        const anchor = document.querySelector<HTMLElement>('[data-scene-anchor]');
        mountScene(canvas, { quality, anchor });
      })
      .catch(() => {
        // Sin 3D la página sigue completa: el fondo CSS y el SVG del hero quedan visibles.
      });
  };

  const isDesktop = matchMedia('(min-width: 900px) and (pointer: fine)').matches;
  if (isDesktop) {
    const idle = () =>
      'requestIdleCallback' in window
        ? requestIdleCallback(start, { timeout: 2000 })
        : setTimeout(start, 200);
    if (document.readyState === 'complete') idle();
    else addEventListener('load', idle, { once: true });
  } else {
    const events = ['scroll', 'pointerdown', 'touchstart', 'keydown'] as const;
    const onFirst = () => {
      events.forEach((e) => removeEventListener(e, onFirst));
      if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 1500 });
      else setTimeout(start, 100);
    };
    events.forEach((e) => addEventListener(e, onFirst, { passive: true, once: true }));
  }
}
