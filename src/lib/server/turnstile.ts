import { TURNSTILE_SECRET_KEY } from 'astro:env/server';
import { log } from './http';

/**
 * Verifica el token de Cloudflare Turnstile.
 * Sin TURNSTILE_SECRET_KEY configurada se omite (modo desarrollo / antes de crear la cuenta);
 * honeypot y rate limit siguen activos.
 */
export async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  if (!TURNSTILE_SECRET_KEY) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams({
      secret: TURNSTILE_SECRET_KEY,
      response: token,
      remoteip: ip,
    });
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(5000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (error) {
    log('turnstile', error);
    return false;
  }
}

export const turnstileEnabled = (): boolean => Boolean(TURNSTILE_SECRET_KEY);
