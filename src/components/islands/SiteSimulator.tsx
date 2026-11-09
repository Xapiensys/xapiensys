/**
 * Simulador de página web: el visitante escribe su negocio, elige rubro y estilo, y ve al
 * instante una web de ejemplo con su nombre. "Generar con IA" reescribe los textos con
 * /api/simulate. La vista previa nunca está vacía: arranca con la plantilla del rubro.
 */
import { useMemo, useState } from 'preact/hooks';
import {
  RUBROS,
  STYLES,
  fakeDomain,
  templateContent,
  type RubroId,
  type SimContent,
  type StyleId,
} from '@/lib/simulator';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { track } from '@/lib/analytics';
import './styles/simulator.css';

const ICONS = [
  'M4 7h16M4 12h16M4 17h10',
  'M12 3l8 4v6c0 4-3.5 7-8 8-4.5-1-8-4-8-8V7l8-4Z',
  'M5 12l4 4 10-10',
];

export default function SiteSimulator() {
  const [business, setBusiness] = useState('');
  const [rubro, setRubro] = useState<RubroId>('restaurante');
  const [description, setDescription] = useState('');
  const [style, setStyle] = useState<StyleId>('ejecutivo');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [ai, setAi] = useState<SimContent | null>(null);
  const [aiFor, setAiFor] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'template'>('idle');
  const [version, setVersion] = useState(0);

  const name = business.trim() || 'Tu Negocio';
  const key = `${rubro}|${name}`;
  // La IA solo vale para el rubro y nombre con que se generó; si cambian, vuelve la plantilla.
  const content = ai && aiFor === key ? ai : templateContent({ business: name, rubro });
  const initial = name.charAt(0).toUpperCase();
  const domain = useMemo(() => fakeDomain(name), [name]);
  const rubroLabel = RUBROS.find((r) => r.id === rubro)?.label ?? '';
  const styleLabel = STYLES.find((s) => s.id === style)?.label ?? '';

  const generate = async (e: Event) => {
    e.preventDefault();
    if (business.trim().length < 2) return;
    setStatus('loading');
    track('simulator_generate', { rubro, style });
    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ business: business.trim(), rubro, description, style }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { source: 'ai' | 'template'; content: SimContent };
      setAi(data.content);
      setAiFor(key);
      setStatus(data.source === 'ai' ? 'done' : 'template');
    } catch {
      setAi(null);
      setStatus('template');
    }
    setVersion((v) => v + 1);
  };

  const waHref = buildWhatsAppUrl({
    intent: 'simulador',
    topic: `${name} (${rubroLabel}, estilo ${styleLabel})`,
  });

  return (
    <div class="sim">
      <form class="sim-form" onSubmit={generate}>
        <p class="sim-step mono">01 · TU NEGOCIO</p>
        <label class="sim-field">
          <span>Nombre del negocio</span>
          <input
            type="text"
            required
            minLength={2}
            maxLength={40}
            placeholder="Ej. Pollería Don Lucho"
            value={business}
            onInput={(e) => setBusiness(e.currentTarget.value)}
          />
        </label>
        <label class="sim-field">
          <span>Rubro</span>
          <select value={rubro} onChange={(e) => setRubro(e.currentTarget.value as RubroId)}>
            {RUBROS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label class="sim-field">
          <span>
            Cuéntanos qué vendes y a quién <small>(opcional)</small>
          </span>
          <textarea
            rows={3}
            maxLength={300}
            placeholder="Ej. Pollos a la brasa y parrillas en Surco, delivery hasta las 11 p. m."
            value={description}
            onInput={(e) => setDescription(e.currentTarget.value)}
          />
        </label>

        <p class="sim-step mono">02 · ESTILO</p>
        <div class="sim-styles" role="radiogroup" aria-label="Estilo visual">
          {STYLES.map((s) => (
            <button
              type="button"
              key={s.id}
              role="radio"
              aria-checked={style === s.id}
              class={`sim-style sw-${s.id}${style === s.id ? ' is-on' : ''}`}
              onClick={() => setStyle(s.id)}
            >
              <span aria-hidden="true" />
              {s.label}
            </button>
          ))}
        </div>

        <button
          class="sim-generate"
          type="submit"
          disabled={status === 'loading' || business.trim().length < 2}
        >
          {status === 'loading' ? 'Diseñando tu web…' : 'Generar mi web con IA'}
          <span aria-hidden="true">✦</span>
        </button>
        <p class="sim-status" role="status">
          {status === 'done' && 'Listo: textos escritos por IA para tu negocio.'}
          {status === 'template' && 'Te mostramos una versión base para tu rubro.'}
          {status === 'idle' && 'Escribe el nombre y mira la vista previa al instante.'}
        </p>
      </form>

      <div class="sim-preview">
        <div class="sim-toolbar">
          <span class="mono">VISTA PREVIA</span>
          <div class="sim-devices" role="group" aria-label="Dispositivo">
            <button
              type="button"
              aria-pressed={device === 'desktop'}
              onClick={() => setDevice('desktop')}
            >
              Escritorio
            </button>
            <button
              type="button"
              aria-pressed={device === 'mobile'}
              onClick={() => setDevice('mobile')}
            >
              Celular
            </button>
          </div>
        </div>

        <div
          class={`sim-browser device-${device}${status === 'loading' ? ' is-loading' : ''}`}
          aria-live="polite"
          aria-label={`Vista previa de la web de ${name}`}
        >
          <div class="sim-bar" aria-hidden="true">
            <i />
            <i />
            <i />
            <span class="sim-url">
              <svg viewBox="0 0 24 24">
                <path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z" />
              </svg>
              {domain}
            </span>
          </div>

          <div class={`sim-site theme-${style}`} key={version}>
            <div class="sim-nav">
              <span class="sim-logo" aria-hidden="true">
                {initial}
              </span>
              <strong>{name}</strong>
              <span class="sim-links" aria-hidden="true">
                <i>Inicio</i>
                <i>Servicios</i>
                <i>Nosotros</i>
                <i>Contacto</i>
              </span>
              <span class="sim-nav-cta">{content.ctaLabel}</span>
            </div>

            <div class="sim-hero">
              <div class="sim-hero-copy">
                <span class="sim-tag">{content.tagline}</span>
                <p class="sim-title">{content.heroTitle}</p>
                <p class="sim-sub">{content.heroSubtitle}</p>
                <div class="sim-ctas">
                  <span class="sim-btn">{content.ctaLabel}</span>
                  <span class="sim-btn sim-btn-wa">WhatsApp</span>
                </div>
              </div>
              <div class="sim-art" aria-hidden="true">
                <span class="sim-orb" />
                <span class="sim-ring" />
                <span class="sim-card c1">
                  <b />
                  <i />
                  <i />
                </span>
                <span class="sim-card c2">
                  <b />
                  <i />
                </span>
                <span class="sim-card c3">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            </div>

            <ul class="sim-highlights">
              {content.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>

            <div class="sim-services">
              {content.services.map((s, i) => (
                <div class="sim-service" key={s.title}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d={ICONS[i % ICONS.length]} />
                  </svg>
                  <strong>{s.title}</strong>
                  <p>{s.text}</p>
                </div>
              ))}
            </div>

            <div class="sim-about">
              <p>{content.about}</p>
              <span class="sim-btn sim-btn-wa">Escríbenos por WhatsApp</span>
            </div>

            <div class="sim-footer">
              © {new Date().getFullYear()} {name} · Hecho por Xapiensys
            </div>
          </div>
        </div>

        <div class="sim-cta">
          <p>
            <strong>¿Te gusta? La hacemos real.</strong> Diseño a medida con tu marca, fotos y
            textos, rápida y lista para Google.
          </p>
          <div>
            <a
              class="sim-cta-wa"
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              data-track="cta_whatsapp_click"
              data-track-location="simulator"
              onClick={() => track('simulator_cta', { rubro, style })}
            >
              Quiero esta web
            </a>
            <a
              class="sim-cta-quote"
              href="/cotizar"
              data-track="cta_quote_click"
              data-track-location="simulator"
            >
              Ver precio en 1 minuto
            </a>
          </div>
          <small>
            Vista previa generada automáticamente como ejemplo; tu web final se diseña contigo.
          </small>
        </div>
      </div>
    </div>
  );
}
