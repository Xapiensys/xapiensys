import type { APIRoute } from 'astro';
import { isAdmin } from '@/lib/server/adminAuth';
import { exportLeads } from '@/lib/server/adminData';

export const prerender = false;

const columns = [
  ['code', 'Código'],
  ['createdAt', 'Fecha'],
  ['status', 'Estado'],
  ['source', 'Origen'],
  ['name', 'Nombre'],
  ['company', 'Empresa'],
  ['phone', 'Teléfono'],
  ['email', 'Email'],
  ['siteUrl', 'Web'],
  ['needs', 'Necesidad'],
  ['sector', 'Sector'],
  ['timeline', 'Plazo'],
  ['estimateMin', 'Estimado mín.'],
  ['estimateMax', 'Estimado máx.'],
  ['utmSource', 'utm_source'],
  ['utmMedium', 'utm_medium'],
  ['utmCampaign', 'utm_campaign'],
  ['landingPath', 'Página de llegada'],
  ['message', 'Mensaje'],
  ['notes', 'Notas'],
] as const;

const cell = (v: unknown): string => {
  let s =
    v instanceof Date
      ? v.toISOString()
      : Array.isArray(v)
        ? v.join(', ')
        : v == null
          ? ''
          : String(v);
  // Evita inyección de fórmulas al abrir el CSV en Excel.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export const GET: APIRoute = async ({ cookies, url }) => {
  if (!isAdmin(cookies)) return new Response('No autorizado', { status: 401 });
  const rows = await exportLeads({
    status: url.searchParams.get('estado'),
    source: url.searchParams.get('origen'),
    q: url.searchParams.get('q'),
  });
  if (!rows) return new Response('Base de datos no configurada', { status: 503 });
  const csv = [
    columns.map(([, label]) => cell(label)).join(','),
    ...rows.map((r) => columns.map(([k]) => cell(r[k])).join(',')),
  ].join('\r\n');
  const date = new Date().toISOString().slice(0, 10);
  return new Response(`﻿${csv}`, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="leads-xapiensys-${date}.csv"`,
      'cache-control': 'no-store',
    },
  });
};
