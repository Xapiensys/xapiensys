/**
 * Simulador de página web: el visitante escribe su negocio con sus propias palabras, elige
 * rubro, estilo y color, y ve una web completa con foto real de su rubro. "Generar con IA"
 * reescribe todos los textos con /api/simulate mientras una animación muestra cómo se arma.
 * La vista previa nunca está vacía: arranca con la plantilla del rubro.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  ACCENTS,
  EXAMPLES,
  RUBROS,
  STYLES,
  fakeDomain,
  templateContent,
  type AccentId,
  type RubroId,
  type SimContent,
  type StyleId,
} from '@/lib/simulator';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { track } from '@/lib/analytics';
import './styles/simulator.css';

interface Props {
  /** Foto de portada por rubro (URL optimizada). */
  images: Partial<Record<RubroId, string>>;
}

const ICONS = [
  'M4 7h16M4 12h16M4 17h10',
  'M12 3l8 4v6c0 4-3.5 7-8 8-4.5-1-8-4-8-8V7l8-4Z',
  'M5 12l4 4 10-10',
];

const BUILD_STEPS = [
  'Leyendo lo que escribiste',
  'Redactando tus textos',
  'Aplicando tu estilo y color',
  'Armando las secciones',
];

export default function SiteSimulator({ images }: Props) {
  const [business, setBusiness] = useState('');
  const [rubro, setRubro] = useState<RubroId>('restaurante');
  const [description, setDescription] = useState('');
  const [style, setStyle] = useState<StyleId>('ejecutivo');
  const [accent, setAccent] = useState<AccentId>('auto');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [full, setFull] = useState(false);
  const [ai, setAi] = useState<SimContent | null>(null);
  const [aiFor, setAiFor] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'template'>('idle');
  const [step, setStep] = useState(0);
  const [typed, setTyped] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const frameRef = useRef<HTMLDivElement>(null);

  const name = business.trim() || 'Tu Negocio';
  const key = `${rubro}|${name}`;
  // La IA vale para el rubro y nombre con que se generó; si cambian, vuelve la plantilla.
  const content = ai && aiFor === key ? ai : templateContent({ business: name, rubro });
  const initial = name.charAt(0).toUpperCase();
  const domain = useMemo(() => fakeDomain(name), [name]);
  const rubroLabel = RUBROS.find((r) => r.id === rubro)?.label ?? '';
  const styleLabel = STYLES.find((s) => s.id === style)?.label ?? '';
  const photo = images[rubro] ?? images.otro;

  // Pasos de "construyendo tu web" mientras responde la IA.
  useEffect(() => {
    if (status !== 'loading') return;
    setStep(0);
    const t = window.setInterval(
      () => setStep((s) => Math.min(s + 1, BUILD_STEPS.length - 1)),
      900,
    );
    return () => window.clearInterval(t);
  }, [status]);

  // El titular se escribe solo al terminar (efecto "en vivo").
  useEffect(() => {
    if (status !== 'done' || !ai) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const title = ai.heroTitle;
    let i = 0;
    setTyped('');
    const t = window.setInterval(() => {
      i += 1;
      setTyped(title.slice(0, i));
      if (i >= title.length) {
        window.clearInterval(t);
        setTyped(null);
      }
    }, 28);
    return () => window.clearInterval(t);
  }, [version, status, ai]);

  // Pantalla completa: Escape cierra.
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFull(false);
    };
    document.addEventListener('keydown', onKey);
    document.documentElement.classList.add('sim-lock');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.documentElement.classList.remove('sim-lock');
    };
  }, [full]);

  const generate = async (e: Event) => {
    e.preventDefault();
    if (business.trim().length < 2) return;
    setStatus('loading');
    track('simulator_generate', { rubro, style, accent });
    frameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const started = Date.now();
    let next: { content: SimContent | null; source: 'ai' | 'template' } = {
      content: null,
      source: 'template',
    };
    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ business: business.trim(), rubro, description, style }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { source: 'ai' | 'template'; content: SimContent };
      next = { content: data.content, source: data.source };
    } catch {
      // Sin respuesta: se queda la plantilla del rubro.
    }
    // Deja ver la animación de construcción al menos un instante.
    const wait = 1800 - (Date.now() - started);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    setAi(next.content);
    setAiFor(key);
    setStatus(next.content && next.source === 'ai' ? 'done' : 'template');
    setVersion((v) => v + 1);
  };

  const waHref = buildWhatsAppUrl({
    intent: 'simulador',
    topic: `${name} (${rubroLabel}, estilo ${styleLabel})`,
  });

  const heroTitle = typed ?? content.heroTitle;

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
            Descríbelo con tus palabras <small>(la IA las usa)</small>
          </span>
          <textarea
            rows={3}
            maxLength={300}
            placeholder={`Ej. ${EXAMPLES[rubro] ?? EXAMPLES.otro}`}
            value={description}
            onInput={(e) => setDescription(e.currentTarget.value)}
          />
          <small class="sim-count mono">{description.length}/300</small>
        </label>

        <p class="sim-step mono">02 · ESTILO Y COLOR</p>
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
        <div class="sim-accents" role="radiogroup" aria-label="Color de tu marca">
          {ACCENTS.map((a) => (
            <button
              type="button"
              key={a.id}
              role="radio"
              aria-checked={accent === a.id}
              aria-label={`Color: ${a.label}`}
              title={a.label}
              class={`sim-accent ac-${a.id}${accent === a.id ? ' is-on' : ''}`}
              onClick={() => setAccent(a.id)}
            />
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
          {status === 'done' && 'Listo: tu web, escrita por IA con tus palabras.'}
          {status === 'template' && 'Te mostramos una versión base para tu rubro.'}
          {status === 'idle' && 'Escribe el nombre y mira la vista previa al instante.'}
          {status === 'loading' && BUILD_STEPS[step]}
        </p>
      </form>

      <div class="sim-preview" ref={frameRef}>
        <div class="sim-toolbar">
          <span class="mono">VISTA PREVIA EN VIVO</span>
          <div class="sim-tools">
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
            <button type="button" class="sim-full-btn" onClick={() => setFull(true)}>
              Pantalla completa ⤢
            </button>
          </div>
        </div>

        <div
          class={`sim-browser device-${device}${full ? ' is-full' : ''}${
            status === 'loading' ? ' is-loading' : ''
          }`}
          aria-live="polite"
          aria-label={`Vista previa de la web de ${name}`}
        >
          <div class="sim-bar">
            <i aria-hidden="true" />
            <i aria-hidden="true" />
            <i aria-hidden="true" />
            <span class="sim-url">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z" />
              </svg>
              {domain}
            </span>
            {full && (
              <button type="button" class="sim-exit" onClick={() => setFull(false)}>
                Cerrar ✕
              </button>
            )}
          </div>

          {status === 'loading' && (
            <div class="sim-building" aria-hidden="true">
              <span class="sim-spinner" />
              <ol>
                {BUILD_STEPS.map((s, i) => (
                  <li key={s} class={i < step ? 'is-done' : i === step ? 'is-now' : ''}>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div class="sim-scroll">
            <div class={`sim-site theme-${style} accent-${accent}`} key={version}>
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
                <span class="sim-burger" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              </div>

              <div class="sim-hero">
                {photo && <img class="sim-hero-img" src={photo} alt="" loading="lazy" />}
                <div class="sim-hero-copy">
                  <span class="sim-tag">{content.tagline}</span>
                  <p class="sim-title">
                    {heroTitle}
                    {typed !== null && <span class="sim-caret" aria-hidden="true" />}
                  </p>
                  <p class="sim-sub">{content.heroSubtitle}</p>
                  <div class="sim-ctas">
                    <span class="sim-btn">{content.ctaLabel}</span>
                    <span class="sim-btn sim-btn-wa">WhatsApp</span>
                  </div>
                </div>
              </div>

              <ul class="sim-highlights">
                {content.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>

              <div class="sim-section">
                <p class="sim-h">Lo que ofrecemos</p>
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
              </div>

              <div class="sim-section sim-split">
                {photo && <img class="sim-about-img" src={photo} alt="" loading="lazy" />}
                <div>
                  <p class="sim-h">Sobre {name}</p>
                  <p class="sim-about-text">{content.about}</p>
                  <span class="sim-btn sim-btn-ghost">Conócenos</span>
                </div>
              </div>

              <div class="sim-section">
                <p class="sim-h">Cómo funciona</p>
                <ol class="sim-steps">
                  {content.steps.map((s, i) => (
                    <li key={s.title}>
                      <span>{i + 1}</span>
                      <strong>{s.title}</strong>
                      <p>{s.text}</p>
                    </li>
                  ))}
                </ol>
              </div>

              <div class="sim-band">
                <p>{content.ctaBand}</p>
                <span class="sim-btn sim-btn-wa">Escríbenos por WhatsApp</span>
              </div>

              <div class="sim-footer">
                <span>
                  © {new Date().getFullYear()} {name}
                </span>
                <span>Hecho por Xapiensys</span>
              </div>
            </div>
          </div>
        </div>

        <div class="sim-cta">
          <p>
            <strong>¿Te gusta? La hacemos real.</strong> Con tu logo, tus fotos y tus textos,
            rápida, lista para Google y con WhatsApp integrado.
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
            Vista previa automática de ejemplo; la foto es ilustrativa. Tu web final se diseña
            contigo.
          </small>
        </div>
      </div>
    </div>
  );
}
