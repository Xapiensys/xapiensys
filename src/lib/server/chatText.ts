/**
 * Limpieza en streaming de la respuesta del modelo antes de mostrarla en el chat.
 * El chat pinta texto plano: quita markdown (negritas, títulos), fórmulas LaTeX y
 * cualquier línea donde el modelo "escriba" una herramienta en vez de llamarla.
 * Avisa qué herramientas vio escritas (y la búsqueda de música, si la hay) para
 * ejecutarlas igual.
 */

export interface TextCleaner {
  /** Recibe un fragmento y devuelve lo que ya se puede mostrar (puede ser ''). */
  push(chunk: string): string;
  /** Vacía lo pendiente al terminar. */
  flush(): string;
  /** Herramientas que el modelo escribió como texto. */
  readonly sawTools: ReadonlySet<string>;
  /** Búsqueda escrita en la herramienta de música (`poner_musica(busqueda="…")`). */
  readonly writtenQuery: string | null;
}

/** Nombre tolerando escapes de LaTeX/markdown (mostrar\_formulario...). */
const toPattern = (name: string) => new RegExp(name.split('_').join('\\\\?_'), 'i');

export function createTextCleaner(toolNames: string[]): TextCleaner {
  const patterns = toolNames.map((name) => ({ name, re: toPattern(name) }));
  // Primera palabra de cada herramienta: mientras llega, la línea se retiene.
  const riskyWords = new RegExp(`[$\\\\]|${toolNames.map((n) => n.split('_')[0]).join('|')}`, 'i');
  const sawTools = new Set<string>();
  let writtenQuery: string | null = null;
  let pending = '';
  let lineStart = true;

  /** Limpia un trozo sin saltos de línea que no corta ningún token a medias. */
  const clean = (segment: string, startsLine: boolean): string => {
    let out = segment
      // Solo fórmulas LaTeX ($$…$$ o $…\algo…$): "US$ 100" se respeta.
      .replace(/\$\$.*?\$\$|\$[^$]*\\[^$]*\$/g, '')
      .replace(/\*\*|__/g, '')
      .replace(/\\([_*$#`])/g, '$1')
      .replace(/`/g, '');
    if (startsLine) out = out.replace(/^#{1,6}[ \t]+/, '').replace(/^[ \t]*[-*][ \t]+/, '• ');
    return out;
  };

  /** Si la línea menciona una herramienta, la registra y devuelve `true` (se descarta). */
  const takeTool = (line: string): boolean => {
    const hit = patterns.find((p) => p.re.test(line));
    if (!hit) return false;
    sawTools.add(hit.name);
    const q = /busqueda\\?\s*[:=]\s*\\?["“']([^"”'\\]{2,80})/i.exec(line)?.[1];
    if (q && !writtenQuery) writtenQuery = q.trim();
    return true;
  };

  /** Procesa líneas completas; descarta las que mencionan una herramienta. */
  const takeLines = (final: boolean): string => {
    let out = '';
    for (;;) {
      const nl = pending.indexOf('\n');
      if (nl === -1) break;
      const line = pending.slice(0, nl);
      pending = pending.slice(nl + 1);
      if (takeTool(line)) {
        lineStart = true;
        continue;
      }
      // "Haz clic aquí…": no hay enlace que clicar; el formulario aparece solo.
      if (lineStart && /^\s*haz clic aqu[ií]/i.test(line)) continue;
      out += clean(line, lineStart) + '\n';
      lineStart = true;
    }
    if (!pending) return out;

    if (final) {
      if (!takeTool(pending)) out += clean(pending, lineStart);
      pending = '';
      return out;
    }
    // Línea incompleta: si puede contener una herramienta o una fórmula abierta, se espera.
    if (riskyWords.test(pending)) return out;
    // Emitir hasta el último espacio: los pares ** nunca quedan partidos por un espacio.
    const cut = pending.lastIndexOf(' ');
    if (cut <= 0) return out;
    const head = pending.slice(0, cut + 1);
    pending = pending.slice(cut + 1);
    out += clean(head, lineStart);
    lineStart = false;
    return out;
  };

  return {
    push(chunk) {
      pending += chunk;
      return takeLines(false);
    },
    flush() {
      return takeLines(true).replace(/\n{3,}/g, '\n\n');
    },
    get sawTools() {
      return sawTools;
    },
    get writtenQuery() {
      return writtenQuery;
    },
  };
}
