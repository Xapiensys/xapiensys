/**
 * Opciones del cotizador (sin dependencias: se usan en la isla del cliente).
 * Los precios viven solo en `pricing.ts` (servidor).
 */
export const needOptions = [
  { value: 'web', label: 'Página web' },
  { value: 'chatbot', label: 'Chatbot con IA' },
  { value: 'automatizacion', label: 'Automatización de procesos' },
  { value: 'sistema', label: 'Sistema a medida' },
  { value: 'no_seguro', label: 'No estoy seguro' },
] as const;

export const sectorOptions = [
  { value: 'salud', label: 'Clínica / salud' },
  { value: 'construccion', label: 'Construcción / inmobiliaria' },
  { value: 'comercio', label: 'Comercio / restaurante' },
  { value: 'servicios', label: 'Servicios profesionales' },
  { value: 'otro', label: 'Otro' },
] as const;

export const webScopeOptions = [
  { value: 'basica', label: 'Hasta 5 secciones' },
  { value: 'media', label: '6 a 10 secciones' },
  { value: 'amplia', label: 'Más de 10 secciones o catálogo' },
] as const;

export const chatbotChannelOptions = [
  { value: 'web', label: 'En la web' },
  { value: 'whatsapp', label: 'En WhatsApp' },
  { value: 'ambos', label: 'Web y WhatsApp' },
] as const;

export const automationScopeOptions = [
  { value: '1', label: '1 proceso' },
  { value: '2-3', label: '2 a 3 procesos' },
  { value: '4+', label: '4 o más procesos' },
] as const;

export const timelineOptions = [
  { value: 'urgente', label: 'Urgente (menos de 2 semanas)' },
  { value: 'mes', label: 'Este mes' },
  { value: 'trimestre', label: 'En 1 a 3 meses' },
  { value: 'explorando', label: 'Solo estoy explorando' },
] as const;

export const labelOf = <T extends readonly { value: string; label: string }[]>(
  opts: T,
  value: string | undefined,
): string => opts.find((o) => o.value === value)?.label ?? value ?? '';

export const formatSoles = (n: number): string =>
  `S/ ${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

export type Need = (typeof needOptions)[number]['value'];

export interface QuoteScope {
  web?: (typeof webScopeOptions)[number]['value'];
  chatbot?: (typeof chatbotChannelOptions)[number]['value'];
  automatizacion?: (typeof automationScopeOptions)[number]['value'];
}

export interface QuoteResult {
  ok: true;
  leadCode: string;
  diagnosis: boolean;
  range: { min: number; max: number };
  maintenance: { min: number; max: number };
  includes: string[];
  summary: string;
}
