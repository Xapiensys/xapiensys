/**
 * Persistencia y límites del chat (ARCHITECTURE §7.3). Postgres si existe; si no, memoria
 * por instancia (suficiente para desarrollo, no para producción).
 */
import { and, asc, desc, eq, gt, sql } from 'drizzle-orm';
import { CHAT_MONTHLY_TOKEN_CAP } from 'astro:env/server';
import { getDb, schema } from './db';
import { log } from './http';
import type { ChatTurn } from './llm';

export const LIMITS = {
  messagesPerSession: 12,
  sessionsPerIpPerDay: 5,
  historyTurns: 10,
} as const;

const DAY = 24 * 60 * 60 * 1000;
const month = () => new Date().toISOString().slice(0, 7);

const mem = {
  sessions: new Map<
    string,
    { ipHash: string; createdAt: number; count: number; history: ChatTurn[] }
  >(),
  usage: new Map<string, number>(),
};

export type SessionCheck =
  | { ok: true; count: number }
  | { ok: false; reason: 'session_messages' | 'ip_sessions' | 'monthly_cap' };

/** Crea la sesión si no existe y valida todos los límites antes de llamar al modelo. */
export async function checkAndCountMessage(
  sessionId: string,
  ipHash: string,
): Promise<SessionCheck> {
  const db = getDb();
  if (db) {
    try {
      const usage = await db
        .select({
          total: sql<number>`${schema.usageMonthly.tokensIn} + ${schema.usageMonthly.tokensOut}`,
        })
        .from(schema.usageMonthly)
        .where(eq(schema.usageMonthly.month, month()));
      if (Number(usage[0]?.total ?? 0) >= CHAT_MONTHLY_TOKEN_CAP)
        return { ok: false, reason: 'monthly_cap' };

      const existing = await db
        .select({ count: schema.chatSessions.messageCount })
        .from(schema.chatSessions)
        .where(eq(schema.chatSessions.id, sessionId));

      if (!existing[0]) {
        const recent = await db
          .select({ n: sql<number>`count(*)` })
          .from(schema.chatSessions)
          .where(
            and(
              eq(schema.chatSessions.ipHash, ipHash),
              gt(schema.chatSessions.createdAt, new Date(Date.now() - DAY)),
            ),
          );
        if (Number(recent[0]?.n ?? 0) >= LIMITS.sessionsPerIpPerDay)
          return { ok: false, reason: 'ip_sessions' };
        await db
          .insert(schema.chatSessions)
          .values({ id: sessionId, ipHash, messageCount: 1 })
          .onConflictDoNothing();
        return { ok: true, count: 1 };
      }
      if (existing[0].count >= LIMITS.messagesPerSession)
        return { ok: false, reason: 'session_messages' };
      const updated = await db
        .update(schema.chatSessions)
        .set({ messageCount: sql`${schema.chatSessions.messageCount} + 1` })
        .where(eq(schema.chatSessions.id, sessionId))
        .returning({ count: schema.chatSessions.messageCount });
      return { ok: true, count: updated[0]?.count ?? existing[0].count + 1 };
    } catch (error) {
      log('chat.check', error);
      // Si la BD falla, preferimos degradar a modo guiado antes que gastar sin control.
      return { ok: false, reason: 'monthly_cap' };
    }
  }

  if ((mem.usage.get(month()) ?? 0) >= CHAT_MONTHLY_TOKEN_CAP)
    return { ok: false, reason: 'monthly_cap' };
  const s = mem.sessions.get(sessionId);
  if (!s) {
    const recent = [...mem.sessions.values()].filter(
      (x) => x.ipHash === ipHash && Date.now() - x.createdAt < DAY,
    );
    if (recent.length >= LIMITS.sessionsPerIpPerDay) return { ok: false, reason: 'ip_sessions' };
    mem.sessions.set(sessionId, { ipHash, createdAt: Date.now(), count: 1, history: [] });
    return { ok: true, count: 1 };
  }
  if (s.count >= LIMITS.messagesPerSession) return { ok: false, reason: 'session_messages' };
  s.count += 1;
  return { ok: true, count: s.count };
}

export async function loadHistory(sessionId: string): Promise<ChatTurn[]> {
  const db = getDb();
  if (db) {
    try {
      const rows = await db
        .select({ role: schema.chatMessages.role, content: schema.chatMessages.content })
        .from(schema.chatMessages)
        .where(eq(schema.chatMessages.sessionId, sessionId))
        .orderBy(desc(schema.chatMessages.createdAt), desc(schema.chatMessages.id))
        .limit(LIMITS.historyTurns * 2);
      return rows.reverse().map((r) => ({ role: r.role as ChatTurn['role'], content: r.content }));
    } catch (error) {
      log('chat.history', error);
      return [];
    }
  }
  return (mem.sessions.get(sessionId)?.history ?? []).slice(-LIMITS.historyTurns * 2);
}

export async function saveExchange(
  sessionId: string,
  user: string,
  assistant: string,
  tokensIn: number,
  tokensOut: number,
  cost: number,
): Promise<void> {
  const db = getDb();
  if (db) {
    try {
      await db.insert(schema.chatMessages).values([
        { sessionId, role: 'user', content: user, tokensIn, tokensOut: 0 },
        { sessionId, role: 'assistant', content: assistant, tokensIn: 0, tokensOut },
      ]);
      await db
        .insert(schema.usageMonthly)
        .values({ month: month(), tokensIn, tokensOut, costEstimate: cost.toFixed(4) })
        .onConflictDoUpdate({
          target: schema.usageMonthly.month,
          set: {
            tokensIn: sql`${schema.usageMonthly.tokensIn} + ${tokensIn}`,
            tokensOut: sql`${schema.usageMonthly.tokensOut} + ${tokensOut}`,
            costEstimate: sql`${schema.usageMonthly.costEstimate} + ${cost.toFixed(4)}`,
          },
        });
    } catch (error) {
      log('chat.save', error);
    }
    return;
  }
  const s = mem.sessions.get(sessionId);
  s?.history.push({ role: 'user', content: user }, { role: 'assistant', content: assistant });
  mem.usage.set(month(), (mem.usage.get(month()) ?? 0) + tokensIn + tokensOut);
}

export async function chatSessionExists(sessionId: string): Promise<boolean> {
  const db = getDb();
  if (!db) return mem.sessions.has(sessionId);
  try {
    const rows = await db
      .select({ id: schema.chatSessions.id })
      .from(schema.chatSessions)
      .where(eq(schema.chatSessions.id, sessionId))
      .orderBy(asc(schema.chatSessions.createdAt))
      .limit(1);
    return rows.length > 0;
  } catch {
    return false;
  }
}
