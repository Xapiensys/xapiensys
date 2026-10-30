import { IP_HASH_SALT } from 'astro:env/server';

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  });

/** Error uniforme: `{ ok: false, error }`, sin trazas. */
export const fail = (error: string, status = 400, headers: Record<string, string> = {}): Response =>
  json({ ok: false, error }, status, headers);

export function clientIp(request: Request, fallback?: string): string {
  return (
    request.headers.get('x-nf-client-connection-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    fallback ??
    '0.0.0.0'
  );
}

export async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(`${IP_HASH_SALT ?? 'xapiensys-dev-salt'}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function readJson(request: Request, maxBytes = 16_384): Promise<unknown> {
  const len = Number(request.headers.get('content-length') ?? 0);
  if (len > maxBytes) throw new Error('payload_too_large');
  const text = await request.text();
  if (text.length > maxBytes) throw new Error('payload_too_large');
  return JSON.parse(text) as unknown;
}

/** Resumen corto del user-agent (no guardamos el string completo). */
export function summarizeUserAgent(ua: string | null): string | null {
  if (!ua) return null;
  const device = /Mobile|Android|iPhone|iPad/i.test(ua) ? 'móvil' : 'escritorio';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Otro';
  return `${browser} · ${device}`;
}

export const log = (scope: string, error: unknown): void => {
  console.error(`[${scope}]`, error instanceof Error ? error.message : error);
};
