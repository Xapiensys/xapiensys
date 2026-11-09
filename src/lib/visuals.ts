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
