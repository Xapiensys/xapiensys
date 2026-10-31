/**
 * Métricas REALES del propio sitio (honestidad del contenido: nada inventado).
 * Se actualizan tras medir con Lighthouse sobre el build de producción.
 * Si no hay medición, la lista queda vacía y la franja muestra solo el stack.
 */
export interface SiteMetric {
  label: string;
  value: string;
}

// Medido el 2026-10-30 sobre el build de producción servido con compresión (laboratorio, 3 corridas).
// TODO(xapiensys): volver a medir sobre https://xapiensys.com después del deploy y actualizar.
export const siteMetrics: { measuredAt: string | null; tool: string; items: SiteMetric[] } = {
  measuredAt: '2026-10-30',
  tool: 'Lighthouse móvil, 4G simulado',
  items: [
    { label: 'RENDIMIENTO', value: '100' },
    { label: 'ACCESIBILIDAD', value: '100' },
    { label: 'SEO', value: '100' },
    { label: 'LCP MÓVIL', value: '1.7 s' },
  ],
};

/** Tecnologías con las que trabajamos. */
export const stack = [
  'Python',
  'n8n',
  'Node.js',
  'TypeScript',
  'Astro',
  'PostgreSQL',
  'WebGL',
  'IA generativa',
];
