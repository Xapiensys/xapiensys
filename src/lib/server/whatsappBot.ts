import { eq, sql } from 'drizzle-orm';
import {
  WHATSAPP_TOKEN,
  WHATSAPP_PHONE_NUMBER_ID,
  WHATSAPP_APP_SECRET,
  LEAD_NOTIFY_EMAIL,
} from 'astro:env/server';
import { PUBLIC_BOOKING_URL } from 'astro:env/client';
import { getDb, schema } from './db';
import { log } from './http';
import { rateLimit } from './rateLimit';
import { sendRaw } from './email';
import { site } from '../site';

/**
 * Respuesta automática de WhatsApp (WhatsApp Cloud API de Meta).
 * Cuando un cliente escribe con su código `XP-####`, buscamos su solicitud y le
 * respondemos al instante con su nombre y lo que pidió; al equipo le llega un aviso.
 * No da precios ni plazos: eso lo confirma una persona.
 */

const GRAPH = 'https://graph.facebook.com/v23.0';
/** Una respuesta automática por número cada 12 h: el resto de la charla es humana. */
const REPLY_WINDOW_MS = 12 * 60 * 60 * 1000;

export const whatsappBotEnabled = (): boolean =>
  Boolean(WHATSAPP_TOKEN && WHATSAPP_PHONE_NUMBER_ID);

const needLabels: Record<string, string> = {
  web: 'una página web',
  tienda: 'una tienda virtual',
  chatbot: 'un chatbot con IA',
  automatizacion: 'automatizar procesos',
  sistema: 'un sistema a medida',
  '3d': 'una experiencia web 3D',
};

/** Extrae el código de lead aunque venga como "xp 6365", "XP-6365" o "xp6365". */
export function findLeadCode(text: string): string | null {
  const m = /\bXP[\s-]?(\d{4})\b/i.exec(text);
  return m ? `XP-${m[1]}` : null;
}

/** Verifica la firma `X-Hub-Signature-256` que Meta adjunta a cada evento. */
export async function verifySignature(rawBody: string, header: string | null): Promise<boolean> {
  if (!WHATSAPP_APP_SECRET) return false;
  if (!header?.startsWith('sha256=')) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(WHATSAPP_APP_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const given = header.slice(7);
  if (given.length !== hex.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i += 1) diff |= hex.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

interface LeadRow {
  id: number;
  code: string;
  name: string;
  source: string;
  needs: string[];
  message: string | null;
}

/** Texto de la respuesta. Exportado para probarlo sin red. */
export function buildReply(lead: LeadRow | null, code: string | null): string {
  const booking = PUBLIC_BOOKING_URL
    ? `\n\nSi prefieres, agenda una llamada aquí: ${PUBLIC_BOOKING_URL}`
    : '';
  if (!lead) {
    const unknown = code ? `No encontramos el código ${code}; revisa que esté bien escrito. ` : '';
    return (
      `¡Hola! Gracias por escribir a ${site.name}. ${unknown}` +
      `Cuéntanos en un mensaje qué necesitas (web, tienda, chatbot, automatización o sistema), ` +
      `para qué negocio y para cuándo, y te respondemos personalmente.\n\n` +
      `Si quieres adelantar, puedes cotizar en ${site.url}/cotizar` +
      booking
    );
  }
  const first = lead.name.trim().split(/\s+/)[0] ?? lead.name;
  const firstName = first.charAt(0).toUpperCase() + first.slice(1);
  const what =
    lead.source === 'quote'
      ? 'tu cotización'
      : lead.message
        ? `tu consulta: «${lead.message.slice(0, 140)}${lead.message.length > 140 ? '…' : ''}»`
        : `tu consulta sobre ${lead.needs.map((n) => needLabels[n] ?? n).join(', ') || 'tu proyecto'}`;
  return (
    `¡Hola, ${firstName}! Gracias por escribir a ${site.name}. ` +
    `Ya tenemos ${what} (código ${lead.code}).\n\n` +
    `Para preparar tu propuesta, ¿nos ayudas con esto?\n` +
    `1. ¿Qué resultado esperas lograr?\n` +
    `2. ¿Para qué fecha lo necesitas?\n` +
    `3. ¿Tienes un presupuesto aproximado o estás en etapa de evaluación?\n\n` +
    `Un especialista del equipo te responde personalmente en breve.` +
    booking
  );
}

async function sendText(to: string, body: string): Promise<boolean> {
  try {
    const res = await fetch(`${GRAPH}/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body, preview_url: false },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`whatsapp_${res.status}`);
    return true;
  } catch (error) {
    log('whatsapp.send', error);
    return false;
  }
}

async function findLead(code: string): Promise<LeadRow | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const rows = await db
      .select({
        id: schema.leads.id,
        code: schema.leads.code,
        name: schema.leads.name,
        source: schema.leads.source,
        needs: schema.leads.needs,
        message: schema.leads.message,
      })
      .from(schema.leads)
      .where(eq(schema.leads.code, code))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    log('whatsapp.lead', error);
    return null;
  }
}

async function noteOnLead(id: number, note: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db
      .update(schema.leads)
      .set({ notes: sql`concat_ws(E'\n', ${schema.leads.notes}, ${note})` })
      .where(eq(schema.leads.id, id));
  } catch (error) {
    log('whatsapp.note', error);
  }
}

export interface IncomingMessage {
  from: string;
  text: string;
  profileName?: string | undefined;
}

/** Extrae los mensajes de texto del payload de Meta (ignora estados, imágenes, etc.). */
export function parseIncoming(payload: unknown): IncomingMessage[] {
  const out: IncomingMessage[] = [];
  const entries = (payload as { entry?: unknown[] })?.entry ?? [];
  for (const entry of entries) {
    for (const change of (entry as { changes?: unknown[] }).changes ?? []) {
      const value = (change as { value?: Record<string, unknown> }).value ?? {};
      const contacts = (value.contacts as { wa_id?: string; profile?: { name?: string } }[]) ?? [];
      for (const msg of (value.messages as Record<string, unknown>[]) ?? []) {
        const from = typeof msg.from === 'string' ? msg.from : '';
        const body =
          msg.type === 'text' ? (msg.text as { body?: string } | undefined)?.body : undefined;
        if (!from || typeof body !== 'string') continue;
        const profileName = contacts.find((c) => c.wa_id === from)?.profile?.name;
        out.push({ from, text: body.slice(0, 2000), profileName });
      }
    }
  }
  return out;
}

/** Responde una vez por número y ventana; avisa al equipo por correo. */
export async function handleIncoming(msg: IncomingMessage): Promise<void> {
  const code = findLeadCode(msg.text);
  // Una sola respuesta automática por número cada 12 h; lo demás lo contesta una persona.
  // Si después del saludo manda su código, igual recibe la respuesta personalizada.
  const allowed = code
    ? await rateLimit(`wa:${msg.from}:${code}`, 1, REPLY_WINDOW_MS)
    : await rateLimit(`wa:${msg.from}`, 1, REPLY_WINDOW_MS);
  if (code) await rateLimit(`wa:${msg.from}`, 1, REPLY_WINDOW_MS); // silencia saludos posteriores
  if (!allowed) return;

  const lead = code ? await findLead(code) : null;
  const sent = await sendText(msg.from, buildReply(lead, code));
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  if (lead)
    await noteOnLead(
      lead.id,
      `[${stamp} UTC] Escribió por WhatsApp (+${msg.from}); respuesta automática ${sent ? 'enviada' : 'falló'}.`,
    );

  if (LEAD_NOTIFY_EMAIL) {
    const who = lead ? `${lead.code} — ${lead.name}` : (msg.profileName ?? `+${msg.from}`);
    await sendRaw(
      {
        to: LEAD_NOTIFY_EMAIL.split(',').map((s) => s.trim()),
        subject: `[WhatsApp] ${who} te escribió`,
        html: `<p><strong>${escapeHtml(who)}</strong> escribió por WhatsApp (+${escapeHtml(msg.from)}):</p>
<blockquote>${escapeHtml(msg.text)}</blockquote>
<p>Respuesta automática: ${sent ? 'enviada' : '<strong>falló</strong>'}. Ahora te toca a ti.</p>
<p><a href="https://wa.me/${escapeHtml(msg.from)}">Abrir chat</a>${lead ? ` · <a href="${site.url}/admin?q=${encodeURIComponent(lead.code)}">Ver en el panel</a>` : ''}</p>`,
      },
      'whatsapp.notify',
    );
  }
}

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
