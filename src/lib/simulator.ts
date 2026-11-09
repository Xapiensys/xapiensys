/**
 * Simulador de página web: tipos, rubros, estilos y una plantilla de respaldo por rubro.
 * Se usa en el cliente (vista previa) y en el servidor (/api/simulate). Sin dependencias.
 */

export const RUBROS = [
  { id: 'restaurante', label: 'Restaurante o cafetería' },
  { id: 'clinica', label: 'Clínica o consultorio' },
  { id: 'construccion', label: 'Constructora o inmobiliaria' },
  { id: 'comercio', label: 'Tienda o comercio' },
  { id: 'servicios', label: 'Estudio profesional (abogados, contadores)' },
  { id: 'belleza', label: 'Salón de belleza o spa' },
  { id: 'gimnasio', label: 'Gimnasio o centro deportivo' },
  { id: 'educacion', label: 'Academia o colegio' },
  { id: 'hotel', label: 'Hotel u hospedaje' },
  { id: 'otro', label: 'Otro rubro' },
] as const;

export type RubroId = (typeof RUBROS)[number]['id'];

export const STYLES = [
  { id: 'ejecutivo', label: 'Ejecutivo oscuro' },
  { id: 'fresco', label: 'Fresco y claro' },
  { id: 'vibrante', label: 'Vibrante' },
  { id: 'elegante', label: 'Elegante' },
] as const;

export type StyleId = (typeof STYLES)[number]['id'];

export interface SimInput {
  business: string;
  rubro: RubroId;
  description: string;
  style: StyleId;
}

export interface SimContent {
  tagline: string;
  heroTitle: string;
  heroSubtitle: string;
  ctaLabel: string;
  services: { title: string; text: string }[];
  highlights: string[];
  about: string;
}

type Base = Omit<SimContent, 'tagline' | 'about'> & { about: (n: string) => string };

const TEMPLATES: Record<RubroId, Base> = {
  restaurante: {
    heroTitle: 'Sabores que se recuerdan, pedidos en un clic',
    heroSubtitle: 'Mira la carta, reserva tu mesa o pide delivery directo por WhatsApp.',
    ctaLabel: 'Ver la carta',
    services: [
      { title: 'Carta digital', text: 'Platos con foto, precio y disponibilidad del día.' },
      { title: 'Reservas', text: 'Elige día, hora y número de personas en segundos.' },
      { title: 'Delivery', text: 'Tu pedido armado llega directo a nuestro WhatsApp.' },
    ],
    highlights: ['Pedidos por WhatsApp', 'Reservas en línea', 'Carta siempre al día'],
    about: (n) => `En ${n} cocinamos con ingredientes frescos y atención cercana.`,
  },
  clinica: {
    heroTitle: 'Tu salud, atendida a tiempo',
    heroSubtitle: 'Agenda tu cita en línea y recibe recordatorios sin llamar.',
    ctaLabel: 'Agendar cita',
    services: [
      { title: 'Consultas', text: 'Especialistas con horarios visibles y citas en línea.' },
      { title: 'Chequeos preventivos', text: 'Paquetes claros, con precio y preparación.' },
      { title: 'Resultados', text: 'Te avisamos cuando tus resultados estén listos.' },
    ],
    highlights: ['Citas 24/7', 'Recordatorios automáticos', 'Atención por WhatsApp'],
    about: (n) => `${n} combina atención humana con procesos digitales simples.`,
  },
  construccion: {
    heroTitle: 'Construimos lo que imaginas, con plazos claros',
    heroSubtitle: 'Mira nuestras obras y pide tu presupuesto con los datos de tu proyecto.',
    ctaLabel: 'Pedir presupuesto',
    services: [
      { title: 'Construcción', text: 'Viviendas y locales con supervisión en cada etapa.' },
      { title: 'Remodelación', text: 'Cocinas, baños y fachadas con acabados a elección.' },
      { title: 'Supervisión', text: 'Control de avance, costos y calidad de obra.' },
    ],
    highlights: ['Presupuesto detallado', 'Portafolio de obras', 'Seguimiento por etapas'],
    about: (n) => `En ${n} cuidamos cada metro cuadrado como si fuera nuestro.`,
  },
  comercio: {
    heroTitle: 'Todo lo que buscas, a un mensaje de distancia',
    heroSubtitle: 'Explora el catálogo, arma tu pedido y confírmalo por WhatsApp.',
    ctaLabel: 'Ver catálogo',
    services: [
      { title: 'Catálogo en línea', text: 'Productos con precio, stock y filtros por categoría.' },
      { title: 'Pedidos fáciles', text: 'Carrito simple que envía el pedido ordenado.' },
      { title: 'Envíos', text: 'Delivery o recojo en tienda, tú eliges.' },
    ],
    highlights: ['Catálogo actualizado', 'Pedido en 1 minuto', 'Pago al recibir'],
    about: (n) => `${n} te atiende rápido, con precios claros y stock real.`,
  },
  servicios: {
    heroTitle: 'Asesoría profesional que te da tranquilidad',
    heroSubtitle: 'Cuéntanos tu caso y agenda una primera conversación sin compromiso.',
    ctaLabel: 'Agendar consulta',
    services: [
      { title: 'Asesoría', text: 'Te explicamos tu situación en lenguaje claro.' },
      { title: 'Gestión', text: 'Trámites y documentos de principio a fin.' },
      { title: 'Seguimiento', text: 'Te mantenemos al tanto de cada avance.' },
    ],
    highlights: ['Primera consulta ágil', 'Respuesta en el día', 'Casos confidenciales'],
    about: (n) => `${n} acompaña a personas y empresas con criterio y cercanía.`,
  },
  belleza: {
    heroTitle: 'Tu mejor versión empieza con una reserva',
    heroSubtitle: 'Elige tu servicio, tu especialista y tu horario en segundos.',
    ctaLabel: 'Reservar turno',
    services: [
      { title: 'Cabello', text: 'Cortes, color y tratamientos con productos de calidad.' },
      { title: 'Uñas', text: 'Manicure y pedicure con diseños a tu gusto.' },
      { title: 'Spa', text: 'Masajes y faciales para desconectarte.' },
    ],
    highlights: ['Reservas en línea', 'Recordatorio por WhatsApp', 'Promos del mes'],
    about: (n) => `En ${n} te atendemos con calma, detalle y buena energía.`,
  },
  gimnasio: {
    heroTitle: 'Entrena con un plan, no a ciegas',
    heroSubtitle: 'Horarios, planes y tu primera clase de prueba en un solo lugar.',
    ctaLabel: 'Probar una clase',
    services: [
      { title: 'Planes', text: 'Mensual, trimestral o anual, con precios claros.' },
      { title: 'Clases', text: 'Funcional, spinning y más, con horarios en línea.' },
      { title: 'Entrenador', text: 'Rutinas personalizadas según tu objetivo.' },
    ],
    highlights: ['Clase de prueba', 'Horarios en línea', 'Pagos simples'],
    about: (n) => `${n} es tu lugar para avanzar con constancia y acompañamiento.`,
  },
  educacion: {
    heroTitle: 'Aprende con quienes te acompañan de verdad',
    heroSubtitle: 'Conoce cursos, horarios y matrícula, y resuelve tus dudas al instante.',
    ctaLabel: 'Ver cursos',
    services: [
      { title: 'Cursos', text: 'Programas con temario, duración y certificado.' },
      { title: 'Matrícula', text: 'Inscríbete en línea y reserva tu vacante.' },
      { title: 'Tutorías', text: 'Refuerzo personalizado cuando lo necesites.' },
    ],
    highlights: ['Matrícula en línea', 'Vacantes limitadas', 'Clases presenciales y virtuales'],
    about: (n) => `En ${n} enseñamos con método, paciencia y resultados.`,
  },
  hotel: {
    heroTitle: 'Descansa como en casa, lejos de casa',
    heroSubtitle: 'Mira habitaciones, consulta disponibilidad y reserva directo.',
    ctaLabel: 'Ver disponibilidad',
    services: [
      { title: 'Habitaciones', text: 'Fotos, servicios incluidos y precio por noche.' },
      { title: 'Reservas directas', text: 'Sin comisiones de intermediarios.' },
      { title: 'Experiencias', text: 'Tours y recomendaciones de la zona.' },
    ],
    highlights: ['Reserva directa', 'Mejor precio garantizado', 'Atención 24 horas'],
    about: (n) => `${n} te recibe con comodidad, limpieza y trato amable.`,
  },
  otro: {
    heroTitle: 'Lo que necesitas, explicado simple',
    heroSubtitle: 'Conoce lo que hacemos y escríbenos: te respondemos rápido.',
    ctaLabel: 'Conversemos',
    services: [
      { title: 'Lo que ofrecemos', text: 'Servicios claros, con precios y tiempos.' },
      { title: 'Cómo trabajamos', text: 'Un proceso simple, de la consulta a la entrega.' },
      { title: 'Atención', text: 'Respuesta rápida por WhatsApp y formulario.' },
    ],
    highlights: ['Respuesta rápida', 'Precios claros', 'Atención personalizada'],
    about: (n) => `${n} trabaja para que tus clientes te encuentren y te elijan.`,
  },
};

/** Contenido de respaldo (sin IA): siempre hay una vista previa. */
export function templateContent(input: Pick<SimInput, 'business' | 'rubro'>): SimContent {
  const t = TEMPLATES[input.rubro] ?? TEMPLATES.otro;
  const rubro = RUBROS.find((r) => r.id === input.rubro)?.label ?? '';
  return {
    tagline: rubro,
    heroTitle: t.heroTitle,
    heroSubtitle: t.heroSubtitle,
    ctaLabel: t.ctaLabel,
    services: t.services,
    highlights: t.highlights,
    about: t.about(input.business),
  };
}

/** Dominio de ejemplo para la barra del navegador simulado. */
export function fakeDomain(business: string): string {
  const slug = business
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24);
  return `www.${slug || 'tunegocio'}.pe`;
}
