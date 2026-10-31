import { RESEND_API_KEY, LEAD_NOTIFY_EMAIL, EMAIL_FROM } from 'astro:env/server';
import { PUBLIC_BOOKING_URL } from 'astro:env/client';
import { site } from '../site';
import { buildWhatsAppUrl } from '../whatsapp';
import { log } from './http';

export interface LeadEmail {
  leadCode: string;
  source: string;
  name: string;
  company?: string | undefined;
  phone: string;
  email?: string | undefined;
  needs: string[];
  sector?: string | undefined;
  timeline?: string | undefined;
  message?: string | undefined;
  siteUrl?: string | undefined;
  estimate?: { min: number; max: number } | undefined;
  utm?: Record<string, string | undefined> | undefined;
}

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

/** Enlace para escribirle al cliente por WhatsApp desde el correo de aviso. */
export const clientWaLink = (phone: string, code: string): string => {
  const digits = phone.replace(/\D/g, '');
  const intl = digits.length === 9 ? `51${digits}` : digits; // números peruanos sin prefijo
  return `https://wa.me/${intl}?text=${encodeURIComponent(`Hola, te escribimos de Xapiensys por tu consulta ${code}.`)}`;
};

const sourceNames: Record<string, string> = {
  form: 'Formulario de contacto',
  diagnostico: 'Diagnóstico gratuito',
  quote: 'Cotizador',
  chat: 'Chat IA',
};

// TODO(xapiensys): usar un remitente del dominio verificado en Resend (ej. leads@xapiensys.com).
const from = () => EMAIL_FROM ?? 'Xapiensys <onboarding@resend.dev>';

async function send(payload: Record<string, unknown>, scope: string): Promise<boolean> {
  if (!RESEND_API_KEY) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: from(), ...payload }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`resend_${res.status}`);
    return true;
  } catch (error) {
    log(scope, error);
    return false;
  }
}

/** Notifica un lead al equipo de Xapiensys. Devuelve `true` si se envió. */
export async function sendLeadNotification(lead: LeadEmail): Promise<boolean> {
  if (!LEAD_NOTIFY_EMAIL) return false;
  const rows: [string, string | undefined][] = [
    ['Código', lead.leadCode],
    ['Origen', sourceNames[lead.source] ?? lead.source],
    ['Nombre', lead.name],
    ['Empresa', lead.company],
    ['Teléfono', lead.phone],
    ['Email', lead.email],
    ['Web actual', lead.siteUrl],
    ['Necesidad', lead.needs.join(', ')],
    ['Sector', lead.sector],
    ['Plazo', lead.timeline],
    ['Estimado', lead.estimate ? `S/ ${lead.estimate.min} – ${lead.estimate.max}` : undefined],
    ['Mensaje', lead.message],
    [
      'UTM',
      lead.utm
        ? Object.entries(lead.utm)
            .filter(([, v]) => v)
            .map(([k, v]) => `${k}=${v}`)
            .join(' · ')
        : undefined,
    ],
  ];
  const table = rows
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><th align="left">${esc(k)}</th><td>${esc(v!)}</td></tr>`)
    .join('');
  const html = `<h2>Nuevo lead ${esc(lead.leadCode)}</h2><table cellpadding="6">${table}</table>
<p><a href="${clientWaLink(lead.phone, lead.leadCode)}">Responder por WhatsApp</a> ·
<a href="${site.url}/admin?q=${encodeURIComponent(lead.leadCode)}">Abrir en el panel</a></p>`;
  return send(
    {
      to: LEAD_NOTIFY_EMAIL.split(',').map((s) => s.trim()),
      subject: `[${lead.leadCode}] ${sourceNames[lead.source] ?? lead.source} — ${lead.name}`,
      html,
      ...(lead.email ? { reply_to: lead.email } : {}),
    },
    'email.notify',
  );
}

/**
 * Confirmación al cliente (solo si dejó email): su código y el siguiente paso.
 * No promete plazos ni precios: eso lo confirma el equipo.
 */
export async function sendLeadConfirmation(lead: LeadEmail): Promise<boolean> {
  if (!lead.email) return false;
  const first = esc(lead.name.split(' ')[0] ?? lead.name);
  const wa = buildWhatsAppUrl({ intent: 'consultoria', leadCode: lead.leadCode });
  const booking = PUBLIC_BOOKING_URL
    ? `<p>Si prefieres, <a href="${esc(PUBLIC_BOOKING_URL)}">agenda una llamada</a> en el horario que te acomode.</p>`
    : '';
  const estimate = lead.estimate
    ? `<p>El rango orientativo de tu cotización fue <strong>S/ ${lead.estimate.min.toLocaleString('en-US')} – ${lead.estimate.max.toLocaleString('en-US')}</strong>. Lo confirmamos por escrito antes de empezar.</p>`
    : '';
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#111">
<p>Hola ${first}:</p>
<p>Recibimos tu consulta en ${esc(site.name)}. Tu código es <strong>${esc(lead.leadCode)}</strong>; con él retomamos la conversación sin repetir datos.</p>
${estimate}
<p>Te escribiremos por WhatsApp. Si quieres adelantarte: <a href="${wa}">continúa la conversación aquí</a>.</p>
${booking}
<p>— Equipo ${esc(site.name)}<br><a href="${site.url}">${site.url.replace('https://', '')}</a></p>
<p style="font-size:12px;color:#666">Recibes este correo porque dejaste tus datos en ${site.url.replace('https://', '')}. Puedes pedir la eliminación de tus datos respondiendo a este mensaje.</p>
</div>`;
  return send(
    {
      to: [lead.email],
      subject: `Recibimos tu consulta (${lead.leadCode}) — ${site.name}`,
      html,
      reply_to: LEAD_NOTIFY_EMAIL?.split(',')[0]?.trim() || site.email,
    },
    'email.confirm',
  );
}
