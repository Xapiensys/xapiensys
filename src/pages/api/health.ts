import type { APIRoute } from 'astro';
import { sql } from 'drizzle-orm';
import { LLM_API_KEY, LLM_PROVIDER } from 'astro:env/server';
import { getDb } from '@/lib/server/db';
import { json } from '@/lib/server/http';

export const prerender = false;

export const GET: APIRoute = async () => {
  const db = getDb();
  let dbOk = false;
  if (db) {
    try {
      await db.execute(sql`select 1`);
      dbOk = true;
    } catch {
      dbOk = false;
    }
  }
  const llm = Boolean(LLM_API_KEY && LLM_PROVIDER);
  return json({ ok: dbOk && llm, db: dbOk, llm });
};
