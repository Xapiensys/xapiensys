/**
 * Contenido del chat que se arma en el build desde `src/content`: sugerencias iniciales y
 * respuestas fijas del modo guiado (cuando la IA no está disponible o se alcanzó un límite).
 */
import { getCollection } from 'astro:content';
import { buildWhatsAppUrl } from './whatsapp';
import { formatSoles } from './quoteOptions';

export interface GuidedTopic {
  label: string;
  answer: string;
  links: { label: string; href: string }[];
}

export const chatSuggestions = [
  '¿Qué servicios ofrecen?',
  '¿Cuánto cuesta una web con chatbot?',
  'Quiero automatizar mi atención por WhatsApp',
  'Pon música para trabajar',
];

let cached: GuidedTopic[] | null = null;

export async function getGuidedTopics(): Promise<GuidedTopic[]> {
  if (cached) return cached;
  const servicios = (await getCollection('servicios')).sort((a, b) => a.data.order - b.data.order);
  cached = [
    {
      label: 'Ver servicios',
      answer: servicios.map((s) => `• ${s.data.title}: ${s.data.summary}`).join('\n'),
      links: servicios.map((s) => ({ label: s.data.title, href: `/servicios/${s.id}` })),
    },
    {
      label: '¿Cuánto cuesta?',
      answer: servicios
        .map(
          (s) =>
            `• ${s.data.title}: ${s.data.priceFrom ? `desde ${formatSoles(s.data.priceFrom)}` : 'requiere diagnóstico'}`,
        )
        .join('\n'),
      links: [{ label: 'Calcular mi rango', href: '/cotizar' }],
    },
    {
      label: 'Hablar con el equipo',
      answer: 'Te atiende una persona del equipo por WhatsApp.',
      links: [{ label: 'Abrir WhatsApp', href: buildWhatsAppUrl({ intent: 'chat' }) }],
    },
  ];
  return cached;
}
