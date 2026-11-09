/** Chat IA en vivo (ARCHITECTURE §6.3). Si hay límite o error → modo guiado + WhatsApp, sin errores crudos. */
import { useEffect, useRef, useState } from 'preact/hooks';
import { track, getAttribution } from '@/lib/analytics';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { PUBLIC_BOOKING_URL } from 'astro:env/client';
import { ContactFields, emptyContact, type ContactValues } from './ContactFields';
import type { GuidedTopic } from '@/lib/chatGuided';
import './styles/forms.css';
import './styles/chat.css';

type Link = { label: string; href: string };
type Message = {
  id: number;
  role: 'agent' | 'user';
  text: string;
  links?: Link[];
  streaming?: boolean;
};

export type { GuidedTopic };

interface Props {
  suggestions: string[];
  guided: GuidedTopic[];
  /** Prefijo de ids: permite tener el chat de la home y el flotante a la vez. */
  idPrefix?: string;
  /** `dock`: versión compacta dentro del asistente flotante. */
  variant?: 'section' | 'dock';
}

const GREETING = 'Hola, soy el asistente de Xapiensys. ¿Qué te gustaría mejorar en tu negocio?';
const LIMIT_TEXT =
  'Por ahora sigo en modo guiado: elige una opción o escríbenos por WhatsApp y te responde una persona del equipo.';

let nextId = 1;
const msg = (role: Message['role'], text: string, links?: Link[]): Message => ({
  id: nextId++,
  role,
  text,
  ...(links ? { links } : {}),
});

function getSessionId(): string {
  try {
    const existing = sessionStorage.getItem('xp_chat');
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem('xp_chat', id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export default function ChatDemo({
  suggestions,
  guided,
  idPrefix = 'chat',
  variant = 'section',
}: Props) {
  const [messages, setMessages] = useState<Message[]>([msg('agent', GREETING)]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'ai' | 'guided'>('ai');
  const [leadForm, setLeadForm] = useState<'hidden' | 'open' | 'sending' | 'done' | 'error'>(
    'hidden',
  );
  const [leadCode, setLeadCode] = useState<string | null>(null);
  const [contact, setContact] = useState<ContactValues>(emptyContact);
  const listRef = useRef<HTMLDivElement>(null);
  const opened = useRef(false);
  const count = useRef(0);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, leadForm]);

  const open = () => {
    if (!opened.current) {
      opened.current = true;
      track('chat_open');
    }
  };

  const goGuided = (reason: string) => {
    setMode('guided');
    track('chat_limit_reached', { reason });
  };

  const showLeadForm = () => {
    setLeadForm((s) => (s === 'hidden' ? 'open' : s));
    track('chat_lead_form_shown');
  };

  const send = async (raw: string) => {
    const text = raw.trim().slice(0, 500);
    if (!text || busy) return;
    open();
    setInput('');

    if (mode === 'guided') {
      const topic = guided.find((g) => g.label === text);
      setMessages((m) => [
        ...m,
        msg('user', text),
        topic ? msg('agent', topic.answer, topic.links) : msg('agent', LIMIT_TEXT),
      ]);
      return;
    }

    count.current += 1;
    track('chat_message', { n: count.current });
    const reply = msg('agent', '');
    reply.streaming = true;
    setMessages((m) => [...m, msg('user', text), reply]);
    setBusy(true);

    const update = (fn: (r: Message) => Message) =>
      setMessages((m) => m.map((x) => (x.id === reply.id ? fn(x) : x)));

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: getSessionId(), message: text }),
      });
      if (!res.ok || !res.body) throw new Error(String(res.status));
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let limited = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;
          const event = JSON.parse(line.slice(5)) as {
            type: string;
            text?: string;
            reason?: string;
          };
          if (event.type === 'text' && event.text)
            update((r) => ({ ...r, text: r.text + event.text }));
          else if (event.type === 'lead_form') showLeadForm();
          else if (event.type === 'limit') {
            limited = true;
            goGuided(event.reason ?? 'limit');
          }
        }
      }
      update((r) => ({
        ...r,
        streaming: false,
        text: r.text.trim() || (limited ? LIMIT_TEXT : r.text),
        ...(limited
          ? {
              links: [
                { label: 'Escribir por WhatsApp', href: buildWhatsAppUrl({ intent: 'chat' }) },
              ],
            }
          : {}),
      }));
    } catch {
      goGuided('error');
      update((r) => ({
        ...r,
        streaming: false,
        text: r.text.trim() || LIMIT_TEXT,
        links: [{ label: 'Escribir por WhatsApp', href: buildWhatsAppUrl({ intent: 'chat' }) }],
      }));
    } finally {
      setBusy(false);
    }
  };

  const submitLead = async (e: Event) => {
    e.preventDefault();
    if (!(e.currentTarget as HTMLFormElement).reportValidity()) return;
    setLeadForm('sending');
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          source: 'chat',
          chatSessionId: getSessionId(),
          name: contact.name,
          company: contact.company,
          phone: contact.phone,
          consent: contact.consent,
          website: contact.website,
          message: messages
            .filter((m) => m.role === 'user')
            .map((m) => m.text)
            .join(' / ')
            .slice(0, 1500),
          utm: getAttribution(),
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { leadCode: string };
      setLeadCode(data.leadCode);
      setLeadForm('done');
      track('lead_submit', { source: 'chat' });
    } catch {
      setLeadForm('error');
    }
  };

  const chips = mode === 'guided' ? guided.map((g) => g.label) : suggestions;

  return (
    <div class={`chat chat--${variant}`} data-state={busy ? 'busy' : mode} onFocusIn={open}>
      <div class="chat-scan" aria-hidden="true" />
      <div class="chat-header">
        <div class="chat-core" aria-hidden="true">
          <span />
          <svg viewBox="0 0 24 24">
            <path d="M5 5 19 19M19 5 5 19" />
          </svg>
        </div>
        <div class="chat-id">
          <strong>
            X<span class="chat-slash">/</span>CORE
          </strong>
          <span class="mono">
            {mode === 'ai' ? (busy ? 'PROCESANDO…' : 'ASISTENTE IA · LISTO') : 'MODO GUIADO'}
          </span>
        </div>
        <span class="chat-online mono">
          <i aria-hidden="true" /> {mode === 'ai' ? 'EN LÍNEA' : 'GUIADO'}
        </span>
      </div>

      <div class="chat-messages" ref={listRef} aria-live="polite" aria-relevant="additions">
        {messages.map((m) => (
          <div class={`chat-msg ${m.role}`} key={m.id} aria-busy={m.streaming ? 'true' : undefined}>
            <span class="chat-msg-label mono" aria-hidden="true">
              {m.role === 'agent' ? 'X/CORE ›' : 'TÚ ›'}
            </span>
            <span class="visually-hidden">{m.role === 'agent' ? 'Asistente:' : 'Tú:'}</span>
            {m.text && <span class="chat-text">{m.text}</span>}
            {m.streaming && m.text && <span class="chat-caret" aria-hidden="true" />}
            {!m.text &&
              (m.streaming ? (
                <span class="chat-typing" aria-label="Escribiendo">
                  <i />
                  <i />
                  <i />
                </span>
              ) : null)}
            {m.links && (
              <span class="chat-links">
                {m.links.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    {...(l.href.startsWith('http')
                      ? { target: '_blank', rel: 'noopener noreferrer' }
                      : {})}
                    {...(l.href.includes('wa.me')
                      ? { 'data-track': 'cta_whatsapp_click', 'data-track-location': 'chat' }
                      : {})}
                  >
                    {l.label} ↗
                  </a>
                ))}
              </span>
            )}
          </div>
        ))}

        {messages.length === 1 && mode === 'ai' && (
          <ul class="chat-intro" aria-label="Qué puede hacer el asistente">
            <li>
              <span class="mono">01</span>
              <strong>Te orienta</strong>
              Qué servicio resuelve tu problema, según tu rubro.
            </li>
            <li>
              <span class="mono">02</span>
              <strong>Te da precios</strong>
              Rangos de inversión en soles, sin compromiso.
            </li>
            <li>
              <span class="mono">03</span>
              <strong>Te conecta</strong>
              Deja tus datos y el equipo te escribe por WhatsApp.
            </li>
          </ul>
        )}

        {leadForm !== 'hidden' && leadForm !== 'done' && (
          <form class="chat-lead" onSubmit={submitLead}>
            <p class="chat-lead-title">Déjanos tus datos y te escribimos por WhatsApp</p>
            <ContactFields
              idPrefix={idPrefix}
              values={contact}
              onChange={setContact}
              showEmail={false}
              companyLabel="Negocio"
            />
            {leadForm === 'error' && (
              <p class="xf-error" role="alert">
                No pudimos registrar tus datos.{' '}
                <a
                  href={buildWhatsAppUrl({ intent: 'chat' })}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Escríbenos por WhatsApp
                </a>
                .
              </p>
            )}
            <button class="xf-btn" type="submit" disabled={leadForm === 'sending'}>
              {leadForm === 'sending' ? 'Enviando…' : 'Enviar datos'}
            </button>
          </form>
        )}
        {leadForm === 'done' && leadCode && (
          <div class="chat-msg agent">
            <span class="chat-msg-label mono" aria-hidden="true">
              X/CORE ›
            </span>
            Listo, {contact.name.split(' ')[0]}. Tu código es {leadCode}. Te escribimos pronto, o
            adelántate:
            <span class="chat-links">
              <a
                href={buildWhatsAppUrl({ intent: 'chat', leadCode })}
                target="_blank"
                rel="noopener noreferrer"
                data-track="cta_whatsapp_click"
                data-track-location="chat_lead"
              >
                Continuar por WhatsApp ↗
              </a>
              {PUBLIC_BOOKING_URL && (
                <a
                  href={PUBLIC_BOOKING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-track="cta_booking_click"
                  data-track-location="chat_lead"
                >
                  Agendar una llamada ↗
                </a>
              )}
            </span>
          </div>
        )}
      </div>

      <div class="chat-suggestions">
        {chips.map((s) => (
          <button type="button" key={s} onClick={() => void send(s)} disabled={busy}>
            {s} <span aria-hidden="true">↗</span>
          </button>
        ))}
      </div>

      <form
        class="chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <label class="visually-hidden" for={`${idPrefix}-input`}>
          Escribe tu mensaje
        </label>
        <span class="chat-prompt mono" aria-hidden="true">
          &gt;_
        </span>
        <input
          id={`${idPrefix}-input`}
          type="text"
          maxLength={500}
          placeholder={
            mode === 'ai' ? 'Pregúntale a la IA por tu proyecto…' : 'Elige una opción de arriba'
          }
          autocomplete="off"
          value={input}
          disabled={mode === 'guided'}
          onInput={(e) => setInput(e.currentTarget.value)}
        />
        <button
          type="submit"
          aria-label="Enviar mensaje"
          disabled={busy || mode === 'guided' || !input.trim()}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m3 4 18 8-18 8 3-8-3-8Zm3 8h15" />
          </svg>
        </button>
      </form>
      <p class="chat-note">
        Asistente con IA de Xapiensys. Las conversaciones se guardan para mejorar el servicio.{' '}
        <a href="/privacidad">Privacidad</a>
      </p>
    </div>
  );
}
