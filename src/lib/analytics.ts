/**
 * Analítica: `track()` es la única puerta. GA4 se carga diferido (tras interacción o load + idle)
 * y nunca bloquea el render. Si no hay `PUBLIC_GA4_ID`, los eventos solo quedan en dataLayer.
 */
export type AnalyticsEvent =
  | 'cta_whatsapp_click'
  | 'cta_quote_click'
  | 'cta_demo_click'
  | 'cta_booking_click'
  | 'cta_diagnostic_click'
  | 'quote_start'
  | 'quote_step'
  | 'quote_complete'
  | 'lead_submit'
  | 'chat_open'
  | 'chat_message'
  | 'chat_lead_form_shown'
  | 'chat_limit_reached'
  | 'demo_view';

export type EventProps = Record<string, string | number | boolean | undefined>;

type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

function ensureGtag(): Gtag {
  window.dataLayer = window.dataLayer ?? [];
  if (!window.gtag) {
    window.gtag = function gtag() {
      // gtag.js necesita el objeto `arguments`, no un array.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
  }
  return window.gtag;
}

export function track(event: AnalyticsEvent, props: EventProps = {}): void {
  if (typeof window === 'undefined') return;
  try {
    ensureGtag()('event', event, props);
  } catch {
    // La analítica nunca rompe la interacción.
  }
}

let loaded = false;

export function loadGa4(measurementId: string | undefined): void {
  if (loaded || !measurementId || typeof document === 'undefined') return;
  loaded = true;
  const gtag = ensureGtag();
  gtag('js', new Date());
  gtag('config', measurementId, { anonymize_ip: true });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.append(script);
}

/** Carga GA4 tras la primera interacción o, como máximo, tras `load` + idle. */
export function scheduleGa4(measurementId: string | undefined): void {
  if (!measurementId) return;
  const run = () => loadGa4(measurementId);
  const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;
  const onFirst = () => {
    events.forEach((e) => window.removeEventListener(e, onFirst));
    run();
  };
  events.forEach((e) => window.addEventListener(e, onFirst, { once: true, passive: true }));
  window.addEventListener(
    'load',
    () => {
      const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 3000));
      window.setTimeout(() => idle(run, { timeout: 4000 }), 3500);
    },
    { once: true },
  );
}

/* ---------- Atribución (UTM + landing_path) ---------- */

export interface Attribution {
  utm_source?: string | undefined;
  utm_medium?: string | undefined;
  utm_campaign?: string | undefined;
  landing_path?: string | undefined;
}

const ATTR_KEY = 'xp_attr';

export function captureAttribution(): void {
  try {
    if (sessionStorage.getItem(ATTR_KEY)) return;
    const params = new URLSearchParams(location.search);
    const data: Attribution = { landing_path: location.pathname };
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign'] as const) {
      const value = params.get(key);
      if (value) data[key] = value.slice(0, 100);
    }
    if (!data.utm_source && document.referrer) {
      const ref = new URL(document.referrer);
      if (ref.hostname !== location.hostname) data.utm_source = ref.hostname.slice(0, 100);
    }
    sessionStorage.setItem(ATTR_KEY, JSON.stringify(data));
  } catch {
    // sessionStorage puede no estar disponible (modo privado estricto).
  }
}

export function getAttribution(): Attribution {
  try {
    const raw = sessionStorage.getItem(ATTR_KEY);
    return raw ? (JSON.parse(raw) as Attribution) : { landing_path: location.pathname };
  } catch {
    return {};
  }
}
