/**
 * Sonidos de interfaz sutiles, sintetizados con Web Audio (sin archivos, ~1 KB).
 * - hover: un "tic" muy suave sobre botones y enlaces principales.
 * - click: un toque corto con un leve barrido.
 * - reveal: una nota cristalina tenue cuando aparece una sección al hacer scroll.
 * Nunca suena antes del primer gesto del usuario (política de autoplay) y se puede apagar
 * con cualquier [data-sfx-toggle]; la preferencia se recuerda en localStorage.
 */

type Kind = 'hover' | 'click' | 'reveal' | 'open';

const KEY = 'xp_sfx';
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let unlocked = false;
let enabled = true;
const last: Record<Kind, number> = { hover: 0, click: 0, reveal: 0, open: 0 };
const GAP: Record<Kind, number> = { hover: 70, click: 60, reveal: 450, open: 200 };

function readPref(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

function ensureCtx(): AudioContext | null {
  if (ctx) return ctx;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  ctx = new Ctx();
  master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  return ctx;
}

/** Tono con envolvente corta. */
function tone(freq: number, dur: number, gain: number, type: OscillatorType, slideTo?: number) {
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export function play(kind: Kind): void {
  if (!enabled || !unlocked) return;
  const now = performance.now();
  if (now - last[kind] < GAP[kind]) return;
  last[kind] = now;
  if (!ensureCtx()) return;
  // Con música sonando, los efectos bajan para no competir.
  const duck = document.documentElement.hasAttribute('data-music-playing') ? 0.5 : 1;
  switch (kind) {
    case 'hover':
      tone(2200, 0.045, 0.012 * duck, 'sine');
      break;
    case 'click':
      tone(880, 0.09, 0.03 * duck, 'triangle', 520);
      break;
    case 'reveal':
      tone(1320, 0.35, 0.008 * duck, 'sine');
      tone(1980, 0.4, 0.005 * duck, 'sine');
      break;
    case 'open':
      tone(520, 0.12, 0.025 * duck, 'sine', 1040);
      break;
  }
}

function syncToggles(): void {
  document.querySelectorAll<HTMLElement>('[data-sfx-toggle]').forEach((b) => {
    b.setAttribute('aria-pressed', String(enabled));
    b.setAttribute(
      'aria-label',
      enabled ? 'Silenciar sonidos de la interfaz' : 'Activar sonidos de la interfaz',
    );
    b.dataset.state = enabled ? 'on' : 'off';
  });
}

const HOVER_TARGETS =
  'a.button, button.button, .nav-cta, .nav-whatsapp, #main-nav a, .card, .dock-launcher, .music-launcher, .wa-float, .sim-generate, .chat-suggestions button, .music-chips button';
const CLICK_TARGETS = 'a, button, summary, [role="radio"], input[type="checkbox"]';

/** Se llama una vez (los escuchas van en document y sirven para todas las páginas). */
export function bootSfx(): void {
  enabled = readPref();
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch {
    // Sin almacenamiento: se usa el valor por defecto.
  }
  if (matchMedia('(prefers-reduced-motion: reduce)').matches && saved === null) {
    // Quien pide menos movimiento suele preferir menos estímulos: arranca en silencio.
    enabled = false;
  }
  syncToggles();

  const unlock = () => {
    unlocked = true;
    if (enabled) void ensureCtx()?.resume();
  };
  addEventListener('pointerdown', unlock, { once: true, passive: true });
  addEventListener('keydown', unlock, { once: true });

  // Hover: solo con mouse real (en celular no hay hover).
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.addEventListener(
      'pointerover',
      (e) => {
        const el = (e.target as Element | null)?.closest(HOVER_TARGETS);
        const from = (e.relatedTarget as Element | null)?.closest(HOVER_TARGETS);
        if (el && el !== from) play('hover');
      },
      { passive: true },
    );
  }

  document.addEventListener(
    'click',
    (e) => {
      const target = e.target as Element | null;
      const toggle = target?.closest<HTMLElement>('[data-sfx-toggle]');
      if (toggle) {
        enabled = !enabled;
        try {
          localStorage.setItem(KEY, enabled ? 'on' : 'off');
        } catch {
          // Sin almacenamiento: vale para esta visita.
        }
        unlocked = true;
        syncToggles();
        if (enabled) {
          void ensureCtx()?.resume();
          play('open');
        }
        return;
      }
      if (target?.closest('[data-open-assistant], .dock-launcher, .music-launcher')) play('open');
      else if (target?.closest(CLICK_TARGETS)) play('click');
    },
    { passive: true },
  );

  // Los interruptores llegan en cada página nueva (navegación sin recarga).
  document.addEventListener('astro:page-load', syncToggles);
}
