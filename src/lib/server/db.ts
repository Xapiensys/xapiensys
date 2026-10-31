import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { DATABASE_URL } from 'astro:env/server';
import * as schema from './schema';

export type Db = PostgresJsDatabase<typeof schema>;

let db: Db | null | undefined;

/** Devuelve la conexión o `null` si no hay DATABASE_URL (modo degradado). */
export function getDb(): Db | null {
  if (db !== undefined) return db;
  if (!DATABASE_URL) {
    db = null;
    return db;
  }
  // `prepare: false` es necesario con poolers en modo transacción (Supabase/Neon).
  const client = postgres(DATABASE_URL, {
    max: 1,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 5,
  });
  db = drizzle(client, { schema });
  return db;
}

export { schema };
