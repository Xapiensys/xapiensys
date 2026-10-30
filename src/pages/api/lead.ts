import type { APIRoute } from 'astro';
import { leadRequestSchema } from '@/lib/quote';
import { createLead, attachLeadToChat } from '@/lib/server/leads';
import { rateLimit } from '@/lib/server/rateLimit';
import { verifyTurnstile } from '@/lib/server/turnstile';
import { chatSessionExists } from '@/lib/server/chatStore';
import { clientIp, fail, hashIp, json, log, readJson, summarizeUserAgent } from '@/lib/server/http';

export const prerender = false;

/** Envío clásico de formulario (sin JS): se convierte al mismo esquema que el JSON. */
async function readForm(request: Request): Promise<unknown> {
  const form = await request.formData();
  const get = (k: string) => {
    const v = form.get(k);
    return typeof v === 'string' ? v : undefined;
  };
  return {
    source: 'form',
    name: get('name'),
    company: get('company'),
    phone: get('phone'),
    email: get('email'),
    needs: form.getAll('needs').filter((v): v is string => typeof v === 'string'),
    message: get('message'),
    consent: get('consent') === 'on' || get('consent') === 'true',
    website: get('website'),
    turnstileToken: get('cf-turnstile-response'),
  };
}

export const POST: APIRoute = async (context) => {
  const isForm = (context.request.headers.get('content-type') ?? '').includes(
    'application/x-www-form-urlencoded',
  );
  const res = await handle(context, isForm);
  if (!isForm) return res;
  // Sin JS: redirigimos a /gracias o de vuelta al formulario.
  const data = (await res.json()) as { ok: boolean; leadCode?: string; error?: string };
  const to = data.ok
    ? `/gracias?codigo=${encodeURIComponent(data.leadCode ?? '')}`
    : `/contacto?error=${data.error ?? 'error'}`;
  return context.redirect(to, 303);
};

const handle = async (
  { request, clientAddress }: Parameters<APIRoute>[0],
  isForm: boolean,
): Promise<Response> => {
  let body: unknown;
  try {
    body = isForm ? await readForm(request) : await readJson(request);
  } catch {
    return fail('invalid_json');
  }
  const parsed = leadRequestSchema.safeParse(body);
  if (!parsed.success) return fail('invalid_input', 422);
  const input = parsed.data;

  // Honeypot: respondemos como éxito para no dar pistas al bot.
  if (input.website) return json({ ok: true, leadCode: 'XP-0000' });

  const ip = clientIp(request, clientAddress);
  const ipHash = await hashIp(ip);
  if (!(await rateLimit(`${ipHash}:lead`, 5, 60 * 60 * 1000))) return fail('rate_limited', 429);

  // El chat ya pasó sus propios límites de sesión (exige una sesión real); los formularios, Turnstile.
  if (input.source === 'chat') {
    if (!input.chatSessionId || !(await chatSessionExists(input.chatSessionId)))
      return fail('invalid_session', 403);
  } else if (!(await verifyTurnstile(input.turnstileToken, ip))) {
    return fail('captcha_failed', 403);
  }

  try {
    const { code, id } = await createLead({
      source: input.source,
      name: input.name,
      company: input.company,
      phone: input.phone,
      email: input.email,
      needs: input.needs,
      sector: input.sector,
      message: input.message,
      utm: input.utm,
      userAgent: summarizeUserAgent(request.headers.get('user-agent')),
    });
    if (input.chatSessionId && id) await attachLeadToChat(input.chatSessionId, id);
    return json({ ok: true, leadCode: code });
  } catch (error) {
    log('api/lead', error);
    return fail('unavailable', 503);
  }
};

export const ALL: APIRoute = () => fail('method_not_allowed', 405, { allow: 'POST' });
