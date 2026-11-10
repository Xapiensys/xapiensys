/**
 * Imágenes propias de la marca (generadas con IA para Xapiensys, no de stock), una por
 * servicio y por sector. Fuente única para tarjetas y héroes de página.
 */
import type { ImageMetadata } from 'astro';
import web from '@/assets/marca/web.webp';
import chatbot from '@/assets/marca/chatbot.webp';
import automation from '@/assets/marca/automation.webp';
import lima from '@/assets/marca/lima.webp';
import tienda from '@/assets/marca/tienda.webp';
import cubo3d from '@/assets/marca/3d.webp';
import clinicas from '@/assets/marca/sector-clinicas.webp';
import constructoras from '@/assets/marca/sector-constructoras.webp';
import comercios from '@/assets/marca/sector-comercios.webp';
import lanzamiento from '@/assets/marca/lanzamiento.webp';
import secValor from '@/assets/marca/seccion-valor.webp';
import secProceso from '@/assets/marca/seccion-proceso.webp';
import secPrecios from '@/assets/marca/seccion-precios.webp';
import secFaq from '@/assets/marca/seccion-faq.webp';
import secProblemas from '@/assets/marca/seccion-problemas.webp';
import secEntregables from '@/assets/marca/seccion-entregables.webp';
import secDiagnostico from '@/assets/marca/seccion-diagnostico.webp';
import secVelocidad from '@/assets/marca/seccion-velocidad.webp';
import secContacto from '@/assets/marca/seccion-contacto.webp';
import pagEmpresa from '@/assets/marca/pagina-empresa.webp';
import pagGracias from '@/assets/marca/pagina-gracias.webp';
import pagPerdido from '@/assets/marca/pagina-perdido.webp';
import pagPrivacidad from '@/assets/marca/pagina-privacidad.webp';

export interface Visual {
  src: ImageMetadata;
  alt: string;
}

export const serviceVisuals: Record<string, Visual> = {
  'paginas-web': {
    src: web,
    alt: 'Portátil flotante mostrando una página web moderna y rápida con paneles de cristal',
  },
  'tiendas-virtuales': {
    src: tienda,
    alt: 'Teléfono de cristal con una tienda en línea, carrito de compras y paquete flotando',
  },
  'experiencias-3d': {
    src: cubo3d,
    alt: 'Cubo y cristal 3D translúcidos con anillos luminosos en tonos cian y violeta',
  },
  'chatbots-ia': {
    src: chatbot,
    alt: 'Teléfono con burbujas de chat y un asistente de inteligencia artificial',
  },
  automatizacion: {
    src: automation,
    alt: 'Flujo de automatización con nodos de cristal conectados por haces de luz',
  },
  'sistemas-a-medida': {
    src: lima,
    alt: 'Ingeniero trabajando de noche con vista a la costa de Lima, Perú',
  },
};

export const sectorVisuals: Record<string, Visual> = {
  clinicas: {
    src: clinicas,
    alt: 'Clínica dental moderna con calendario de citas, chat de confirmación en el celular e íconos de salud',
  },
  constructoras: {
    src: constructoras,
    alt: 'Edificio holográfico en construcción con grúa, planos por capas y paneles de avance y costos',
  },
  comercios: {
    src: comercios,
    alt: 'Tienda y restaurante con catálogo en el celular, pedidos y bolsa de compras camino a delivery',
  },
};

export const launchVisual: Visual = {
  src: lanzamiento,
  alt: 'Portátil con un panel de crecimiento y celular con chat, con haces de luz que suben',
};

/** Imágenes de sección: ninguna sección queda solo con texto. */
export const sectionVisuals = {
  valor: {
    src: secValor,
    alt: 'Una web antigua y estática frente a un sistema moderno con panel, chat y métricas',
  },
  proceso: {
    src: secProceso,
    alt: 'Camino de luz con cinco etapas: diagnóstico, diseño, desarrollo, revisión y lanzamiento',
  },
  precios: {
    src: secPrecios,
    alt: 'Calculadora de cristal, etiquetas de precio y gráfico en alza: precios claros',
  },
  faq: {
    src: secFaq,
    alt: 'Signo de pregunta de cristal rodeado de burbujas de chat que se convierten en respuestas',
  },
  problemas: {
    src: secProblemas,
    alt: 'Celular con una web lenta, alertas y mensajes sin responder acumulándose',
  },
  entregables: {
    src: secEntregables,
    alt: 'Lista de verificación completa rodeada de íconos de celular, búsqueda, chat, seguridad y métricas',
  },
  velocidad: {
    src: secVelocidad,
    alt: 'Velocímetro al máximo, un rayo y un celular: una web que carga al instante',
  },
  contacto: {
    src: secContacto,
    alt: 'Dos celulares conectados por un haz de luz con mensajes y un apretón de manos',
  },
  diagnostico: {
    src: secDiagnostico,
    alt: 'Lupa que escanea una página web y muestra indicadores de rendimiento',
  },
} satisfies Record<string, Visual>;

/** Imágenes de páginas institucionales. */
export const pageVisuals = {
  empresa: {
    src: pagEmpresa,
    alt: 'Estudio de ingeniería digital frente a la costa de Lima al anochecer, con pantallas y paneles de datos',
  },
  gracias: {
    src: pagGracias,
    alt: 'Marca de verificación luminosa con un mensaje enviado en el celular y un cohete despegando',
  },
  perdido: {
    src: pagPerdido,
    alt: 'Ventana de navegador flotando en el espacio con una brújula y un camino de luz de regreso a casa',
  },
  privacidad: {
    src: pagPrivacidad,
    alt: 'Escudo con candado que protege documentos y perfiles de usuario',
  },
} satisfies Record<string, Visual>;
