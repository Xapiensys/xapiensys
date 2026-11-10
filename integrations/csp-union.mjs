/**
 * CSP compartida entre páginas para la navegación sin recarga (ClientRouter).
 *
 * Astro genera una CSP por página con los hashes de SUS estilos y scripts en línea. Al
 * navegar sin recarga, el navegador conserva la CSP de la primera página y bloquea los
 * estilos/scripts de las siguientes. Tras compilar, esta integración junta los hashes de
 * todas las páginas y escribe la unión en cada una: sigue siendo estricta (solo contenido
 * conocido, sin 'unsafe-inline') pero vale para todo el sitio.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const META = /<meta http-equiv="content-security-policy" content="([^"]*)"/i;

function htmlFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return htmlFiles(path);
    return name.endsWith('.html') ? [path] : [];
  });
}

/** Hashes de una directiva (`script-src` o `style-src`) dentro de una CSP. */
function hashesOf(csp, directive) {
  const part = csp.split(';').find((d) => d.trim().startsWith(`${directive} `)) ?? '';
  return part.match(/'sha256-[A-Za-z0-9+/=]+'/g) ?? [];
}

function withHashes(csp, directive, hashes) {
  return csp
    .split(';')
    .map((d) => {
      const t = d.trim();
      if (!t.startsWith(`${directive} `)) return d;
      const base = t.split(/\s+/).filter((tok) => !tok.startsWith("'sha256-"));
      return ` ${[...base, ...hashes].join(' ')}`;
    })
    .join(';')
    .replace(/^ /, '');
}

function unify(dirs, logger) {
  const files = dirs.flatMap(htmlFiles);
  const scripts = new Set();
  const styles = new Set();
  const pages = files
    .map((file) => ({ file, html: readFileSync(file, 'utf8') }))
    .filter((p) => META.test(p.html));
  for (const { html } of pages) {
    const csp = META.exec(html)[1];
    hashesOf(csp, 'script-src').forEach((h) => scripts.add(h));
    hashesOf(csp, 'style-src').forEach((h) => styles.add(h));
  }
  for (const { file, html } of pages) {
    const csp = META.exec(html)[1];
    let next = withHashes(csp, 'script-src', [...scripts]);
    next = withHashes(next, 'style-src', [...styles]);
    writeFileSync(file, html.replace(META, `<meta http-equiv="content-security-policy" content="${next}"`));
  }
  logger.info(
    `CSP unificada en ${pages.length} páginas (${scripts.size} scripts, ${styles.size} estilos).`,
  );
}

export default function cspUnion() {
  return {
    name: 'xapiensys:csp-union',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const out = fileURLToPath(dir);
        // Vercel copia el estático a .vercel/output/static: se unifica en ambos lugares.
        unify([out, join(process.cwd(), '.vercel', 'output', 'static')], logger);
      },
    },
  };
}
