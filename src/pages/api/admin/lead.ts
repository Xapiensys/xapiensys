import type { APIRoute } from 'astro';
import { isAdmin, sameOrigin } from '@/lib/server/adminAuth';
import { updateLead } from '@/lib/server/adminData';
import { log } from '@/lib/server/http';

export const prerender = false;

/** Actualiza estado y notas de un lead (formulario clásico, sin JS) y vuelve al listado. */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!isAdmin(cookies)) return redirect('/admin/login', 303);
  if (!sameOrigin(request)) return new Response('Origen no permitido', { status: 403 });
  const form = await request.formData();
  const id = Number(form.get('id'));
  const status = String(form.get('status') ?? '');
  const notes = String(form.get('notes') ?? '');
  const back = String(form.get('back') ?? '/admin');
  const safeBack = back.startsWith('/admin') && !back.startsWith('//') ? back : '/admin';
  let ok = false;
  if (Number.isInteger(id) && id > 0) {
    try {
      ok = await updateLead(id, status, notes);
    } catch (error) {
      log('admin.update', error);
    }
  }
  const sep = safeBack.includes('?') ? '&' : '?';
  return redirect(`${safeBack}${sep}${ok ? 'guardado' : 'error'}=${id}#lead-${id}`, 303);
};
