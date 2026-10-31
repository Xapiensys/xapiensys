import { sql } from 'drizzle-orm';
import { getDb, schema } from './db';
import { log } from './http';

const memory = new Map<string, { start: number; count: number }>();

/**
 * Ventana fija por clave (`ipHash:endpoint`). Usa Postgres; si no hay BD, cae a memoria
 * (por instancia de función: protección parcial, pero nunca bloquea por error).
 * Devuelve `true` si la petición está permitida.
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const db = getDb();
  const now = Date.now();
  if (db) {
    try {
      const windowStart = new Date(now - windowMs);
      const rows = await db
        .insert(schema.rateLimits)
        .values({ key, windowStart: new Date(now), count: 1 })
        .onConflictDoUpdate({
          target: schema.rateLimits.key,
          set: {
            count: sql`CASE WHEN ${schema.rateLimits.windowStart} < ${windowStart} THEN 1 ELSE ${schema.rateLimits.count} + 1 END`,
            windowStart: sql`CASE WHEN ${schema.rateLimits.windowStart} < ${windowStart} THEN now() ELSE ${schema.rateLimits.windowStart} END`,
          },
        })
        .returning({ count: schema.rateLimits.count });
      return (rows[0]?.count ?? 1) <= limit;
    } catch (error) {
      log('rateLimit', error);
    }
  }
  const entry = memory.get(key);
  if (!entry || now - entry.start > windowMs) {
    memory.set(key, { start: now, count: 1 });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}
