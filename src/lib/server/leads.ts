import { eq } from 'drizzle-orm';
import { getDb, schema } from './db';
import { sendLeadNotification } from './email';
import { log } from './http';
import type { Attribution } from '../analytics';

export interface NewLead {
  source: 'form' | 'chat' | 'quote';
  name: string;
  company?: string | undefined;
  phone: string;
  email?: string | undefined;
  needs: string[];
  sector?: string | undefined;
  timeline?: string | undefined;
  message?: string | undefined;
  estimate?: { min: number; max: number } | undefined;
  utm?: Attribution | undefined;
  userAgent?: string | null;
}

const randomCode = () =>
  `XP-${String(crypto.getRandomValues(new Uint16Array(1))[0]! % 10000).padStart(4, '0')}`;

/**
 * Flujo de ARCHITECTURE §7.2: genera código, guarda en BD y notifica por email.
 * Si la BD falla el email igual sale (y viceversa). Si ambos fallan, lanza error.
 */
export async function createLead(lead: NewLead): Promise<{ code: string; id: number | null }> {
  const db = getDb();
  let code = randomCode();
  let id: number | null = null;
  let stored = false;

  if (db) {
    for (let attempt = 0; attempt < 5 && !stored; attempt += 1) {
      try {
        const rows = await db
          .insert(schema.leads)
          .values({
            code,
            source: lead.source,
            name: lead.name,
            company: lead.company ?? null,
            phone: lead.phone,
            email: lead.email ?? null,
            needs: lead.needs,
            sector: lead.sector ?? null,
            timeline: lead.timeline ?? null,
            message: lead.message ?? null,
            estimateMin: lead.estimate?.min ?? null,
            estimateMax: lead.estimate?.max ?? null,
            utmSource: lead.utm?.utm_source ?? null,
            utmMedium: lead.utm?.utm_medium ?? null,
            utmCampaign: lead.utm?.utm_campaign ?? null,
            landingPath: lead.utm?.landing_path ?? null,
            userAgent: lead.userAgent ?? null,
          })
          .onConflictDoNothing({ target: schema.leads.code })
          .returning({ id: schema.leads.id });
        if (rows[0]) {
          id = rows[0].id;
          stored = true;
        } else {
          code = randomCode(); // colisión de código: reintentar
        }
      } catch (error) {
        log('leads.insert', error);
        break;
      }
    }
  }

  const emailed = await sendLeadNotification({
    leadCode: code,
    ...lead,
    utm: lead.utm ? { ...lead.utm } : undefined,
  });
  if (!stored && !emailed) throw new Error('lead_not_persisted');
  return { code, id };
}

export async function attachLeadToChat(sessionId: string, leadId: number): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db
      .update(schema.chatSessions)
      .set({ leadId })
      .where(eq(schema.chatSessions.id, sessionId));
  } catch (error) {
    log('leads.chat', error);
  }
}
