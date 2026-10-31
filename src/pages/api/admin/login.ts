import type { APIRoute } from 'astro';
import { checkPassword, sameOrigin, startSession } from '@/lib/server/adminAuth';
import { rateLimit } from '@/lib/server/rateLimit';
import { clientIp, hashIp } from '@/lib/server/http';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!sameOrigin(request)) return redirect('/admin/login?error=origen', 303);
  const ipHash = await hashIp(clientIp(request));
  // 5 intentos cada 15 minutos por IP.
  if (!(await rateLimit(`${ipHash}:admin_login`, 5, 15 * 60 * 1000))) {
    return redirect('/admin/login?error=limite', 303);
  }
  const form = await request.formData();
  const password = form.get('password');
  if (typeof password !== 'string' || !checkPassword(password)) {
    return redirect('/admin/login?error=clave', 303);
  }
  startSession(cookies);
  return redirect('/admin', 303);
};
