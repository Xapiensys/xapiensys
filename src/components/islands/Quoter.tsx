/** Cotizador por pasos (ARCHITECTURE §6.4). El precio SIEMPRE lo calcula el servidor. */
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  needOptions,
  sectorOptions,
  webScopeOptions,
  chatbotChannelOptions,
  automationScopeOptions,
  timelineOptions,
  formatSoles,
  type QuoteScope,
  type QuoteResult,
  type Need,
} from '@/lib/quoteOptions';
import { track, getAttribution } from '@/lib/analytics';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { mountTurnstile, resetTurnstile } from '@/lib/turnstileClient';
import { ContactFields, emptyContact, type ContactValues } from './ContactFields';
import './styles/forms.css';
import './styles/quoter.css';

type Option = { readonly value: string; readonly label: string };

const STEPS = ['Necesidad', 'Sector', 'Alcance', 'Plazo', 'Datos'] as const;

interface Props {
  /** "embedded" en el home; "page" en /cotizar. */
  variant?: 'embedded' | 'page';
}

function Choice({
  name,
  options,
  multiple = false,
  selected,
  onToggle,
}: {
  name: string;
  options: readonly Option[];
  multiple?: boolean;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div class="q-options">
      {options.map((o) => (
        <label class={`q-option${selected.includes(o.value) ? ' is-selected' : ''}`} key={o.value}>
          <input
            type={multiple ? 'checkbox' : 'radio'}
            name={name}
            value={o.value}
            checked={selected.includes(o.value)}
            onChange={() => onToggle(o.value)}
          />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

export default function Quoter({ variant = 'embedded' }: Props) {
  // En /cotizar el título del paso es h2; embebido en el home, h3 (bajo el h2 de la sección).
  const Heading = variant === 'page' ? 'h2' : 'h3';
  const [step, setStep] = useState(0);
  const [needs, setNeeds] = useState<Need[]>([]);
  const [sector, setSector] = useState<string>('');
  const [scope, setScope] = useState<QuoteScope>({});
  const [timeline, setTimeline] = useState<string>('');
  const [contact, setContact] = useState<ContactValues>(emptyContact);
  const [token, setToken] = useState<string | undefined>();
  const [status, setStatus] = useState<'idle' | 'sending' | 'error' | 'limited'>('idle');
  const [result, setResult] = useState<QuoteResult | null>(null);
  const started = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);

  const scopeNeeded = needs.some((n) => n === 'web' || n === 'chatbot' || n === 'automatizacion');

  const markStart = () => {
    if (!started.current) {
      started.current = true;
      track('quote_start', { variant });
    }
  };

  useEffect(() => {
    if (step === 4 && turnstileRef.current) return mountTurnstile(turnstileRef.current, setToken);
    return undefined;
  }, [step]);

  const go = (next: number) => {
    // Si no hay alcance que preguntar, el paso 3 se salta.
    let target = next;
    if (target === 2 && !scopeNeeded) target = next > step ? 3 : 1;
    setStep(target);
    track('quote_step', { step: target + 1 });
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const canContinue = [
    needs.length > 0,
    sector !== '',
    (!needs.includes('web') || !!scope.web) &&
      (!needs.includes('chatbot') || !!scope.chatbot) &&
      (!needs.includes('automatizacion') || !!scope.automatizacion),
    timeline !== '',
    true,
  ][step];

  const toggleNeed = (v: string) => {
    markStart();
    const value = v as Need;
    setNeeds((prev) => {
      if (value === 'no_seguro') return prev.includes('no_seguro') ? [] : ['no_seguro'];
      const base = prev.filter((n) => n !== 'no_seguro');
      return base.includes(value) ? base.filter((n) => n !== value) : [...base, value];
    });
  };

  const submit = async (e: Event) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    if (!form.reportValidity()) return;
    setStatus('sending');
    try {
      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          answers: { needs, sector, scope, timeline },
          name: contact.name,
          company: contact.company,
          phone: contact.phone,
          email: contact.email,
          consent: contact.consent,
          website: contact.website,
          turnstileToken: token,
          utm: getAttribution(),
        }),
      });
      if (res.status === 429) {
        setStatus('limited');
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as QuoteResult;
      setResult(data);
      setStatus('idle');
      track('quote_complete', { range: `${data.range.min}-${data.range.max}` });
      track('lead_submit', { source: 'quote' });
      requestAnimationFrame(() => headingRef.current?.focus());
    } catch {
      setStatus('error');
      resetTurnstile();
    }
  };

  const fallbackWa = buildWhatsAppUrl({ intent: 'cotizacion', topic: 'Quiero una cotización.' });

  if (result) {
    const wa = buildWhatsAppUrl({
      intent: 'cotizacion',
      topic: `Resumen: ${result.summary}.`,
      leadCode: result.leadCode,
    });
    return (
      <div class={`q q-${variant}`}>
        <p class="q-kicker mono">RESULTADO · {result.leadCode}</p>
        <Heading class="q-title" tabIndex={-1} ref={headingRef}>
          {result.diagnosis ? 'Tu proyecto requiere un diagnóstico' : 'Tu inversión estimada'}
        </Heading>
        <p class="q-range">
          {formatSoles(result.range.min)} – {formatSoles(result.range.max)}
        </p>
        <p class="q-note">
          {result.diagnosis
            ? 'Es un rango amplio: para darte un número preciso necesitamos una conversación corta.'
            : 'Rango orientativo. Confirmamos el monto exacto por escrito antes de empezar.'}
        </p>
        {result.maintenance.max > 0 && (
          <p class="q-maint">
            Mantenimiento sugerido: {formatSoles(result.maintenance.min)} –{' '}
            {formatSoles(result.maintenance.max)} / mes
          </p>
        )}
        <ul class="q-includes">
          {result.includes.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
        <div class="q-actions">
          <a
            class="xf-btn"
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            data-track="cta_whatsapp_click"
            data-track-location="quote_result"
          >
            Continuar por WhatsApp ↗
          </a>
        </div>
        <p class="q-note">Guarda tu código {result.leadCode}: con él retomamos tu cotización.</p>
      </div>
    );
  }

  return (
    <form class={`q q-${variant}`} onSubmit={submit} noValidate={false} onFocusIn={markStart}>
      <div
        class="q-progress"
        data-step={step + 1}
        role="progressbar"
        aria-label="Progreso del cotizador"
        aria-valuemin={1}
        aria-valuemax={5}
        aria-valuenow={step + 1}
      >
        <span />
      </div>
      <p class="q-kicker mono">
        PASO {step + 1} DE {STEPS.length} · {STEPS[step]!.toUpperCase()}
      </p>

      <fieldset class="q-step">
        {step === 0 && (
          <>
            <legend>
              <Heading class="q-title" tabIndex={-1} ref={headingRef}>
                ¿Qué necesitas?
              </Heading>
            </legend>
            <p class="q-hint">Puedes elegir varias opciones.</p>
            <Choice
              name="needs"
              options={needOptions}
              multiple
              selected={needs}
              onToggle={toggleNeed}
            />
          </>
        )}
        {step === 1 && (
          <>
            <legend>
              <Heading class="q-title" tabIndex={-1} ref={headingRef}>
                ¿De qué sector es tu negocio?
              </Heading>
            </legend>
            <Choice
              name="sector"
              options={sectorOptions}
              selected={[sector]}
              onToggle={setSector}
            />
          </>
        )}
        {step === 2 && (
          <>
            <legend>
              <Heading class="q-title" tabIndex={-1} ref={headingRef}>
                Cuéntanos el alcance
              </Heading>
            </legend>
            {needs.includes('web') && (
              <div class="q-group">
                <p class="xf-legend">Página web: ¿cuántas secciones aproximadas?</p>
                <Choice
                  name="scope-web"
                  options={webScopeOptions}
                  selected={[scope.web ?? '']}
                  onToggle={(v) => setScope({ ...scope, web: v as never })}
                />
              </div>
            )}
            {needs.includes('chatbot') && (
              <div class="q-group">
                <p class="xf-legend">Chatbot: ¿en qué canal?</p>
                <Choice
                  name="scope-chatbot"
                  options={chatbotChannelOptions}
                  selected={[scope.chatbot ?? '']}
                  onToggle={(v) => setScope({ ...scope, chatbot: v as never })}
                />
              </div>
            )}
            {needs.includes('automatizacion') && (
              <div class="q-group">
                <p class="xf-legend">Automatización: ¿cuántos procesos?</p>
                <Choice
                  name="scope-auto"
                  options={automationScopeOptions}
                  selected={[scope.automatizacion ?? '']}
                  onToggle={(v) => setScope({ ...scope, automatizacion: v as never })}
                />
              </div>
            )}
          </>
        )}
        {step === 3 && (
          <>
            <legend>
              <Heading class="q-title" tabIndex={-1} ref={headingRef}>
                ¿Para cuándo lo necesitas?
              </Heading>
            </legend>
            <Choice
              name="timeline"
              options={timelineOptions}
              selected={[timeline]}
              onToggle={setTimeline}
            />
          </>
        )}
        {step === 4 && (
          <>
            <legend>
              <Heading class="q-title" tabIndex={-1} ref={headingRef}>
                ¿A dónde te enviamos el resultado?
              </Heading>
            </legend>
            <ContactFields idPrefix={`q-${variant}`} values={contact} onChange={setContact} />
            <div class="xf-turnstile" ref={turnstileRef} />
          </>
        )}
      </fieldset>

      {status === 'error' && (
        <p class="xf-error" role="alert">
          No pudimos calcular tu cotización ahora.{' '}
          <a href={fallbackWa} target="_blank" rel="noopener noreferrer">
            Escríbenos por WhatsApp
          </a>{' '}
          y te respondemos con un rango.
        </p>
      )}
      {status === 'limited' && (
        <p class="xf-error" role="alert">
          Recibimos varias solicitudes desde tu conexión.{' '}
          <a href={fallbackWa} target="_blank" rel="noopener noreferrer">
            Continúa por WhatsApp
          </a>
          .
        </p>
      )}

      <div class="q-actions">
        {step > 0 && (
          <button type="button" class="xf-btn xf-btn-secondary" onClick={() => go(step - 1)}>
            ← Atrás
          </button>
        )}
        {step < 4 ? (
          <button type="button" class="xf-btn" disabled={!canContinue} onClick={() => go(step + 1)}>
            Continuar →
          </button>
        ) : (
          <button type="submit" class="xf-btn" disabled={status === 'sending'}>
            {status === 'sending' ? 'Calculando…' : 'Ver mi cotización'}
          </button>
        )}
      </div>
    </form>
  );
}
