/**
 * Contenido del chat que se arma en el build desde `src/content`: sugerencias iniciales y
 * respuestas fijas del modo guiado (cuando la IA no está disponible o se alcanzó un límite).
 */
import { getCollection } from 'astro:content';
import { buildWhatsAppUrl } from './whatsapp';

export interface GuidedTopic {
  label: string;
  answer: string;
  links: { label: string; href: string }[];
}

export const chatSuggestions = [
  '¿Qué servicios ofrecen?',
  'Quiero cotizar una web con chatbot',
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
      label: 'Quiero cotizar',
      answer:
        'Cada proyecto se cotiza a tu medida: cuéntanos qué necesitas por WhatsApp o en el cotizador y te enviamos una propuesta por escrito, sin compromiso.',
      links: [
        { label: 'Cotizar por WhatsApp', href: buildWhatsAppUrl({ intent: 'cotizacion' }) },
        { label: 'Usar el cotizador', href: '/cotizar' },
      ],
    },
    {
      label: 'Hablar con el equipo',
      answer: 'Te atiende una persona del equipo por WhatsApp.',
      links: [{ label: 'Abrir WhatsApp', href: buildWhatsAppUrl({ intent: 'chat' }) }],
    },
  ];
  return cached;
}
