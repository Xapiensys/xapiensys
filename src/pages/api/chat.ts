import type { APIRoute } from 'astro';
import { z } from 'zod';
import { getProvider, estimateCost, type ChatEvent } from '@/lib/server/llm';
import { buildSystemPrompt } from '@/lib/server/chatPrompt';
import { checkAndCountMessage, loadHistory, saveExchange } from '@/lib/server/chatStore';
import { rateLimit } from '@/lib/server/rateLimit';
import { clientIp, fail, hashIp, log, readJson } from '@/lib/server/http';

export const prerender = false;

const bodySchema = z.object({
  sessionId: z.uuid(),
  message: z.string().trim().min(1).max(500),
});

const LEAD_FORM_TEXT = 'Te dejo un formulario corto para que el equipo te contacte.';
const REFUSED_TEXT = 'Prefiero no responder eso. ¿Te cuento cómo podemos ayudar a tu negocio?';

type Outgoing =
  ChatEvent | { type: 'limit'; reason: string } | { type: 'done' } | { type: 'error' };

const encoder = new TextEncoder();
const sse = (event: Outgoing) => encoder.encode(`data: ${JSON.stringify(event)}\n\n`);

/** Respuesta SSE de un solo evento (límite alcanzado o chat no configurado). */
const single = (event: Outgoing) =>
  new Response(new Uint8Array([...sse(event), ...sse({ type: 'done' })]), {
    headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store' },
  });

export const POST: APIRoute = async ({ request }) => {
  let parsed;
  try {
    parsed = bodySchema.safeParse(await readJson(request, 4096));
  } catch {
    return fail('invalid_json');
  }
  if (!parsed.success) return fail('invalid_input', 422);
  const { sessionId, message } = parsed.data;

  const provider = getProvider();
  if (!provider) return single({ type: 'limit', reason: 'unavailable' });

  const ipHash = await hashIp(clientIp(request));
  if (!(await rateLimit(`${ipHash}:chat`, 40, 60 * 60 * 1000)))
    return single({ type: 'limit', reason: 'rate' });

  const check = await checkAndCountMessage(sessionId, ipHash);
  if (!check.ok) return single({ type: 'limit', reason: check.reason });

  const [system, history] = await Promise.all([buildSystemPrompt(), loadHistory(sessionId)]);
  const turns = [...history, { role: 'user' as const, content: message }];

  const abort = new AbortController();
  request.signal.addEventListener('abort', () => abort.abort());

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Si el visitante cierra la pestaña, enqueue lanza: lo ignoramos y seguimos para guardar.
      const push = (event: Outgoing) => {
        try {
          controller.enqueue(sse(event));
        } catch {
          // Conexión cerrada por el cliente.
        }
      };
      let text = '';
      let leadForm = false;
      let tokensIn = 0;
      let tokensOut = 0;
      try {
        for await (const event of provider.stream(system, turns, abort.signal)) {
          if (event.type === 'usage') {
            tokensIn = event.tokensIn;
            tokensOut = event.tokensOut;
            continue;
          }
          if (event.type === 'refused') {
            text = REFUSED_TEXT;
            push({ type: 'text', text: `\n${REFUSED_TEXT}` });
            continue;
          }
          if (event.type === 'text') text += event.text;
          if (event.type === 'lead_form') leadForm = true;
          push(event);
        }
        if (leadForm && !text.trim()) {
          text = LEAD_FORM_TEXT;
          push({ type: 'text', text });
        }
        push({ type: 'done' });
      } catch (error) {
        log('api/chat', error);
        push({ type: 'limit', reason: 'error' });
        push({ type: 'done' });
      } finally {
        // Guardar ANTES de cerrar: en Vercel la función puede congelarse al terminar la respuesta.
        if (text) {
          await saveExchange(
            sessionId,
            message,
            text,
            tokensIn,
            tokensOut,
            estimateCost(provider.model, tokensIn, tokensOut),
          );
        }
        try {
          controller.close();
        } catch {
          // El cliente ya cerró la conexión.
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(body, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store',
      'x-accel-buffering': 'no',
    },
  });
};

export const ALL: APIRoute = () => fail('method_not_allowed', 405, { allow: 'POST' });
