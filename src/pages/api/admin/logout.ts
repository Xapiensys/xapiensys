import type { APIRoute } from 'astro';
import { endSession, sameOrigin } from '@/lib/server/adminAuth';

export const prerender = false;

export const POST: APIRoute = ({ request, cookies, redirect }) => {
  if (sameOrigin(request)) endSession(cookies);
  return redirect('/admin/login', 303);
};
