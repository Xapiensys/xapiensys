import { site } from './site';

export type WhatsAppIntent =
  'general' | 'consultoria' | 'cotizacion' | 'servicio' | 'sector' | 'demo' | 'chat';

const baseMessages: Record<WhatsAppIntent, string> = {
  general: 'Hola Xapiensys, quiero conversar sobre una solución digital.',
  consultoria: 'Hola Xapiensys, quiero solicitar una consultoría.',
  cotizacion: 'Hola Xapiensys, acabo de usar el cotizador de la web.',
  servicio: 'Hola Xapiensys, me interesa el servicio de',
  sector: 'Hola Xapiensys, tengo un negocio del rubro',
  demo: 'Hola Xapiensys, vi la demo de',
  chat: 'Hola Xapiensys, vengo del asistente de la web.',
};

export interface WhatsAppOptions {
  intent?: WhatsAppIntent;
  /** Complemento del mensaje (ej. nombre del servicio o resumen de la cotización). */
  topic?: string;
  /** Código de lead `XP-####` para unir la conversación con el registro en BD. */
  leadCode?: string;
}

/** Único constructor de enlaces a WhatsApp del sitio. */
export function buildWhatsAppUrl({
  intent = 'general',
  topic,
  leadCode,
}: WhatsAppOptions = {}): string {
  let text = baseMessages[intent];
  if (topic) text += ` ${topic}`;
  if (!/[.!?]$/.test(text)) text += '.';
  if (leadCode) text += ` Mi código es ${leadCode}.`;
  return `https://wa.me/${site.phone.whatsapp}?text=${encodeURIComponent(text)}`;
}
