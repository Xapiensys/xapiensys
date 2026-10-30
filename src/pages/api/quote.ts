import type { APIRoute } from 'astro';
import {
  quoteRequestSchema,
  labelOf,
  sectorOptions,
  timelineOptions,
  type QuoteResult,
} from '@/lib/quote';
import { calculateQuote } from '@/lib/pricing';
import { createLead } from '@/lib/server/leads';
import { getDb, schema } from '@/lib/server/db';
import { rateLimit } from '@/lib/server/rateLimit';
import { verifyTurnstile } from '@/lib/server/turnstile';
import { clientIp, fail, hashIp, json, log, readJson, summarizeUserAgent } from '@/lib/server/http';

export const prerender = false;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let body: unknown;
  try {
    body = await readJson(request);
  } catch {
    return fail('invalid_json');
  }
  // Zod descarta cualquier campo extra (p. ej. un "precio" enviado por el cliente).
  const parsed = quoteRequestSchema.safeParse(body);
  if (!parsed.success) return fail('invalid_input', 422);
  const input = parsed.data;

  const ip = clientIp(request, clientAddress);
  const ipHash = await hashIp(ip);
  if (input.website) return fail('invalid_input', 422);
  if (!(await rateLimit(`${ipHash}:quote`, 10, 60 * 60 * 1000))) return fail('rate_limited', 429);
  if (!(await verifyTurnstile(input.turnstileToken, ip))) return fail('captcha_failed', 403);

  const result = calculateQuote(input.answers);

  let leadCode: string;
  let leadId: number | null;
  try {
    ({ code: leadCode, id: leadId } = await createLead({
      source: 'quote',
      name: input.name,
      company: input.company,
      phone: input.phone,
      email: input.email,
      needs: input.answers.needs,
      sector: labelOf(sectorOptions, input.answers.sector),
      timeline: labelOf(timelineOptions, input.answers.timeline),
      message: result.summary,
      estimate: result.range,
      utm: input.utm,
      userAgent: summarizeUserAgent(request.headers.get('user-agent')),
    }));
  } catch (error) {
    log('api/quote', error);
    return fail('unavailable', 503);
  }

  const db = getDb();
  if (db && leadId) {
    try {
      await db.insert(schema.quotes).values({ leadId, answers: input.answers, result });
    } catch (error) {
      log('api/quote.insert', error);
    }
  }

  const response: QuoteResult = { ok: true, leadCode, ...result };
  return json(response);
};

export const ALL: APIRoute = () => fail('method_not_allowed', 405, { allow: 'POST' });
