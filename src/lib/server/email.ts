import { RESEND_API_KEY, LEAD_NOTIFY_EMAIL, EMAIL_FROM } from 'astro:env/server';
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
  estimate?: { min: number; max: number } | undefined;
  utm?: Record<string, string | undefined> | undefined;
}

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

const waLink = (phone: string, code: string) => {
  const digits = phone.replace(/\D/g, '');
  const intl = digits.length === 9 ? `51${digits}` : digits; // números peruanos sin prefijo
  return `https://wa.me/${intl}?text=${encodeURIComponent(`Hola, te escribimos de Xapiensys por tu consulta ${code}.`)}`;
};

/** Notifica un lead a Xapiensys por Resend. Devuelve `true` si se envió. */
export async function sendLeadNotification(lead: LeadEmail): Promise<boolean> {
  if (!RESEND_API_KEY || !LEAD_NOTIFY_EMAIL) return false;
  const rows: [string, string | undefined][] = [
    ['Código', lead.leadCode],
    ['Origen', lead.source],
    ['Nombre', lead.name],
    ['Empresa', lead.company],
    ['Teléfono', lead.phone],
    ['Email', lead.email],
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
  const html = `<h2>Nuevo lead ${esc(lead.leadCode)}</h2><table cellpadding="6">${rows
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><th align="left">${esc(k)}</th><td>${esc(v!)}</td></tr>`)
    .join(
      '',
    )}</table><p><a href="${waLink(lead.phone, lead.leadCode)}">Responder por WhatsApp</a></p>`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        // TODO(xapiensys): usar un remitente del dominio verificado en Resend (ej. leads@xapiensys.com).
        from: EMAIL_FROM ?? 'Xapiensys Leads <onboarding@resend.dev>',
        to: LEAD_NOTIFY_EMAIL.split(',').map((s) => s.trim()),
        subject: `[${lead.leadCode}] Nuevo lead (${lead.source}) — ${lead.name}`,
        html,
        ...(lead.email ? { reply_to: lead.email } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`resend_${res.status}`);
    return true;
  } catch (error) {
    log('email', error);
    return false;
  }
}
