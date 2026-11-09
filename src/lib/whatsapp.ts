import { site } from './site';

export type WhatsAppIntent =
  | 'general'
  | 'consultoria'
  | 'cotizacion'
  | 'servicio'
  | 'sector'
  | 'demo'
  | 'chat'
  | 'web'
  | 'tienda'
  | 'cubo3d'
  | 'chatbot'
  | 'automatizacion'
  | 'sistema'
  | 'simulador';

const baseMessages: Record<WhatsAppIntent, string> = {
  general: 'Hola Xapiensys, quiero conversar sobre una solución digital.',
  consultoria: 'Hola Xapiensys, quiero solicitar una consultoría.',
  cotizacion: 'Hola Xapiensys, acabo de usar el cotizador de la web.',
  servicio: 'Hola Xapiensys, me interesa el servicio de',
  sector: 'Hola Xapiensys, tengo un negocio del rubro',
  demo: 'Hola Xapiensys, vi la demo de',
  chat: 'Hola Xapiensys, vengo del asistente de la web.',
  web: 'Hola, estoy interesado en desarrollar una página web para mi negocio.',
  tienda: 'Hola, quiero información sobre una tienda virtual.',
  cubo3d: 'Hola, quiero información sobre una experiencia web 3D para mi marca.',
  chatbot: 'Hola, quisiera implementar un chatbot con inteligencia artificial.',
  automatizacion: 'Hola, quiero automatizar procesos de mi empresa.',
  sistema: 'Hola, necesito un sistema a medida para mi empresa.',
  simulador: 'Hola Xapiensys, probé el simulador y quiero esta web para mi negocio:',
};

/** Mensaje de WhatsApp preconfigurado por servicio (clave = id de la colección `servicios`). */
export const serviceIntent = (id: string): WhatsAppIntent =>
  (
    ({
      'paginas-web': 'web',
      'tiendas-virtuales': 'tienda',
      'experiencias-3d': 'cubo3d',
      'chatbots-ia': 'chatbot',
      automatizacion: 'automatizacion',
      'sistemas-a-medida': 'sistema',
    }) as Record<string, WhatsAppIntent>
  )[id] ?? 'servicio';

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
