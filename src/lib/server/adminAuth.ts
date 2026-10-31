/**
 * Sesión del panel /admin: una contraseña (ADMIN_PASSWORD) y una cookie firmada con HMAC.
 * Sin ADMIN_PASSWORD el panel queda desactivado. Cambiar la contraseña cierra todas las sesiones.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { AstroCookies } from 'astro';
import { ADMIN_PASSWORD, IP_HASH_SALT } from 'astro:env/server';

export const ADMIN_COOKIE = 'xp_admin';
const TTL_SECONDS = 12 * 60 * 60;

export const adminEnabled = (): boolean => Boolean(ADMIN_PASSWORD && ADMIN_PASSWORD.length >= 12);

const key = () =>
  createHash('sha256')
    .update(`${ADMIN_PASSWORD}:${IP_HASH_SALT ?? ''}:admin`)
    .digest();
const sign = (value: string) => createHmac('sha256', key()).update(value).digest('base64url');

const safeEqual = (a: string, b: string) => {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
};

export function checkPassword(candidate: string): boolean {
  return adminEnabled() && safeEqual(candidate, ADMIN_PASSWORD!);
}

export function startSession(cookies: AstroCookies): void {
  const exp = String(Math.floor(Date.now() / 1000) + TTL_SECONDS);
  cookies.set(ADMIN_COOKIE, `${exp}.${sign(exp)}`, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'strict',
    path: '/',
    maxAge: TTL_SECONDS,
  });
}

export function endSession(cookies: AstroCookies): void {
  cookies.delete(ADMIN_COOKIE, { path: '/' });
}

export function isAdmin(cookies: AstroCookies): boolean {
  if (!adminEnabled()) return false;
  const raw = cookies.get(ADMIN_COOKIE)?.value;
  if (!raw) return false;
  const [exp, mac] = raw.split('.');
  if (!exp || !mac || !safeEqual(mac, sign(exp))) return false;
  return Number(exp) * 1000 > Date.now();
}

/** Protección CSRF para los POST del panel: el origen debe ser el mismo sitio. */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin') ?? request.headers.get('referer');
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}
