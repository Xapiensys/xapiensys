/**
 * Aplica las migraciones de `drizzle/` antes del build (Vercel ejecuta `vercel-build`).
 * Sin DATABASE_URL no hace nada: el sitio funciona en modo degradado.
 * Si una migración falla, el build falla y Vercel mantiene en línea la versión anterior.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.log('[db-migrate] DATABASE_URL no está definida: se omiten las migraciones.');
  process.exit(0);
}

const client = postgres(url, { max: 1, prepare: false, connect_timeout: 15, onnotice: () => {} });
try {
  await migrate(drizzle(client), { migrationsFolder: 'drizzle' });
  const [row] = await client`select count(*)::int as n from contacts`;
  console.log(`[db-migrate] Migraciones al día. Tabla contacts: ${row.n} registros.`);
} catch (error) {
  console.error('[db-migrate] Falló la migración:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end();
}
