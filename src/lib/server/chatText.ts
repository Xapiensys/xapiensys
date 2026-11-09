/**
 * Limpieza en streaming de la respuesta del modelo antes de mostrarla en el chat.
 * El chat pinta texto plano: quita markdown (negritas, títulos), fórmulas LaTeX y
 * cualquier línea donde el modelo "escriba" la herramienta en vez de llamarla.
 * Si detecta la herramienta escrita como texto, lo avisa para abrir el formulario igual.
 */

export interface TextCleaner {
  /** Recibe un fragmento y devuelve lo que ya se puede mostrar (puede ser ''). */
  push(chunk: string): string;
  /** Vacía lo pendiente al terminar. */
  flush(): string;
  /** `true` si el modelo escribió la herramienta como texto. */
  readonly sawTool: boolean;
}

export function createTextCleaner(toolName: string): TextCleaner {
  // Nombre de la herramienta tolerando escapes de LaTeX/markdown (mostrar\_formulario...).
  const toolPattern = new RegExp(toolName.split('_').join('\\\\?_'), 'i');
  let pending = '';
  let lineStart = true;
  let sawTool = false;

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

  /** Procesa líneas completas; descarta las que mencionan la herramienta. */
  const takeLines = (final: boolean): string => {
    let out = '';
    for (;;) {
      const nl = pending.indexOf('\n');
      if (nl === -1) break;
      const line = pending.slice(0, nl);
      pending = pending.slice(nl + 1);
      if (toolPattern.test(line)) {
        sawTool = true;
        lineStart = true;
        continue;
      }
      // "Haz clic aquí…": no hay enlace que clicar; el formulario aparece solo.
      if (lineStart && /^\s*haz clic aqu[ií]/i.test(line)) continue;
      out += clean(line, lineStart) + '\n';
      lineStart = true;
    }
    if (!pending) return out;

    // Línea incompleta: si puede contener la herramienta o una fórmula abierta, se espera.
    const risky = /[$\\]|mostrar/i.test(pending);
    if (final) {
      if (toolPattern.test(pending)) sawTool = true;
      else out += clean(pending, lineStart);
      pending = '';
      return out;
    }
    if (risky) return out;
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
    get sawTool() {
      return sawTool;
    },
  };
}
