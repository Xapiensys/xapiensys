/** Consultas del panel /admin. Solo servidor. */
import { and, count, desc, eq, gte, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import { getDb, schema } from './db';
import { leadStatus } from './schema';

export type LeadStatus = (typeof leadStatus)[number];
export const leadStatuses = leadStatus;
export const leadSources = ['form', 'quote', 'chat', 'diagnostico'] as const;

export const statusLabels: Record<LeadStatus, string> = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  propuesta: 'Propuesta enviada',
  ganado: 'Ganado',
  perdido: 'Perdido',
};

export const sourceLabels: Record<string, string> = {
  form: 'Formulario',
  quote: 'Cotizador',
  chat: 'Chat IA',
  diagnostico: 'Diagnóstico',
};

export interface LeadFilters {
  status?: string | null;
  source?: string | null;
  q?: string | null;
  page?: number;
}

export const PAGE_SIZE = 50;

function where(f: LeadFilters): SQL | undefined {
  const parts: SQL[] = [];
  if (f.status && (leadStatus as readonly string[]).includes(f.status)) {
    parts.push(eq(schema.leads.status, f.status as LeadStatus));
  }
  if (f.source && (leadSources as readonly string[]).includes(f.source)) {
    parts.push(eq(schema.leads.source, f.source));
  }
  const q = f.q?.trim().slice(0, 80);
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    parts.push(
      or(
        ilike(schema.leads.code, like),
        ilike(schema.leads.name, like),
        ilike(schema.leads.company, like),
        ilike(schema.leads.phone, like),
        ilike(schema.leads.email, like),
        ilike(schema.leads.utmCampaign, like),
      )!,
    );
  }
  return parts.length ? and(...parts) : undefined;
}

export async function listLeads(f: LeadFilters) {
  const db = getDb();
  if (!db) return null;
  const page = Math.max(1, f.page ?? 1);
  const w = where(f);
  const [rows, total] = await Promise.all([
    db
      .select()
      .from(schema.leads)
      .where(w)
      .orderBy(desc(schema.leads.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(schema.leads).where(w),
  ]);
  return { rows, total: Number(total[0]?.n ?? 0), page };
}

export async function leadStats() {
  const db = getDb();
  if (!db) return null;
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [byStatus, bySource, lastWeek, byCampaign] = await Promise.all([
    db
      .select({ k: schema.leads.status, n: count() })
      .from(schema.leads)
      .groupBy(schema.leads.status),
    db
      .select({ k: schema.leads.source, n: count() })
      .from(schema.leads)
      .groupBy(schema.leads.source),
    db.select({ n: count() }).from(schema.leads).where(gte(schema.leads.createdAt, weekAgo)),
    db
      .select({ k: sql<string>`coalesce(${schema.leads.utmSource}, 'directo')`, n: count() })
      .from(schema.leads)
      .groupBy(sql`1`)
      .orderBy(desc(count()))
      .limit(6),
  ]);
  const toMap = (rows: { k: string | null; n: number }[]) =>
    Object.fromEntries(rows.map((r) => [r.k ?? '—', Number(r.n)]));
  return {
    byStatus: toMap(byStatus),
    bySource: toMap(bySource),
    byOrigin: byCampaign.map((r) => ({ k: r.k, n: Number(r.n) })),
    lastWeek: Number(lastWeek[0]?.n ?? 0),
  };
}

export async function updateLead(id: number, status: string, notes: string): Promise<boolean> {
  const db = getDb();
  if (!db || !(leadStatus as readonly string[]).includes(status)) return false;
  const rows = await db
    .update(schema.leads)
    .set({ status: status as LeadStatus, notes: notes.trim().slice(0, 4000) || null })
    .where(eq(schema.leads.id, id))
    .returning({ id: schema.leads.id });
  return rows.length > 0;
}

/** Conversaciones del chat vinculadas a los leads de la página actual. */
export async function chatTranscripts(leadIds: number[]) {
  const db = getDb();
  if (!db || leadIds.length === 0) return new Map<number, { role: string; content: string }[]>();
  const rows = await db
    .select({
      leadId: schema.chatSessions.leadId,
      role: schema.chatMessages.role,
      content: schema.chatMessages.content,
    })
    .from(schema.chatMessages)
    .innerJoin(schema.chatSessions, eq(schema.chatSessions.id, schema.chatMessages.sessionId))
    .where(inArray(schema.chatSessions.leadId, leadIds))
    .orderBy(schema.chatMessages.createdAt, schema.chatMessages.id);
  const map = new Map<number, { role: string; content: string }[]>();
  for (const r of rows) {
    if (r.leadId == null) continue;
    const list = map.get(r.leadId) ?? [];
    list.push({ role: r.role, content: r.content });
    map.set(r.leadId, list);
  }
  return map;
}

/** Todas las filas que cumplen el filtro (para exportar a CSV), hasta 5000. */
export async function exportLeads(f: LeadFilters) {
  const db = getDb();
  if (!db) return null;
  return db
    .select()
    .from(schema.leads)
    .where(where(f))
    .orderBy(desc(schema.leads.createdAt))
    .limit(5000);
}
