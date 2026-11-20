import type { APIRoute } from 'astro';
import { WHATSAPP_VERIFY_TOKEN } from 'astro:env/server';
import {
  handleIncoming,
  parseIncoming,
  verifySignature,
  whatsappBotEnabled,
} from '@/lib/server/whatsappBot';
import { fail, log } from '@/lib/server/http';

export const prerender = false;

/** Verificación del webhook al registrarlo en Meta (Meta → Webhooks → "Verificar"). */
export const GET: APIRoute = ({ url }) => {
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge') ?? '';
  if (WHATSAPP_VERIFY_TOKEN && mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN)
    return new Response(challenge, { status: 200, headers: { 'content-type': 'text/plain' } });
  return fail('forbidden', 403);
};

/** Mensajes entrantes: respondemos y avisamos (~2 s, dentro del margen de Meta). */
export const POST: APIRoute = async ({ request }) => {
  if (!whatsappBotEnabled()) return fail('disabled', 404);
  const raw = await request.text();
  if (!(await verifySignature(raw, request.headers.get('x-hub-signature-256'))))
    return fail('invalid_signature', 401);

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return fail('invalid_json');
  }
  const messages = parseIncoming(payload);
  try {
    await Promise.all(messages.map((m) => handleIncoming(m)));
  } catch (error) {
    // Siempre 200: si no, Meta reintenta y el cliente recibiría la respuesta duplicada.
    log('api/whatsapp', error);
  }
  return new Response('ok', { status: 200 });
};

export const ALL: APIRoute = () => fail('method_not_allowed', 405, { allow: 'GET, POST' });
